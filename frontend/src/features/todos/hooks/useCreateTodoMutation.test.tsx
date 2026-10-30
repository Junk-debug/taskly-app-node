import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import { todoKeys } from '../api/queryKeys'
import { todosApi } from '../api/todos'
import { useCreateTodoMutation } from './useCreateTodoMutation'

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

const input = {
  title: 'New task',
  description: '',
  priority: 'low' as const,
  due_date: null,
  completed: false,
}

it('puts the created task first in the cached list', async () => {
  const { client, wrapper } = setup()
  const older = { ...todoFixture, id: 1 }
  const saved = { ...todoFixture, id: 2, title: 'New task' }
  client.setQueryData(todoKeys.list, [older])
  vi.mocked(todosApi.create).mockResolvedValue(saved)
  const { result } = renderHook(() => useCreateTodoMutation(), { wrapper })
  await result.current.mutateAsync(input)
  expect(todosApi.create).toHaveBeenCalledWith(input)
  expect(client.getQueryData(todoKeys.list)).toEqual([saved, older])
})

it('replaces a cached task with the same id instead of duplicating it', async () => {
  const { client, wrapper } = setup()
  const other = { ...todoFixture, id: 1 }
  const stale = { ...todoFixture, id: 2, title: 'Stale' }
  const saved = { ...todoFixture, id: 2, title: 'Fresh' }
  client.setQueryData(todoKeys.list, [other, stale])
  vi.mocked(todosApi.create).mockResolvedValue(saved)
  const { result } = renderHook(() => useCreateTodoMutation(), { wrapper })
  await result.current.mutateAsync(input)
  expect(client.getQueryData(todoKeys.list)).toEqual([saved, other])
})

it('creates the list from the saved task when nothing is cached', async () => {
  const { client, wrapper } = setup()
  vi.mocked(todosApi.create).mockResolvedValue(todoFixture)
  const { result } = renderHook(() => useCreateTodoMutation(), { wrapper })
  await result.current.mutateAsync(input)
  expect(client.getQueryData(todoKeys.list)).toEqual([todoFixture])
})

it('exposes the API error and leaves the cache untouched', async () => {
  const { client, wrapper } = setup()
  client.setQueryData(todoKeys.list, [todoFixture])
  vi.mocked(todosApi.create).mockRejectedValue(new Error('Server down'))
  const { result } = renderHook(() => useCreateTodoMutation(), { wrapper })
  result.current.mutate(input)
  await waitFor(() => expect(result.current.error?.message).toBe('Server down'))
  expect(client.getQueryData(todoKeys.list)).toEqual([todoFixture])
})
