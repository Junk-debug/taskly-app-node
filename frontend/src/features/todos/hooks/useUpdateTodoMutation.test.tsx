import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import { todoKeys } from '../api/queryKeys'
import { todosApi } from '../api/todos'
import { useUpdateTodoMutation } from './useUpdateTodoMutation'

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

it('replaces only the updated task in the cached list', async () => {
  const { client, wrapper } = setup()
  const other = { ...todoFixture, id: 1 }
  const saved = { ...todoFixture, id: 2, completed: true }
  client.setQueryData(todoKeys.list, [other, { ...todoFixture, id: 2 }])
  vi.mocked(todosApi.update).mockResolvedValue(saved)
  const { result } = renderHook(() => useUpdateTodoMutation(), { wrapper })
  await result.current.mutateAsync({ id: 2, input: { completed: true } })
  expect(todosApi.update).toHaveBeenCalledWith(2, { completed: true })
  expect(client.getQueryData(todoKeys.list)).toEqual([other, saved])
})

it('does not create a list when nothing is cached', async () => {
  const { client, wrapper } = setup()
  vi.mocked(todosApi.update).mockResolvedValue(todoFixture)
  const { result } = renderHook(() => useUpdateTodoMutation(), { wrapper })
  await result.current.mutateAsync({ id: 7, input: { title: 'x' } })
  expect(client.getQueryData(todoKeys.list)).toBeUndefined()
})

it('exposes the API error and keeps the cached task unchanged', async () => {
  const { client, wrapper } = setup()
  client.setQueryData(todoKeys.list, [todoFixture])
  vi.mocked(todosApi.update).mockRejectedValue(new Error('Server down'))
  const { result } = renderHook(() => useUpdateTodoMutation(), { wrapper })
  result.current.mutate({ id: 7, input: { completed: true } })
  await waitFor(() => expect(result.current.error?.message).toBe('Server down'))
  expect(client.getQueryData(todoKeys.list)).toEqual([todoFixture])
})
