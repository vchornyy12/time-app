'use server'

import { revalidatePath } from 'next/cache'
import { authedClient } from '@/lib/actions/authed-action'
import type { Project, Task, RoughPlanItem } from '@/lib/types'
import {
  createProjectSchema,
  taskId as taskIdSchema,
  projectId as projectIdSchema,
  itemId as itemIdSchema,
  reorderRoughPlanSchema,
  addRoughPlanStepSchema,
} from '@/lib/validation/schemas'

function revalidateProjects() {
  revalidatePath('/projects')
  revalidatePath('/projects/[id]', 'page')
  revalidatePath('/next-actions')
  revalidatePath('/weekly-review')
}

export async function createProject(input: {
  title: string
  completionCriteria: string
  roughPlanLines: string[]
  firstStepTitle: string
  originTaskId: string
}): Promise<{ project: Project; firstTask: Task }> {
  const parsed = createProjectSchema.parse(input)
  const { supabase } = await authedClient()
  const { data, error } = await supabase.rpc('create_project_from_inbox', {
    p_origin_task_id: parsed.originTaskId,
    p_title: parsed.title,
    p_completion_criteria: parsed.completionCriteria,
    p_rough_plan_lines: parsed.roughPlanLines,
    p_first_step_title: parsed.firstStepTitle,
  })
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Failed to create project')
  revalidatePath('/', 'layout')
  return data as { project: Project; firstTask: Task }
}

export async function completeFirstStep(projectId: string, taskId: string) {
  const pId = projectIdSchema.parse(projectId)
  const tId = taskIdSchema.parse(taskId)
  const { supabase } = await authedClient()
  const { error } = await supabase.rpc('complete_project_step', { p_project_id: pId, p_task_id: tId })
  if (error) throw new Error(error.message)
  revalidateProjects()
  revalidatePath('/analytics')
  revalidatePath('/logbook')
  revalidatePath('/calendar')
}

export async function promoteRoughPlanItem(projectId: string, itemId: string): Promise<Task> {
  const pId = projectIdSchema.parse(projectId)
  const iId = itemIdSchema.parse(itemId)
  const { supabase } = await authedClient()
  const { data, error } = await supabase.rpc('promote_project_step', { p_project_id: pId, p_item_id: iId })
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Failed to promote step')
  revalidateProjects()
  return data as Task
}

export async function reorderRoughPlan(projectId: string, orderedIds: string[]): Promise<RoughPlanItem[]> {
  const parsed = reorderRoughPlanSchema.parse({ projectId, orderedIds })
  const { supabase } = await authedClient()
  const { data, error } = await supabase.rpc('reorder_project_plan', {
    p_project_id: parsed.projectId, p_ordered_ids: parsed.orderedIds,
  })
  if (error) throw new Error(error.message)
  revalidateProjects()
  return data as RoughPlanItem[]
}

export async function addRoughPlanStep(projectId: string, text: string, requestId?: string): Promise<RoughPlanItem> {
  const parsed = addRoughPlanStepSchema.parse({ projectId, text })
  const id = requestId === undefined ? crypto.randomUUID() : itemIdSchema.parse(requestId)
  const { supabase } = await authedClient()
  const { data, error } = await supabase.rpc('add_project_plan_step', {
    p_project_id: parsed.projectId, p_item_id: id, p_text: parsed.text,
  })
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Failed to add step')
  revalidateProjects()
  return data as RoughPlanItem
}

export async function completeProject(projectId: string) {
  const pId = projectIdSchema.parse(projectId)
  const { supabase } = await authedClient()
  const { error } = await supabase.rpc('complete_project', { p_project_id: pId })
  if (error) throw new Error(error.message)
  revalidateProjects()
}
