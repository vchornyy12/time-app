import { supabase } from './supabase'
import type { Task } from '@shared/types'
import { contexts as contextsSchema, taskId as taskIdSchema, title as titleSchema } from '../../lib/validation/schemas'

export type TaskSummary = Pick<Task, 'id' | 'title' | 'created_at' | 'scheduled_at' | 'google_calendar_event_id' | 'contexts' | 'recurrence_rule' | 'due_date' | 'delegated_to' | 'project_id'>
export type TaskStatus = Task['status']
export type TaskCursor = { value: string; id: string }
export const TASK_PAGE_SIZE = 50

export function taskCursor(task: TaskSummary, status: TaskStatus): TaskCursor {
  return { value: status === 'calendar' ? task.scheduled_at! : task.created_at, id: task.id }
}

export async function fetchTaskPage(userId: string, status: TaskStatus, after: TaskCursor | null, signal: AbortSignal, day = new Date(), context: string | null = null, allDates = false) {
  const column = status === 'calendar' ? 'scheduled_at' : 'created_at'
  const ascending = status === 'calendar'
  let query = supabase.from('tasks')
    .select('id, title, created_at, scheduled_at, google_calendar_event_id, contexts, recurrence_rule, due_date, delegated_to, project_id')
    .eq('user_id', userId).eq('status', status)
  if (context) query = query.contains('contexts', [context])
  if (status === 'calendar' && !allDates) {
    const start = new Date(day); start.setHours(0, 0, 0, 0)
    const end = new Date(start); end.setDate(end.getDate() + 1)
    query = query.gte('scheduled_at', start.toISOString()).lt('scheduled_at', end.toISOString())
  }
  if (after) {
    const comparison = ascending ? 'gt' : 'lt'
    // Validate before composing the filter, preserving Postgres microsecond precision.
    if (!/^[a-f0-9-]{36}$/i.test(after.id)) throw new Error('Invalid task cursor')
    const timestamp = after.value
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(timestamp) || Number.isNaN(Date.parse(timestamp))) throw new Error('Invalid task cursor')
    query = query.or(`${column}.${comparison}.${timestamp},and(${column}.eq.${timestamp},id.${comparison}.${after.id})`)
  }
  const { data, error } = await query
    .order(column, { ascending }).order('id', { ascending })
    .limit(TASK_PAGE_SIZE).abortSignal(signal)
  if (error) throw error
  return (data ?? []) as TaskSummary[]
}

export type TaskDetail = Pick<Task, 'id' | 'title' | 'status' | 'contexts' | 'updated_at' | 'scheduled_at' | 'due_date' | 'delegated_to' | 'project_id' | 'recurrence_rule'>
const DETAIL_COLUMNS = 'id, title, status, contexts, updated_at, scheduled_at, due_date, delegated_to, project_id, recurrence_rule'

export async function fetchTaskDetail(userId: string, taskId: string, signal: AbortSignal): Promise<TaskDetail> {
  taskIdSchema.parse(taskId)
  if (!userId) throw new Error('Sign in to open this task.')
  const { data, error } = await supabase.from('tasks').select(DETAIL_COLUMNS)
    .eq('id', taskId).eq('user_id', userId).abortSignal(signal).single()
  if (error) throw error
  if (!data) throw new Error('Task not found.')
  return data as TaskDetail
}

// One write keeps title, contexts and the processing transition together.
// The version guard prevents a stale editor from overwriting changes made on web.
export async function saveTaskDetail(userId: string, task: TaskDetail, input: { title: string; contexts: string[] }, process = false) {
  taskIdSchema.parse(task.id)
  if (!userId) throw new Error('Sign in to save this task.')
  const title = titleSchema.parse(input.title)
  const contexts = contextsSchema.parse(input.contexts)
  if (process && task.status !== 'inbox') throw new Error('Only inbox items can be processed here.')
  const patch = { title, contexts, ...(process ? { status: 'next_actions' as const } : {}) }
  const { data, error } = await supabase.from('tasks').update(patch)
    .eq('id', task.id).eq('user_id', userId).eq('status', task.status)
    .eq('updated_at', task.updated_at).select(DETAIL_COLUMNS).single()
  if (error) throw error
  if (!data) throw new Error('Task changed. Reload it before saving.')
  return data as TaskDetail
}

export async function fetchUserContexts(userId: string, signal: AbortSignal): Promise<string[]> {
  if (!userId) return []
  const { data, error } = await supabase.from('user_contexts').select('name')
    .eq('user_id', userId).order('created_at', { ascending: true }).abortSignal(signal)
  if (error) throw error
  return (data ?? []).map(row => row.name)
}

export async function completeTask(userId: string, taskId: string) {
  // Project next actions must clear the first step in the same transaction.
  const { data: current, error: readError } = await supabase.from('tasks')
    .select('id, project_id, status').eq('id', taskId).eq('user_id', userId).single()
  if (readError) throw readError
  if (!current) throw new Error('Task not found.')
  if (current.status === 'done') return
  if (current.status !== 'next_actions' && current.status !== 'calendar') throw new Error('Task moved to another list. Reload before completing it.')
  if (current.project_id && current.status === 'next_actions') {
    const { error } = await supabase.rpc('complete_project_step', { p_project_id: current.project_id, p_task_id: taskId })
    if (error) throw error
    return
  }
  const { data, error } = await supabase.from('tasks')
    .update({ status: 'done', completed_at: new Date().toISOString() })
    .eq('id', taskId).eq('user_id', userId).eq('status', current.status).select('id, project_id').single()
  if (error) throw error
  // Match the web completion workflow without an extra request for standalone tasks.
  if (data.project_id) {
    const { error: projectError } = await supabase.from('projects')
      .update({ first_step_task_id: null }).eq('id', data.project_id)
      .eq('first_step_task_id', taskId).eq('user_id', userId)
    if (projectError) throw projectError
  }
}

// Keep this object for retries after a timeout: the first request may have committed.
export async function saveCapture(draft: { id: string; title: string; userId: string }) {
  const title = draft.title.trim()
  if (!draft.userId || !title || Array.from(title).length > 500) throw new Error('Use a title between 1 and 500 characters.')
  const { error } = await supabase.from('tasks').upsert(
    { id: draft.id, title, status: 'inbox', user_id: draft.userId },
    { onConflict: 'id', ignoreDuplicates: true },
  )
  if (error) throw error
}

export async function processInbox(command: import('../../lib/validation/inbox-command').InboxCommand) {
  const { inboxCommandSchema } = await import('../../lib/validation/inbox-command')
  const payload = inboxCommandSchema.parse(command)
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session) throw new Error('Sign in again before processing.')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30000)
  try {
    const response = await fetch('https://time24.pro/api/mobile/process-inbox', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
      body: JSON.stringify(payload), signal: controller.signal,
    })
    const result = await response.json()
    if (!response.ok || !result.ok) throw new Error(typeof result.error === 'string' ? result.error : 'Unable to process task.')
    return result.result
  } finally { clearTimeout(timer) }
}
