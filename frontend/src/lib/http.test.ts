import { afterEach, expect, it, vi } from 'vitest'
import { request } from './http'

afterEach(() => vi.unstubAllGlobals())

function respond(status: number, body?: unknown) {
  const fetch = vi.fn().mockResolvedValue(
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
    }),
  )
  vi.stubGlobal('fetch', fetch)
  return fetch
}

it('prefixes the path, sends JSON headers and returns the body', async () => {
  const fetch = respond(200, { ok: true })
  await expect(request('/todos', { method: 'POST' })).resolves.toEqual({
    ok: true,
  })
  expect(fetch).toHaveBeenCalledWith('/api/todos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
})

it('lets caller headers override and extend the defaults', async () => {
  const fetch = respond(200, {})
  await request('/todos', {
    headers: { 'Content-Type': 'text/plain', 'X-Test': '1' },
  })
  expect(fetch).toHaveBeenCalledWith('/api/todos', {
    headers: { 'Content-Type': 'text/plain', 'X-Test': '1' },
  })
})

it('returns undefined for 204 without parsing a body', async () => {
  respond(204)
  await expect(
    request('/todos/1', { method: 'DELETE' }),
  ).resolves.toBeUndefined()
})

it('uses the server detail as the error message', async () => {
  respond(404, { detail: 'Task not found.' })
  await expect(request('/todos/9')).rejects.toThrow('Task not found.')
})

it('shows the validation hint for 422 even when a detail is sent', async () => {
  respond(422, { detail: 'raw validation error' })
  await expect(request('/todos', { method: 'POST' })).rejects.toThrow(
    'Check the task details: title up to 120 characters, description up to 2000 characters, and a valid due date.',
  )
})

it.each([
  ['a non-string detail', { detail: ['x'] }],
  ['a body without detail', { message: 'nope' }],
  ['a non-JSON body', undefined],
])('falls back to a generic message for %s', async (_name, body) => {
  respond(500, body)
  await expect(request('/todos')).rejects.toThrow(
    'The operation failed. Please try again.',
  )
})

it('reports a connection problem when fetch fails', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed')))
  await expect(request('/todos')).rejects.toThrow(
    'Cannot connect to the server. Please try again.',
  )
})

it('rethrows the original error when the request was aborted', async () => {
  const controller = new AbortController()
  controller.abort()
  const abortError = new DOMException('Aborted', 'AbortError')
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError))
  await expect(request('/todos', { signal: controller.signal })).rejects.toBe(
    abortError,
  )
})
