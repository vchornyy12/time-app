import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

export async function saveUserLLMKey(userId: string, key: string, model: string) {
  const { error } = await createAdminClient().rpc('set_user_llm_secret', {
    p_user_id: userId, p_api_key: key, p_model: model,
  })
  if (error) throw new Error('Could not save the provider key.')
}

export async function getUserLLMKey(userId: string): Promise<string | null> {
  const { data, error } = await createAdminClient().rpc('get_user_llm_secret', { p_user_id: userId })
  if (error) throw new Error('Provider settings are unavailable.')
  return data as string | null
}

export async function clearUserLLMKey(userId: string) {
  const { error } = await createAdminClient().rpc('clear_user_llm_secret', { p_user_id: userId })
  if (error) throw new Error('Could not remove the provider key.')
}
