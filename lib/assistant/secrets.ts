import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

export type AssistantSecretKind = 'chat' | 'notify'

// Callers must derive the user ID from a verified session or agent token, never client input.
export async function getAssistantSecret(userId: string, kind: AssistantSecretKind): Promise<string | null> {
  const { data, error } = await createAdminClient().rpc('get_assistant_secret', { p_user_id: userId, p_kind: kind })
  if (error) throw new Error('Assistant connection is unavailable. Please retry.')
  return (data as string | null) ?? null
}

export async function setAssistantSecret(userId: string, kind: AssistantSecretKind, secret: string, accountEmail?: string) {
  const { error } = await createAdminClient().rpc('set_assistant_secret', {
    p_user_id: userId, p_kind: kind, p_secret: secret, p_account_email: accountEmail ?? null,
  })
  if (error) throw new Error('Could not save the connection.')
}

export async function clearAssistantSecret(userId: string, kind: AssistantSecretKind) {
  const { error } = await createAdminClient().rpc('clear_assistant_secret', { p_user_id: userId, p_kind: kind })
  if (error) throw new Error('Could not disconnect.')
}
