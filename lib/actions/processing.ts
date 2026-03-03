'use server'

import { revalidatePath } from 'next/cache'
import { syncCreateCalendarEvent, syncWaitingForReminder } from '@/lib/actions/calendar'
import { authedClient } from '@/lib/actions/authed-action'
import {
  taskId as taskIdSchema,
  processToWaitingForSchema,
  processToCalendarSchema,
  processToSomedayMaybeSchema,
  processToNextActionsSchema,
} from '@/lib/validation/schemas'

function revalidateInbox() {
  revalidatePath('/inbox')
  revalidatePath('/', 'layout') // sidebar count
}

export async function processToTrash(taskId: string) {
  const id = taskIdSchema.parse(taskId)
  const { supabase, user } = await authedClient()
  const { error } = await supabase
    .from('tasks')
    .update({ status: 'trash' })
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) throw error
  revalidateInbox()
  revalidatePath('/trash')
}

export async function processToNotes(taskId: string) {
  const id = taskIdSchema.parse(taskId)
  const { supabase, user } = await authedClient()
  const { error } = await supabase
    .from('tasks')
    .update({ status: 'notes' })
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) throw error
  revalidateInbox()
  revalidatePath('/notes')
}

export async function processToWaitingFor(
  taskId: string,
  delegatedTo: string,
  dueDate?: string,
  contexts: string[] = []
) {
  const parsed = processToWaitingForSchema.parse({ taskId, delegatedTo, dueDate, contexts })
  const { supabase, user } = await authedClient()

  const update: Record<string, unknown> = {
    status: 'waiting_for',
    delegated_to: parsed.delegatedTo,
    contexts: parsed.contexts,
  }
  if (parsed.dueDate) update.due_date = parsed.dueDate

  const { error } = await supabase
    .from('tasks')
    .update(update)
    .eq('id', parsed.taskId)
    .eq('user_id', user.id)
  if (error) throw error

  revalidateInbox()
  revalidatePath('/waiting-for')

  // Auto-create GCal follow-up reminder (non-fatal)
  if (parsed.dueDate) {
    await syncWaitingForReminder(parsed.taskId, parsed.dueDate).catch(() => {})
  }
}

export async function processToCalendar(taskId: string, scheduledAt: string) {
  const parsed = processToCalendarSchema.parse({ taskId, scheduledAt })
  const { supabase, user } = await authedClient()

  // Fetch title before updating status (needed for Google Calendar event)
  const { data: task } = await supabase
    .from('tasks')
    .select('title')
    .eq('id', parsed.taskId)
    .eq('user_id', user.id)
    .single()

  const { error } = await supabase
    .from('tasks')
    .update({ status: 'calendar', scheduled_at: new Date(parsed.scheduledAt).toISOString() })
    .eq('id', parsed.taskId)
    .eq('user_id', user.id)
  if (error) throw error

  revalidateInbox()
  revalidatePath('/calendar')

  // Auto-sync to Google Calendar — non-fatal if it fails
  if (task?.title) {
    try {
      await syncCreateCalendarEvent(parsed.taskId, task.title, parsed.scheduledAt)
    } catch {
      // Sync failure is non-fatal: task is still in calendar status
    }
  }
}

export async function processToSomedayMaybe(taskId: string, reviewDate?: string) {
  const parsed = processToSomedayMaybeSchema.parse({ taskId, reviewDate })
  const { supabase, user } = await authedClient()
  const update: Record<string, unknown> = { status: 'someday_maybe' }
  if (parsed.reviewDate) update.due_date = parsed.reviewDate
  const { error } = await supabase
    .from('tasks')
    .update(update)
    .eq('id', parsed.taskId)
    .eq('user_id', user.id)
  if (error) throw error
  revalidateInbox()
  revalidatePath('/someday')
}

export async function processToNextActions(
  taskId: string,
  contexts: string[] = [],
  nextActionTitle?: string
) {
  const parsed = processToNextActionsSchema.parse({ taskId, contexts, nextActionTitle })
  const { supabase, user } = await authedClient()
  const update: Record<string, unknown> = { status: 'next_actions', contexts: parsed.contexts }
  if (parsed.nextActionTitle?.trim()) update.title = parsed.nextActionTitle.trim()
  const { error } = await supabase
    .from('tasks')
    .update(update)
    .eq('id', parsed.taskId)
    .eq('user_id', user.id)
  if (error) throw error
  revalidateInbox()
  revalidatePath('/next-actions')
}

export async function processAsDone(taskId: string) {
  const id = taskIdSchema.parse(taskId)
  const { supabase, user } = await authedClient()
  const { error } = await supabase
    .from('tasks')
    .update({ status: 'done', completed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) throw error
  revalidateInbox()
}
