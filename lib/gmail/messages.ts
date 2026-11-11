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

  const ids = (pending ?? []).map(row => row.message_id)
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
  const messages = retrieved.filter(message => Number.isFinite(message.timestamp))
  return messages
}
