# Frontend test templates

Starting points that are known to pass. Adapt names and cases; keep the shape.

## Query and mutation hooks

A fresh `QueryClient` per test, no retries, the API module mocked, and the
assertions on both the hook result and the cache.

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import { todoKeys } from '../api/queryKeys'
import { todosApi } from '../api/todos'
import { useCreateTodoMutation } from './useCreateTodoMutation'

vi.mock('../api/todos', () => ({
  todosApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
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

it('puts the created task first in the cached list', async () => {
  const { client, wrapper } = setup()
  const older = { ...todoFixture, id: 1 }
  const saved = { ...todoFixture, id: 2, title: 'New task' }
  client.setQueryData(todoKeys.list, [older])
  vi.mocked(todosApi.create).mockResolvedValue(saved)
  const { result } = renderHook(() => useCreateTodoMutation(), { wrapper })
  await result.current.mutateAsync(saved)
  expect(todosApi.create).toHaveBeenCalledWith(saved)
  expect(client.getQueryData(todoKeys.list)).toEqual([saved, older])
})

it('exposes the API error', async () => {
  const { wrapper } = setup()
  vi.mocked(todosApi.create).mockRejectedValue(new Error('Server down'))
  const { result } = renderHook(() => useCreateTodoMutation(), { wrapper })
  result.current.mutate(todoFixture)
  await waitFor(() => expect(result.current.error?.message).toBe('Server down'))
})
```

For a query hook, render it and `await waitFor(() => expect(result.current.isSuccess).toBe(true))`
before asserting `result.current.data`.

## fetch (`lib/http.ts`)

```ts
import { afterEach, expect, it, vi } from 'vitest'
import { request } from './http'

afterEach(() => vi.unstubAllGlobals())

function respond(status: number, body?: unknown) {
  const fetch = vi.fn().mockResolvedValue(
    new Response(body === undefined ? null : JSON.stringify(body), { status }),
  )
  vi.stubGlobal('fetch', fetch)
  return fetch
}

it('prefixes the path, sends JSON headers and returns the body', async () => {
  const fetch = respond(200, { ok: true })
  await expect(request('/todos', { method: 'POST' })).resolves.toEqual({ ok: true })
  expect(fetch).toHaveBeenCalledWith('/api/todos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
})

it('uses the server detail as the error message', async () => {
  respond(404, { detail: 'Task not found.' })
  await expect(request('/todos/9')).rejects.toThrow('Task not found.')
})
```
