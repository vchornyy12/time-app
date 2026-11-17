import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  admin: vi.fn(), deleteUser: vi.fn(), cleanup: vi.fn(), revoke: vi.fn(), integration: vi.fn(),
  user: { id: '11111111-1111-4111-8111-111111111111', email: 'owner@example.test', last_sign_in_at: '' },
  from: vi.fn(), signOut: vi.fn(),
  gmailToken: vi.fn(),
}))
vi.mock('@/lib/actions/authed-action', () => ({ authedClient: async () => ({ user: mocks.user, supabase: { from: mocks.from, auth: { signOut: mocks.signOut } } }) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.admin }))
vi.mock('@/lib/storage/delete-user-files', () => ({ deleteUserAttachments: mocks.cleanup }))
vi.mock('@/lib/google/revoke', () => ({ revokeGoogleToken: mocks.revoke }))
vi.mock('@/lib/google/integration', () => ({ getGoogleIntegration: mocks.integration }))
vi.mock('@/lib/gmail/integration', () => ({ getGmailRefreshToken: mocks.gmailToken }))
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`) } }))
import { deleteAccount } from './account'
beforeEach(() => {
  vi.resetAllMocks(); mocks.user.last_sign_in_at = new Date().toISOString()
  vi.stubEnv('GMAIL_INBOX_ENABLED', 'false')
  mocks.admin.mockReturnValue({ auth: { admin: { deleteUser: mocks.deleteUser } } })
  mocks.integration.mockResolvedValue({ google_refresh_token: 'synthetic' })
  mocks.deleteUser.mockResolvedValue({ error: null })
})
describe('account deletion boundaries', () => {
  it('revokes Gmail access before deleting an account when the integration is enabled', async () => {
    vi.stubEnv('GMAIL_INBOX_ENABLED', 'true')
    mocks.gmailToken.mockResolvedValue('synthetic-gmail')
    await expect(deleteAccount('owner@example.test')).rejects.toThrow('redirect:/login')
    expect(mocks.gmailToken).toHaveBeenCalledWith(mocks.user.id)
    expect(mocks.revoke).toHaveBeenCalledWith('synthetic-gmail')
    expect(mocks.revoke.mock.invocationCallOrder.at(-1)).toBeLessThan(mocks.deleteUser.mock.invocationCallOrder[0])
  })
  it('requires recent sign-in and checks server configuration before deleting any data', async () => {
    mocks.user.last_sign_in_at = new Date(Date.now() - 3600000).toISOString()
    expect(await deleteAccount('owner@example.test')).toHaveProperty('error')
    expect(mocks.admin).not.toHaveBeenCalled()
    mocks.user.last_sign_in_at = new Date().toISOString()
    mocks.admin.mockImplementation(() => { throw new Error('not configured') })
    expect(await deleteAccount('owner@example.test')).toHaveProperty('error')
    expect(mocks.cleanup).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it('keeps the auth user and public rows when file cleanup fails', async () => {
    mocks.cleanup.mockRejectedValue(new Error('storage unavailable'))
    expect(await deleteAccount('owner@example.test')).toHaveProperty('error')
    expect(mocks.deleteUser).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it('revokes Google, cleans owner files and uses one cascading auth deletion', async () => {
    await expect(deleteAccount('OWNER@example.test')).rejects.toThrow('redirect:/login')
    expect(mocks.revoke).toHaveBeenCalledWith('synthetic')
    expect(mocks.cleanup).toHaveBeenCalledWith(expect.anything(), mocks.user.id)
    expect(mocks.deleteUser).toHaveBeenCalledWith(mocks.user.id)
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.signOut).toHaveBeenCalledOnce()
  })
})
