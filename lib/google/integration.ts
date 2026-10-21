import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

export interface GoogleIntegration {
  google_refresh_token: string | null
  google_calendar_id: string | null
}
// Callers must derive this ID from a verified Supabase session, never client input.
export async function getGoogleIntegration(userId: string): Promise<GoogleIntegration | null> {
  const { data, error } = await createAdminClient().rpc('get_google_integration_secret', { p_user_id: userId })
  if (error) throw new Error('Calendar connection is unavailable. Please retry.')
  return data as GoogleIntegration | null
}
export async function saveGoogleIntegration(userId: string, refreshToken: string, calendarConnected: boolean) {
  const { error } = await createAdminClient().rpc('set_google_integration_secret', {
    p_user_id: userId, p_refresh_token: refreshToken, p_calendar_connected: calendarConnected,
  })
  if (error) throw new Error('Could not save calendar connection')
}
export async function clearGoogleIntegration(userId: string) {
  const { error } = await createAdminClient().rpc('clear_google_integration_secret', { p_user_id: userId })
  if (error) throw new Error('Could not disconnect calendar')
}
