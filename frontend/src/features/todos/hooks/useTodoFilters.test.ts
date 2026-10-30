import { act, renderHook } from '@testing-library/react'
import { expect, it } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import { useTodoFilters } from './useTodoFilters'

const open = { ...todoFixture, id: 1, title: 'Write report' }
const done = { ...todoFixture, id: 2, title: 'Buy milk', completed: true }
const todos = [open, done]

it('starts with all tasks, empty search and newest sort', () => {
  const newer = { ...todoFixture, id: 1, created_at: '2026-10-03T00:00:00Z' }
  const older = { ...todoFixture, id: 2, created_at: '2026-10-01T00:00:00Z' }
  const { result } = renderHook(() => useTodoFilters([older, newer]))
  expect(result.current.filter).toBe('all')
  expect(result.current.search).toBe('')
  expect(result.current.sort).toBe('newest')
  expect(result.current.visible).toEqual([newer, older])
})

it('narrows the visible tasks by status filter', () => {
  const { result } = renderHook(() => useTodoFilters(todos))
  act(() => result.current.setFilter('completed'))
  expect(result.current.filter).toBe('completed')
  expect(result.current.visible).toEqual([done])
  act(() => result.current.setFilter('active'))
  expect(result.current.visible).toEqual([open])
})

it('narrows the visible tasks by search text', () => {
  const { result } = renderHook(() => useTodoFilters(todos))
  act(() => result.current.setSearch('REPORT'))
  expect(result.current.search).toBe('REPORT')
  expect(result.current.visible).toEqual([open])
})

it('reorders the visible tasks when the sort changes', () => {
  const high = { ...todoFixture, id: 3, priority: 'high' as const }
  const low = { ...todoFixture, id: 4, priority: 'low' as const }
  const { result } = renderHook(() => useTodoFilters([low, high]))
  act(() => result.current.setSort('priority'))
  expect(result.current.sort).toBe('priority')
  expect(result.current.visible).toEqual([high, low])
})

it('recomputes the visible tasks when the input list changes', () => {
  const { result, rerender } = renderHook(({ list }) => useTodoFilters(list), {
    initialProps: { list: [open] },
  })
  rerender({ list: [open, done] })
  expect(result.current.visible).toEqual([done, open])
})
