// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
vi.mock('server-only', () => ({}))
const m = vi.hoisted(() => ({ user: vi.fn(), single: vi.fn(), from: vi.fn(), createClient: vi.fn(), done: vi.fn(), decide: vi.fn(), sync: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient: m.createClient }))
vi.mock('@/lib/actions/tasks', () => ({ markTaskDone: m.done }))
vi.mock('@/lib/actions/assistant', () => ({ decideSuggestion: m.decide }))
vi.mock('@/lib/actions/calendar', () => ({ syncPendingCalendarTasks: m.sync }))
import { POST } from './route'
import { actionContext } from '@/lib/actions/action-context'
const taskId = '00000000-0000-4000-8000-000000000001'
let query: { select: ReturnType<typeof vi.fn>; eq: ReturnType<typeof vi.fn>; single: typeof m.single }
beforeEach(() => {
  vi.clearAllMocks()
  query = { select: vi.fn(), eq: vi.fn(), single: m.single }
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query)
  m.from.mockReturnValue(query)
  m.createClient.mockReturnValue({ auth: { getUser: m.user }, from: m.from })
  m.user.mockResolvedValue({ data: { user: { id: 'verified-owner' } }, error: null })
  m.single.mockResolvedValue({ data: { status: 'waiting_for' }, error: null })
})
function request(body: unknown, token = 'synthetic-token') {
  return new NextRequest('https://app.test/api/mobile/task-action', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) })
}
describe('mobile task actions run web actions under the verified user', () => {
  it('rejects requests without a valid token', async () => {
    expect((await POST(request({ action: 'sync_calendar' }, ''))).status).toBe(401)
    expect(m.sync).not.toHaveBeenCalled()
  })
  it('marks a Waiting For item done as the token owner', async () => {
    m.done.mockImplementationOnce(async () => { expect(actionContext.getStore()?.user.id).toBe('verified-owner') })
    expect((await POST(request({ action: 'complete_waiting_for', taskId }))).status).toBe(200)
    expect(query.eq).toHaveBeenCalledWith('user_id', 'verified-owner')
    expect(m.done).toHaveBeenCalledWith(taskId)
  })
  it('refuses to complete an item that is no longer in Waiting For', async () => {
    m.single.mockResolvedValueOnce({ data: { status: 'inbox' }, error: null })
    expect((await POST(request({ action: 'complete_waiting_for', taskId }))).status).toBe(409)
    expect(m.done).not.toHaveBeenCalled()
  })
  it('records a suggestion decision', async () => {
    m.decide.mockResolvedValueOnce({ status: 'dismissed' })
    const response = await POST(request({ action: 'decide_suggestion', suggestionId: taskId, decision: 'dismiss' }))
    expect(await response.json()).toEqual({ ok: true, result: { status: 'dismissed' } })
    expect(m.decide).toHaveBeenCalledWith(taskId, 'dismiss')
  })
  it('returns the calendar sync result', async () => {
    m.sync.mockResolvedValueOnce({ synced: 2, failed: 0, remaining: 0, status: 'synced' })
    const response = await POST(request({ action: 'sync_calendar' }))
    expect((await response.json()).result.synced).toBe(2)
  })
  it('validates input before any action', async () => {
    expect((await POST(request({ action: 'complete_waiting_for', taskId: 'nope' }))).status).toBe(400)
    expect((await POST(request({ action: 'delete_everything' }))).status).toBe(400)
    expect(m.done).not.toHaveBeenCalled()
  })
})
