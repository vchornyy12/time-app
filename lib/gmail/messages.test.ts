import { beforeEach, describe, expect, it, vi } from 'vitest'
import { retrieveInboxScanMessages } from './messages'

interface LedgerRow {
  user_id: string
  account_email: string
  message_id: string
  status: 'pending' | 'processing' | 'processed' | 'failed' | 'skipped'
  attempts: number
  incremental_eligible: boolean
  created_at: string
}

interface ScanRun { user_id: string; account_email: string; status: string; created_at: string }

const mocks = vi.hoisted(() => ({
  integration: null as null | { account_email: string; connected: boolean; scan_cursor_at: string | null },
  runs: [] as ScanRun[],
  ledger: [] as LedgerRow[],
  listPages: [] as Array<{ ids: string[]; nextPageToken?: string }>,
  gmailMessages: {} as Record<string, { internalDate: string; subject: string; from: string; text: string; labelIds?: string[] }>,
  requests: [] as URL[],
  from: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: mocks.from, rpc: mocks.rpc }),
}))

function makeQuery(table: string) {
  let operation: 'select' | 'insert' | 'update' = 'select'
  let values: Partial<LedgerRow> | Partial<LedgerRow>[] = {}
  const filters: Array<{ column: string; value: unknown; kind: 'eq' | 'in' }> = []
  const orders: Array<{ column: string; ascending: boolean }> = []
  let rowLimit = Infinity
  let pendingOr = false

  const matches = (row: Record<string, unknown>) => filters.every(filter => {
    if (filter.kind === 'eq') return row[filter.column] === filter.value
    return (filter.value as unknown[]).includes(row[filter.column])
  }) && (!pendingOr || row.status === 'pending' || (row.status === 'failed' && Number(row.attempts) < 3))

  const execute = () => {
    if (table === 'gmail_integrations') return { data: mocks.integration, error: null }
    if (table === 'gmail_scan_runs') {
      const result = mocks.runs.filter(row => matches(row as unknown as Record<string, unknown>))
      for (const order of orders) result.sort((left, right) =>
        (left[order.column as keyof ScanRun] < right[order.column as keyof ScanRun] ? -1 : 1) * (order.ascending ? 1 : -1))
      return { data: result.slice(0, rowLimit), error: null }
    }
    if (table !== 'gmail_processed_messages') return { data: [], error: null }
    if (operation === 'insert') {
      const rows = Array.isArray(values) ? values : [values]
      mocks.ledger.push(...rows as LedgerRow[])
      return { data: null, error: null }
    }
    const rows = mocks.ledger.filter(row => matches(row as unknown as Record<string, unknown>))
    if (operation === 'update') {
      for (const row of rows) Object.assign(row, values)
      return { data: null, error: null }
    }
    for (const order of orders) rows.sort((left, right) =>
      (left[order.column as keyof LedgerRow] < right[order.column as keyof LedgerRow] ? -1 : 1) * (order.ascending ? 1 : -1))
    return { data: rows.slice(0, rowLimit), error: null }
  }

  const query = {
    select: () => query,
    eq: (column: string, value: unknown) => { filters.push({ column, value, kind: 'eq' }); return query },
    in: (column: string, value: unknown[]) => { filters.push({ column, value, kind: 'in' }); return query },
    or: () => { pendingOr = true; return query },
    order: (column: string, options?: { ascending?: boolean }) => { orders.push({ column, ascending: options?.ascending ?? true }); return query },
    limit: (value: number) => { rowLimit = value; return query },
    insert: (input: Partial<LedgerRow> | Partial<LedgerRow>[]) => { operation = 'insert'; values = input; return query },
    update: (input: Partial<LedgerRow>) => { operation = 'update'; values = input; return query },
    maybeSingle: async () => {
      const result = execute() as { data: unknown[] | object | null; error: null }
      return { data: Array.isArray(result.data) ? result.data[0] ?? null : result.data, error: null }
    },
    then: (resolve: (result: { data: unknown; error: null }) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(execute()).then(resolve, reject),
  }
  return query
}

function email(id: string, receivedAt = '2026-11-13T09:00:00.000Z') {
  return { internalDate: String(new Date(receivedAt).getTime()), subject: `Subject ${id}`, from: `${id}@example.test`, text: `Body ${id}`, labelIds: ['INBOX'] }
}

function response(body: unknown, ok = true) {
  return new Response(JSON.stringify(body), { status: ok ? 200 : 500, headers: { 'Content-Type': 'application/json' } })
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.integration = { account_email: 'user@example.test', connected: true, scan_cursor_at: null }
  mocks.runs = [{ user_id: 'user-1', account_email: 'user@example.test', status: 'running', created_at: '2026-11-13T10:00:00.000Z' }]
  mocks.ledger = []
  mocks.listPages = []
  mocks.gmailMessages = {}
  mocks.requests = []
  mocks.from.mockImplementation((table: string) => makeQuery(table))
  mocks.rpc.mockResolvedValue({ data: 'refresh-token', error: null })
  vi.stubEnv('GMAIL_CLIENT_ID', 'test-client')
  vi.stubEnv('GMAIL_CLIENT_SECRET', 'test-secret')
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input.toString() : input.url)
    mocks.requests.push(url)
    if (url.hostname === 'oauth2.googleapis.com') return response({ access_token: 'access-token' })
    if (url.pathname.endsWith('/messages') && !url.pathname.includes('/messages/')) {
      const pageIndex = url.searchParams.get('pageToken') ? Number(url.searchParams.get('pageToken')) : 0
      const page = mocks.listPages[pageIndex] ?? { ids: [] }
      return response({ messages: page.ids.map(id => ({ id })), nextPageToken: page.nextPageToken ? String(pageIndex + 1) : undefined })
    }
    const id = decodeURIComponent(url.pathname.split('/').pop() ?? '')
    const message = mocks.gmailMessages[id]
    if (!message) return response({}, false)
    if (url.searchParams.get('format') === 'metadata') return response({ id, internalDate: message.internalDate, labelIds: message.labelIds })
    const data = Buffer.from(message.text).toString('base64url')
    return response({ id, internalDate: message.internalDate, payload: {
      headers: [{ name: 'subject', value: message.subject }, { name: 'from', value: message.from }],
      mimeType: 'text/plain', body: { data },
    } })
  }))
})

describe('incremental Gmail scans', () => {
  it('starts a first scan with the newest requested Inbox messages only', async () => {
    mocks.listPages = [{ ids: ['newest', 'next', 'older'] }]
    mocks.gmailMessages = { newest: email('newest'), next: email('next'), older: email('older') }

    const messages = await retrieveInboxScanMessages('user-1', 2)

    expect(messages.map(message => message.id)).toEqual(['newest', 'next'])
    expect(mocks.ledger.map(row => row.message_id)).toEqual(['newest', 'next'])
    expect(mocks.ledger.every(row => !row.incremental_eligible && row.status === 'pending')).toBe(true)
    expect(mocks.requests.find(url => url.pathname.endsWith('/messages'))?.searchParams.get('q')).toBe('in:inbox')
    expect(mocks.requests.some(url => url.pathname.endsWith('/messages/older'))).toBe(false)
  })

  it('queues only mail after the prior successful cursor and preserves new-mail overflow for later batches', async () => {
    const cursor = '2026-11-12T10:00:00.000Z'
    mocks.integration!.scan_cursor_at = cursor
    mocks.runs.push({ user_id: 'user-1', account_email: 'user@example.test', status: 'completed', created_at: cursor })
    mocks.ledger = [{ user_id: 'user-1', account_email: 'user@example.test', message_id: 'already-scanned', status: 'processed', attempts: 1, incremental_eligible: false, created_at: cursor }]
    mocks.listPages = [{ ids: ['already-scanned', 'newest', 'next-new'] }]
    mocks.gmailMessages = { 'already-scanned': email('already-scanned', cursor), newest: email('newest'), 'next-new': email('next-new') }

    const messages = await retrieveInboxScanMessages('user-1', 1)

    expect(messages.map(message => message.id)).toEqual(['newest'])
    expect(mocks.ledger.map(row => row.message_id)).toEqual(['already-scanned', 'newest', 'next-new'])
    expect(mocks.ledger.filter(row => row.incremental_eligible).map(row => row.message_id)).toEqual(['newest', 'next-new'])
    const listRequest = mocks.requests.find(url => url.pathname.endsWith('/messages'))
    expect(listRequest?.searchParams.get('q')).toBe(`in:inbox after:${Math.floor(new Date(cursor).getTime() / 1000)}`)
    expect(mocks.requests.some(url => url.pathname.endsWith('/messages/already-scanned'))).toBe(false)
    expect(mocks.integration?.scan_cursor_at).toBe(cursor)
  })

  it('does not pull historical pending messages into a later incremental scan', async () => {
    const cursor = '2026-11-12T10:00:00.000Z'
    mocks.integration!.scan_cursor_at = cursor
    mocks.runs.push({ user_id: 'user-1', account_email: 'user@example.test', status: 'completed', created_at: cursor })
    mocks.ledger = [{ user_id: 'user-1', account_email: 'user@example.test', message_id: 'historical-pending', status: 'pending', attempts: 0, incremental_eligible: false, created_at: cursor }]
    mocks.listPages = [{ ids: [] }]

    const messages = await retrieveInboxScanMessages('user-1', 5)

    expect(messages).toEqual([])
    expect(mocks.ledger).toHaveLength(1)
    expect(mocks.requests.some(url => url.pathname.endsWith('/messages/historical-pending'))).toBe(false)
  })

  it('does not advance the stored cursor while a scan is still running', async () => {
    const cursor = '2026-11-12T10:00:00.000Z'
    mocks.integration!.scan_cursor_at = cursor
    mocks.runs.push({ user_id: 'user-1', account_email: 'user@example.test', status: 'completed', created_at: cursor })
    mocks.listPages = [{ ids: [] }]

    await retrieveInboxScanMessages('user-1', 5)

    expect(mocks.integration?.scan_cursor_at).toBe(cursor)
  })
})
