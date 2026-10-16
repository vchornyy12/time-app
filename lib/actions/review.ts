'use server'

import { authedClient } from '@/lib/actions/authed-action'
import type { Project, Task } from '@/lib/types'

export type ReviewProject = Project & { tasks: Pick<Task, 'id' | 'status'>[] }

export async function getReviewProjects(): Promise<ReviewProject[]> {
  const { supabase, user } = await authedClient()
  const { data, error } = await supabase.from('projects')
    .select('*, tasks!tasks_project_id_fkey(id, status)')
    .eq('user_id', user.id).eq('status', 'active')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ReviewProject[]
}

export async function getReviewInboxCount(): Promise<number> {
  const { supabase, user } = await authedClient()
  const { count, error } = await supabase.from('tasks')
    .select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'inbox')
  if (error) throw error
  if (count === null) throw new Error('Inbox count unavailable')
  return count
}

export async function getReviewTasks(status: 'waiting_for' | 'next_actions' | 'someday_maybe'): Promise<Task[]> {
  if (!['waiting_for', 'next_actions', 'someday_maybe'].includes(status)) throw new Error('Invalid review list')
  const { supabase, user } = await authedClient()
  const query = supabase.from('tasks').select('*').eq('user_id', user.id).eq('status', status)
  const { data, error } = status === 'next_actions'
    ? await query.order('created_at', { ascending: false })
    : await query.order('due_date', { ascending: true, nullsFirst: false })
  if (error) throw error
  return (data ?? []) as Task[]
}
