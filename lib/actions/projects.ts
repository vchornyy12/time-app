'use server'

import { revalidatePath } from 'next/cache'
import { authedClient } from '@/lib/actions/authed-action'
import type { RoughPlanItem } from '@/lib/types'
import {
  createProjectSchema,
  taskId as taskIdSchema,
  projectId as projectIdSchema,
  itemId as itemIdSchema,
  reorderRoughPlanSchema,
  addRoughPlanStepSchema,
} from '@/lib/validation/schemas'

export async function createProject(input: {
  title: string
  completionCriteria: string
  roughPlanLines: string[]
  firstStepTitle: string
  originTaskId: string
}) {
  const parsed = createProjectSchema.parse(input)
  const { supabase, user } = await authedClient()

  // Build rough plan items (skip blank lines)
  const roughPlan: RoughPlanItem[] = parsed.roughPlanLines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text, i) => ({ id: crypto.randomUUID(), text, order: i }))

  // 1. Create the project (without first_step_task_id yet)
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({
      title: parsed.title,
      completion_criteria: parsed.completionCriteria.trim() || null,
      rough_plan: roughPlan,
      user_id: user.id,
      status: 'active',
    })
    .select()
    .single()

  if (projectError || !project) {
    throw new Error(projectError?.message ?? 'Failed to create project')
  }

  // 2. Transform the origin inbox task into the first next action
  const { data: firstTask, error: taskError } = await supabase
    .from('tasks')
    .update({
      title: parsed.firstStepTitle.trim() || parsed.title,
      status: 'next_actions',
      project_id: project.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.originTaskId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (taskError || !firstTask) {
    // Roll back project if task update fails
    await supabase.from('projects').delete().eq('id', project.id)
    throw new Error(taskError?.message ?? 'Failed to update task')
  }

  // 3. Link first_step_task_id on the project
  const { error: linkError } = await supabase
    .from('projects')
    .update({ first_step_task_id: firstTask.id })
    .eq('id', project.id)

  if (linkError) throw new Error(linkError.message)

  revalidatePath('/', 'layout')

  return { project, firstTask }
}

// ── Marks the current first-step task as done and clears the reference ──

export async function completeFirstStep(projectId: string, taskId: string) {
  const pId = projectIdSchema.parse(projectId)
  const tId = taskIdSchema.parse(taskId)
  const { supabase, user } = await authedClient()

  const { error: taskError } = await supabase
    .from('tasks')
    .update({ status: 'done', completed_at: new Date().toISOString() })
    .eq('id', tId)
    .eq('user_id', user.id)

  if (taskError) throw new Error(taskError.message)

  const { error: projectError } = await supabase
    .from('projects')
    .update({ first_step_task_id: null })
    .eq('id', pId)
    .eq('user_id', user.id)

  if (projectError) throw new Error(projectError.message)

  revalidatePath('/projects')
  revalidatePath('/next-actions')
}

// ── Promotes a rough-plan item: removes it from JSON, creates a next-action task ──

export async function promoteRoughPlanItem(projectId: string, itemId: string) {
  const pId = projectIdSchema.parse(projectId)
  const iId = itemIdSchema.parse(itemId)
  const { supabase, user } = await authedClient()

  const { data: project, error: fetchError } = await supabase
    .from('projects')
    .select('rough_plan')
    .eq('id', pId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !project) throw new Error('Project not found')

  const item = (project.rough_plan as RoughPlanItem[]).find((i) => i.id === iId)
  if (!item) throw new Error('Plan item not found')

  const newRoughPlan = (project.rough_plan as RoughPlanItem[]).filter((i) => i.id !== iId)

  // Create the promoted task
  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .insert({
      title: item.text,
      status: 'next_actions',
      project_id: pId,
      user_id: user.id,
    })
    .select()
    .single()

  if (taskError || !task) throw new Error('Failed to create task')

  // Update project: new plan + new first step
  await supabase
    .from('projects')
    .update({ rough_plan: newRoughPlan, first_step_task_id: task.id })
    .eq('id', pId)
    .eq('user_id', user.id)

  revalidatePath('/projects')
  revalidatePath('/next-actions')

  return task
}

// ── Persists a reordered rough plan ──

// orderedIds: the IDs of rough-plan items in the desired order.
// We re-order using server-side data so client-supplied item content is never trusted.
export async function reorderRoughPlan(projectId: string, orderedIds: string[]) {
  const parsed = reorderRoughPlanSchema.parse({ projectId, orderedIds })
  const { supabase, user } = await authedClient()

  const { data: project, error } = await supabase
    .from('projects')
    .select('rough_plan')
    .eq('id', parsed.projectId)
    .eq('user_id', user.id)
    .single()

  if (error || !project) throw new Error('Project not found')

  const current = project.rough_plan as RoughPlanItem[]
  const planMap = new Map(current.map((item) => [item.id, item]))

  const reordered = parsed.orderedIds
    .filter((id) => planMap.has(id))
    .map((id, idx) => ({ ...planMap.get(id)!, order: idx }))

  // Preserve any items the client omitted (safety net for partial lists)
  const includedIds = new Set(parsed.orderedIds)
  const remaining = current
    .filter((item) => !includedIds.has(item.id))
    .map((item, i) => ({ ...item, order: reordered.length + i }))

  await supabase
    .from('projects')
    .update({ rough_plan: [...reordered, ...remaining] })
    .eq('id', parsed.projectId)
    .eq('user_id', user.id)

  revalidatePath('/projects')
}

// ── Appends a new step to the rough plan ──

export async function addRoughPlanStep(projectId: string, text: string) {
  const parsed = addRoughPlanStepSchema.parse({ projectId, text })
  const { supabase, user } = await authedClient()

  const { data: project, error: fetchError } = await supabase
    .from('projects')
    .select('rough_plan')
    .eq('id', parsed.projectId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !project) throw new Error('Project not found')

  const current = (project.rough_plan as RoughPlanItem[]) ?? []
  const newItem: RoughPlanItem = {
    id: crypto.randomUUID(),
    text: parsed.text,
    order: current.length,
  }

  const { error: updateError } = await supabase
    .from('projects')
    .update({ rough_plan: [...current, newItem] })
    .eq('id', parsed.projectId)
    .eq('user_id', user.id)

  if (updateError) throw new Error(updateError.message)

  revalidatePath('/projects')

  return newItem
}

// ── Marks the project itself as completed ──

export async function completeProject(projectId: string) {
  const pId = projectIdSchema.parse(projectId)
  const { supabase, user } = await authedClient()

  await supabase
    .from('projects')
    .update({ status: 'completed' })
    .eq('id', pId)
    .eq('user_id', user.id)

  revalidatePath('/projects')
}
