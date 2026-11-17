import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dispatchScanWorker, workerAuthorized } from './worker'

const request = (token?: string) => new Request('https://app.example.test/api/gmail/scan-worker', {
  method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {},
})

beforeEach(() => {
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')
  vi.stubEnv('GMAIL_WORKER_SECRET', 'dedicated-worker-secret')
  vi.stubEnv('APP_ORIGIN', 'https://app.example.test')
  vi.stubEnv('GMAIL_APP_ORIGIN', '')
  vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 202 })))
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe('Gmail worker authentication', () => {
  it('accepts only the dedicated secret once it is configured', () => {
    expect(workerAuthorized(request('dedicated-worker-secret'))).toBe(true)
    expect(workerAuthorized(request('service-role-key'))).toBe(false)
    expect(workerAuthorized(request('wrong'))).toBe(false)
    expect(workerAuthorized(request())).toBe(false)
  })
  it('falls back to the service key until a dedicated secret is set', () => {
    vi.stubEnv('GMAIL_WORKER_SECRET', '')
    expect(workerAuthorized(request('service-role-key'))).toBe(true)
  })
})

describe('dispatching the scan worker', () => {
  it('posts the run to the configured origin without following redirects', async () => {
    await dispatchScanWorker('run-1')
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(String(url)).toBe('https://app.example.test/.netlify/functions/gmail-scan-worker-background')
    expect(init).toMatchObject({ method: 'POST', redirect: 'manual', headers: { Authorization: 'Bearer dedicated-worker-secret' } })
  })
  it.each(['http://attacker.example.test', 'https://app.example.test/path', 'https://user:pass@app.example.test'])(
    'refuses to send the secret to untrusted origin %s', async origin => {
      vi.stubEnv('APP_ORIGIN', origin)
      await expect(dispatchScanWorker('run-1')).rejects.toThrow()
      expect(fetch).not.toHaveBeenCalled()
    })
  it('fails when the worker rejects the request', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }))
    await expect(dispatchScanWorker('run-1')).rejects.toThrow('Background worker rejected the scan.')
  })
})
