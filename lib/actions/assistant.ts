'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { authedClient } from '@/lib/actions/authed-action'
import { markTaskDone } from '@/lib/actions/tasks'
import { clearAssistantSecret, setAssistantSecret } from '@/lib/assistant/secrets'
import { isValidWebhookUrl, notifyUser, postToWebhook } from '@/lib/assistant/notify'

// ── Google Chat source ────────────────────────────────────────

export async function disconnectGoogleChat() {
  const { user } = await authedClient()
  await clearAssistantSecret(user.id, 'chat')
  revalidatePath('/settings')
}

// ── Notifications (Google Chat incoming webhook) ──────────────

export async function saveNotificationWebhook(url: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = z.string().trim().max(2000).parse(url)
  if (!isValidWebhookUrl(trimmed)) {
    return { ok: false, error: 'Paste the webhook URL from Google Chat (it starts with https://chat.googleapis.com/v1/spaces/…).' }
  }
  const { user } = await authedClient()
  try {
    await postToWebhook(trimmed, '✅ Time24 assistant is connected. Reminders and digests will arrive in this space.')
  } catch {
    return { ok: false, error: 'Google Chat did not accept a test message. Check the webhook URL.' }
  }
  await setAssistantSecret(user.id, 'notify', trimmed)
  revalidatePath('/settings')
  return { ok: true }
}

export async function sendTestNotification(): Promise<{ ok: boolean; error?: string }> {
  const { user } = await authedClient()
  try {
    await notifyUser(user.id, '🔔 Test notification from Time24.')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not send.' }
  }
}

export async function disconnectNotifications() {
  const { user } = await authedClient()
  await clearAssistantSecret(user.id, 'notify')
  revalidatePath('/settings')
}

// ── Agent profile ─────────────────────────────────────────────

const profileSchema = z.object({
  instructions: z.string().max(4000),
  muted: z.array(z.string().trim().min(1).max(200)).max(100),
})

export async function saveAgentProfile(input: { instructions: string; muted: string[] }) {
  const parsed = profileSchema.parse({
    instructions: input.instructions.trim(),
    muted: [...new Set(input.muted.map((m) => m.trim()).filter(Boolean))],
  })
  const { supabase, user } = await authedClient()
  const { error } = await supabase.from('agent_profiles').upsert(
    { user_id: user.id, instructions: parsed.instructions, muted: parsed.muted, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' },
  )
  if (error) throw new Error('Could not save the assistant profile.')
  revalidatePath('/settings')
}

// ── Decisions on agent suggestions ────────────────────────────

const decisionSchema = z.object({ suggestionId: z.string().uuid(), decision: z.enum(['accept', 'dismiss']) })

/**
 * The human decides. Accepting:
 *   close      → the task is marked done;
 *   follow_up  → recorded; the client copies the draft for the user to send;
 *   jira_issue → queued; the agent creates the issue on its next run.
 */
export async function decideSuggestion(suggestionId: string, decision: 'accept' | 'dismiss') {
  const parsed = decisionSchema.parse({ suggestionId, decision })
  const { supabase, user } = await authedClient()
  const { data: s, error } = await supabase.from('agent_suggestions').select('id, task_id, kind, status')
    .eq('id', parsed.suggestionId).eq('user_id', user.id).maybeSingle()
  if (error || !s) throw new Error('Suggestion not found.')
  if (s.status !== 'pending') return { status: s.status as string }

  if (parsed.decision === 'accept' && s.kind === 'close') await markTaskDone(s.task_id as string)

  const status = parsed.decision === 'accept' ? 'accepted' : 'dismissed'
  const { error: updateError } = await supabase.from('agent_suggestions')
    .update({ status, decided_at: new Date().toISOString() })
    .eq('id', s.id).eq('user_id', user.id).eq('status', 'pending')
  if (updateError) throw new Error('Could not save the decision.')

  revalidatePath('/inbox')
  revalidatePath('/waiting-for')
  revalidatePath('/', 'layout')
  return { status }
}
