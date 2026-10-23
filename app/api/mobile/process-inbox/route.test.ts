// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
vi.mock('server-only', () => ({}))
const m = vi.hoisted(() => ({ user: vi.fn(), single: vi.fn(), from: vi.fn(), createClient: vi.fn(), done: vi.fn(), calendar: vi.fn(), next: vi.fn(), notes: vi.fn(), someday: vi.fn(), trash: vi.fn(), waiting: vi.fn(), project: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient: m.createClient }))
vi.mock('@/lib/actions/processing', () => ({ processAsDone: m.done, processToCalendar: m.calendar, processToNextActions: m.next, processToNotes: m.notes, processToSomedayMaybe: m.someday, processToTrash: m.trash, processToWaitingFor: m.waiting }))
vi.mock('@/lib/actions/projects', () => ({ createProject: m.project }))
import { POST } from './route'
import { actionContext } from '@/lib/actions/action-context'
const base = { taskId: '00000000-0000-4000-8000-000000000001', version: '2026-10-23T12:00:00.123456+00:00' }
let query: { select: ReturnType<typeof vi.fn>; eq: ReturnType<typeof vi.fn>; single: typeof m.single }
beforeEach(() => {
  vi.clearAllMocks()
  query = { select: vi.fn(), eq: vi.fn(), single: m.single }
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query)
  m.from.mockReturnValue(query)
  m.createClient.mockReturnValue({ auth: { getUser: m.user }, from: m.from })
  m.user.mockResolvedValue({ data: { user: { id: 'verified-owner' } }, error: null })
  m.single.mockResolvedValue({ data: { status: 'inbox', updated_at: base.version }, error: null })
})
function request(body: unknown, token = 'synthetic-token') { return new NextRequest('https://app.test/api/mobile/process-inbox', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) }) }
describe('mobile processing uses existing web actions under a verified user', () => {
  it('rejects missing or rejected authentication before reading tasks', async () => {
    expect((await POST(request({ ...base, action: 'notes' }, ''))).status).toBe(401)
    m.user.mockResolvedValueOnce({ data: { user: null }, error: new Error('invalid') })
    expect((await POST(request({ ...base, action: 'notes' }))).status).toBe(401)
    expect(m.from).not.toHaveBeenCalled()
  })
  it('uses the token’s owner, never a body-supplied user ID', async () => {
    m.notes.mockImplementationOnce(async () => { expect(actionContext.getStore()?.user.id).toBe('verified-owner') })
    expect((await POST(request({ ...base, action: 'notes', userId: 'another-user' }))).status).toBe(200)
    expect(m.user).toHaveBeenCalledWith('synthetic-token')
    expect(query.eq).toHaveBeenCalledWith('user_id', 'verified-owner')
    expect(m.notes).toHaveBeenCalledWith(base.taskId)
    expect(actionContext.getStore()).toBeUndefined()
  })
  it.each([
    { status: 'next_actions', updated_at: base.version },
    { status: 'inbox', updated_at: 'changed' },
  ])('does not process stale or already processed tasks', async task => {
    m.single.mockResolvedValueOnce({ data: task, error: null })
    expect((await POST(request({ ...base, action: 'notes' }))).status).toBe(409)
    expect(m.notes).not.toHaveBeenCalled()
  })
  it('does not process a task hidden by RLS', async () => {
    m.single.mockResolvedValueOnce({ data: null, error: new Error('not found') })
    expect((await POST(request({ ...base, action: 'trash' }))).status).toBe(404)
    expect(m.trash).not.toHaveBeenCalled()
  })
  it('validates fields before any action', async () => {
    expect((await POST(request({ ...base, action: 'waiting_for', delegatedTo: '' }))).status).toBe(400)
    expect(m.waiting).not.toHaveBeenCalled()
  })
  it('dispatches scheduling to the same calendar action, including recurrence', async () => {
    const scheduledAt = '2026-10-30T12:00:00Z'
    expect((await POST(request({ ...base, action: 'calendar', scheduledAt, recurrenceRule: 'weekly' }))).status).toBe(200)
    expect(m.calendar).toHaveBeenCalledWith(base.taskId, scheduledAt, 'weekly')
  })
  it('dispatches project creation to the existing atomic conversion', async () => {
    expect((await POST(request({ ...base, action: 'project', title: 'Launch', roughPlanLines: ['Draft'], firstStepTitle: 'Write' }))).status).toBe(200)
    expect(m.project).toHaveBeenCalledWith(expect.objectContaining({ originTaskId: base.taskId, roughPlanLines: ['Draft'] }))
  })
})
