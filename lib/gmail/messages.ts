import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me'
const MAX_RESULTS = 500
const MAX_PAGES = 100
const MAX_TEXT = 12000

async function gmailFetch(path: string, token: string, init?: RequestInit) {
  const response = await fetch(`${GMAIL}${path}`, {
    ...init, cache: 'no-store', signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${token}`, ...init?.headers },
  })
  if (!response.ok) throw new Error('Gmail request failed.')
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

function plainText(payload: GmailPart | undefined): string {
  if (!payload || payload.filename || payload.body?.attachmentId) return ''
  if (payload.mimeType === 'text/plain') return decodeText(payload.body?.data)
  if (!Array.isArray(payload.parts)) return ''
  return payload.parts.map(part => plainText(part)).filter(Boolean).join('\n').slice(0, MAX_TEXT)
}

export interface GmailMessagePreview { id: string; subject: string; from: string; date: string; text: string }

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

  const legacyIds = messageIds.filter(id => {
    const row = existing.get(id)
    return !!row && !row.incremental_eligible && ['pending', 'failed', 'skipped'].includes(row.status)
      && row.attempts < 3
  })
  const freshLegacyIds = new Set<string>()
  for (let offset = 0; offset < legacyIds.length; offset += 10) {
    const ids = legacyIds.slice(offset, offset + 10)
    const checks = await Promise.all(ids.map(async id => {
      const message = await gmailFetch(`/messages/${encodeURIComponent(id)}?format=metadata&fields=id,internalDate,labelIds`, token)
      const internalDate = Number(message.internalDate)
      return Number.isFinite(internalDate) && internalDate > cursorTime && (message.labelIds ?? []).includes('INBOX') ? id : null
    }))
    for (const id of checks) if (id) freshLegacyIds.add(id)
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

  const toReactivate = [...freshLegacyIds]
  if (toReactivate.length) {
    const { error } = await admin.from('gmail_processed_messages').update({
      status: 'pending', incremental_eligible: true,
    }).eq('user_id', userId).eq('account_email', accountEmail).in('message_id', toReactivate)
    if (error) throw new Error('Could not queue new Gmail messages.')
  }

  const toMarkIncremental = messageIds.filter(id => {
    const row = existing.get(id)
    return !!row && row.incremental_eligible && ['pending', 'failed'].includes(row.status)
      && (row.status !== 'failed' || row.attempts < 3)
  })
  if (toMarkIncremental.length) {
    const { error } = await admin.from('gmail_processed_messages').update({ incremental_eligible: true })
      .eq('user_id', userId).eq('account_email', accountEmail).in('message_id', toMarkIncremental)
    if (error) throw new Error('Could not update new Gmail messages.')
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
      .select('message_id,status,attempts').eq('user_id', userId).eq('account_email', accountEmail)
      .in('message_id', pageIds)
    if (error) throw new Error('Could not check previously scanned Gmail messages.')
    const priorById = new Map((prior ?? []).map(row => [row.message_id, row]))
    const newIds = pageIds.filter(id => {
      const row = priorById.get(id)
      if (!row) return true
      return false
    }).slice(0, remaining)
    if (newIds.length) {
      const now = Date.now()
      const toInsert = newIds.filter(id => !priorById.has(id)).map((message_id, index) => ({
        user_id: userId, account_email: accountEmail, message_id, status: 'pending', incremental_eligible: false,
        created_at: new Date(now - newIds.length + index).toISOString(),
      }))
      if (toInsert.length) {
        const { error: insertError } = await admin.from('gmail_processed_messages').insert(toInsert)
        if (insertError) throw new Error('Could not reserve Gmail messages for processing.')
      }
      const skippedIds = newIds.filter(id => priorById.get(id)?.status === 'skipped')
      if (skippedIds.length) {
        const { error: updateError } = await admin.from('gmail_processed_messages').update({ status: 'pending', incremental_eligible: false })
          .eq('user_id', userId).eq('account_email', accountEmail).in('message_id', skippedIds).eq('status', 'skipped')
        if (updateError) throw new Error('Could not reserve Gmail messages for processing.')
      }
      remaining -= newIds.length
    }
    pageToken = list.nextPageToken
    if (!pageToken) break
  }
}

async function retrieveFullMessages(token: string, ids: string[]): Promise<GmailMessagePreview[]> {
  if (!ids.length) return []
  const retrieved = await Promise.all(ids.map(async id => {
    const message = await gmailFetch(`/messages/${encodeURIComponent(id)}?format=full`, token)
    const headers = message.payload?.headers ?? []
    const header = (name: string) => headers.find((item: { name: string }) => item.name.toLowerCase() === name)?.value ?? ''
    const timestamp = Number(message.internalDate)
    return { id, subject: header('subject').slice(0, 500), from: header('from').slice(0, 500), timestamp,
      date: Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : '',
      text: plainText(message.payload).slice(0, MAX_TEXT) }
  }))
  return retrieved.filter(message => Number.isFinite(message.timestamp))
}

export async function retrieveInboxScanMessages(userId: string, limit = 5): Promise<GmailMessagePreview[]> {
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
  const firstScan = !latestCompleted?.created_at
  if (firstScan) {
    const pending = await loadPendingIds(userId, integration.account_email, batchLimit, false)
    if (pending.length < batchLimit) await queueInitialInboxMessages(userId, integration.account_email, token, batchLimit - pending.length)
    const ids = await loadPendingIds(userId, integration.account_email, batchLimit, false)
    return retrieveFullMessages(token, ids)
  }

  const cursorAt = integration.scan_cursor_at || latestCompleted.created_at
  const ids: string[] = []
  let pageToken: string | undefined
  for (let page = 0; page < MAX_PAGES; page++) {
    const after = Math.floor(new Date(cursorAt).getTime() / 1000)
    const query = new URLSearchParams({ maxResults: '100', q: `in:inbox after:${after}` })
    if (pageToken) query.set('pageToken', pageToken)
    const list = await gmailFetch(`/messages?${query}`, token)
    ids.push(...(list.messages ?? []).map((message: { id: string }) => message.id))
    pageToken = list.nextPageToken
    if (!pageToken) break
  }
  if (pageToken) throw new Error('Too many new Gmail messages to sync in one pass. Retry the scan to continue.')
  await queueIncrementalInboxIds(userId, integration.account_email, ids, token, cursorAt)
  const pending = await loadPendingIds(userId, integration.account_email, batchLimit, true)
  return retrieveFullMessages(token, pending)
}

export async function retrieveInboxMessages(userId: string, limit = 20): Promise<GmailMessagePreview[]> {
  const batchLimit = Math.max(1, Math.min(MAX_RESULTS, Math.floor(limit)))
  const db = createAdminClient()
  const { data: settings, error } = await db.from('gmail_integrations')
    .select('account_email,connected').eq('user_id', userId).maybeSingle()
  if (error || !settings?.connected) throw new Error('Connect Gmail before retrieving messages.')
  const token = await getGmailAccessToken(userId)

  let { data: pending, error: pendingError } = await db.from('gmail_processed_messages')
    .select('message_id').eq('user_id', userId).eq('account_email', settings.account_email)
    .or('status.eq.pending,and(status.eq.failed,attempts.lt.3)')
    .order('created_at', { ascending: true }).limit(batchLimit)
  if (pendingError) throw new Error('Could not load pending Gmail messages.')

  let pageToken: string | undefined
  for (let page = 0; !(pending?.length) && page < MAX_PAGES; page++) {
    const query = new URLSearchParams({ maxResults: '100', q: 'in:inbox' })
    if (pageToken) query.set('pageToken', pageToken)
    const list = await gmailFetch(`/messages?${query}`, token)
    const pageIds: string[] = (list.messages ?? []).map((message: { id: string }) => message.id)
    if (!pageIds.length) break
    const { data: prior, error: priorError } = await db.from('gmail_processed_messages')
      .select('message_id,status,attempts').eq('user_id', userId).eq('account_email', settings.account_email)
      .in('message_id', pageIds)
    if (priorError) throw new Error('Could not check processed Gmail messages.')
    const seen = new Set((prior ?? []).filter(row => row.status === 'processed' || row.status === 'processing' || (row.status === 'failed' && row.attempts >= 3)).map(row => row.message_id))
    const newIds = pageIds.filter(id => !seen.has(id))
    if (newIds.length) {
      const ledger = await db.from('gmail_processed_messages').upsert(
        newIds.map((message_id, index) => ({ user_id: userId, account_email: settings.account_email, message_id, status: 'pending',
          created_at: new Date(Date.now() + index).toISOString() })),
        { onConflict: 'user_id,account_email,message_id', ignoreDuplicates: true },
      )
      if (ledger.error) throw new Error('Could not reserve Gmail messages for processing.')
      const result = await db.from('gmail_processed_messages').select('message_id')
        .eq('user_id', userId).eq('account_email', settings.account_email)
        .or('status.eq.pending,and(status.eq.failed,attempts.lt.3)')
        .order('created_at', { ascending: true }).limit(batchLimit)
      if (result.error) throw new Error('Could not load pending Gmail messages.')
      pending = result.data
    }
    pageToken = list.nextPageToken
    if (!pageToken) break
  }

  return retrieveFullMessages(token, (pending ?? []).map(row => row.message_id))
}
