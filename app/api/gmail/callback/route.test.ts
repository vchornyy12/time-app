// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'
import { GET as connect } from '../auth/route'
import { createGoogleOAuthState, GOOGLE_OAUTH_COOKIE } from '@/lib/google/oauth-state'
import { GMAIL_OAUTH_COOKIE, GMAIL_SCOPE } from '@/lib/gmail/config'

const mocks = vi.hoisted(() => ({ jar: new Map<string, string>(), getUser: vi.fn(), save: vi.fn(), fetch: vi.fn() }))
vi.mock('next/headers', () => ({ cookies: async () => ({
  get: (key: string) => ({ value: mocks.jar.get(key) }),
  set: (key: string, value: string, options: { maxAge?: number }) => {
    if (options.maxAge === 0) mocks.jar.delete(key)
    else mocks.jar.set(key, value)
  },
}) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser } }) }))
vi.mock('@/lib/gmail/integration', () => ({ saveGmailIntegration: mocks.save }))

beforeEach(() => {
  vi.resetAllMocks()
  mocks.jar.clear()
  vi.stubEnv('GMAIL_INBOX_ENABLED', 'true')
  vi.stubEnv('GMAIL_CLIENT_ID', 'gmail-client')
  vi.stubEnv('GMAIL_CLIENT_SECRET', 'synthetic-secret')
  vi.stubEnv('GMAIL_APP_ORIGIN', '')
  vi.stubGlobal('fetch', mocks.fetch)
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'alice' } } })
})

function callback(user = 'alice') {
  const pending = createGoogleOAuthState(user, '/settings')
  mocks.jar.set(GMAIL_OAUTH_COOKIE, pending.cookie)
  return { pending, request: new NextRequest(`https://app.test/api/gmail/callback?code=code&state=${pending.state}`) }
}

function validResponses(scope = GMAIL_SCOPE) {
  mocks.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({
    access_token: 'synthetic-access', refresh_token: 'synthetic-refresh', scope,
  }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ emailAddress: 'mailbox@example.test' }) })
}

describe('Gmail connection', () => {
  it('uses the registered origin through consent, token exchange and result redirects behind a hosting adapter', async () => {
    vi.stubEnv('GMAIL_APP_ORIGIN', 'https://staging.example.test')
    const response = await connect(new NextRequest('https://immutable-deploy.example.test/api/gmail/auth'))
    expect(new URL(response.headers.get('location')!).searchParams.get('redirect_uri'))
      .toBe('https://staging.example.test/api/gmail/callback')
    const { request } = callback()
    validResponses()
    expect((await GET(request)).headers.get('location')).toBe('https://staging.example.test/settings?gmail=connected')
    expect(mocks.fetch.mock.calls[0][1].body.get('redirect_uri')).toBe('https://staging.example.test/api/gmail/callback')
  })

  it('requests only read access and binds consent with PKCE and its own cookie', async () => {
    const response = await connect(new NextRequest('https://app.test/api/gmail/auth'))
    const location = new URL(response.headers.get('location')!)
    expect(location.searchParams.get('scope')).toBe(GMAIL_SCOPE)
    expect(location.searchParams.get('client_id')).toBe('gmail-client')
    expect(location.searchParams.get('redirect_uri')).toBe('https://app.test/api/gmail/callback')
    expect(location.searchParams.get('code_challenge_method')).toBe('S256')
    expect(mocks.jar.has(GMAIL_OAUTH_COOKIE)).toBe(true)
    expect(mocks.jar.has(GOOGLE_OAUTH_COOKIE)).toBe(false)
  })

  it('stays unavailable without configuration and requires a signed-in user', async () => {
    vi.stubEnv('GMAIL_INBOX_ENABLED', 'false')
    expect((await connect(new NextRequest('https://app.test/api/gmail/auth'))).status).toBe(503)
    expect(mocks.getUser).not.toHaveBeenCalled()
    vi.stubEnv('GMAIL_INBOX_ENABLED', 'true')
    mocks.getUser.mockResolvedValue({ data: { user: null } })
    expect((await connect(new NextRequest('https://app.test/api/gmail/auth'))).headers.get('location')).toBe('https://app.test/login')
  })

  it('rejects state bound to another user without exchanging tokens', async () => {
    const { request } = callback('bob')
    expect((await GET(request)).headers.get('location')).toContain('invalid_state')
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it('does not accept a calendar flow cookie', async () => {
    const { request, pending } = callback()
    mocks.jar.delete(GMAIL_OAUTH_COOKIE)
    mocks.jar.set(GOOGLE_OAUTH_COOKIE, pending.cookie)
    expect((await GET(request)).headers.get('location')).toContain('invalid_state')
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('saves the authorized mailbox and consumes state before replay', async () => {
    const { request, pending } = callback()
    validResponses()
    expect((await GET(request)).headers.get('location')).toContain('gmail=connected')
    expect(mocks.fetch.mock.calls[0][1].body.get('code_verifier')).toBe(pending.verifier)
    expect(mocks.save).toHaveBeenCalledWith('alice', 'mailbox@example.test', 'synthetic-refresh')
    expect((await GET(request)).headers.get('location')).toContain('invalid_state')
    expect(mocks.fetch).toHaveBeenCalledTimes(2)
  })

  it('rejects missing or lookalike scope grants', async () => {
    const { request } = callback()
    validResponses(`${GMAIL_SCOPE}.fake`)
    expect((await GET(request)).headers.get('location')).toContain('missing_scope')
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it('handles cancellation without fetching or changing stored credentials', async () => {
    const { request } = callback()
    request.nextUrl.searchParams.set('error', 'access_denied')
    expect((await GET(request)).headers.get('location')).toContain('cancelled')
    expect(mocks.jar.has(GMAIL_OAUTH_COOKIE)).toBe(false)
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it.each(['network', 'profile', 'storage'])('fails safely on %s errors', async stage => {
    const { request } = callback()
    if (stage === 'network') mocks.fetch.mockRejectedValue(new Error('secret response'))
    else if (stage === 'profile') mocks.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({
      access_token: 'access', refresh_token: 'refresh', scope: GMAIL_SCOPE,
    }) }).mockResolvedValueOnce({ ok: false })
    else {
      validResponses()
      mocks.save.mockRejectedValue(new Error('database secret'))
    }
    expect((await GET(request)).headers.get('location')).toBe('https://app.test/settings?gmail=failed')
    expect(mocks.jar.has(GMAIL_OAUTH_COOKIE)).toBe(false)
  })
})
