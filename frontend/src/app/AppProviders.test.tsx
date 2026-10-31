import { QueryClient, useQueryClient } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { useTheme } from 'styled-components'
import { beforeEach, expect, it, vi } from 'vitest'
import { GlobalStyles, theme } from '../design-system/mocks'
import { queryClient } from '../lib/queryClient'
import { AppProviders } from './AppProviders'

vi.mock('../design-system', () => import('../design-system/mocks'))
beforeEach(() => vi.clearAllMocks())

function Probe() {
  const client = useQueryClient()
  const currentTheme = useTheme()
  return (
    <p>
      {String(client === queryClient)}|{String(currentTheme === theme)}
    </p>
  )
}

it('provides the default query client, the theme and global styles', () => {
  render(
    <AppProviders>
      <Probe />
    </AppProviders>,
  )
  expect(screen.getByText('true|true')).toBeVisible()
  expect(GlobalStyles).toHaveBeenCalledTimes(1)
})

it('uses the query client passed as a prop', () => {
  const client = new QueryClient()
  function ClientProbe() {
    return <p>{String(useQueryClient() === client)}</p>
  }
  render(
    <AppProviders client={client}>
      <ClientProbe />
    </AppProviders>,
  )
  expect(screen.getByText('true')).toBeVisible()
})
