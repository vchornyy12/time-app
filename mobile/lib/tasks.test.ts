import { beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), response: { data: [] as unknown, error: null as unknown } }))
vi.mock('./supabase', () => ({ supabase: { from: mock.from, rpc: mock.rpc } }))
import { completeTask, fetchTaskPage, saveCapture, fetchTaskDetail, saveTaskDetail, type TaskDetail } from './tasks'

let query: Record<string, ReturnType<typeof vi.fn>>
beforeEach(() => {
  mock.response = { data: [], error: null }
  mock.rpc.mockResolvedValue({ error: null })
  query = Object.fromEntries(['select', 'eq', 'gte', 'lt', 'order', 'or', 'limit', 'contains', 'abortSignal', 'update', 'single', 'upsert'].map(name => [name, vi.fn()]))
  for (const method of Object.values(query)) method.mockImplementation(() => query)
  query.abortSignal.mockImplementation(async () => mock.response)
  query.single.mockImplementation(async () => mock.response)
  query.upsert.mockImplementation(async () => mock.response)
  mock.from.mockReturnValue(query)
})
describe('mobile task repository', () => {
  it('loads a bounded page with stable ordering, owner filter and cancellation', async () => {
    const signal = new AbortController().signal
    await fetchTaskPage('owner', 'inbox', null, signal)
    expect(query.eq).toHaveBeenCalledWith('user_id', 'owner')
    expect(query.eq).toHaveBeenCalledWith('status', 'inbox')
    expect(query.order).toHaveBeenCalledWith('id', { ascending: false })
    expect(query.limit).toHaveBeenCalledWith(50)
    expect(query.abortSignal).toHaveBeenCalledWith(signal)
  })
  it('uses a half-open local day for calendar tasks', async () => {
    const day = new Date(2026, 9, 22, 12)
    const start = new Date(2026, 9, 22)
    const end = new Date(2026, 9, 23)
    await fetchTaskPage('owner', 'calendar', null, new AbortController().signal, day)
    expect(query.gte).toHaveBeenCalledWith('scheduled_at', start.toISOString())
    expect(query.lt).toHaveBeenCalledWith('scheduled_at', end.toISOString())
  })
  it('filters contexts before pagination, including actions beyond the first page', async () => {
    await fetchTaskPage('owner', 'next_actions', null, new AbortController().signal, new Date(), '@office')
    expect(query.contains).toHaveBeenCalledWith('contexts', ['@office'])
    expect(query.limit).toHaveBeenCalledWith(50)
  })
  it.each([
    ['inbox', 'created_at', 'lt'],
    ['calendar', 'scheduled_at', 'gt'],
  ] as const)('paginates %s by timestamp and UUID without an offset', async (status, column, comparison) => {
    const after = { id: '00000000-0000-4000-8000-000000000001', value: '2026-10-22T12:00:00.123456+00:00' }
    await fetchTaskPage('owner', status, after, new AbortController().signal)
    expect(query.or).toHaveBeenCalledWith(`${column}.${comparison}.${after.value},and(${column}.eq.${after.value},id.${comparison}.${after.id})`)
    expect(query.limit).toHaveBeenCalledWith(50)
  })
  it('does not report a failed or forbidden completion as successful', async () => {
    const error = new Error('permission denied')
    mock.response.error = error
    await expect(completeTask('owner', 'task')).rejects.toBe(error)
    expect(query.update).not.toHaveBeenCalled()
    expect(query.eq).toHaveBeenCalledWith('id', 'task')
    expect(query.eq).toHaveBeenCalledWith('user_id', 'owner')
    expect(query.single).toHaveBeenCalled()
  })
  it('retries capture with the same ID after an ambiguous timeout', async () => {
    const draft = { id: 'retry-id', title: '  Task  ', userId: 'owner' }
    mock.response.error = new Error('timeout after commit')
    await expect(saveCapture(draft)).rejects.toThrow('timeout')
    mock.response.error = null
    await saveCapture(draft)
    expect(query.upsert.mock.calls[0]).toEqual(query.upsert.mock.calls[1])
    expect(query.upsert).toHaveBeenLastCalledWith({ id: 'retry-id', title: 'Task', status: 'inbox', user_id: 'owner' }, { onConflict: 'id', ignoreDuplicates: true })
  })
  it('clears a completed first-step reference only in the current user’s project', async () => {
    mock.response.data = { id: 'task', project_id: 'project', status: 'calendar' }
    await completeTask('owner', 'task')
    expect(mock.from).toHaveBeenCalledWith('projects')
    expect(query.update).toHaveBeenCalledWith({ first_step_task_id: null })
    expect(query.eq).toHaveBeenCalledWith('id', 'project')
    expect(query.eq).toHaveBeenCalledWith('first_step_task_id', 'task')
    expect(query.eq).toHaveBeenCalledWith('user_id', 'owner')
  })
  it('completes project next actions atomically through the existing RPC', async () => {
    mock.response.data = { id: 'task', project_id: 'project', status: 'next_actions' }
    await completeTask('owner', 'task')
    expect(mock.rpc).toHaveBeenCalledWith('complete_project_step', { p_project_id: 'project', p_task_id: 'task' })
    expect(query.update).not.toHaveBeenCalled()
  })
  it('does not regenerate another recurrence when retrying a completed action', async () => {
    mock.response.data = { id: 'task', project_id: null, status: 'done' }
    await completeTask('owner', 'task')
    expect(query.update).not.toHaveBeenCalled()
    expect(mock.rpc).not.toHaveBeenCalled()
  })
  it('does not complete an action moved to Waiting For on another device', async () => {
    mock.response.data = { id: 'task', project_id: null, status: 'waiting_for' }
    await expect(completeTask('owner', 'task')).rejects.toThrow('another list')
    expect(query.update).not.toHaveBeenCalled()
  })
  it.each(['', ' '.repeat(10), 'x'.repeat(501)])('rejects invalid title before contacting the API', async title => {
    await expect(saveCapture({ id: 'id', title, userId: 'owner' })).rejects.toThrow()
    expect(mock.from).not.toHaveBeenCalled()
  })
  it('accepts the database limit in Unicode code points', async () => {
    await expect(saveCapture({ id: 'id', title: '🙂'.repeat(500), userId: 'owner' })).resolves.toBeUndefined()
  })
})

const detail: TaskDetail = { id: '00000000-0000-4000-8000-000000000001', title: 'Original', status: 'inbox', contexts: [], updated_at: '2026-10-23T12:00:00.123456Z', scheduled_at: null, due_date: null, delegated_to: null, project_id: null, recurrence_rule: null }
describe('task details and processing', () => {
  it('loads only the current owner’s task, with cancellation', async () => {
    mock.response.data = detail
    query.abortSignal.mockReturnValue(query)
    const signal = new AbortController().signal
    expect(await fetchTaskDetail('owner', detail.id, signal)).toEqual(detail)
    expect(query.eq).toHaveBeenCalledWith('user_id', 'owner')
    expect(query.eq).toHaveBeenCalledWith('id', detail.id)
    expect(query.abortSignal).toHaveBeenCalledWith(signal)
  })
  it('processes an inbox item in one guarded write without losing recurrence', async () => {
    mock.response.data = { ...detail, status: 'next_actions' }
    await saveTaskDetail('owner', detail, { title: '  Call accountant  ', contexts: ['@phone'] }, true)
    expect(query.update).toHaveBeenCalledExactlyOnceWith({ title: 'Call accountant', contexts: ['@phone'], status: 'next_actions' })
    expect(query.eq).toHaveBeenCalledWith('user_id', 'owner')
    expect(query.eq).toHaveBeenCalledWith('status', 'inbox')
    expect(query.eq).toHaveBeenCalledWith('updated_at', detail.updated_at)
  })
  it('does not move an ordinary edit into another list', async () => {
    mock.response.data = detail
    await saveTaskDetail('owner', { ...detail, status: 'calendar' }, { title: 'Changed', contexts: [] })
    expect(query.update).toHaveBeenCalledWith({ title: 'Changed', contexts: [] })
  })
  it('reports a stale, deleted or forbidden task instead of pretending to save', async () => {
    mock.response.error = { code: 'PGRST116' }
    await expect(saveTaskDetail('owner', detail, { title: 'Changed', contexts: [] }, true)).rejects.toEqual({ code: 'PGRST116' })
  })
  it.each([
    { title: ' ', contexts: [] },
    { title: 'x'.repeat(501), contexts: [] },
    { title: 'Valid', contexts: Array(21).fill('@phone') },
    { title: 'Valid', contexts: ['x'.repeat(51)] },
  ])('rejects invalid edits before writing: %j', async input => {
    await expect(saveTaskDetail('owner', detail, input)).rejects.toThrow()
    expect(mock.from).not.toHaveBeenCalled()
  })
  it('cannot process an already processed snapshot', async () => {
    await expect(saveTaskDetail('owner', { ...detail, status: 'done' }, { title: 'Changed', contexts: [] }, true)).rejects.toThrow()
    expect(mock.from).not.toHaveBeenCalled()
  })
})
