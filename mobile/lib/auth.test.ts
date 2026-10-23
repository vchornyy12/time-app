import { beforeEach, describe, expect, it, vi } from 'vitest'
const auth = vi.hoisted(() => ({ exchangeCodeForSession: vi.fn(), setSession: vi.fn(), verifyOtp: vi.fn(), signInWithOtp: vi.fn(), signInWithPassword: vi.fn(), signOut: vi.fn() }))
vi.mock('./supabase', () => ({ supabase: { auth } }))
import { verifyMagicLink, sendMagicLink, signOut, signInWithPassword } from './auth'
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
describe('mobile auth failures', () => {
  it('uses the same password login as web without changing the password', async () => {
    auth.signInWithPassword.mockResolvedValueOnce({ error: null })
    expect(await signInWithPassword(' USER@example.com ', '  original password  ')).toBeNull()
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'user@example.com', password: '  original password  ' })
  })
  it('rejects empty password and recovers from network or login errors', async () => {
    expect(await signInWithPassword('user@example.com', '')).not.toBeNull()
    expect(auth.signInWithPassword).not.toHaveBeenCalled()
    auth.signInWithPassword.mockRejectedValueOnce(new Error('offline'))
    expect(await signInWithPassword('user@example.com', 'password')).toBe('Unable to connect. Please try again.')
    auth.signInWithPassword.mockResolvedValueOnce({ error: { message: 'Invalid login credentials' } })
    expect(await signInWithPassword('user@example.com', 'password')).toContain('Check your email and password')
  })
  it('rejects invalid email before requesting an OTP', async () => {
    expect(await sendMagicLink('not an email')).not.toBeNull()
    expect(auth.signInWithOtp).not.toHaveBeenCalled()
  })
  it('turns network rejection into a recoverable login error', async () => {
    auth.signInWithOtp.mockRejectedValueOnce(new Error('offline'))
    expect(await sendMagicLink('test@example.com')).toBe('Unable to connect. Please try again.')
  })
  it('surfaces logout failure and limits logout to this device', async () => {
    const error = new Error('storage failure')
    auth.signOut.mockResolvedValueOnce({ error })
    await expect(signOut()).rejects.toBe(error)
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })
})
