// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'
import { createGoogleOAuthState, GOOGLE_OAUTH_COOKIE } from '@/lib/google/oauth-state'

const mocks = vi.hoisted(() => ({
  jar: new Map<string, string>(),
  set: vi.fn(), upsert: vi.fn(), fetch: vi.fn(),
  getUser: vi.fn(),
}))
vi.mock('@/lib/google/integration', () => ({ saveGoogleIntegration: (...args: unknown[]) => mocks.upsert(...args) }))
vi.mock('next/headers', () => ({ cookies: async () => ({
  get: (key: string) => mocks.jar.has(key) ? { value: mocks.jar.get(key) } : undefined,
  set: (key: string, value: string, options: {maxAge?: number}) => {
    mocks.set(key, value, options)
    if (options.maxAge === 0) mocks.jar.delete(key)
    else mocks.jar.set(key, value)
  },
}) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({
  auth: { getUser: mocks.getUser }, from: () => ({ upsert: mocks.upsert }),
}) }))
beforeEach(() => {
  vi.clearAllMocks(); mocks.jar.clear()
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'alice' } } })
  mocks.upsert.mockResolvedValue({ error: null })
  vi.stubGlobal('fetch', mocks.fetch)
})
function request(state: string, extra = '') {
  return new NextRequest(`https://app.test/api/google/callback?code=code&state=${encodeURIComponent(state)}${extra}`)
}
describe('Google callback security', () => {
  it('rejects forged state before contacting Google or writing credentials', async () => {
    const response = await GET(request('alice|%2Fsettings'))
    expect(response.headers.get('location')).toContain('invalid_state')
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(mocks.upsert).not.toHaveBeenCalled()
  })
  it('exchanges a bound code with PKCE and consumes the cookie before a replay', async () => {
    const pending = createGoogleOAuthState('alice', '/inbox')
    mocks.jar.set(GOOGLE_OAUTH_COOKIE, pending.cookie)
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ refresh_token: 'synthetic', scope: 'https://www.googleapis.com/auth/calendar.events' }) })
    const response = await GET(request(pending.state))
    expect(response.headers.get('location')).toBe('https://app.test/inbox')
    const body = mocks.fetch.mock.calls[0][1].body as URLSearchParams
    expect(body.get('code_verifier')).toBe(pending.verifier)
    expect(mocks.upsert).toHaveBeenCalledTimes(1)
    const replay = await GET(request(pending.state))
    expect(replay.headers.get('location')).toContain('invalid_state')
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
  })
  it('rejects a cookie issued for another user', async () => {
    const pending = createGoogleOAuthState('bob', '/settings')
    mocks.jar.set(GOOGLE_OAUTH_COOKIE, pending.cookie)
    expect((await GET(request(pending.state))).headers.get('location')).toContain('invalid_state')
    expect(mocks.fetch).not.toHaveBeenCalled()
  })
  it('consumes cancelled authorization without exchanging a code', async () => {
    const pending = createGoogleOAuthState('alice', '/inbox')
    mocks.jar.set(GOOGLE_OAUTH_COOKIE, pending.cookie)
    expect((await GET(request(pending.state, '&error=access_denied'))).headers.get('location')).toContain('google_auth_denied')
    expect(mocks.jar.has(GOOGLE_OAUTH_COOKIE)).toBe(false)
    expect(mocks.fetch).not.toHaveBeenCalled()
  })
})
