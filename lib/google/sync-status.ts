/**
 * Outcome of a Google Calendar sync attempt. Shared by server and client code.
 * - synced: the task has a Google event that matches it
 * - skipped: nothing to do (not a scheduled calendar task, or already synced)
 * - not_connected: the user has no Google Calendar connection
 * - reconnect: Google rejected the stored grant; the connection was cleared
 * - failed: a transient error; the task stays unsynced and can be retried
 */
export type CalendarSyncStatus = 'synced' | 'skipped' | 'not_connected' | 'reconnect' | 'failed'

/** Message to show for a sync outcome, or null when the user needs no notice. */
export function syncNotice(status: CalendarSyncStatus): string | null {
  if (status === 'reconnect') return 'Google Calendar access expired. Reconnect it to keep syncing.'
  if (status === 'failed') return 'Could not reach Google Calendar. The item stays here; sync will retry.'
  return null
}
