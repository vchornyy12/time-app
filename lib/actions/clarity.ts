'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { authedClient } from '@/lib/actions/authed-action'
import { claritySessionSchema } from '@/lib/validation/schemas'

type ClarityInput = z.infer<typeof claritySessionSchema>

/**
 * Saves a Clarity Protocol (Willis Carrier) session and creates an inbox task.
 *
 * Transaction integrity via manual rollback:
 *  1. Validate input with Zod — no DB writes on failure.
 *  2. INSERT task (status: inbox).
 *  3. INSERT clarity_session linking to the new task.
 *  4. If step 3 fails, hard-delete the orphaned task and re-throw.
 */
export async function submitClaritySession(
  input: ClarityInput,
): Promise<{ sessionId: string; taskId: string }> {
  const { worryDescription, worstCaseScenario, actionTitle } =
    claritySessionSchema.parse(input)

  const { supabase, user } = await authedClient()

  // ── 1. Insert task ─────────────────────────────────────────
  const { data: taskData, error: taskError } = await supabase
    .from('tasks')
    .insert({ title: actionTitle, status: 'inbox', user_id: user.id })
    .select('id')
    .single()

  if (taskError) throw taskError

  const taskId: string = taskData.id

  // ── 2. Insert clarity session ──────────────────────────────
  const { data: sessionData, error: sessionError } = await supabase
    .from('clarity_sessions')
    .insert({
      user_id: user.id,
      worry_description: worryDescription,
      worst_case_scenario: worstCaseScenario,
      resulting_task_id: taskId,
    })
    .select('id')
    .single()

  // ── Rollback: remove orphaned task if session write failed ─
  if (sessionError) {
    await supabase.from('tasks').delete().eq('id', taskId).eq('user_id', user.id)
    throw sessionError
  }

  revalidatePath('/inbox')
  revalidatePath('/', 'layout')

  return { sessionId: sessionData.id, taskId }
}
