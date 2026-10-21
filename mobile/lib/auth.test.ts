import { beforeEach, describe, expect, it, vi } from 'vitest'
const auth = vi.hoisted(() => ({ exchangeCodeForSession: vi.fn(), setSession: vi.fn(), verifyOtp: vi.fn() }))
vi.mock('./supabase', () => ({ supabase: { auth } }))
import { verifyMagicLink } from './auth'
beforeEach(() => { vi.clearAllMocks(); auth.exchangeCodeForSession.mockResolvedValue({ error: null }) })
describe('mobile PKCE callback', () => {
  it('exchanges a code through the stored PKCE verifier', async () => {
    expect(await verifyMagicLink('timeapp://auth?code=synthetic')).toBeNull()
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('synthetic')
  })
  it.each(['https://auth?code=x','timeapp://auth.evil?code=x','timeapp://auth/other?code=x','timeapp://auth#access_token=x&refresh_token=y','timeapp://auth?token_hash=x'])('does not adopt unbound credentials from %s', async url => {
    expect(await verifyMagicLink(url)).not.toBeNull()
    expect(auth.setSession).not.toHaveBeenCalled()
    expect(auth.verifyOtp).not.toHaveBeenCalled()
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled()
  })
})
