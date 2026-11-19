// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createGoogleOAuthState } from '@/lib/google/oauth-state'
import { CHAT_OAUTH_COOKIE } from '@/lib/google-chat/client'

const mocks = vi.hoisted(() => ({ jar: new Map<string, string>(), save: vi.fn(), fetch: vi.fn(), getUser: vi.fn() }))
vi.mock('@/lib/assistant/secrets', () => ({ setAssistantSecret: (...a: unknown[]) => mocks.save(...a), getAssistantSecret: vi.fn() }))
vi.mock('next/headers', () => ({ cookies: async () => ({
  get: (k: string) => mocks.jar.has(k) ? { value: mocks.jar.get(k) } : undefined,
  set: (k: string, v: string, o: { maxAge?: number }) => { if (o.maxAge === 0) mocks.jar.delete(k); else mocks.jar.set(k, v) },
}) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser } }) }))
const { GET } = await import('./route')

const SCOPES = 'openid email https://www.googleapis.com/auth/chat.spaces.readonly https://www.googleapis.com/auth/chat.messages.readonly'
const req = (state: string) => new NextRequest(`https://app.test/api/google-chat/callback?code=c&state=${encodeURIComponent(state)}`)

beforeEach(() => {
  vi.clearAllMocks(); mocks.jar.clear()
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'alice' } } })
  vi.stubGlobal('fetch', mocks.fetch)
  delete process.env.APP_ORIGIN
})

describe('Google Chat callback', () => {
  it('rejects a forged state before contacting Google', async () => {
    const res = await GET(req('forged'))
    expect(res.headers.get('location')).toContain('error=invalid_state')
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it('stores the refresh token with PKCE and consumes the cookie', async () => {
    const pending = createGoogleOAuthState('alice', '/settings')
    mocks.jar.set(CHAT_OAUTH_COOKIE, pending.cookie)
    mocks.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ refresh_token: 'r1', access_token: 'a1', scope: SCOPES }) })
      .mockResolvedValueOnce({ json: async () => ({ email: 'alice@example.com' }) })
    const res = await GET(req(pending.state))
    expect(res.headers.get('location')).toBe('https://app.test/settings?chat_connected=1')
    expect((mocks.fetch.mock.calls[0][1].body as URLSearchParams).get('code_verifier')).toBe(pending.verifier)
    expect(mocks.save).toHaveBeenCalledWith('alice', 'chat', 'r1', 'alice@example.com')
    expect((await GET(req(pending.state))).headers.get('location')).toContain('invalid_state')
  })

  it('refuses a grant without message access', async () => {
    const pending = createGoogleOAuthState('alice', '/settings')
    mocks.jar.set(CHAT_OAUTH_COOKIE, pending.cookie)
    mocks.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ refresh_token: 'r1', scope: 'openid email' }) })
    const res = await GET(req(pending.state))
    expect(res.headers.get('location')).toContain('error=chat_scopes_missing')
    expect(mocks.save).not.toHaveBeenCalled()
  })
})
