import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

// All callers must obtain userId from a verified session, never request input.
export async function saveGmailIntegration(userId: string, email: string, refreshToken: string): Promise<void> {
  const { error } = await createAdminClient().rpc('set_gmail_integration_secret', {
    p_user_id: userId, p_account_email: email.toLowerCase(), p_refresh_token: refreshToken,
  })
  if (error) throw new Error('Could not save Gmail connection.')
}

export async function getGmailRefreshToken(userId: string): Promise<string | null> {
  const { data, error } = await createAdminClient().rpc('get_gmail_integration_secret', { p_user_id: userId })
  if (error) throw new Error('Gmail connection is unavailable.')
  return data as string | null
}

export async function clearGmailIntegration(userId: string): Promise<void> {
  const { error } = await createAdminClient().rpc('clear_gmail_integration_secret', { p_user_id: userId })
  if (error) throw new Error('Could not disconnect Gmail.')
}
