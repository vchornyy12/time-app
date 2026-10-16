import type { Task } from '@/lib/types'

export type ProjectTask = Pick<Task, 'id' | 'title' | 'status' | 'contexts' | 'due_date'>
export type ProjectHealth = 'actionable' | 'waiting' | 'scheduled' | 'missing'

export function getProjectHealth(tasks: Pick<Task, 'status'>[]): ProjectHealth {
  if (tasks.some((task) => task.status === 'next_actions')) return 'actionable'
  if (tasks.some((task) => task.status === 'waiting_for')) return 'waiting'
  if (tasks.some((task) => task.status === 'calendar')) return 'scheduled'
  return 'missing'
}

export function getActiveProjectTask(tasks: ProjectTask[], preferredId: string | null): ProjectTask | null {
  const active = tasks.filter((task) => ['next_actions', 'waiting_for', 'calendar'].includes(task.status))
  return active.find((task) => task.id === preferredId)
    ?? active.find((task) => task.status === 'next_actions') ?? active[0] ?? null
}
