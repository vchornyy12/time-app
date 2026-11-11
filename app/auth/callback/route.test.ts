// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'

const mocks = vi.hoisted(() => ({ exchange: vi.fn(), save: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { exchangeCodeForSession: mocks.exchange } }) }))
vi.mock('@/lib/google/integration', () => ({ saveGoogleIntegration: mocks.save }))

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('APP_ORIGIN', '')
  mocks.exchange.mockResolvedValue({ data: { session: { user: { id: 'alice', created_at: '2020-01-01' } } }, error: null })
})

describe('auth callback origin', () => {
  it('keeps successful sign-in on the configured staging host', async () => {
    vi.stubEnv('APP_ORIGIN', 'https://staging.example.test')
    const response = await GET(new Request('https://immutable.example.test/auth/callback?code=synthetic'))
    expect(response.headers.get('location')).toBe('https://staging.example.test/inbox')
    expect(mocks.exchange).toHaveBeenCalledWith('synthetic')
  })

  it('keeps failures on staging and preserves the existing request-origin default', async () => {
    vi.stubEnv('APP_ORIGIN', 'https://staging.example.test')
    expect((await GET(new Request('https://immutable.example.test/auth/callback'))).headers.get('location'))
      .toBe('https://staging.example.test/login?error=auth')
    vi.stubEnv('APP_ORIGIN', '')
    expect((await GET(new Request('https://app.test/auth/callback'))).headers.get('location'))
      .toBe('https://app.test/login?error=auth')
  })

  it('rejects an external next destination and ignores untrusted forwarded hosts', async () => {
    vi.stubEnv('APP_ORIGIN', 'https://staging.example.test')
    const response = await GET(new Request('https://immutable.example.test/auth/callback?code=synthetic&next=https://evil.test', {
      headers: { 'x-forwarded-host': 'evil.test' },
    }))
    expect(response.headers.get('location')).toBe('https://staging.example.test/inbox')
  })
})
