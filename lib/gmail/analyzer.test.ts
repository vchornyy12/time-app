import { beforeEach, describe, expect, it, vi } from 'vitest'
import { analyzeGmailBatch } from './analyzer'
import { LLMProviderError } from '@/lib/llm'

type Row = Record<string, unknown>

const db = vi.hoisted(() => ({
  llm: { provider: 'openai', model: 'gpt-6-luna', connected: true } as Record<string, unknown>,
  ledger: [] as Array<Record<string, unknown>>,
  suggestions: [] as Array<Record<string, unknown>>,
  retrieve: vi.fn(),
  suggest: vi.fn(),
}))

// Minimal in-memory stand-in for the Supabase query builder used by the analyzer.
function makeQuery(table: string) {
  const filters: Array<(row: Row) => boolean> = []
  let operation: 'select' | 'update' | 'upsert' = 'select'
  let values: Row | Row[] = {}
  const rows = () => table === 'gmail_processed_messages' ? db.ledger : db.suggestions
  const execute = () => {
    if (table === 'user_llm_settings') return { data: db.llm, error: null }
    if (table === 'gmail_integrations') return { data: { account_email: 'user@example.test', connected: true }, error: null }
    if (operation === 'upsert') {
      const saved = (values as Row[]).map(value => {
        const existing = db.suggestions.find(row => row.message_id === value.message_id)
        if (existing) return Object.assign(existing, value)
        const created = { status: 'pending', ...value }
        db.suggestions.push(created)
        return created
      })
      return { data: saved, error: null }
    }
    const matched = rows().filter(row => filters.every(filter => filter(row)))
    if (operation === 'update') for (const row of matched) Object.assign(row, values)
    return { data: matched, error: null }
  }
  const query = {
    select: () => query,
    limit: () => query,
    eq: (column: string, value: unknown) => { filters.push(row => row[column] === value); return query },
    in: (column: string, value: unknown[]) => { filters.push(row => value.includes(row[column])); return query },
    lt: (column: string, value: string | number) => { filters.push(row => row[column] != null && (row[column] as string | number) < value); return query },
    update: (input: Row) => { operation = 'update'; values = input; return query },
    upsert: (input: Row[]) => { operation = 'upsert'; values = input; return query },
    maybeSingle: async () => {
      const result = execute()
      return { data: Array.isArray(result.data) ? result.data[0] ?? null : result.data, error: null }
    },
    then: (resolve: (result: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(execute()).then(resolve, reject),
  }
  return query
}

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: (table: string) => makeQuery(table) }) }))
vi.mock('@/lib/llm/integration', () => ({ getUserLLMKey: async () => 'sk-test' }))
vi.mock('./messages', () => ({ retrieveInboxScanMessages: db.retrieve }))
vi.mock('@/lib/llm', async () => ({
  LLMProviderError: (await vi.importActual<typeof import('@/lib/llm/tasks')>('@/lib/llm/tasks')).LLMProviderError,
  suggestEmailTasks: db.suggest,
}))

const owner = { user_id: 'user-1', account_email: 'user@example.test' }
const queued = (message_id: string, extra: Row = {}) => ({ ...owner, message_id, status: 'pending', attempts: 0, claimed_at: null, processed_at: null, ...extra })
const message = (id: string, text = `Body ${id}`) => ({ id, subject: `Subject ${id}`, from: `${id}@example.test`, date: '2026-11-13T09:00:00.000Z', text })
const row = (id: string) => db.ledger.find(entry => entry.message_id === id)!

beforeEach(() => {
  vi.resetAllMocks()
  db.ledger = []
  db.suggestions = []
  db.llm = { provider: 'openai', model: 'gpt-6-luna', connected: true }
})

describe('analyzeGmailBatch', () => {
  it('finishes emails without a task and keeps suggested emails awaiting review', async () => {
    db.ledger = [queued('task'), queued('no-task')]
    db.retrieve.mockResolvedValue({ messages: [message('task'), message('no-task')], skipped: 0 })
    db.suggest.mockResolvedValue([{ sourceIndex: 0, title: 'Send the report' }, { sourceIndex: 1, title: null }])

    expect(await analyzeGmailBatch('user-1')).toEqual({ analyzed: 2, suggestions: 1 })

    expect(row('no-task')).toMatchObject({ status: 'processed', attempts: 1, claimed_at: null })
    expect(row('no-task').processed_at).toEqual(expect.any(String))
    expect(row('task')).toMatchObject({ status: 'processing', attempts: 1 })
    expect(row('task').claimed_at).toEqual(expect.any(String))
    expect(db.suggestions).toEqual([expect.objectContaining({ message_id: 'task', title: 'Send the report', status: 'pending' })])
  })

  it('resolves empty and deleted messages without calling the model', async () => {
    db.ledger = [queued('empty')]
    db.retrieve.mockResolvedValue({ messages: [message('empty', '   ')], skipped: 2 })

    expect(await analyzeGmailBatch('user-1')).toEqual({ analyzed: 3, suggestions: 0 })

    expect(db.suggest).not.toHaveBeenCalled()
    expect(row('empty').status).toBe('processed')
  })

  it('does not spend a retry attempt when the provider fails', async () => {
    db.ledger = [queued('a'), queued('b', { status: 'failed', attempts: 2 })]
    db.retrieve.mockResolvedValue({ messages: [message('a'), message('b')], skipped: 0 })
    db.suggest.mockRejectedValue(new LLMProviderError('OpenAI could not analyze these messages.', 401))

    await expect(analyzeGmailBatch('user-1')).rejects.toBeInstanceOf(LLMProviderError)

    expect(row('a')).toMatchObject({ status: 'pending', attempts: 0, claimed_at: null })
    expect(row('b')).toMatchObject({ status: 'pending', attempts: 2, claimed_at: null })
  })

  it('counts an attempt when the model output for these emails is unusable', async () => {
    db.ledger = [queued('a')]
    db.retrieve.mockResolvedValue({ messages: [message('a')], skipped: 0 })
    db.suggest.mockRejectedValue(new Error('OpenAI returned an invalid suggestion list.'))

    await expect(analyzeGmailBatch('user-1')).rejects.toThrow('invalid suggestion list')

    expect(row('a')).toMatchObject({ status: 'failed', attempts: 1, claimed_at: null })
  })

  it('requeues claims abandoned by an interrupted worker but not emails awaiting review', async () => {
    const longAgo = new Date(Date.now() - 60 * 60_000).toISOString()
    db.ledger = [
      queued('orphan', { status: 'processing', attempts: 1, claimed_at: longAgo }),
      queued('in-review', { status: 'processing', attempts: 1, claimed_at: longAgo }),
      queued('in-flight', { status: 'processing', attempts: 1, claimed_at: new Date().toISOString() }),
    ]
    db.suggestions = [{ ...owner, message_id: 'in-review', status: 'pending', title: 'Reply to Sam' }]
    db.retrieve.mockResolvedValue({ messages: [], skipped: 0 })

    expect(await analyzeGmailBatch('user-1')).toEqual({ analyzed: 0, suggestions: 0 })

    expect(row('orphan')).toMatchObject({ status: 'failed', attempts: 1, claimed_at: null })
    expect(row('in-review').status).toBe('processing')
    expect(row('in-flight').status).toBe('processing')
  })

  it.each([
    ['anthropic', 'claude-sonnet-5-5', 'claude-sonnet-5-5'],
    ['openai', 'gpt-4o-mini', 'gpt-6-luna'], // retired model saved earlier falls back to the default
  ])('calls the connected provider %s (saved model %s)', async (provider, saved, used) => {
    db.llm = { provider, model: saved, connected: true }
    db.ledger = [queued('a')]
    db.retrieve.mockResolvedValue({ messages: [message('a')], skipped: 0 })
    db.suggest.mockResolvedValue([{ sourceIndex: 0, title: null }])

    await analyzeGmailBatch('user-1')

    expect(db.suggest).toHaveBeenCalledWith({ provider, key: 'sk-test', model: used }, [expect.objectContaining({ subject: 'Subject a' })])
  })

  it('refuses to scan with an unknown provider', async () => {
    db.llm = { provider: 'other', model: 'x', connected: true }
    await expect(analyzeGmailBatch('user-1')).rejects.toThrow('Connect an AI provider key')
    expect(db.retrieve).not.toHaveBeenCalled()
  })

  it('passes the discover flag through to message retrieval', async () => {
    db.retrieve.mockResolvedValue({ messages: [], skipped: 0 })

    await analyzeGmailBatch('user-1', 5, { discover: false })

    expect(db.retrieve).toHaveBeenCalledWith('user-1', 5, { discover: false })
  })
})
