import { afterEach, describe, expect, it, vi } from 'vitest'
import { createGoogleOAuthState, verifyGoogleOAuthState, safeInternalPath, GOOGLE_OAUTH_TTL } from './oauth-state'

afterEach(() => vi.useRealTimers())
describe('Google OAuth browser binding', () => {
  it('uses fresh unpredictable state and PKCE, bound to one user', () => {
    const a = createGoogleOAuthState('alice', '/inbox?from=calendar')
    const b = createGoogleOAuthState('alice', '/inbox')
    expect(a.state).not.toBe(b.state)
    expect(a.verifier).not.toBe(b.verifier)
    expect(a.state).not.toContain('alice')
    expect(a.challenge).not.toBe(a.verifier)
    expect(verifyGoogleOAuthState(a.cookie, a.state, 'alice')).toEqual({ next: '/inbox?from=calendar', verifier: a.verifier })
    expect(verifyGoogleOAuthState(a.cookie, a.state, 'bob')).toBeNull()
    expect(verifyGoogleOAuthState(a.cookie, b.state, 'alice')).toBeNull()
    expect(verifyGoogleOAuthState(undefined, a.state, 'alice')).toBeNull()
    expect(verifyGoogleOAuthState(a.cookie, 'alice|%2Finbox', 'alice')).toBeNull()
  })
  it('rejects expired and malformed cookies', () => {
    vi.useFakeTimers()
    const a = createGoogleOAuthState('alice', '/inbox')
    vi.advanceTimersByTime((GOOGLE_OAUTH_TTL + 1) * 1000)
    expect(verifyGoogleOAuthState(a.cookie, a.state, 'alice')).toBeNull()
    expect(verifyGoogleOAuthState('{bad', a.state, 'alice')).toBeNull()
  })
  it.each(['https://evil.test', '//evil.test', '/\\evil.test', '/%2f%2fevil.test', '/%5cevil.test', '/%0aevil', '/%zz'])('rejects unsafe redirect %s', value => {
    expect(safeInternalPath(value)).toBe('/settings')
  })
})
