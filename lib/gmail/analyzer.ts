import 'server-only'

import { getUserLLMKey } from '@/lib/llm/integration'
import { suggestEmailTasks } from '@/lib/llm/openai'
import { createAdminClient } from '@/lib/supabase/admin'
import { retrieveInboxMessages } from './messages'

export async function analyzeGmailBatch(userId: string, batchSize = 5): Promise<{ analyzed: number; suggestions: number }> {
  const admin = createAdminClient()
  const [{ data: provider, error: providerError }, { data: integration, error: integrationError }] = await Promise.all([
    admin.from('user_llm_settings').select('provider,model,connected').eq('user_id', userId).maybeSingle(),
    admin.from('gmail_integrations').select('account_email,connected').eq('user_id', userId).maybeSingle(),
  ])
  if (providerError || !provider?.connected || provider.provider !== 'openai') throw new Error('Connect your OpenAI API key before scanning.')
  if (integrationError || !integration?.connected || !integration.account_email) throw new Error('Connect Gmail before scanning.')
  const key = await getUserLLMKey(userId)
  if (!key || (provider.model !== 'gpt-4o-mini' && provider.model !== 'gpt-4o')) throw new Error('Your OpenAI connection is unavailable. Reconnect your key.')

  const messages = await retrieveInboxMessages(userId, Math.max(1, Math.min(5, Math.floor(batchSize))))
  const eligible = messages.filter(message => message.text.trim()).slice(0, 5)
  if (!eligible.length) {
    await markGmailMessagesProcessed(userId, integration.account_email, messages.map(message => message.id))
    return { analyzed: messages.length, suggestions: 0 }
  }

  const claimedIds = await claimGmailMessages(userId, integration.account_email, eligible.map(message => message.id))
  const claimed = eligible.filter(message => claimedIds.has(message.id))
  if (!claimed.length) return { analyzed: 0, suggestions: 0 }
  let remaining = 30000
  const bounded = claimed.map(message => {
    const text = message.text.slice(0, Math.min(6000, remaining))
    remaining -= text.length
    return { message, text }
  }).filter(item => item.text.length > 0)

  let candidates
  try {
    candidates = await suggestEmailTasks(key, provider.model, bounded.map(({ message, text }) => ({
      subject: message.subject.slice(0, 300), from: message.from.slice(0, 200), text,
    })))
  } catch (error) {
    await releaseGmailClaims(userId, integration.account_email, claimed.map(message => message.id))
    throw error
  }
  const candidatesWithMetadata = candidates.flatMap(candidate => {
    const item = bounded[candidate.sourceIndex]
    return candidate.title && item ? [{ message_id: item.message.id, subject: item.message.subject,
      sender: item.message.from, received_at: item.message.date || null, title: candidate.title }] : []
  })
  const { data: saved, error: saveError } = candidatesWithMetadata.length
    ? await admin.from('gmail_task_suggestions').upsert(
      candidatesWithMetadata.map(suggestion => ({ ...suggestion, user_id: userId, account_email: integration.account_email })),
      { onConflict: 'user_id,account_email,message_id' },
    ).select('message_id')
    : { data: [], error: null }
  if (saveError) {
    await releaseGmailClaims(userId, integration.account_email, claimed.map(message => message.id))
    throw new Error('Could not save Gmail suggestions.')
  }
  const suggestedIds = new Set((saved ?? []).map(row => row.message_id))
  try {
    await markGmailMessagesProcessed(userId, integration.account_email,
      messages.filter(message => !message.text.trim()).map(message => message.id)
        .concat(bounded.filter(item => !suggestedIds.has(item.message.id)).map(item => item.message.id)))
  } catch (error) {
    await releaseGmailClaims(userId, integration.account_email, claimed.map(message => message.id))
    throw error
  }
  return { analyzed: claimed.length + messages.filter(message => !message.text.trim()).length, suggestions: candidatesWithMetadata.length }
}

async function claimGmailMessages(userId: string, accountEmail: string, messageIds: string[]): Promise<Set<string>> {
  const admin = createAdminClient()
  const { data: rows, error } = await admin.from('gmail_processed_messages')
    .select('message_id,attempts').eq('user_id', userId).eq('account_email', accountEmail)
    .in('message_id', messageIds).in('status', ['pending', 'failed']).lt('attempts', 3)
  if (error) throw new Error('Could not reserve Gmail messages.')
  const claimed = await Promise.all((rows ?? []).map(async row => {
    const { data } = await admin.from('gmail_processed_messages').update({ status: 'processing', attempts: row.attempts + 1 })
      .eq('user_id', userId).eq('account_email', accountEmail).eq('message_id', row.message_id)
      .eq('attempts', row.attempts).in('status', ['pending', 'failed']).select('message_id').maybeSingle()
    return data?.message_id as string | undefined
  }))
  return new Set(claimed.filter((id): id is string => !!id))
}

async function releaseGmailClaims(userId: string, accountEmail: string, messageIds: string[]) {
  if (!messageIds.length) return
  await createAdminClient().from('gmail_processed_messages').update({ status: 'failed' })
    .eq('user_id', userId).eq('account_email', accountEmail).in('message_id', messageIds).eq('status', 'processing')
}

async function markGmailMessagesProcessed(userId: string, accountEmail: string, messageIds: string[]) {
  if (!messageIds.length) return
  const { error } = await createAdminClient().from('gmail_processed_messages')
    .update({ status: 'processed', processed_at: new Date().toISOString() })
    .eq('user_id', userId).eq('account_email', accountEmail).in('message_id', messageIds)
    .in('status', ['pending', 'failed'])
  if (error) throw new Error('Could not update Gmail processing status.')
}
