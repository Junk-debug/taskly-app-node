import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import { todosApi } from '../api/todos'
import { useCreateTodoMutation } from './useCreateTodoMutation'
import { useDeleteTodoMutation } from './useDeleteTodoMutation'
import { useTodosBusy } from './useTodosBusy'

vi.mock('../api/todos', () => ({
  todosApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}))
beforeEach(() => vi.clearAllMocks())

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return { wrapper }
}

const input = {
  title: 'New task',
  description: '',
  priority: 'low' as const,
  due_date: null,
  completed: false,
}

it('is false when no mutation is running', () => {
  const { wrapper } = setup()
  const { result } = renderHook(() => useTodosBusy(), { wrapper })
  expect(result.current).toBe(false)
})

it('is true while a create is pending and false after it settles', async () => {
  const { wrapper } = setup()
  let resolve: (value: typeof todoFixture) => void = () => {}
  vi.mocked(todosApi.create).mockReturnValue(
    new Promise((r) => {
      resolve = r
    }),
  )
  const { result } = renderHook(
    () => ({ busy: useTodosBusy(), create: useCreateTodoMutation() }),
    { wrapper },
  )
  act(() => result.current.create.mutate(input))
  await waitFor(() => expect(result.current.busy).toBe(true))
  await act(async () => resolve(todoFixture))
  await waitFor(() => expect(result.current.busy).toBe(false))
})

it('is true while a delete is pending', async () => {
  const { wrapper } = setup()
  vi.mocked(todosApi.remove).mockReturnValue(new Promise(() => {}))
  const { result } = renderHook(
    () => ({ busy: useTodosBusy(), remove: useDeleteTodoMutation() }),
    { wrapper },
  )
  act(() => result.current.remove.mutate(7))
  await waitFor(() => expect(result.current.busy).toBe(true))
})
