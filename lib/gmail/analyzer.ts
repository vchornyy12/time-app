import 'server-only'

import { LLMProviderError, suggestEmailTasks } from '@/lib/llm'
import { getUserLLMKey } from '@/lib/llm/integration'
import { isLLMProvider, resolveModel } from '@/lib/llm/models'
import { createAdminClient } from '@/lib/supabase/admin'
import { retrieveInboxScanMessages } from './messages'

const MAX_BATCH = 5
const MAX_MESSAGE_TEXT = 6000
// Longer than any single batch can run (Gmail and model calls are time-bounded),
// so a claim this old belongs to a worker that died before finishing.
const STALE_CLAIM_MS = 10 * 60_000

type Admin = ReturnType<typeof createAdminClient>
interface Scope { admin: Admin; userId: string; accountEmail: string }

function ledger({ admin, userId, accountEmail }: Scope) {
  return {
    select: (columns: string) => admin.from('gmail_processed_messages').select(columns)
      .eq('user_id', userId).eq('account_email', accountEmail),
    update: (values: Record<string, unknown>) => admin.from('gmail_processed_messages').update(values)
      .eq('user_id', userId).eq('account_email', accountEmail),
  }
}

/**
 * Analyze the next batch (at most five messages) of the user's running scan.
 * `analyzed` counts every queued message this call resolved, including ones
 * skipped without a model call, so callers can tell when the queue is drained.
 */
export async function analyzeGmailBatch(
  userId: string,
  batchSize = MAX_BATCH,
  options: { discover?: boolean } = {},
): Promise<{ analyzed: number; suggestions: number }> {
  const admin = createAdminClient()
  const [{ data: provider, error: providerError }, { data: integration, error: integrationError }] = await Promise.all([
    admin.from('user_llm_settings').select('provider,model,connected').eq('user_id', userId).maybeSingle(),
    admin.from('gmail_integrations').select('account_email,connected').eq('user_id', userId).maybeSingle(),
  ])
  if (providerError || !provider?.connected || !isLLMProvider(provider.provider)) throw new Error('Connect an AI provider key before scanning.')
  if (integrationError || !integration?.connected || !integration.account_email) throw new Error('Connect Gmail before scanning.')
  const key = await getUserLLMKey(userId)
  if (!key) throw new Error('Your AI provider connection is unavailable. Reconnect your key.')
  const llm = { provider: provider.provider, key, model: resolveModel(provider.provider, provider.model) }

  const scope: Scope = { admin, userId, accountEmail: integration.account_email }
  await releaseStaleClaims(scope)

  const limit = Math.max(1, Math.min(MAX_BATCH, Math.floor(batchSize)))
  const { messages, skipped } = await retrieveInboxScanMessages(userId, limit, options)
  const withText = messages.filter(message => message.text.trim())
  const emptyIds = messages.filter(message => !message.text.trim()).map(message => message.id)
  // Nothing to send to the model (for example image-only mail): resolve without a claim.
  await markProcessed(scope, emptyIds, ['pending', 'failed'])
  const resolvedWithoutModel = emptyIds.length + skipped
  if (!withText.length) return { analyzed: resolvedWithoutModel, suggestions: 0 }

  const claims = await claimMessages(scope, withText.map(message => message.id))
  const claimed = withText.filter(message => claims.has(message.id))
  if (!claimed.length) return { analyzed: resolvedWithoutModel, suggestions: 0 }

  try {
    const candidates = await suggestEmailTasks(llm, claimed.map(message => ({
      subject: message.subject.slice(0, 300), from: message.from.slice(0, 200), text: message.text.slice(0, MAX_MESSAGE_TEXT),
    })))
    const suggestions = candidates.flatMap(candidate => {
      const message = claimed[candidate.sourceIndex]
      return candidate.title && message ? [{
        user_id: userId, account_email: scope.accountEmail, message_id: message.id, subject: message.subject,
        sender: message.from, received_at: message.date || null, title: candidate.title,
      }] : []
    })
    let awaitingReview = new Set<string>()
    if (suggestions.length) {
      const { data: saved, error } = await admin.from('gmail_task_suggestions')
        .upsert(suggestions, { onConflict: 'user_id,account_email,message_id' }).select('message_id,status')
      if (error) throw new Error('Could not save Gmail suggestions.')
      awaitingReview = new Set((saved ?? []).filter(row => row.status === 'pending').map(row => row.message_id))
    }
    // A message with a pending suggestion stays `processing` until the user
    // accepts or dismisses it; everything else in the batch is finished.
    await markProcessed(scope, claimed.filter(message => !awaitingReview.has(message.id)).map(message => message.id), ['processing'])
    return { analyzed: claimed.length + resolvedWithoutModel, suggestions: awaitingReview.size }
  } catch (error) {
    // A provider-side failure says nothing about the emails, so hand the
    // attempts back instead of burning the per-message retry limit.
    await releaseClaims(scope, claims, error instanceof LLMProviderError).catch(() => {})
    throw error
  }
}

/** Atomically move messages to `processing`; returns each claimed ID with its prior attempt count. */
async function claimMessages(scope: Scope, messageIds: string[]): Promise<Map<string, number>> {
  const { data: rows, error } = await ledger(scope).select('message_id,attempts')
    .in('message_id', messageIds).in('status', ['pending', 'failed']).lt('attempts', 3)
  if (error) throw new Error('Could not reserve Gmail messages.')
  const claimedAt = new Date().toISOString()
  const candidates = (rows ?? []) as unknown as Array<{ message_id: string; attempts: number }>
  const claimed = await Promise.all(candidates.map(async ({ message_id: messageId, attempts }) => {
    // The attempts guard makes this a compare-and-swap against concurrent workers.
    const { data, error: claimError } = await ledger(scope)
      .update({ status: 'processing', attempts: attempts + 1, claimed_at: claimedAt })
      .eq('message_id', messageId).eq('attempts', attempts).in('status', ['pending', 'failed'])
      .select('message_id').maybeSingle()
    if (claimError) throw new Error('Could not reserve Gmail messages.')
    return data ? [messageId, attempts] as const : null
  }))
  return new Map(claimed.filter(entry => entry !== null))
}

async function releaseClaims(scope: Scope, claims: Map<string, number>, refundAttempt: boolean) {
  if (!refundAttempt) {
    await ledger(scope).update({ status: 'failed', claimed_at: null })
      .in('message_id', [...claims.keys()]).eq('status', 'processing')
    return
  }
  await Promise.all([...claims].map(([messageId, attempts]) => ledger(scope)
    .update({ status: 'pending', attempts, claimed_at: null })
    .eq('message_id', messageId).eq('status', 'processing')))
}

async function markProcessed(scope: Scope, messageIds: string[], from: string[]) {
  if (!messageIds.length) return
  const { error } = await ledger(scope)
    .update({ status: 'processed', processed_at: new Date().toISOString(), claimed_at: null })
    .in('message_id', messageIds).in('status', from)
  if (error) throw new Error('Could not update Gmail processing status.')
}

/**
 * Recover messages claimed by a worker that was killed mid-batch. A stale
 * `processing` row without a suggestion was never analyzed; return it to the
 * queue (the lost attempt still counts, bounding retries of a crashing input).
 */
async function releaseStaleClaims(scope: Scope) {
  const cutoff = new Date(Date.now() - STALE_CLAIM_MS).toISOString()
  const { data: stale, error } = await ledger(scope).select('message_id')
    .eq('status', 'processing').lt('claimed_at', cutoff).limit(200)
  if (error) throw new Error('Could not check interrupted Gmail scans.')
  const staleIds = ((stale ?? []) as unknown as Array<{ message_id: string }>).map(row => row.message_id)
  if (!staleIds.length) return
  const { data: suggested, error: suggestionError } = await scope.admin.from('gmail_task_suggestions').select('message_id')
    .eq('user_id', scope.userId).eq('account_email', scope.accountEmail).in('message_id', staleIds)
  if (suggestionError) throw new Error('Could not check interrupted Gmail scans.')
  const reviewed = new Set((suggested ?? []).map(row => row.message_id))
  const orphaned = staleIds.filter(id => !reviewed.has(id))
  if (!orphaned.length) return
  const { error: releaseError } = await ledger(scope).update({ status: 'failed', claimed_at: null })
    .in('message_id', orphaned).eq('status', 'processing')
  if (releaseError) throw new Error('Could not recover interrupted Gmail messages.')
}
