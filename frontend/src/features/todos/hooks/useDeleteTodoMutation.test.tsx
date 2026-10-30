import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import { todoKeys } from '../api/queryKeys'
import { todosApi } from '../api/todos'
import { useDeleteTodoMutation } from './useDeleteTodoMutation'

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
  return { client, wrapper }
}

it('removes only the deleted task from the cached list', async () => {
  const { client, wrapper } = setup()
  const kept = { ...todoFixture, id: 1 }
  const deleted = { ...todoFixture, id: 2 }
  client.setQueryData(todoKeys.list, [kept, deleted])
  vi.mocked(todosApi.remove).mockResolvedValue(undefined)
  const { result } = renderHook(() => useDeleteTodoMutation(), { wrapper })
  await result.current.mutateAsync(2)
  expect(todosApi.remove).toHaveBeenCalledWith(2)
  expect(client.getQueryData(todoKeys.list)).toEqual([kept])
})

it('does not create a list when nothing is cached', async () => {
  const { client, wrapper } = setup()
  vi.mocked(todosApi.remove).mockResolvedValue(undefined)
  const { result } = renderHook(() => useDeleteTodoMutation(), { wrapper })
  await result.current.mutateAsync(2)
  expect(client.getQueryData(todoKeys.list)).toBeUndefined()
})

it('exposes the API error and keeps the task in the cache', async () => {
  const { client, wrapper } = setup()
  client.setQueryData(todoKeys.list, [todoFixture])
  vi.mocked(todosApi.remove).mockRejectedValue(new Error('Task not found.'))
  const { result } = renderHook(() => useDeleteTodoMutation(), { wrapper })
  result.current.mutate(todoFixture.id)
  await waitFor(() =>
    expect(result.current.error?.message).toBe('Task not found.'),
  )
  expect(client.getQueryData(todoKeys.list)).toEqual([todoFixture])
})
