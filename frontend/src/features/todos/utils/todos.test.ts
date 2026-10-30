import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  countCompleted,
  formatDate,
  isOverdue,
  selectTodos,
  validateTodo,
} from './todos'
import type { Todo, TodoInput } from '../types'

const base: Todo = {
  id: 1,
  title: 'Sprint plan',
  description: '',
  priority: 'medium',
  completed: false,
  due_date: null,
  created_at: '2026-10-01T12:00:00Z',
  updated_at: '2026-10-01T12:00:00Z',
}

const input: TodoInput = {
  title: 'Sprint plan',
  description: '',
  priority: 'medium',
  due_date: null,
  completed: false,
}

afterEach(() => vi.useRealTimers())

describe('selectTodos', () => {
  it('combines status with a case-insensitive search in the description', () => {
    const matching = { ...base, description: 'Discuss the API' }
    const todos = [
      matching,
      { ...matching, id: 2, completed: true },
      { ...base, id: 3 },
    ]
    expect(selectTodos(todos, 'active', ' api ', 'newest')).toEqual([matching])
  })

  it('keeps only completed tasks for the completed filter', () => {
    const done = { ...base, id: 2, completed: true }
    expect(selectTodos([base, done], 'completed', '', 'newest')).toEqual([done])
  })

  it('sorts by priority without changing the source array', () => {
    const high: Todo = { ...base, id: 2, priority: 'high' }
    const todos = [base, high]
    expect(selectTodos(todos, 'all', '', 'priority')).toEqual([high, base])
    expect(todos).toEqual([base, high])
  })

  it('sorts equal priorities by newest id first', () => {
    const second = { ...base, id: 2 }
    expect(selectTodos([base, second], 'all', '', 'priority')).toEqual([
      second,
      base,
    ])
  })

  it('sorts by due date and puts tasks without a due date last', () => {
    const noDate = { ...base, id: 1 }
    const late = { ...base, id: 2, due_date: '2026-12-01' }
    const early = { ...base, id: 3, due_date: '2026-11-01' }
    const earlyNewer = { ...base, id: 4, due_date: '2026-11-01' }
    expect(
      selectTodos([noDate, late, early, earlyNewer], 'all', '', 'due'),
    ).toEqual([earlyNewer, early, late, noDate])
  })

  it('sorts newest first by creation time, then by id', () => {
    const older = { ...base, id: 1 }
    const newer = { ...base, id: 2, created_at: '2026-10-02T12:00:00Z' }
    const sameTimeHigherId = { ...base, id: 3 }
    expect(
      selectTodos([older, newer, sameTimeHigherId], 'all', '', 'newest'),
    ).toEqual([newer, sameTimeHigherId, older])
  })
})

describe('validateTodo', () => {
  it('returns no errors for a valid task', () => {
    expect(validateTodo({ ...input, due_date: '2026-10-14' })).toEqual({})
  })

  it('requires a non-blank title', () => {
    expect(validateTodo({ ...input, title: '   ' })).toEqual({
      title: 'Enter a task title.',
    })
  })

  it.each([
    [120, false],
    [121, true],
  ])('title of %i characters → too long %s', (length, tooLong) => {
    const errors = validateTodo({ ...input, title: 'a'.repeat(length) })
    expect(errors.title).toBe(
      tooLong ? 'The title must be at most 120 characters.' : undefined,
    )
  })

  it('ignores surrounding spaces when measuring the title length', () => {
    const title = ` ${'a'.repeat(120)} `
    expect(validateTodo({ ...input, title })).toEqual({})
  })

  it.each([
    [2000, false],
    [2001, true],
  ])('description of %i characters → too long %s', (length, tooLong) => {
    const errors = validateTodo({ ...input, description: 'a'.repeat(length) })
    expect(errors.description).toBe(
      tooLong ? 'The description must be at most 2000 characters.' : undefined,
    )
  })

  it.each(['not-a-date', '2026-13-01', '2026-02-30', '26-10-14'])(
    'rejects the due date %s',
    (due_date) => {
      expect(validateTodo({ ...input, due_date })).toEqual({
        due_date: 'Enter a valid date.',
      })
    },
  )
})

describe('isOverdue', () => {
  it.each([
    ['2026-10-14', false, true],
    ['2026-10-15', false, false],
    ['2026-10-16', false, false],
    ['2026-10-14', true, false],
    [null, false, false],
  ])('due %s, completed %s → overdue %s', (due_date, completed, expected) => {
    vi.useFakeTimers({ now: new Date(2026, 9, 15, 9, 0) })
    expect(isOverdue({ ...base, due_date, completed })).toBe(expected)
  })
})

describe('countCompleted', () => {
  it('counts only completed tasks', () => {
    const todos = [
      base,
      { ...base, id: 2, completed: true },
      { ...base, id: 3, completed: true },
    ]
    expect(countCompleted(todos)).toBe(2)
  })

  it('returns 0 for an empty list', () => {
    expect(countCompleted([])).toBe(0)
  })
})

describe('formatDate', () => {
  it('formats an ISO date as day, short month and year', () => {
    expect(formatDate('2026-10-14')).toBe('14 Oct 2026')
  })
})
