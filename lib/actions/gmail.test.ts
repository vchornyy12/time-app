import { beforeEach, describe, expect, it, vi } from 'vitest'
import { disconnectGmail, startGmailScan } from './gmail'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), getToken: vi.fn(), revoke: vi.fn(), clear: vi.fn(), revalidate: vi.fn(),
  rpc: vi.fn(), dispatch: vi.fn(), runLookup: vi.fn(),
}))
vi.mock('@/lib/actions/authed-action', () => ({ authedClient: mocks.auth }))
vi.mock('@/lib/gmail/config', () => ({ gmailAvailable: () => true }))
vi.mock('@/lib/gmail/integration', () => ({ getGmailRefreshToken: mocks.getToken, clearGmailIntegration: mocks.clear }))
vi.mock('@/lib/gmail/worker', () => ({ dispatchScanWorker: mocks.dispatch }))
vi.mock('@/lib/google/revoke', () => ({ revokeGoogleToken: mocks.revoke }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: mocks.rpc,
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.runLookup }) }) }),
  }),
}))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }))

const RUN_ID = '0b0f6a52-6f0e-4c53-9d0a-3a8b1f2c4d5e'

beforeEach(() => {
  vi.resetAllMocks()
  mocks.auth.mockResolvedValue({ user: { id: 'alice' } })
  mocks.getToken.mockResolvedValue('synthetic')
  mocks.rpc.mockResolvedValue({ data: RUN_ID, error: null })
  mocks.runLookup.mockResolvedValue({ data: { id: RUN_ID, status: 'queued' }, error: null })
})

describe('Gmail connection actions', () => {
  it('rejects unauthenticated changes before accessing tokens', async () => {
    mocks.auth.mockRejectedValue(new Error('Unauthorized'))
    await expect(disconnectGmail()).rejects.toThrow('Unauthorized')
    await expect(startGmailScan(true, 25)).rejects.toThrow('Unauthorized')
    expect(mocks.getToken).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
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

describe('starting a Gmail scan', () => {
  it.each([[false, 25], [true, 7], [true, 1000]])('rejects consent=%j batch=%j without creating a run', async (consent, batchSize) => {
    expect(await startGmailScan(consent, batchSize)).toHaveProperty('error')
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(mocks.dispatch).not.toHaveBeenCalled()
  })
  it('creates the run for the verified user and dispatches the worker', async () => {
    expect(await startGmailScan(true, 50)).toEqual({ run: { id: RUN_ID, status: 'queued' } })
    expect(mocks.rpc).toHaveBeenCalledWith('create_gmail_scan_run', { p_user_id: 'alice', p_batch_size: 50 })
    expect(mocks.dispatch).toHaveBeenCalledWith(RUN_ID)
  })
  it('shows known preconditions but never raw database errors', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'Connect an AI provider key before scanning' } })
    expect(await startGmailScan(true, 50)).toEqual({ error: 'Connect an AI provider key before scanning.' })
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'relation "gmail_scan_runs" does not exist' } })
    expect(await startGmailScan(true, 50)).toEqual({ error: 'Could not start Gmail scan.' })
    expect(mocks.dispatch).not.toHaveBeenCalled()
  })
  it('reports a worker dispatch failure', async () => {
    mocks.dispatch.mockRejectedValue(new Error('Background worker rejected the scan.'))
    expect(await startGmailScan(true, 50)).toHaveProperty('error')
  })
})
