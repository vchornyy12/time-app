'use server'

import { revalidatePath } from 'next/cache'
import { subDays, startOfDay, isBefore, isEqual, parseISO, format } from 'date-fns'
import { authedClient } from '@/lib/actions/authed-action'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getAccessToken,
  createGCalEvent,
  updateGCalEvent,
  deleteGCalEvent,
} from '@/lib/google/calendar'
import {
  taskId as taskIdSchema,
  datetimeString,
  dateString,
  rescheduleCalendarTaskSchema,
} from '@/lib/validation/schemas'

// ── Shared: fetch the user's Google Calendar integration ──────

async function getUserIntegration(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from('user_integrations')
    .select('google_refresh_token, google_calendar_id')
    .eq('user_id', userId)
    .maybeSingle()
  return data
}

// ── Creates a Google Calendar event and stores the event_id ───

export async function syncCreateCalendarEvent(
  taskId: string,
  title: string,
  scheduledAt: string
) {
  const id = taskIdSchema.parse(taskId)
  datetimeString.parse(scheduledAt)
  const { supabase, user } = await authedClient()

  const integration = await getUserIntegration(supabase, user.id)
  if (!integration?.google_refresh_token) return // not connected — silently skip

  const accessToken = await getAccessToken(integration.google_refresh_token)
  const calendarId = integration.google_calendar_id ?? 'primary'
  const eventId = await createGCalEvent(accessToken, calendarId, { summary: title, scheduledAt })

  await supabase
    .from('tasks')
    .update({ google_calendar_event_id: eventId })
    .eq('id', id)
    .eq('user_id', user.id)

  revalidatePath('/calendar')
}

// ── Updates an existing Google Calendar event's time ──────────

export async function syncUpdateCalendarEvent(taskId: string, scheduledAt: string) {
  const id = taskIdSchema.parse(taskId)
  datetimeString.parse(scheduledAt)
  const { supabase, user } = await authedClient()

  const { data: task } = await supabase
    .from('tasks')
    .select('google_calendar_event_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!task?.google_calendar_event_id) return // no event to update

  const integration = await getUserIntegration(supabase, user.id)
  if (!integration?.google_refresh_token) return

  const accessToken = await getAccessToken(integration.google_refresh_token)
  const calendarId = integration.google_calendar_id ?? 'primary'

  await updateGCalEvent(accessToken, calendarId, task.google_calendar_event_id, scheduledAt)
  revalidatePath('/calendar')
}

// ── Deletes the Google Calendar event and clears the stored ID ─

export async function syncDeleteCalendarEvent(taskId: string) {
  const id = taskIdSchema.parse(taskId)
  const { supabase, user } = await authedClient()

  const { data: task } = await supabase
    .from('tasks')
    .select('google_calendar_event_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!task?.google_calendar_event_id) return

  const integration = await getUserIntegration(supabase, user.id)
  if (!integration?.google_refresh_token) return

  const accessToken = await getAccessToken(integration.google_refresh_token)
  const calendarId = integration.google_calendar_id ?? 'primary'

  await deleteGCalEvent(accessToken, calendarId, task.google_calendar_event_id)

  await supabase
    .from('tasks')
    .update({ google_calendar_event_id: null })
    .eq('id', id)
    .eq('user_id', user.id)

  revalidatePath('/calendar')
}

// ── Moves a calendar task to trash + deletes the GCal event ──

export async function removeCalendarTaskToTrash(taskId: string) {
  const id = taskIdSchema.parse(taskId)
  const { supabase, user } = await authedClient()

  const { data: task } = await supabase
    .from('tasks')
    .select('google_calendar_event_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  // Clear event_id and move to trash in one update
  await supabase
    .from('tasks')
    .update({ status: 'trash', google_calendar_event_id: null })
    .eq('id', id)
    .eq('user_id', user.id)

  // Delete from Google Calendar (non-fatal)
  if (task?.google_calendar_event_id) {
    const integration = await getUserIntegration(supabase, user.id)
    if (integration?.google_refresh_token) {
      try {
        const accessToken = await getAccessToken(integration.google_refresh_token)
        await deleteGCalEvent(
          accessToken,
          integration.google_calendar_id ?? 'primary',
          task.google_calendar_event_id
        )
      } catch {
        console.error('Failed to delete GCal event during trash move')
      }
    }
  }

  revalidatePath('/calendar')
  revalidatePath('/trash')
}

// ── Moves a calendar task back to inbox + deletes the GCal event ─

export async function moveCalendarTaskToInbox(taskId: string) {
  const id = taskIdSchema.parse(taskId)
  const { supabase, user } = await authedClient()

  const { data: task } = await supabase
    .from('tasks')
    .select('google_calendar_event_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  await supabase
    .from('tasks')
    .update({ status: 'inbox', scheduled_at: null, google_calendar_event_id: null })
    .eq('id', id)
    .eq('user_id', user.id)

  if (task?.google_calendar_event_id) {
    const integration = await getUserIntegration(supabase, user.id)
    if (integration?.google_refresh_token) {
      try {
        const accessToken = await getAccessToken(integration.google_refresh_token)
        await deleteGCalEvent(
          accessToken,
          integration.google_calendar_id ?? 'primary',
          task.google_calendar_event_id
        )
      } catch {
        console.error('Failed to delete GCal event during inbox move')
      }
    }
  }

  revalidatePath('/calendar')
  revalidatePath('/', 'layout')
}

// ── Reschedules a calendar task and syncs the new time ────────

export async function rescheduleCalendarTask(taskId: string, scheduledAt: string) {
  const parsed = rescheduleCalendarTaskSchema.parse({ taskId, scheduledAt })
  const { supabase, user } = await authedClient()

  const { data: task } = await supabase
    .from('tasks')
    .select('title, google_calendar_event_id')
    .eq('id', parsed.taskId)
    .eq('user_id', user.id)
    .single()

  await supabase
    .from('tasks')
    .update({ scheduled_at: new Date(parsed.scheduledAt).toISOString() })
    .eq('id', parsed.taskId)
    .eq('user_id', user.id)

  if (!task) { revalidatePath('/calendar'); return }

  const integration = await getUserIntegration(supabase, user.id)
  if (!integration?.google_refresh_token) { revalidatePath('/calendar'); return }

  try {
    const accessToken = await getAccessToken(integration.google_refresh_token)
    const calendarId = integration.google_calendar_id ?? 'primary'

    if (task.google_calendar_event_id) {
      await updateGCalEvent(accessToken, calendarId, task.google_calendar_event_id, parsed.scheduledAt)
    } else {
      const eventId = await createGCalEvent(accessToken, calendarId, {
        summary: task.title,
        scheduledAt: parsed.scheduledAt,
      })
      await supabase
        .from('tasks')
        .update({ google_calendar_event_id: eventId })
        .eq('id', parsed.taskId)
        .eq('user_id', user.id)
    }
  } catch {
    console.error('Failed to sync reschedule to GCal')
  }

  revalidatePath('/calendar')
}

// ── Creates a GCal event for a task that was missed during sync ─

export async function syncNowCalendarTask(taskId: string) {
  const id = taskIdSchema.parse(taskId)
  const { supabase, user } = await authedClient()

  const { data: task } = await supabase
    .from('tasks')
    .select('title, scheduled_at, google_calendar_event_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!task || task.google_calendar_event_id || !task.scheduled_at) return

  const integration = await getUserIntegration(supabase, user.id)
  if (!integration?.google_refresh_token) return

  const accessToken = await getAccessToken(integration.google_refresh_token)
  const calendarId = integration.google_calendar_id ?? 'primary'

  const eventId = await createGCalEvent(accessToken, calendarId, {
    summary: task.title,
    scheduledAt: task.scheduled_at,
  })

  await supabase
    .from('tasks')
    .update({ google_calendar_event_id: eventId })
    .eq('id', id)
    .eq('user_id', user.id)

  revalidatePath('/calendar')
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

  const integration = await getUserIntegration(supabase, user.id)
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
  const { supabase, user } = await authedClient()

  const { data: task } = await supabase
    .from('tasks')
    .select('status, google_calendar_event_id')
    .eq('id', id)
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
    .eq('id', id)
    .eq('user_id', user.id)

  // Delete from Google Calendar (non-fatal)
  const integration = await getUserIntegration(supabase, user.id)
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

// ── Disconnects Google Calendar (clears the stored token) ─────

export async function disconnectGoogleCalendar() {
  const { supabase, user } = await authedClient()

  await supabase
    .from('user_integrations')
    .update({ google_refresh_token: null, google_calendar_id: null })
    .eq('user_id', user.id)

  revalidatePath('/settings')
}
