import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { GmailInboxCard } from './GmailInboxCard'

const mocks = vi.hoisted(() => ({ save: vi.fn(), disconnect: vi.fn(), refresh: vi.fn() }))
vi.mock('@/lib/actions/gmail', () => ({ updateGmailLabel: mocks.save, disconnectGmail: mocks.disconnect }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }))
const settings = { account_email: 'owner@example.test', connected: true, label_name: 'AI Inbox', start_at: '2026-11-06T10:00:00Z' }
beforeEach(() => vi.resetAllMocks())

describe('Gmail settings', () => {
  it('does not offer connection before server configuration is ready', () => {
    render(<GmailInboxCard available={false} settings={null} />)
    expect(screen.queryByRole('link', { name: 'Connect Gmail' })).not.toBeInTheDocument()
    expect(screen.getByText(/automatic scans and AI analysis are coming/)).toBeInTheDocument()
  })
  it('saves the chosen label and reports server errors without claiming success', async () => {
    mocks.save.mockResolvedValue({ error: 'Connection expired.' })
    render(<GmailInboxCard available settings={settings} />)
    fireEvent.change(screen.getByLabelText('Gmail label'), { target: { value: 'Action emails' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save label' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Connection expired.'))
    expect(mocks.save).toHaveBeenCalledWith('Action emails')
    expect(mocks.refresh).not.toHaveBeenCalled()
  })
  it('handles disconnection with feedback and refreshed state', async () => {
    mocks.disconnect.mockResolvedValue({})
    render(<GmailInboxCard available settings={settings} />)
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect Gmail' }))
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce())
    expect(screen.getByRole('status')).toHaveTextContent('Gmail disconnected.')
  })
})
