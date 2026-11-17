import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { GmailInboxCard } from './GmailInboxCard'
import type { GmailSettings } from '@/lib/gmail/settings'

const mocks = vi.hoisted(() => ({ disconnect: vi.fn(), refresh: vi.fn() }))
vi.mock('@/lib/actions/gmail', () => ({ disconnectGmail: mocks.disconnect }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }))

const settings: GmailSettings = {
  account_email: 'owner@example.test', connected: true, scan_frequency: 'manual',
  scan_time: '08:00:00', scan_timezone: 'UTC', scan_batch_size: 50, auto_scan_consent: false,
}

beforeEach(() => vi.resetAllMocks())

describe('Gmail settings', () => {
  it('does not offer connection before server configuration is ready', () => {
    render(<GmailInboxCard available={false} settings={null} />)
    expect(screen.queryByRole('link', { name: 'Connect Gmail' })).not.toBeInTheDocument()
    expect(screen.getByText('Gmail setup is not yet available on this server.')).toBeInTheDocument()
  })

  it('shows the connected account and scan preferences', () => {
    render(<GmailInboxCard available settings={settings} />)
    expect(screen.getByText('Connected as owner@example.test')).toBeInTheDocument()
    expect(screen.getByLabelText('Schedule')).toHaveValue('manual')
    expect(screen.getByLabelText('Messages per scan')).toHaveValue('50')
  })

  it('handles disconnection with feedback and refreshed state', async () => {
    mocks.disconnect.mockResolvedValue({})
    render(<GmailInboxCard available settings={settings} />)
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect Gmail' }))
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce())
    expect(screen.getByText('Gmail disconnected.')).toBeInTheDocument()
  })
})
