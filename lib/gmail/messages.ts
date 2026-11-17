import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { htmlToText } from './text'

const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me'
const MAX_PAGES = 100
const MAX_TEXT = 12000

export class GmailApiError extends Error {
  constructor(readonly status: number) {
    super('Gmail request failed.')
    this.name = 'GmailApiError'
  }
}

async function gmailFetch(path: string, token: string, init?: RequestInit) {
  const response = await fetch(`${GMAIL}${path}`, {
    ...init, cache: 'no-store', signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${token}`, ...init?.headers },
  })
  if (!response.ok) throw new GmailApiError(response.status)
  return response.json()
}

export async function getGmailAccessToken(userId: string): Promise<string> {
  const { data, error } = await createAdminClient().rpc('get_gmail_integration_secret', { p_user_id: userId })
  if (error || typeof data !== 'string' || !data) throw new Error('Gmail is not connected.')
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.GMAIL_CLIENT_ID!, client_secret: process.env.GMAIL_CLIENT_SECRET!, refresh_token: data, grant_type: 'refresh_token' }),
  })
  if (!response.ok) throw new Error('Could not refresh Gmail access.')
  const result = await response.json()
  if (typeof result.access_token !== 'string') throw new Error('Gmail did not return an access token.')
  return result.access_token
}

function decodeText(value: string | undefined): string {
  if (!value) return ''
  try { return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8') } catch { return '' }
}

interface GmailPart {
  filename?: string
  mimeType?: string
  body?: { attachmentId?: string; data?: string }
  parts?: GmailPart[]
}

// Collect inline body parts of one MIME type; attachments are never read.
function collectParts(payload: GmailPart | undefined, mimeType: string): string {
  if (!payload || payload.filename || payload.body?.attachmentId) return ''
  if (payload.mimeType === mimeType) return decodeText(payload.body?.data)
  if (!Array.isArray(payload.parts)) return ''
  return payload.parts.map(part => collectParts(part, mimeType)).filter(Boolean).join('\n')
}

// Prefer the sender's plain-text alternative; fall back to HTML-only bodies.
function bodyText(payload: GmailPart | undefined): string {
  const plain = collectParts(payload, 'text/plain')
  return (plain.trim() ? plain : htmlToText(collectParts(payload, 'text/html'))).slice(0, MAX_TEXT)
}

export interface GmailMessagePreview { id: string; subject: string; from: string; date: string; text: string }

export interface GmailScanBatch {
  messages: GmailMessagePreview[]
  /** Queued messages that no longer exist in Gmail and were dropped from the queue. */
  skipped: number
}

interface GmailScanQueueRow {
  message_id: string
  status: 'pending' | 'processing' | 'processed' | 'failed' | 'skipped'
  attempts: number
  incremental_eligible: boolean
}

async function loadPendingIds(userId: string, accountEmail: string, limit: number, incremental: boolean): Promise<string[]> {
  const { data, error } = await createAdminClient().from('gmail_processed_messages')
    .select('message_id').eq('user_id', userId).eq('account_email', accountEmail)
    .eq('incremental_eligible', incremental)
    .or('status.eq.pending,and(status.eq.failed,attempts.lt.3)')
    .order('created_at', { ascending: true }).limit(limit)
  if (error) throw new Error('Could not load pending Gmail messages.')
  return (data ?? []).map(row => row.message_id)
}

export async function saveScanCursor(userId: string, scanStartedAt: string): Promise<void> {
  const { error } = await createAdminClient().from('gmail_integrations')
    .update({ scan_cursor_at: scanStartedAt }).eq('user_id', userId).eq('connected', true)
  if (error) throw new Error('Could not save the Gmail scan cursor.')
}

async function queueIncrementalInboxIds(
  userId: string,
  accountEmail: string,
  messageIds: string[],
  token: string,
  cursorAt: string,
): Promise<void> {
  const admin = createAdminClient()
  const cursorTime = new Date(cursorAt).getTime()
  const existing = new Map<string, GmailScanQueueRow>()
  for (let offset = 0; offset < messageIds.length; offset += 100) {
    const ids = messageIds.slice(offset, offset + 100)
    const { data, error } = await admin.from('gmail_processed_messages')
      .select('message_id,status,attempts,incremental_eligible').eq('user_id', userId)
      .eq('account_email', accountEmail).in('message_id', ids)
    if (error) throw new Error('Could not check previously scanned Gmail messages.')
    for (const row of (data ?? []) as GmailScanQueueRow[]) existing.set(row.message_id, row)
  }

  // Rows left over from before incremental scans are only reactivated when
  // Gmail confirms the message really arrived after the cursor.
  const legacyIds = messageIds.filter(id => {
    const row = existing.get(id)
    return !!row && !row.incremental_eligible && ['pending', 'failed', 'skipped'].includes(row.status)
      && row.attempts < 3
  })
  const freshLegacyIds: string[] = []
  for (let offset = 0; offset < legacyIds.length; offset += 10) {
    const checks = await Promise.all(legacyIds.slice(offset, offset + 10).map(async id => {
      try {
        const message = await gmailFetch(`/messages/${encodeURIComponent(id)}?format=metadata&fields=id,internalDate,labelIds`, token)
        const internalDate = Number(message.internalDate)
        return Number.isFinite(internalDate) && internalDate > cursorTime && (message.labelIds ?? []).includes('INBOX') ? id : null
      } catch (error) {
        if (error instanceof GmailApiError && error.status === 404) return null
        throw error
      }
    }))
    for (const id of checks) if (id) freshLegacyIds.push(id)
  }

  const now = Date.now()
  const toInsert = messageIds.filter(id => !existing.has(id)).map((message_id, index) => ({
    user_id: userId, account_email: accountEmail, message_id, status: 'pending', incremental_eligible: true,
    created_at: new Date(now - messageIds.length + index).toISOString(),
  }))
  if (toInsert.length) {
    const { error } = await admin.from('gmail_processed_messages').insert(toInsert)
    if (error) throw new Error('Could not queue new Gmail messages.')
  }

  if (freshLegacyIds.length) {
    const { error } = await admin.from('gmail_processed_messages').update({
      status: 'pending', incremental_eligible: true,
    }).eq('user_id', userId).eq('account_email', accountEmail).in('message_id', freshLegacyIds)
    if (error) throw new Error('Could not queue new Gmail messages.')
  }
}

async function queueInitialInboxMessages(userId: string, accountEmail: string, token: string, count: number): Promise<void> {
  const admin = createAdminClient()
  let remaining = count
  let pageToken: string | undefined
  for (let page = 0; remaining > 0 && page < MAX_PAGES; page++) {
    const query = new URLSearchParams({ maxResults: '100', q: 'in:inbox' })
    if (pageToken) query.set('pageToken', pageToken)
    const list = await gmailFetch(`/messages?${query}`, token)
    const pageIds: string[] = (list.messages ?? []).map((message: { id: string }) => message.id)
    if (!pageIds.length) break
    const { data: prior, error } = await admin.from('gmail_processed_messages')
      .select('message_id').eq('user_id', userId).eq('account_email', accountEmail)
      .in('message_id', pageIds)
    if (error) throw new Error('Could not check previously scanned Gmail messages.')
    const known = new Set((prior ?? []).map(row => row.message_id))
    const newIds = pageIds.filter(id => !known.has(id)).slice(0, remaining)
    if (newIds.length) {
      const now = Date.now()
      const { error: insertError } = await admin.from('gmail_processed_messages').insert(newIds.map((message_id, index) => ({
        user_id: userId, account_email: accountEmail, message_id, status: 'pending', incremental_eligible: false,
        created_at: new Date(now - newIds.length + index).toISOString(),
      })))
      if (insertError) throw new Error('Could not reserve Gmail messages for processing.')
      remaining -= newIds.length
    }
    pageToken = list.nextPageToken
    if (!pageToken) break
  }
}

async function retrieveFullMessages(token: string, ids: string[]): Promise<{ messages: GmailMessagePreview[]; goneIds: string[] }> {
  const settled = await Promise.allSettled(ids.map(async id => {
    const message = await gmailFetch(`/messages/${encodeURIComponent(id)}?format=full`, token)
    const headers = message.payload?.headers ?? []
    const header = (name: string) => headers.find((item: { name: string }) => item.name.toLowerCase() === name)?.value ?? ''
    const timestamp = Number(message.internalDate)
    if (!Number.isFinite(timestamp)) return null
    return { id, subject: header('subject').slice(0, 500), from: header('from').slice(0, 500),
      date: new Date(timestamp).toISOString(), text: bodyText(message.payload) }
  }))
  const messages: GmailMessagePreview[] = []
  const goneIds: string[] = []
  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      if (result.value) messages.push(result.value)
      else goneIds.push(ids[index])
    } else if (result.reason instanceof GmailApiError && result.reason.status === 404) {
      // Deleted after it was queued. Without this, the same ID would be picked
      // first by every later scan and fail it.
      goneIds.push(ids[index])
    } else {
      throw result.reason
    }
  })
  return { messages, goneIds }
}

async function loadBatch(userId: string, accountEmail: string, token: string, ids: string[]): Promise<GmailScanBatch> {
  if (!ids.length) return { messages: [], skipped: 0 }
  const { messages, goneIds } = await retrieveFullMessages(token, ids)
  if (goneIds.length) {
    const { error } = await createAdminClient().from('gmail_processed_messages').update({ status: 'skipped' })
      .eq('user_id', userId).eq('account_email', accountEmail).in('message_id', goneIds)
      .in('status', ['pending', 'failed'])
    if (error) throw new Error('Could not update Gmail processing status.')
  }
  return { messages, skipped: goneIds.length }
}

/**
 * Load the next batch of queued messages for the user's running scan.
 * `discover` lists new Inbox mail since the cursor; later batches of the same
 * run pass `false` and only drain the queue the first batch built.
 */
export async function retrieveInboxScanMessages(userId: string, limit = 5, { discover = true }: { discover?: boolean } = {}): Promise<GmailScanBatch> {
  const batchLimit = Math.max(1, Math.min(5, Math.floor(limit)))
  const admin = createAdminClient()
  const [{ data: integration, error: integrationError }, { data: activeRun, error: activeRunError }] = await Promise.all([
    admin.from('gmail_integrations').select('account_email,connected,scan_cursor_at').eq('user_id', userId).maybeSingle(),
    admin.from('gmail_scan_runs').select('created_at').eq('user_id', userId).eq('status', 'running')
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  if (integrationError || !integration?.connected) throw new Error('Connect Gmail before scanning.')
  if (activeRunError || !activeRun?.created_at) throw new Error('The Gmail scan run is unavailable.')
  const { data: latestCompleted, error: completedError } = await admin.from('gmail_scan_runs').select('created_at')
    .eq('user_id', userId).eq('account_email', integration.account_email).eq('status', 'completed')
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (completedError) throw new Error('Could not check the previous Gmail scan.')

  const token = await getGmailAccessToken(userId)
  const accountEmail: string = integration.account_email
  if (!latestCompleted?.created_at) {
    // First scan: walk the Inbox newest-first, queueing only what this batch needs.
    const pending = await loadPendingIds(userId, accountEmail, batchLimit, false)
    if (pending.length < batchLimit) await queueInitialInboxMessages(userId, accountEmail, token, batchLimit - pending.length)
    return loadBatch(userId, accountEmail, token, await loadPendingIds(userId, accountEmail, batchLimit, false))
  }

  if (discover) {
    const cursorAt = integration.scan_cursor_at || latestCompleted.created_at
    const after = Math.floor(new Date(cursorAt).getTime() / 1000)
    const ids: string[] = []
    let pageToken: string | undefined
    for (let page = 0; page < MAX_PAGES; page++) {
      const query = new URLSearchParams({ maxResults: '100', q: `in:inbox after:${after}` })
      if (pageToken) query.set('pageToken', pageToken)
      const list = await gmailFetch(`/messages?${query}`, token)
      ids.push(...(list.messages ?? []).map((message: { id: string }) => message.id))
      pageToken = list.nextPageToken
      if (!pageToken) break
    }
    if (pageToken) throw new Error('Too many new Gmail messages to sync in one pass. Retry the scan to continue.')
    await queueIncrementalInboxIds(userId, accountEmail, ids, token, cursorAt)
  }
  return loadBatch(userId, accountEmail, token, await loadPendingIds(userId, accountEmail, batchLimit, true))
}
