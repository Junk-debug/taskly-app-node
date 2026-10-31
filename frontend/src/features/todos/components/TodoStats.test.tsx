import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import { TodoStats } from './TodoStats'

vi.mock('../../../design-system', () => import('../../../design-system/mocks'))

afterEach(() => vi.useRealTimers())

describe('TodoStats', () => {
  it('renders nothing when there are no tasks', () => {
    const { container } = render(<TodoStats todos={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows only active and completed counts when nothing is late or due', () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 15, 9, 0) })
    render(
      <TodoStats
        todos={[
          { ...todoFixture, due_date: null },
          { ...todoFixture, id: 8, due_date: null, completed: true },
        ]}
      />,
    )
    expect(screen.getByText('1 active · 1 completed')).toBeInTheDocument()
  })

  it('shows only the due-today count when nothing is overdue', () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 15, 9, 0) })
    render(<TodoStats todos={[{ ...todoFixture, due_date: '2026-10-15' }]} />)
    expect(
      screen.getByText('1 active · 0 completed · 1 due today'),
    ).toBeInTheDocument()
  })

  it('shows only the overdue count when nothing is due today', () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 15, 9, 0) })
    render(<TodoStats todos={[{ ...todoFixture, due_date: '2026-10-14' }]} />)
    expect(
      screen.getByText('1 active · 0 completed · 1 overdue'),
    ).toBeInTheDocument()
  })

  it('adds overdue and due-today counts when present', () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 15, 9, 0) })
    render(
      <TodoStats
        todos={[
          { ...todoFixture, id: 1, due_date: '2026-10-14' },
          { ...todoFixture, id: 2, due_date: '2026-10-15' },
          { ...todoFixture, id: 3, due_date: '2026-10-15' },
        ]}
      />,
    )
    expect(
      screen.getByText('3 active · 0 completed · 1 overdue · 2 due today'),
    ).toBeInTheDocument()
  })
})
