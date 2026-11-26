import { NextRequest } from 'next/server'
import { actionContext } from '@/lib/actions/action-context'
import { inboxCommandSchema } from '@/lib/validation/inbox-command'
import { processAsDone, processToCalendar, processToNextActions, processToNotes, processToSomedayMaybe, processToTrash, processToWaitingFor } from '@/lib/actions/processing'
import { createProject } from '@/lib/actions/projects'
import { reply, verifyMobileRequest } from '@/lib/mobile/route-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function POST(request: NextRequest) {
  const verified = await verifyMobileRequest(request)
  if (!verified.ok) return verified.response
  const parsed = inboxCommandSchema.safeParse(verified.body)
  if (!parsed.success) return reply({ error: parsed.error.issues[0]?.message ?? 'Invalid input.' }, 400)
  const { supabase, user } = verified
  try {
    const command = parsed.data
    const { data: task, error: taskError } = await supabase.from('tasks').select('status, updated_at')
      .eq('id', command.taskId).eq('user_id', user.id).single()
    if (taskError || !task) return reply({ error: 'Task not found.' }, 404)
    if (task.status !== 'inbox' || task.updated_at !== command.version) return reply({ error: 'Task changed. Reload it before processing.' }, 409)
    const result = await actionContext.run({ supabase, user, inboxVersion: command.version }, async () => {
      switch (command.action) {
        case 'trash': return processToTrash(command.taskId)
        case 'notes': return processToNotes(command.taskId)
        case 'done': return processAsDone(command.taskId)
        case 'waiting_for': return processToWaitingFor(command.taskId, command.delegatedTo, command.dueDate, command.contexts)
        case 'calendar': return processToCalendar(command.taskId, command.scheduledAt, command.recurrenceRule)
        case 'someday_maybe': return processToSomedayMaybe(command.taskId, command.reviewDate)
        case 'next_actions': return processToNextActions(command.taskId, command.contexts, command.nextActionTitle, command.recurrenceRule)
        case 'project': return createProject({ ...command, originTaskId: command.taskId })
      }
    })
    return reply({ ok: true, result: result ?? null })
  } catch { return reply({ error: 'Unable to process task. Reload before retrying if a previous request timed out.' }, 500) }
}
