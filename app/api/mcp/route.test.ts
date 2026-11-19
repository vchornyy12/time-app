import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: { getUser } }) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { POST, GET } from './route'
import { GET as metadata } from '../../.well-known/oauth-protected-resource/[[...resource]]/route'

const jwt = (claims: Record<string, unknown>) =>
  `h.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.sig`

const post = (body: unknown, token?: string, contentType = 'application/json') => new NextRequest('https://time24.pro/api/mcp', {
  method: 'POST',
  headers: { 'content-type': contentType, ...(token ? { authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body),
})

describe('/api/mcp', () => {
  beforeEach(() => {
    vi.stubEnv('MCP_AGENT_ENABLED', 'true')
    vi.stubEnv('APP_ORIGIN', 'https://time24.pro')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://proj.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon')
    getUser.mockReset()
  })
  afterEach(() => vi.unstubAllEnvs())

  it('is hidden when the feature flag is off', async () => {
    vi.stubEnv('MCP_AGENT_ENABLED', '')
    expect((await POST(post({}))).status).toBe(404)
  })

  it('challenges unauthenticated calls with the resource metadata URL', async () => {
    const res = await POST(post({ jsonrpc: '2.0', id: 1, method: 'initialize' }))
    expect(res.status).toBe(401)
    expect(res.headers.get('www-authenticate')).toBe(
      'Bearer resource_metadata="https://time24.pro/.well-known/oauth-protected-resource/api/mcp"')
    expect(getUser).not.toHaveBeenCalled()
  })

  it('rejects tokens Supabase does not verify', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: new Error('bad jwt') })
    expect((await POST(post({ jsonrpc: '2.0', id: 1, method: 'ping' }, jwt({ client_id: 'c1' })))).status).toBe(401)
  })

  it('rejects ordinary app session tokens that were not issued to an OAuth client', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    expect((await POST(post({ jsonrpc: '2.0', id: 1, method: 'ping' }, jwt({ sub: 'u1' })))).status).toBe(401)
  })

  it('serves verified connector tokens', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    const res = await POST(post({ jsonrpc: '2.0', id: 7, method: 'ping' }, jwt({ sub: 'u1', client_id: 'c1' })))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ jsonrpc: '2.0', id: 7, result: {} })
  })

  it('acknowledges notifications with 202 and no body', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    const res = await POST(post({ jsonrpc: '2.0', method: 'notifications/initialized' }, jwt({ client_id: 'c1' })))
    expect(res.status).toBe(202)
  })

  it('rejects non-JSON bodies', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    expect((await POST(post('x', jwt({ client_id: 'c1' }), 'text/plain'))).status).toBe(415)
  })

  it('does not offer a GET stream', async () => {
    expect((await GET()).status).toBe(405)
  })

  it('publishes protected resource metadata pointing at Supabase Auth', async () => {
    const res = await metadata(new NextRequest('https://deploy-123--site.netlify.app/.well-known/oauth-protected-resource/api/mcp'),
      { params: Promise.resolve({ resource: ['api', 'mcp'] }) })
    expect(await res.json()).toMatchObject({
      resource: 'https://time24.pro/api/mcp',
      authorization_servers: ['https://proj.supabase.co/auth/v1'],
    })
    const other = await metadata(new NextRequest('https://time24.pro/.well-known/oauth-protected-resource/x'),
      { params: Promise.resolve({ resource: ['x'] }) })
    expect(other.status).toBe(404)
  })
})
