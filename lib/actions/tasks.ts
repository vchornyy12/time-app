'use server'

import { revalidatePath } from 'next/cache'
import { authedClient } from '@/lib/actions/authed-action'
import { cleanupWaitingForReminder } from '@/lib/google/reminders'
import { syncWaitingForReminder } from '@/lib/actions/calendar'
import {
  captureTaskSchema,
  taskId as taskIdSchema,
  updateTaskTitleSchema,
  updateWaitingForDueDateSchema,
  updateSomedayReviewDateSchema,
  contexts as contextsSchema,
  delegateTaskSchema,
} from '@/lib/validation/schemas'

function revalidateAll() {
  revalidatePath('/inbox')
  revalidatePath('/', 'layout') // refreshes sidebar count
}

// ── capture ───────────────────────────────────────────────────

export async function captureTask(title: string, requestId?: string): Promise<{ id: string }> {
  const { title: trimmed } = captureTaskSchema.parse({ title })
  const id = requestId === undefined ? crypto.randomUUID() : taskIdSchema.parse(requestId)

  const { supabase, user } = await authedClient()

  const { data, error } = await supabase
    .from('tasks')
    .upsert(
      { id, title: trimmed, status: 'inbox', user_id: user.id },
      { onConflict: 'id', ignoreDuplicates: true }
    )
    .select('id')
    .maybeSingle()

  if (error) throw error
  // A retry after a lost response returns the original task without changing it.
  if (!data) {
    const { error: lookupError } = await supabase.from('tasks').select('id')
      .eq('id', id).eq('user_id', user.id).single()
    if (lookupError) throw lookupError
  }
  revalidateAll()
  return { id }
}

// ── update title ─────────────────────────────────────────────

export async function updateTaskTitle(taskId: string, title: string) {
  const parsed = updateTaskTitleSchema.parse({ taskId, title })
  const { supabase, user } = await authedClient()

  const { error } = await supabase
    .from('tasks')
    .update({ title: parsed.title })
    .eq('id', parsed.taskId)
    .eq('user_id', user.id)

  if (error) throw error
  revalidatePath('/inbox')
  revalidatePath('/', 'layout')
}

// ── delete (soft) → trash ────────────────────────────────────

export async function deleteTask(taskId: string) {
  const id = taskIdSchema.parse(taskId)
  const { supabase, user } = await authedClient()

  const { error } = await supabase
    .from('tasks')
    .update({ status: 'trash' })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw error
  revalidateAll()
  revalidatePath('/trash')
}

// ── mark complete ────────────────────────────────────────────

export async function markTaskDone(taskId: string) {
  const id = taskIdSchema.parse(taskId)
  const { supabase, user } = await authedClient()
  await cleanupWaitingForReminder(id, { supabase, user }).catch(() => {})

  const { error } = await supabase
    .from('tasks')
    .update({ status: 'done', completed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw error

  // If this task is a project's first step, clear the reference
  await supabase
    .from('projects')
    .update({ first_step_task_id: null })
    .eq('first_step_task_id', id)
    .eq('user_id', user.id)

  revalidatePath('/next-actions')
  revalidatePath('/waiting-for')
  revalidatePath('/projects')
  revalidatePath('/analytics')
  revalidatePath('/calendar')
}

// ── restore from trash (undo delete) ────────────────────────

export async function restoreTask(taskId: string) {
  const id = taskIdSchema.parse(taskId)
  const { supabase, user } = await authedClient()

  const { error } = await supabase
    .from('tasks')
    .update({ status: 'inbox' })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw error
  revalidateAll()
  revalidatePath('/trash')
}

// ── move any task back to inbox ───────────────────────────────

export async function moveToInbox(taskId: string) {
  const id = taskIdSchema.parse(taskId)
  const { supabase, user } = await authedClient()
  await cleanupWaitingForReminder(id, { supabase, user }).catch(() => {})

  const { error } = await supabase
    .from('tasks')
    .update({ status: 'inbox' })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw error
  revalidateAll()
  revalidatePath('/waiting-for')
}

// ── waiting for: toggle delegation communicated ───────────────

export async function toggleDelegationCommunicated(taskId: string, next: boolean) {
  const id = taskIdSchema.parse(taskId)
  const { supabase, user } = await authedClient()

  const { error } = await supabase
    .from('tasks')
    .update({ is_delegation_communicated: next })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw error
  revalidatePath('/waiting-for')
}

// ── hard delete a single task (permanent) ────────────────────

export async function hardDeleteTask(taskId: string) {
  const id = taskIdSchema.parse(taskId)
  const { supabase, user } = await authedClient()

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw error
  revalidatePath('/trash')
}

// ── update due date on a waiting_for task ────────────────────

export async function updateWaitingForDueDate(taskId: string, dueDate: string | null) {
  const parsed = updateWaitingForDueDateSchema.parse({ taskId, dueDate })
  const { supabase, user } = await authedClient()
  await cleanupWaitingForReminder(parsed.taskId, { supabase, user }).catch(() => {})

  const { error } = await supabase
    .from('tasks')
    .update({ due_date: parsed.dueDate })
    .eq('id', parsed.taskId)
    .eq('user_id', user.id)

  if (error) throw error

  revalidatePath('/waiting-for')

  if (parsed.dueDate) {
    await syncWaitingForReminder(parsed.taskId, parsed.dueDate).catch(() => {})
  }
}

// ── update context tags on a task ────────────────────────────

export async function updateTaskContexts(taskId: string, contexts: string[]) {
  const id = taskIdSchema.parse(taskId)
  const validContexts = contextsSchema.parse(contexts)
  const { supabase, user } = await authedClient()

  const { error } = await supabase
    .from('tasks')
    .update({ contexts: validContexts })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw error
  revalidatePath('/next-actions')
}

// ── move any task directly to next_actions ────────────────────

export async function moveToNextActions(taskId: string) {
  const id = taskIdSchema.parse(taskId)
  const { supabase, user } = await authedClient()
  await cleanupWaitingForReminder(id, { supabase, user }).catch(() => {})

  const { error } = await supabase
    .from('tasks')
    .update({ status: 'next_actions' })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw error
  revalidatePath('/next-actions')
  revalidatePath('/waiting-for')
  revalidatePath('/someday')
  revalidatePath('/', 'layout')
}

// ── update review date on a someday_maybe task ───────────────

export async function updateSomedayReviewDate(taskId: string, reviewDate: string | null) {
  const parsed = updateSomedayReviewDateSchema.parse({ taskId, reviewDate })
  const { supabase, user } = await authedClient()

  const { error } = await supabase
    .from('tasks')
    .update({ due_date: parsed.reviewDate })
    .eq('id', parsed.taskId)
    .eq('user_id', user.id)

  if (error) throw error
  revalidatePath('/someday')
}

// ── delegate: move next_actions → waiting_for ────────────────

export async function delegateTask(
  taskId: string,
  delegatedTo: string,
  dueDate?: string,
  isCommunicated: boolean = false
) {
  const parsed = delegateTaskSchema.parse({ taskId, delegatedTo, dueDate, isCommunicated })
  const { supabase, user } = await authedClient()

  const update: Record<string, unknown> = {
    status: 'waiting_for',
    delegated_to: parsed.delegatedTo,
    is_delegation_communicated: parsed.isCommunicated,
  }
  if (parsed.dueDate) update.due_date = parsed.dueDate

  const { error } = await supabase
    .from('tasks')
    .update(update)
    .eq('id', parsed.taskId)
    .eq('user_id', user.id)

  if (error) throw error

  revalidatePath('/next-actions')
  revalidatePath('/waiting-for')
  revalidatePath('/', 'layout')

  // Auto-create GCal follow-up reminder (non-fatal)
  if (parsed.dueDate) {
    await syncWaitingForReminder(parsed.taskId, parsed.dueDate).catch(() => {})
  }
}

// ── empty trash (hard delete all trash items) ─────────────────

export async function emptyTrash() {
  const { supabase, user } = await authedClient()

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('user_id', user.id)
    .eq('status', 'trash')

  if (error) throw error
  revalidatePath('/trash')
}
