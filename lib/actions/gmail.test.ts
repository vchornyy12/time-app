import { beforeEach, describe, expect, it, vi } from 'vitest'
import { updateGmailLabel, disconnectGmail } from './gmail'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), update: vi.fn(), eq: vi.fn(), select: vi.fn(), single: vi.fn(),
  getToken: vi.fn(), revoke: vi.fn(), clear: vi.fn(), revalidate: vi.fn(),
}))
vi.mock('@/lib/actions/authed-action', () => ({ authedClient: mocks.auth }))
vi.mock('@/lib/gmail/config', () => ({ gmailAvailable: () => true }))
vi.mock('@/lib/gmail/integration', () => ({ getGmailRefreshToken: mocks.getToken, clearGmailIntegration: mocks.clear }))
vi.mock('@/lib/google/revoke', () => ({ revokeGoogleToken: mocks.revoke }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }))

beforeEach(() => {
  vi.resetAllMocks()
  const chain = { update: mocks.update, eq: mocks.eq, select: mocks.select, maybeSingle: mocks.single }
  mocks.update.mockReturnValue(chain)
  mocks.eq.mockReturnValue(chain)
  mocks.select.mockReturnValue(chain)
  mocks.single.mockResolvedValue({ data: { user_id: 'alice' }, error: null })
  mocks.auth.mockResolvedValue({ user: { id: 'alice' }, supabase: { from: () => chain } })
  mocks.getToken.mockResolvedValue('synthetic')
})

describe('Gmail settings actions', () => {
  it('trims labels and scopes updates to the verified user and connected row', async () => {
    expect(await updateGmailLabel('  AI Inbox  ')).toEqual({})
    expect(mocks.update).toHaveBeenCalledWith({ label_name: 'AI Inbox' })
    expect(mocks.eq).toHaveBeenCalledWith('user_id', 'alice')
    expect(mocks.eq).toHaveBeenCalledWith('connected', true)
  })
  it.each(['', '   ', 'x'.repeat(101), 'AI\nInbox'])('rejects invalid label %j', async label => {
    expect(await updateGmailLabel(label)).toHaveProperty('error')
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it('reports missing/disconnected rows as failures', async () => {
    mocks.single.mockResolvedValue({ data: null, error: null })
    expect(await updateGmailLabel('AI Inbox')).toHaveProperty('error')
    expect(mocks.revalidate).not.toHaveBeenCalled()
  })
  it('rejects unauthenticated changes before accessing tokens or settings', async () => {
    mocks.auth.mockRejectedValue(new Error('Unauthorized'))
    await expect(updateGmailLabel('AI Inbox')).rejects.toThrow('Unauthorized')
    await expect(disconnectGmail()).rejects.toThrow('Unauthorized')
    expect(mocks.getToken).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it('revokes access before clearing local credentials', async () => {
    expect(await disconnectGmail()).toEqual({})
    expect(mocks.getToken).toHaveBeenCalledWith('alice')
    expect(mocks.revoke).toHaveBeenCalledWith('synthetic')
    expect(mocks.clear).toHaveBeenCalledWith('alice')
    expect(mocks.revoke.mock.invocationCallOrder[0]).toBeLessThan(mocks.clear.mock.invocationCallOrder[0])
  })
  it('retains credentials for retry if revocation fails', async () => {
    mocks.revoke.mockRejectedValue(new Error('network error'))
    expect(await disconnectGmail()).toHaveProperty('error')
    expect(mocks.clear).not.toHaveBeenCalled()
  })
})
