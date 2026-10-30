import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useNotice } from './useNotice'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

it('starts without a notice', () => {
  const { result } = renderHook(() => useNotice())
  expect(result.current.message).toBe('')
})

it('shows a notice and clears it after four seconds', () => {
  const { result } = renderHook(() => useNotice())
  act(() => result.current.notify('Task saved.'))
  expect(result.current.message).toBe('Task saved.')
  act(() => vi.advanceTimersByTime(3999))
  expect(result.current.message).toBe('Task saved.')
  act(() => vi.advanceTimersByTime(1))
  expect(result.current.message).toBe('')
})

it('restarts the timer when a new notice replaces the current one', () => {
  const { result } = renderHook(() => useNotice())
  act(() => result.current.notify('First'))
  act(() => vi.advanceTimersByTime(3000))
  act(() => result.current.notify('Second'))
  act(() => vi.advanceTimersByTime(3000))
  expect(result.current.message).toBe('Second')
  act(() => vi.advanceTimersByTime(1000))
  expect(result.current.message).toBe('')
})

it('restarts the timer when the same message is shown again', () => {
  const { result } = renderHook(() => useNotice())
  act(() => result.current.notify('Same'))
  act(() => vi.advanceTimersByTime(3000))
  act(() => result.current.notify('Same'))
  act(() => vi.advanceTimersByTime(3000))
  expect(result.current.message).toBe('Same')
  act(() => vi.advanceTimersByTime(1000))
  expect(result.current.message).toBe('')
})

it('cancels the pending timer on unmount', () => {
  const { result, unmount } = renderHook(() => useNotice())
  act(() => result.current.notify('Bye'))
  unmount()
  expect(vi.getTimerCount()).toBe(0)
})
