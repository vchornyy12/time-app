// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ notifyUser: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/assistant/notify', () => ({ notifyUser: mocks.notifyUser }))
vi.mock('@/lib/google-chat/client', async (orig) => ({ ...(await orig<object>()), ChatSession: { open: vi.fn() } }))

const { handleMessage } = await import('./protocol')

type Result = { data?: unknown; error?: unknown; count?: number | null }
function fakeDb() {
  const calls: { method: string; args: unknown[] }[] = []
  const results: Result[] = []
  const q: Record<string, unknown> = {}
  for (const m of ['from', 'select', 'eq', 'in', 'not', 'gte', 'order', 'limit', 'upsert', 'insert']) {
    q[m] = (...args: unknown[]) => { calls.push({ method: m, args }); return q }
  }
  const settle = (m: string) => (...args: unknown[]) => { calls.push({ method: m, args }); return Promise.resolve(results.shift() ?? { data: null, error: null }) }
  q.maybeSingle = settle('maybeSingle')
  q.single = settle('single')
  q.rpc = settle('rpc')
  q.then = (resolve: (v: unknown) => void) => resolve(results.shift() ?? { data: null, error: null })
  return { client: q, calls, queue: (...r: Result[]) => results.push(...r) }
}
const ctx = (db: ReturnType<typeof fakeDb>) => ({ supabase: db.client as never, user: { id: 'user-1' } as never, clientId: 'client-abc' })
const call = (name: string, args: unknown) => ({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } })
const out = (res: unknown) => (res as { result: { structuredContent?: Record<string, unknown>; isError?: boolean; content: { text: string }[] } }).result

beforeEach(() => vi.clearAllMocks())

describe('processed-items ledger', () => {
  it('returns only refs the agent has not handled, deduplicated', async () => {
    const db = fakeDb()
    db.queue({ data: [{ source_ref: 'm1' }], error: null })
    const res = out(await handleMessage(call('filter_unprocessed', { source: 'gmail', source_refs: ['m1', 'm2', 'm2', 'm3'] }), ctx(db)))
    expect(res.structuredContent).toEqual({ source: 'gmail', unprocessed: ['m2', 'm3'], already_processed: 1 })
    const eqs = db.calls.filter((c) => c.method === 'eq').map((c) => c.args)
    expect(eqs).toContainEqual(['user_id', 'user-1'])
    expect(eqs).toContainEqual(['source', 'gmail'])
  })

  it('records non-captured items and refuses the "captured" outcome from the agent', async () => {
    const db = fakeDb()
    const res = out(await handleMessage(call('mark_processed', { source: 'google_chat', items: [{ source_ref: 'spaces/a/messages/b', outcome: 'noise' }] }), ctx(db)))
    expect(res.structuredContent).toEqual({ source: 'google_chat', recorded: 1 })
    const upsert = db.calls.find((c) => c.method === 'upsert')!
    expect(upsert.args[0]).toMatchObject([{ user_id: 'user-1', source: 'google_chat', source_ref: 'spaces/a/messages/b', outcome: 'noise' }])
    const bad = out(await handleMessage(call('mark_processed', { source: 'gmail', items: [{ source_ref: 'x', outcome: 'captured' }] }), ctx(fakeDb())))
    expect(bad.isError).toBe(true)
  })

  it('records a capture in the ledger', async () => {
    const db = fakeDb()
    db.queue({ data: { id: 't1', status: 'inbox' }, error: null })
    await handleMessage(call('capture_inbox_item', { title: 'Send the estimate', source: 'gmail', source_ref: 'm9' }), ctx(db))
    const ledger = db.calls.filter((c) => c.method === 'upsert').find((c) => (c.args[1] as { onConflict: string }).onConflict === 'user_id,source,source_ref')
    expect(ledger?.args[0]).toMatchObject([{ source: 'gmail', source_ref: 'm9', outcome: 'captured', task_id: 't1' }])
  })
})

describe('propose_task_update', () => {
  const task = '11111111-1111-4111-8111-111111111111'

  it('requires a draft for follow-ups and a Jira payload for issues', async () => {
    const a = out(await handleMessage(call('propose_task_update', { task_id: task, kind: 'follow_up', reason: 'Overdue' }), ctx(fakeDb())))
    expect(a.isError).toBe(true)
    const b = out(await handleMessage(call('propose_task_update', { task_id: task, kind: 'jira_issue', reason: 'Track it' }), ctx(fakeDb())))
    expect(b.isError).toBe(true)
  })

  it('stores a pending suggestion only for an open task of the user', async () => {
    const db = fakeDb()
    db.queue({ data: { id: task, status: 'waiting_for' }, error: null }, { data: { id: 's1' }, error: null })
    const res = out(await handleMessage(call('propose_task_update', {
      task_id: task, kind: 'close', reason: 'Oleh said the build is shared', evidence_url: 'https://chat.google.com/dm/x',
    }), ctx(db)))
    expect(res.structuredContent).toEqual({ created: true, suggestion_id: 's1' })
    const insert = db.calls.find((c) => c.method === 'insert')!
    expect(insert.args[0]).toMatchObject({ user_id: 'user-1', task_id: task, kind: 'close', captured_by: 'client-abc' })
    expect(insert.args[0]).not.toHaveProperty('status')
  })

  it('does not propose on finished tasks and reports pending duplicates', async () => {
    const done = fakeDb()
    done.queue({ data: { id: task, status: 'done' }, error: null })
    expect(out(await handleMessage(call('propose_task_update', { task_id: task, kind: 'close', reason: 'x' }), ctx(done))).structuredContent)
      .toMatchObject({ created: false })
    const dup = fakeDb()
    dup.queue({ data: { id: task, status: 'waiting_for' }, error: null }, { data: null, error: { code: '23505' } })
    expect(out(await handleMessage(call('propose_task_update', { task_id: task, kind: 'close', reason: 'x' }), ctx(dup))).structuredContent)
      .toMatchObject({ created: false, duplicate: true })
  })
})

describe('approved actions', () => {
  it('records results through the guarded database function', async () => {
    const db = fakeDb()
    const id = '22222222-2222-4222-8222-222222222222'
    const res = out(await handleMessage(call('complete_approved_action', { suggestion_id: id, ok: true, external_ref: 'N30-200' }), ctx(db)))
    expect(res.structuredContent).toMatchObject({ status: 'executed', external_ref: 'N30-200' })
    expect(db.calls.find((c) => c.method === 'rpc')?.args).toEqual(['complete_agent_suggestion', { p_suggestion_id: id, p_ok: true, p_external_ref: 'N30-200' }])
    const missingRef = out(await handleMessage(call('complete_approved_action', { suggestion_id: id, ok: true }), ctx(fakeDb())))
    expect(missingRef.isError).toBe(true)
  })
})

describe('notify_user', () => {
  it('sends and audits within the daily limit', async () => {
    const db = fakeDb()
    db.queue({ count: 3, error: null })
    const res = out(await handleMessage(call('notify_user', { text: 'Morning digest', kind: 'digest' }), ctx(db)))
    expect(res.structuredContent).toEqual({ sent: true, kind: 'digest' })
    expect(mocks.notifyUser).toHaveBeenCalledWith('user-1', 'Morning digest')
  })

  it('stops at the daily limit without sending', async () => {
    const db = fakeDb()
    db.queue({ count: 30, error: null })
    const res = out(await handleMessage(call('notify_user', { text: 'One more', kind: 'urgent' }), ctx(db)))
    expect(res.isError).toBe(true)
    expect(mocks.notifyUser).not.toHaveBeenCalled()
  })
})

describe('chat_messages_since paging', () => {
  const space = (name: string, lastActiveTime: string) => ({ name, lastActiveTime })
  const msg = (space: string, n: number, minute: number, text = 'hello') =>
    ({ name: `${space}/messages/${n}`, createTime: `2026-11-19T10:${String(minute).padStart(2, '0')}:00.000Z`, text })
  async function session(raw: Record<string, ReturnType<typeof msg>[]>) {
    const { ChatSession } = await import('@/lib/google-chat/client')
    vi.mocked(ChatSession.open).mockResolvedValue({
      recentSpaces: async () => Object.keys(raw).map((s) => space(s, '2026-11-19T11:00:00.000Z')),
      rawMessages: async (s: string, o: { limit: number }) => raw[s].slice(0, o.limit),
      describe: async (s: { name: string }) => ({ space: s.name, title: s.name === 'spaces/m' ? 'Kudos Hub' : s.name }),
      format: async (_s: unknown, m: { name: string; text: string }) => ({ message_name: m.name, text: m.text }),
    } as never)
  }
  const page = async (args: object, ledger: string[] = []) => {
    const db = fakeDb()
    db.queue({ data: { instructions: '', muted: ['Kudos'] }, error: null }, { data: ledger.map((source_ref) => ({ source_ref })), error: null })
    return out(await handleMessage(call('chat_messages_since', { since: '2026-11-19T09:00:00Z', ...args }), ctx(db))).structuredContent as {
      newest_message_at: string; has_more: boolean; conversations: { space: string; messages: { message_name: string }[] }[]
    }
  }

  it('returns everything and moves the cursor past muted messages when it fits', async () => {
    await session({ 'spaces/a': [msg('spaces/a', 1, 1), msg('spaces/a', 2, 5)], 'spaces/m': [msg('spaces/m', 1, 9)] })
    const res = await page({})
    expect(res.has_more).toBe(false)
    expect(res.newest_message_at).toBe('2026-11-19T10:09:00.000Z')
    expect(res.conversations.map((c) => c.space)).toEqual(['spaces/a'])
  })

  it('stops at the text budget and sets the cursor to the last returned message', async () => {
    const long = 'x'.repeat(1800)
    await session({ 'spaces/a': [msg('spaces/a', 1, 1, long), msg('spaces/a', 2, 3, long)], 'spaces/b': [msg('spaces/b', 1, 2, long)] })
    const res = await page({ max_chars: 2500 })
    expect(res.has_more).toBe(true)
    expect(res.newest_message_at).toBe('2026-11-19T10:01:00.000Z')
    expect(res.conversations.flatMap((c) => c.messages.map((m) => m.message_name))).toEqual(['spaces/a/messages/1'])
  })

  it('never moves the cursor past a conversation that was cut by the per-conversation limit', async () => {
    await session({ 'spaces/a': [msg('spaces/a', 1, 1), msg('spaces/a', 2, 2), msg('spaces/a', 3, 8)], 'spaces/b': [msg('spaces/b', 1, 5)] })
    const res = await page({ limit_per_conversation: 2 })
    expect(res.has_more).toBe(true)
    expect(res.newest_message_at).toBe('2026-11-19T10:02:00.000Z')
    expect(res.conversations.flatMap((c) => c.messages.map((m) => m.message_name))).toEqual(['spaces/a/messages/1', 'spaces/a/messages/2'])
  })

  it('skips ledger messages without spending the budget', async () => {
    await session({ 'spaces/a': [msg('spaces/a', 1, 1), msg('spaces/a', 2, 2)] })
    const res = await page({}, ['spaces/a/messages/1'])
    expect(res.conversations[0].messages.map((m) => m.message_name)).toEqual(['spaces/a/messages/2'])
    expect(res.newest_message_at).toBe('2026-11-19T10:02:00.000Z')
  })
})
