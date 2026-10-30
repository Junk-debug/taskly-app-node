import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import type { Todo } from '../types'
import { TodoList } from './TodoList'

vi.mock('../../../design-system', () => import('../../../design-system/mocks'))
vi.mock('./TodoEmptyState', () => ({
  TodoEmptyState: () => <p>Empty task list</p>,
}))
vi.mock('./TodoItem', () => ({
  TodoItem: (props: {
    todo: Todo
    busy: boolean
    onToggle: () => void
    onEdit: () => void
    onDelete: () => void
  }) => (
    <li>
      {props.todo.title} {props.busy ? 'busy' : 'idle'}
      <button onClick={props.onToggle}>Toggle {props.todo.id}</button>
      <button onClick={props.onEdit}>Edit {props.todo.id}</button>
      <button onClick={props.onDelete}>Delete {props.todo.id}</button>
    </li>
  ),
}))

const props = {
  todos: [] as Todo[],
  hasTodos: false,
  loading: false,
  failed: false,
  busy: false,
  onCreate: vi.fn(),
  onToggle: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
}

it('shows an unavailable message when loading failed and nothing is cached', () => {
  render(<TodoList {...props} failed />)
  expect(
    screen.getByRole('heading', {
      name: 'The task list is temporarily unavailable',
    }),
  ).toBeVisible()
  expect(screen.queryByText('Empty task list')).not.toBeInTheDocument()
})

it('keeps showing cached tasks when a refetch failed', () => {
  render(<TodoList {...props} failed hasTodos todos={[todoFixture]} />)
  expect(screen.getByText(/Prepare a demo/)).toBeVisible()
  expect(screen.queryByRole('heading')).not.toBeInTheDocument()
})

it('renders each task and forwards the clicked task to the handlers', async () => {
  const user = userEvent.setup()
  const other = { ...todoFixture, id: 8, title: 'Second' }
  const onToggle = vi.fn()
  const onEdit = vi.fn()
  const onDelete = vi.fn()
  render(
    <TodoList
      {...props}
      hasTodos
      busy
      todos={[todoFixture, other]}
      onToggle={onToggle}
      onEdit={onEdit}
      onDelete={onDelete}
    />,
  )
  expect(screen.getAllByRole('listitem')).toHaveLength(2)
  expect(screen.getByText(/Second busy/)).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Toggle 8' }))
  await user.click(screen.getByRole('button', { name: 'Edit 7' }))
  await user.click(screen.getByRole('button', { name: 'Delete 8' }))
  expect(onToggle).toHaveBeenCalledExactlyOnceWith(other)
  expect(onEdit).toHaveBeenCalledExactlyOnceWith(todoFixture)
  expect(onDelete).toHaveBeenCalledExactlyOnceWith(other)
})

it('shows loading feedback before showing an empty list', () => {
  const { rerender } = render(<TodoList {...props} loading />)
  expect(screen.getByRole('status')).toHaveTextContent('Loading your tasks…')
  expect(screen.queryByText('Empty task list')).not.toBeInTheDocument()
  rerender(<TodoList {...props} loading={false} />)
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(screen.getByText('Empty task list')).toBeVisible()
})
