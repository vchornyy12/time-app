'use server'

import { revalidatePath } from 'next/cache'
import { authedClient } from '@/lib/actions/authed-action'
import { gmailAvailable } from '@/lib/gmail/config'
import { clearGmailIntegration, getGmailRefreshToken } from '@/lib/gmail/integration'
import { dispatchScanWorker } from '@/lib/gmail/worker'
import { revokeGoogleToken } from '@/lib/google/revoke'
import { createAdminClient } from '@/lib/supabase/admin'
import { captureTaskSchema } from '@/lib/validation/schemas'
import { z } from 'zod'

const SCAN_BATCH_SIZES = [25, 50, 100, 500] as const
const RUN_COLUMNS = 'id,kind,batch_size,status,processed_count,suggestion_count,error_message'
const uuidSchema = z.uuid()

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
  if (error || !data) return { error: 'Could not save Gmail scan preferences. Check your Gmail connection and time zone, then retry.' }
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
  const admin = createAdminClient()
  const { data: integration } = await admin.from('gmail_integrations').select('account_email').eq('user_id', user.id).maybeSingle()
  if (!integration?.account_email) return []
  const { data, error } = await admin.from('gmail_task_suggestions')
    .select('id,message_id,subject,sender,received_at,title').eq('user_id', user.id)
    .eq('account_email', integration.account_email).eq('status', 'pending').order('created_at', { ascending: true }).limit(50)
  if (error) throw new Error('Could not load pending Gmail suggestions.')
  return (data ?? []).map(suggestion => ({
    id: suggestion.id, messageId: suggestion.message_id, subject: suggestion.subject,
    from: suggestion.sender, date: suggestion.received_at ?? '', title: suggestion.title,
  }))
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

// Preconditions raised by create_gmail_scan_run that are safe and useful to show.
const SCAN_PRECONDITIONS = ['Connect Gmail before scanning', 'Connect an AI provider key before scanning']

export async function startGmailScan(consent: boolean, batchSize: number): Promise<{ run?: GmailScanRun; error?: string }> {
  const { user } = await authedClient()
  if (consent !== true) return { error: 'Confirm before sending email text to your AI provider.' }
  if (!gmailAvailable()) return { error: 'Gmail is not configured.' }
  if (!(SCAN_BATCH_SIZES as readonly number[]).includes(batchSize)) return { error: 'Choose a valid scan size.' }
  const admin = createAdminClient()
  const { data: runId, error: createError } = await admin.rpc('create_gmail_scan_run', {
    p_user_id: user.id, p_batch_size: batchSize,
  })
  if (createError || typeof runId !== 'string') {
    const precondition = SCAN_PRECONDITIONS.find(message => createError?.message?.includes(message))
    return { error: precondition ? `${precondition}.` : 'Could not start Gmail scan.' }
  }
  try {
    await dispatchScanWorker(runId)
  } catch {
    // The run stays queued; retrying re-dispatches it, and the scheduler picks
    // up queued runs that were never claimed.
    return { error: 'Could not start the background scan. Check the deployed worker configuration and retry.' }
  }
  const { data: run } = await admin.from('gmail_scan_runs').select(RUN_COLUMNS).eq('id', runId).maybeSingle()
  revalidatePath('/inbox')
  return { run: run ? run as GmailScanRun : undefined }
}

export async function getGmailScanRun(runId: string): Promise<GmailScanRun | null> {
  const { supabase, user } = await authedClient()
  if (!uuidSchema.safeParse(runId).success) return null
  const { data } = await supabase.from('gmail_scan_runs').select(RUN_COLUMNS)
    .eq('user_id', user.id).eq('id', runId).maybeSingle()
  return data as GmailScanRun | null
}

async function decideGmailSuggestion(suggestionId: string, title?: string): Promise<{ error?: string }> {
  const { user } = await authedClient()
  if (!uuidSchema.safeParse(suggestionId).success) return { error: 'Invalid Gmail suggestion.' }
  const parsedTitle = title === undefined ? undefined : captureTaskSchema.safeParse({ title })
  if (parsedTitle && !parsedTitle.success) return { error: 'Enter a valid task title.' }
  const admin = createAdminClient()
  const { error } = parsedTitle?.success
    ? await admin.rpc('accept_gmail_task_suggestion', { p_user_id: user.id, p_suggestion_id: suggestionId, p_title: parsedTitle.data.title })
    : await admin.rpc('dismiss_gmail_task_suggestion', { p_user_id: user.id, p_suggestion_id: suggestionId })
  if (error) return { error: 'This suggestion is unavailable or could not be saved. Please refresh and retry.' }
  revalidatePath('/', 'layout')
  return {}
}

export async function acceptGmailSuggestion(suggestionId: string, title: string): Promise<{ error?: string }> {
  return decideGmailSuggestion(suggestionId, title)
}

export async function dismissGmailSuggestion(suggestionId: string): Promise<{ error?: string }> {
  return decideGmailSuggestion(suggestionId)
}
