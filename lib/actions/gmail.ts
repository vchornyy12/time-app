'use server'

import { revalidatePath } from 'next/cache'
import { authedClient } from '@/lib/actions/authed-action'
import { gmailAvailable } from '@/lib/gmail/config'
import { gmailLabelSchema } from '@/lib/gmail/settings'
import { clearGmailIntegration, getGmailRefreshToken } from '@/lib/gmail/integration'
import { revokeGoogleToken } from '@/lib/google/revoke'
import { retrieveInboxMessages, type GmailMessagePreview } from '@/lib/gmail/messages'
import { createAdminClient } from '@/lib/supabase/admin'
import { captureTaskSchema } from '@/lib/validation/schemas'
import { z } from 'zod'

const scanPreferencesSchema = z.object({
  frequency: z.enum(['manual', 'daily', 'twice_daily']),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  timezone: z.string().min(1).max(64),
  batchSize: z.union([z.literal(25), z.literal(50), z.literal(100), z.literal(500)]),
  autoConsent: z.boolean(),
})

export async function saveGmailScanPreferences(input: z.infer<typeof scanPreferencesSchema>): Promise<{ error?: string }> {
  const { supabase, user } = await authedClient()
  const parsed = scanPreferencesSchema.safeParse(input)
  if (!parsed.success) return { error: 'Choose a valid scan schedule and batch size.' }
  if (!gmailAvailable()) return { error: 'Gmail is not configured.' }
  const preference = parsed.data
  try { new Intl.DateTimeFormat('en-US', { timeZone: preference.timezone }) } catch {
    return { error: 'Enter a valid IANA time zone, such as Europe/Warsaw.' }
  }
  if (preference.frequency !== 'manual' && !preference.autoConsent) return { error: 'Confirm consent before enabling automatic scans.' }
  const { data, error } = await supabase.from('gmail_integrations').update({
    scan_frequency: preference.frequency, scan_time: `${preference.time}:00`, scan_timezone: preference.timezone,
    scan_batch_size: preference.batchSize, auto_scan_consent: preference.autoConsent,
  }).eq('user_id', user.id).eq('connected', true).select('user_id').maybeSingle()
  if (error || !data) return { error: 'Could not save Gmail scan preferences. Apply the latest Gmail migration and retry.' }
  revalidatePath('/settings')
  return {}
}

export async function updateGmailLabel(label: string): Promise<{ error?: string }> {
  const { supabase, user } = await authedClient()
  if (!gmailAvailable()) return { error: 'Gmail is not configured.' }
  const parsed = gmailLabelSchema.safeParse(label)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { data, error } = await supabase.from('gmail_integrations')
    .update({ label_name: parsed.data }).eq('user_id', user.id).eq('connected', true)
    .select('user_id').maybeSingle()
  if (error || !data) return { error: 'Could not save the label. Check your Gmail connection and retry.' }
  revalidatePath('/settings')
  return {}
}

export async function disconnectGmail(): Promise<{ error?: string }> {
  const { user } = await authedClient()
  if (!gmailAvailable()) return { error: 'Gmail is not configured.' }
  try {
    const token = await getGmailRefreshToken(user.id)
    if (token) await revokeGoogleToken(token)
    await clearGmailIntegration(user.id)
    revalidatePath('/settings')
    return {}
  } catch {
    return { error: 'Could not disconnect Gmail. Please retry.' }
  }
}

export async function retrieveGmailMessages(): Promise<{ messages?: GmailMessagePreview[]; error?: string }> {
  const { user } = await authedClient()
  if (!gmailAvailable()) return { error: 'Gmail is not configured.' }
  try {
    return { messages: await retrieveInboxMessages(user.id) }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not retrieve Gmail messages.' }
  }
}

export interface GmailTaskSuggestion {
  id: string
  messageId: string
  subject: string
  from: string
  date: string
  title: string
}

export async function getGmailTaskSuggestions(): Promise<GmailTaskSuggestion[]> {
  const { user } = await authedClient()
  if (!gmailAvailable()) return []
  return getPendingGmailSuggestions(user.id)
}

export interface GmailScanRun {
  id: string
  kind: 'manual' | 'scheduled'
  batch_size: number
  status: 'queued' | 'running' | 'completed' | 'failed'
  processed_count: number
  suggestion_count: number
  error_message: string | null
}

export async function startGmailScan(consent: boolean, batchSize: number): Promise<{ run?: GmailScanRun; error?: string }> {
  const { user } = await authedClient()
  if (consent !== true) return { error: 'Confirm before sending email text to OpenAI.' }
  if (!gmailAvailable()) return { error: 'Gmail is not configured.' }
  if (![25, 50, 100, 500].includes(batchSize)) return { error: 'Choose a valid scan size.' }
  const admin = createAdminClient()
  const { data: runId, error: createError } = await admin.rpc('create_gmail_scan_run', {
    p_user_id: user.id, p_batch_size: batchSize,
  })
  if (createError || typeof runId !== 'string') return { error: createError?.message ?? 'Could not start Gmail scan.' }
  try {
    const origin = process.env.APP_ORIGIN || process.env.GMAIL_APP_ORIGIN
    if (!origin) throw new Error('Background scan origin is not configured.')
    const endpoint = new URL('/.netlify/functions/gmail-scan-worker-background', origin)
    const response = await fetch(endpoint, {
      method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(8000),
      redirect: 'manual',
      headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId }),
    })
    if (!response.ok && response.status !== 202) throw new Error('Could not start the background scan.')
  } catch {
    return { error: 'Could not start the background scan. Check the deployed worker configuration and retry.' }
  }
  const { data: run } = await admin.from('gmail_scan_runs')
    .select('id,kind,batch_size,status,processed_count,suggestion_count,error_message').eq('id', runId).maybeSingle()
  revalidatePath('/inbox')
  return { run: run ? run as GmailScanRun : undefined }
}

export async function getGmailScanRun(runId: string): Promise<GmailScanRun | null> {
  const { supabase, user } = await authedClient()
  if (!/^[0-9a-f-]{36}$/i.test(runId)) return null
  const { data } = await supabase.from('gmail_scan_runs')
    .select('id,kind,batch_size,status,processed_count,suggestion_count,error_message')
    .eq('user_id', user.id).eq('id', runId).maybeSingle()
  return data as GmailScanRun | null
}

export async function getLatestGmailScanRun(): Promise<GmailScanRun | null> {
  const { supabase, user } = await authedClient()
  const { data } = await supabase.from('gmail_scan_runs')
    .select('id,kind,batch_size,status,processed_count,suggestion_count,error_message')
    .eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
  return data as GmailScanRun | null
}

async function getPendingGmailSuggestions(userId: string): Promise<GmailTaskSuggestion[]> {
  const admin = createAdminClient()
  const { data: integration } = await admin.from('gmail_integrations').select('account_email').eq('user_id', userId).maybeSingle()
  if (!integration?.account_email) return []
  const { data, error } = await admin.from('gmail_task_suggestions')
    .select('id,message_id,subject,sender,received_at,title').eq('user_id', userId)
    .eq('account_email', integration.account_email).eq('status', 'pending').order('created_at', { ascending: true }).limit(50)
  if (error) throw new Error('Could not load pending Gmail suggestions.')
  return (data ?? []).map(suggestion => ({
    id: suggestion.id, messageId: suggestion.message_id, subject: suggestion.subject,
    from: suggestion.sender, date: suggestion.received_at ?? '', title: suggestion.title,
  }))
}

async function finishGmailMessage(suggestionId: string, title?: string): Promise<{ error?: string }> {
  const { user } = await authedClient()
  if (typeof suggestionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(suggestionId)) return { error: 'Invalid Gmail suggestion.' }
  const parsedTitle = title === undefined ? undefined : captureTaskSchema.safeParse({ title })
  if (parsedTitle && !parsedTitle.success) return { error: 'Enter a valid task title.' }
  const admin = createAdminClient()
  const { error } = parsedTitle?.success
    ? await admin.rpc('accept_gmail_task_suggestion', { p_user_id: user.id, p_suggestion_id: suggestionId, p_title: parsedTitle.data.title })
    : await admin.rpc('dismiss_gmail_task_suggestion', { p_user_id: user.id, p_suggestion_id: suggestionId })
  if (error) return { error: 'This suggestion is unavailable or could not be saved. Please refresh and retry.' }
  revalidatePath('/inbox')
  revalidatePath('/inbox')
  revalidatePath('/', 'layout')
  return {}
}

export async function acceptGmailSuggestion(suggestionId: string, title: string): Promise<{ error?: string }> {
  return finishGmailMessage(suggestionId, title)
}

export async function dismissGmailSuggestion(suggestionId: string): Promise<{ error?: string }> {
  return finishGmailMessage(suggestionId)
}
