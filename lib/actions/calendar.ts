'use server'

import { revokeGoogleToken } from '@/lib/google/revoke'
import { revalidatePath } from 'next/cache'
import { subDays, startOfDay, isBefore, isEqual, parseISO, format } from 'date-fns'
import { authedClient } from '@/lib/actions/authed-action'
import { cleanupWaitingForReminder } from '@/lib/google/reminders'
import { getGoogleIntegration, clearGoogleIntegration } from '@/lib/google/integration'
import { getAccessToken, createGCalEvent } from '@/lib/google/calendar'
import {
  deleteGoogleEvent,
  rescheduleTaskInGoogle,
  syncPendingTasks,
  syncTaskToGoogle,
  type CalendarSyncStatus,
  type PendingSyncResult,
} from '@/lib/google/calendar-sync'
import {
  taskId as taskIdSchema,
  dateString,
  rescheduleCalendarTaskSchema,
} from '@/lib/validation/schemas'

// ── Google Calendar sync for calendar tasks ──────────────────
// Google failures never throw to the client: each action reports a status
// instead, so a revoked or expired grant cannot crash the page.

/** Creates the Google event for a calendar task (called after processing). */
export async function syncCreateCalendarEvent(taskId: string): Promise<CalendarSyncStatus> {
  const id = taskIdSchema.parse(taskId)
  const ctx = await authedClient()
  const status = await syncTaskToGoogle(ctx, id)
  if (status !== 'skipped') revalidatePath('/calendar')
  return status
}

/** "Sync now" for one task that is not in Google yet. */
export async function syncNowCalendarTask(taskId: string): Promise<CalendarSyncStatus> {
  return syncCreateCalendarEvent(taskId)
}

/** Catches up every calendar task that has no Google event yet. */
export async function syncPendingCalendarTasks(): Promise<PendingSyncResult> {
  const ctx = await authedClient()
  const result = await syncPendingTasks(ctx)
  if (result.synced || result.status === 'reconnect') {
    revalidatePath('/calendar')
    revalidatePath('/settings')
  }
  return result
}

async function detachCalendarTask(
  taskId: string,
  update: Record<string, unknown>
): Promise<CalendarSyncStatus> {
  const id = taskIdSchema.parse(taskId)
  const ctx = await authedClient()
  const { supabase, user } = ctx

  const { data: task } = await supabase
    .from('tasks')
    .select('google_calendar_event_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  const { error } = await supabase
    .from('tasks')
    .update({ ...update, google_calendar_event_id: null })
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) throw new Error('Could not update the task. Please retry.')

  return task?.google_calendar_event_id
    ? deleteGoogleEvent(ctx, task.google_calendar_event_id)
    : 'skipped'
}

// ── Moves a calendar task to trash + deletes the GCal event ──

export async function removeCalendarTaskToTrash(taskId: string): Promise<CalendarSyncStatus> {
  const status = await detachCalendarTask(taskId, { status: 'trash' })
  revalidatePath('/calendar')
  revalidatePath('/trash')
  return status
}

// ── Moves a calendar task back to inbox + deletes the GCal event ─

export async function moveCalendarTaskToInbox(taskId: string): Promise<CalendarSyncStatus> {
  const status = await detachCalendarTask(taskId, { status: 'inbox', scheduled_at: null })
  revalidatePath('/calendar')
  revalidatePath('/', 'layout')
  return status
}

// ── Reschedules a calendar task and syncs the new time ────────

export async function rescheduleCalendarTask(taskId: string, scheduledAt: string): Promise<CalendarSyncStatus> {
  const parsed = rescheduleCalendarTaskSchema.parse({ taskId, scheduledAt })
  const ctx = await authedClient()

  const { error } = await ctx.supabase
    .from('tasks')
    .update({ scheduled_at: new Date(parsed.scheduledAt).toISOString() })
    .eq('id', parsed.taskId)
    .eq('user_id', ctx.user.id)
  if (error) throw new Error('Could not reschedule the task. Please retry.')

  const status = await rescheduleTaskInGoogle(ctx, parsed.taskId)
  revalidatePath('/calendar')
  return status
}

// ── Creates/updates the follow-up reminder for a Waiting For task ─

/**
 * Creates an all-day "[Follow up] ..." event the day before `dueDate`.
 * Silently no-ops if: Google Calendar is not connected, reminder date is
 * today-or-earlier, or the task can't be found.
 * Stores the resulting event ID on the task.
 */
export async function syncWaitingForReminder(
  taskId: string,
  dueDate: string   // 'YYYY-MM-DD'
): Promise<void> {
  const id = taskIdSchema.parse(taskId)
  dateString.parse(dueDate)

  // Calculate reminder date (due_date - 1 day) and bail if it's not in the future
  const today = startOfDay(new Date())
  const reminderDay = subDays(parseISO(dueDate), 1)
  if (isBefore(reminderDay, today) || isEqual(reminderDay, today)) return

  const { supabase, user } = await authedClient()

  const { data: task } = await supabase
    .from('tasks')
    .select('title, delegated_to')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!task) return

  const integration = await getGoogleIntegration(user.id)
  if (!integration?.google_refresh_token) return

  const accessToken = await getAccessToken(integration.google_refresh_token)
  const calendarId = integration.google_calendar_id ?? 'primary'
  const reminderDateStr = format(reminderDay, 'yyyy-MM-dd')

  const eventId = await createGCalEvent(accessToken, calendarId, {
    summary: `[Follow up] ${task.title} → ${task.delegated_to ?? ''}`,
    date: reminderDateStr,
    allDay: true,
  })

  await supabase
    .from('tasks')
    .update({ google_calendar_event_id: eventId })
    .eq('id', id)
    .eq('user_id', user.id)
}

// ── Deletes the WF reminder event if the task is being resolved ─

/**
 * If `taskId` is currently a waiting_for task that has a GCal reminder event,
 * deletes the event and clears the stored ID.
 * Safe to call on any task — no-ops if conditions aren't met.
 */
export async function cleanupWFReminderIfNeeded(taskId: string): Promise<void> {
  const id = taskIdSchema.parse(taskId)
  await cleanupWaitingForReminder(id, await authedClient())
}

// ── Disconnects Google Calendar (clears the stored token) ─────

export async function disconnectGoogleCalendar() {
  const { user } = await authedClient()
  const integration = await getGoogleIntegration(user.id)
  if (integration?.google_refresh_token) await revokeGoogleToken(integration.google_refresh_token)
  await clearGoogleIntegration(user.id)
  revalidatePath('/settings')
}
