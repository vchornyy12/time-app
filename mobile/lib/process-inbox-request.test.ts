import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ session: vi.fn(), fetch: vi.fn() }))
vi.mock('./supabase', () => ({ supabase: { auth: { getSession: m.session } } }))
import { processInbox } from './tasks'
const command = { taskId: '00000000-0000-4000-8000-000000000001', version: '2026-10-23T12:00:00.123456Z', action: 'notes' as const }
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('fetch', m.fetch); m.session.mockResolvedValue({ data: { session: { access_token: 'synthetic-token' } }, error: null }); m.fetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true, result: null }) }) })
afterEach(() => vi.unstubAllGlobals())
describe('native processing HTTP adapter', () => {
  it('calls the production web action adapter with the current user token', async () => {
    await processInbox(command)
    expect(m.fetch).toHaveBeenCalledWith('https://time24.pro/api/mobile/process-inbox', expect.objectContaining({ method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer synthetic-token' }, body: JSON.stringify(command) }))
  })
  it('does not send an unauthenticated command', async () => {
    m.session.mockResolvedValueOnce({ data: { session: null }, error: null })
    await expect(processInbox(command)).rejects.toThrow('Sign in again')
    expect(m.fetch).not.toHaveBeenCalled()
  })
  it('surfaces a conflict instead of reporting success', async () => {
    m.fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Task changed. Reload it.' }) })
    await expect(processInbox(command)).rejects.toThrow('Task changed')
  })
})
