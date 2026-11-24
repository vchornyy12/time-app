import 'server-only'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { RecurrenceRule } from '@/lib/types'
import { clearGoogleIntegration, getGoogleIntegration } from '@/lib/google/integration'
import {
  createGCalEvent,
  deleteGCalEvent,
  getAccessToken,
  GoogleApiError,
  GoogleAuthError,
  updateGCalEvent,
} from '@/lib/google/calendar'

import type { CalendarSyncStatus } from '@/lib/google/sync-status'

export type { CalendarSyncStatus }

type Ctx = { supabase: SupabaseClient; user: Pick<User, 'id'> }
type Session = { accessToken: string; calendarId: string }
type SyncableTask = {
  id: string
  title: string
  status: string
  scheduled_at: string | null
  recurrence_rule: RecurrenceRule | null
  google_calendar_event_id: string | null
}

const TASK_COLUMNS = 'id, title, status, scheduled_at, recurrence_rule, google_calendar_event_id'
const RRULE: Record<RecurrenceRule, string> = {
  daily: 'RRULE:FREQ=DAILY',
  weekly: 'RRULE:FREQ=WEEKLY',
  monthly: 'RRULE:FREQ=MONTHLY',
  yearly: 'RRULE:FREQ=YEARLY',
}
/** Upper bound for one automatic catch-up pass, so a page load stays fast. */
export const MAX_PENDING_SYNC = 25

async function openSession(ctx: Ctx): Promise<Session | null> {
  const integration = await getGoogleIntegration(ctx.user.id)
  if (!integration?.google_refresh_token) return null
  return {
    accessToken: await getAccessToken(integration.google_refresh_token),
    calendarId: integration.google_calendar_id ?? 'primary',
  }
}

async function failure(ctx: Ctx, error: unknown, label: string): Promise<'reconnect' | 'failed'> {
  const message = error instanceof Error ? error.message : String(error)
  if (error instanceof GoogleAuthError) {
    console.error(`[calendar-sync] ${label}: Google access lost, clearing the connection. ${message}`)
    await clearGoogleIntegration(ctx.user.id).catch(() => {})
    return 'reconnect'
  }
  console.error(`[calendar-sync] ${label}: ${message}`)
  return 'failed'
}

async function createEvent(ctx: Ctx, session: Session, task: SyncableTask): Promise<CalendarSyncStatus> {
  if (task.status !== 'calendar' || !task.scheduled_at || task.google_calendar_event_id) return 'skipped'
  const eventId = await createGCalEvent(session.accessToken, session.calendarId, {
    summary: task.title,
    scheduledAt: task.scheduled_at,
    recurrence: task.recurrence_rule ? [RRULE[task.recurrence_rule]] : undefined,
  })
  // Store the ID only if no concurrent sync stored one first; otherwise drop our duplicate.
  const { data, error } = await ctx.supabase
    .from('tasks')
    .update({ google_calendar_event_id: eventId })
    .eq('id', task.id)
    .eq('user_id', ctx.user.id)
    .is('google_calendar_event_id', null)
    .select('id')
  if (error || !data?.length) {
    await deleteGCalEvent(session.accessToken, session.calendarId, eventId).catch(() => {})
    if (error) throw new Error(`Could not store the Google event: ${error.message}`)
  }
  return 'synced'
}

async function loadTask(ctx: Ctx, taskId: string): Promise<SyncableTask | null> {
  const { data } = await ctx.supabase
    .from('tasks')
    .select(TASK_COLUMNS)
    .eq('id', taskId)
    .eq('user_id', ctx.user.id)
    .maybeSingle()
  return (data as SyncableTask | null) ?? null
}

/** Creates the Google event for one calendar task. Never throws for Google errors. */
export async function syncTaskToGoogle(ctx: Ctx, taskId: string): Promise<CalendarSyncStatus> {
  try {
    const task = await loadTask(ctx, taskId)
    if (!task) return 'skipped'
    if (task.status !== 'calendar' || !task.scheduled_at || task.google_calendar_event_id) return 'skipped'
    const session = await openSession(ctx)
    if (!session) return 'not_connected'
    return await createEvent(ctx, session, task)
  } catch (error) {
    return failure(ctx, error, `sync ${taskId}`)
  }
}

/** Moves the Google event to the task's current time, recreating it if it was deleted in Google. */
export async function rescheduleTaskInGoogle(ctx: Ctx, taskId: string): Promise<CalendarSyncStatus> {
  try {
    const task = await loadTask(ctx, taskId)
    if (!task || task.status !== 'calendar' || !task.scheduled_at) return 'skipped'
    const session = await openSession(ctx)
    if (!session) return 'not_connected'
    if (!task.google_calendar_event_id) return await createEvent(ctx, session, task)
    try {
      await updateGCalEvent(session.accessToken, session.calendarId, task.google_calendar_event_id, task.scheduled_at)
      return 'synced'
    } catch (error) {
      if (!(error instanceof GoogleApiError) || (error.status !== 404 && error.status !== 410)) throw error
      await ctx.supabase.from('tasks').update({ google_calendar_event_id: null })
        .eq('id', task.id).eq('user_id', ctx.user.id).eq('google_calendar_event_id', task.google_calendar_event_id)
      return await createEvent(ctx, session, { ...task, google_calendar_event_id: null })
    }
  } catch (error) {
    return failure(ctx, error, `reschedule ${taskId}`)
  }
}

/** Removes a Google event. Non-fatal: a failure only leaves a stray event behind. */
export async function deleteGoogleEvent(ctx: Ctx, eventId: string): Promise<CalendarSyncStatus> {
  try {
    const session = await openSession(ctx)
    if (!session) return 'not_connected'
    await deleteGCalEvent(session.accessToken, session.calendarId, eventId)
    return 'synced'
  } catch (error) {
    return failure(ctx, error, `delete event`)
  }
}

export type PendingSyncResult = { synced: number; failed: number; remaining: number; status: CalendarSyncStatus }

/**
 * Creates Google events for calendar tasks that have none yet: tasks scheduled
 * while Google was unreachable, from the mobile app, or before connecting.
 */
export async function syncPendingTasks(ctx: Ctx): Promise<PendingSyncResult> {
  const result: PendingSyncResult = { synced: 0, failed: 0, remaining: 0, status: 'skipped' }
  try {
    const { data, error } = await ctx.supabase
      .from('tasks')
      .select(TASK_COLUMNS)
      .eq('user_id', ctx.user.id)
      .eq('status', 'calendar')
      .is('google_calendar_event_id', null)
      .not('scheduled_at', 'is', null)
      .order('scheduled_at', { ascending: true })
      .limit(MAX_PENDING_SYNC + 1)
    if (error) throw new Error(error.message)
    const tasks = (data ?? []) as SyncableTask[]
    if (!tasks.length) return result
    result.remaining = Math.max(0, tasks.length - MAX_PENDING_SYNC)
    const session = await openSession(ctx)
    if (!session) return { ...result, status: 'not_connected' }
    for (const task of tasks.slice(0, MAX_PENDING_SYNC)) {
      try {
        if ((await createEvent(ctx, session, task)) === 'synced') result.synced++
      } catch (error) {
        const status = await failure(ctx, error, `sync ${task.id}`)
        if (status === 'reconnect') return { ...result, status }
        result.failed++
      }
    }
    return { ...result, status: result.failed ? 'failed' : 'synced' }
  } catch (error) {
    return { ...result, status: await failure(ctx, error, 'pending sync') }
  }
}
