import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { actionContext } from '@/lib/actions/action-context'
import { inboxCommandSchema } from '@/lib/validation/inbox-command'
import { processAsDone, processToCalendar, processToNextActions, processToNotes, processToSomedayMaybe, processToTrash, processToWaitingFor } from '@/lib/actions/processing'
import { createProject } from '@/lib/actions/projects'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const reply = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { 'Cache-Control': 'private, no-store' } })
export async function POST(request: NextRequest) {
  const bearer = request.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1]
  if (!bearer || bearer.length > 8192) return reply({ error: 'Sign in again.' }, 401)
  if (!request.headers.get('content-type')?.startsWith('application/json')) return reply({ error: 'Expected JSON.' }, 415)
  let raw: unknown
  try {
    const text = await request.text()
    if (text.length > 40000) return reply({ error: 'Request too large.' }, 413)
    raw = JSON.parse(text)
  } catch { return reply({ error: 'Invalid request.' }, 400) }
  const parsed = inboxCommandSchema.safeParse(raw)
  if (!parsed.success) return reply({ error: parsed.error.issues[0]?.message ?? 'Invalid input.' }, 400)
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${bearer}` } }, auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: { user }, error } = await supabase.auth.getUser(bearer)
    if (error || !user) return reply({ error: 'Sign in again.' }, 401)
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
