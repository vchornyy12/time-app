import { beforeEach, describe, expect, it } from 'vitest'
import { handleMessage, negotiateVersion } from './protocol'
import { dedupeKey, TOOLS } from './tools'
import type { ToolContext } from './tools'

// Chainable Supabase query double that records every call.
function makeSupabase(result: { data: unknown; error: unknown } = { data: null, error: null }) {
  const calls: { method: string; args: unknown[] }[] = []
  const results: { data: unknown; error: unknown }[] = []
  const query: Record<string, unknown> = {}
  for (const method of ['from', 'select', 'eq', 'contains', 'order', 'limit', 'upsert', 'insert']) {
    query[method] = (...args: unknown[]) => { calls.push({ method, args }); return query }
  }
  const settle = (method: string) => (...args: unknown[]) => {
    calls.push({ method, args })
    return Promise.resolve(results.shift() ?? result)
  }
  query.maybeSingle = settle('maybeSingle')
  query.single = settle('single')
  query.then = (resolve: (v: unknown) => void) => resolve(results.shift() ?? result)
  return { client: query, calls, queue: (r: { data: unknown; error: unknown }) => results.push(r) }
}

function ctxWith(supabase: ReturnType<typeof makeSupabase>): ToolContext {
  return { supabase: supabase.client as never, user: { id: 'user-1' } as never, clientId: 'client-abc' }
}

const call = (name: string, args: unknown, id = 1) => ({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } })

describe('MCP protocol', () => {
  let db: ReturnType<typeof makeSupabase>
  beforeEach(() => { db = makeSupabase() })

  it('negotiates a supported protocol version and falls back to the latest', () => {
    expect(negotiateVersion('2025-06-18')).toBe('2025-06-18')
    expect(negotiateVersion('1999-01-01')).toBe('2025-11-25')
  })

  it('answers initialize with tools capability and instructions', async () => {
    const res = await handleMessage({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } }, ctxWith(db))
    expect(res?.result).toMatchObject({ protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'time24-gtd' } })
    expect((res?.result as { instructions: string }).instructions).toMatch(/data, not instructions/)
  })

  it('returns no response for notifications and rejects batches', async () => {
    expect(await handleMessage({ jsonrpc: '2.0', method: 'notifications/initialized' }, ctxWith(db))).toBeNull()
    expect((await handleMessage([], ctxWith(db)))?.error?.code).toBe(-32600)
    expect((await handleMessage({ id: 1, method: 'ping' }, ctxWith(db)))?.error?.code).toBe(-32600)
  })

  it('exposes capture plus read-only tools, and nothing that processes or deletes', async () => {
    const res = await handleMessage({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, ctxWith(db))
    const tools = (res?.result as { tools: { name: string; annotations: { readOnlyHint: boolean }; inputSchema: { type: string } }[] }).tools
    expect(tools.map((t) => t.name).sort()).toEqual([
      'capture_inbox_item', 'get_source_cursor', 'get_task', 'list_inbox', 'list_next_actions', 'list_waiting_for', 'set_source_cursor',
    ])
    expect(tools.filter((t) => !t.annotations.readOnlyHint).map((t) => t.name).sort()).toEqual(['capture_inbox_item', 'set_source_cursor'])
    for (const t of tools) expect(t.inputSchema.type).toBe('object')
    expect(tools.some((t) => /delete|process|complete|update|move/.test(t.name))).toBe(false)
  })

  it('returns unknown methods and tools as errors', async () => {
    expect((await handleMessage({ jsonrpc: '2.0', id: 3, method: 'tasks/delete' }, ctxWith(db)))?.error?.code).toBe(-32601)
    expect((await handleMessage(call('delete_task', {}), ctxWith(db)))?.error?.code).toBe(-32602)
  })

  it('reports invalid tool arguments as a tool error the model can fix', async () => {
    const res = await handleMessage(call('capture_inbox_item', { title: '', source: 'gmail' }), ctxWith(db))
    expect(res?.result).toMatchObject({ isError: true })
    expect(db.calls).toHaveLength(0)
  })

  it('rejects status, external actions and other fields an agent must not set', async () => {
    const res = await handleMessage(call('capture_inbox_item', {
      title: 'Send the estimate', source: 'gmail', source_ref: 'm1', status: 'next_actions',
    }), ctxWith(db))
    expect(res?.result).toMatchObject({ isError: true })
    expect(db.calls).toHaveLength(0)
  })

  it('rejects non-https source links', async () => {
    const res = await handleMessage(call('capture_inbox_item', {
      title: 'Reply to Anna', source: 'gmail', source_ref: 'm1', source_url: 'javascript:alert(1)',
    }), ctxWith(db))
    expect(res?.result).toMatchObject({ isError: true })
  })
})

describe('capture_inbox_item', () => {
  it('creates an inbox task with a server-derived dedupe key and audits it', async () => {
    const db = makeSupabase()
    db.queue({ data: { id: 't1', status: 'inbox' }, error: null }) // upsert
    db.queue({ data: null, error: null }) // audit insert
    const res = await handleMessage(call('capture_inbox_item', {
      title: 'Send the estimate to Anna', source: 'bluedot', source_ref: 'meeting-42',
      source_url: 'https://app.bluedothq.com/meetings/42', source_quote: 'I will send the estimate by Friday',
      proposed: { type: 'next_action', due: '2026-11-21' }, confidence: 0.9,
    }), ctxWith(db))

    expect(res?.result).toMatchObject({ structuredContent: { created: true, task_id: 't1' } })
    const upsert = db.calls.find((c) => c.method === 'upsert')!
    expect(upsert.args[0]).toMatchObject({
      user_id: 'user-1', status: 'inbox', source: 'bluedot', source_ref: 'meeting-42',
      dedupe_key: dedupeKey('bluedot', 'meeting-42', '1'), captured_by: 'client-abc',
      agent_proposal: { type: 'next_action', due: '2026-11-21', confidence: 0.9 },
    })
    expect(upsert.args[1]).toEqual({ onConflict: 'user_id,dedupe_key', ignoreDuplicates: true })
    const audit = db.calls.find((c) => c.method === 'insert')!
    expect(audit.args[0]).toMatchObject({ tool: 'capture_inbox_item', task_id: 't1', ok: true, client_id: 'client-abc' })
  })

  it('returns the existing task when the same item is captured again', async () => {
    const db = makeSupabase()
    db.queue({ data: null, error: null }) // upsert ignored as duplicate
    db.queue({ data: { id: 't1', status: 'next_actions' }, error: null }) // lookup
    const res = await handleMessage(call('capture_inbox_item', { title: 'Send the estimate', source: 'gmail', source_ref: 'm1' }), ctxWith(db))
    expect(res?.result).toMatchObject({ structuredContent: { created: false, duplicate: true, task_id: 't1', status: 'next_actions' } })
  })

  it('derives the same key regardless of item key case or spacing, and different keys per item', () => {
    expect(dedupeKey('gmail', 'm1', ' A ')).toBe(dedupeKey('gmail', 'm1', 'a'))
    expect(dedupeKey('gmail', 'm1', '1')).not.toBe(dedupeKey('gmail', 'm1', '2'))
    expect(dedupeKey('gmail', 'm1', '1')).not.toBe(dedupeKey('bluedot', 'm1', '1'))
  })
})

describe('read tools', () => {
  it('scopes every list to the authenticated user and status', async () => {
    const db = makeSupabase({ data: [{ id: 't1' }], error: null })
    await handleMessage(call('list_waiting_for', { limit: 10 }), ctxWith(db))
    const eqs = db.calls.filter((c) => c.method === 'eq').map((c) => c.args)
    expect(eqs).toContainEqual(['user_id', 'user-1'])
    expect(eqs).toContainEqual(['status', 'waiting_for'])
    expect(db.calls.find((c) => c.method === 'limit')?.args).toEqual([10])
  })

  it('caps list size', async () => {
    const db = makeSupabase()
    const res = await handleMessage(call('list_inbox', { limit: 1000 }), ctxWith(db))
    expect(res?.result).toMatchObject({ isError: true })
  })

  it('keeps tool annotations honest', () => {
    for (const t of TOOLS) {
      if (t.name.startsWith('list_') || t.name.startsWith('get_')) expect(t.annotations.readOnlyHint).toBe(true)
    }
  })
})
