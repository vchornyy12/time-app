import 'server-only'
import { getGoogleIntegration } from '@/lib/google/integration'
import type { authedClient } from '@/lib/actions/authed-action'
import { getAccessToken, deleteGCalEvent } from '@/lib/google/calendar'

export async function cleanupWaitingForReminder(
  taskId: string,
  context: Awaited<ReturnType<typeof authedClient>>
): Promise<void> {
  const { supabase, user } = context

  const { data: task } = await supabase
    .from('tasks')
    .select('status, google_calendar_event_id')
    .eq('id', taskId)
    .eq('user_id', user.id)
    .single()

  if (
    !task ||
    task.status !== 'waiting_for' ||
    !task.google_calendar_event_id
  ) return

  // Clear the event ID immediately so the UI is consistent
  await supabase
    .from('tasks')
    .update({ google_calendar_event_id: null })
    .eq('id', taskId)
    .eq('user_id', user.id)

  // Delete from Google Calendar (non-fatal)
  const integration = await getGoogleIntegration(user.id)
  if (!integration?.google_refresh_token) return

  try {
    const accessToken = await getAccessToken(integration.google_refresh_token)
    await deleteGCalEvent(
      accessToken,
      integration.google_calendar_id ?? 'primary',
      task.google_calendar_event_id
    )
  } catch {
    console.error('Failed to delete WF reminder from GCal')
  }
}
