import { NextRequest } from 'next/server'
import { z } from 'zod'
import { actionContext } from '@/lib/actions/action-context'
import { markTaskDone } from '@/lib/actions/tasks'
import { decideSuggestion } from '@/lib/actions/assistant'
import { syncPendingCalendarTasks } from '@/lib/actions/calendar'
import { reply, verifyMobileRequest } from '@/lib/mobile/route-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const commandSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('complete_waiting_for'), taskId: z.string().uuid() }),
  z.object({ action: z.literal('decide_suggestion'), suggestionId: z.string().uuid(), decision: z.enum(['accept', 'dismiss']) }),
  z.object({ action: z.literal('sync_calendar') }),
])

/**
 * Mobile actions that must run on the server: they touch Google Calendar
 * (reminder cleanup, event creation) through the user's stored grant.
 */
export async function POST(request: NextRequest) {
  const verified = await verifyMobileRequest(request)
  if (!verified.ok) return verified.response
  const parsed = commandSchema.safeParse(verified.body)
  if (!parsed.success) return reply({ error: parsed.error.issues[0]?.message ?? 'Invalid input.' }, 400)
  const { supabase, user } = verified
  const command = parsed.data
  try {
    if (command.action === 'complete_waiting_for') {
      const { data: task, error } = await supabase.from('tasks').select('status')
        .eq('id', command.taskId).eq('user_id', user.id).single()
      if (error || !task) return reply({ error: 'Task not found.' }, 404)
      if (task.status !== 'waiting_for') return reply({ error: 'Task moved to another list. Reload it.' }, 409)
    }
    const result = await actionContext.run({ supabase, user }, async () => {
      switch (command.action) {
        case 'complete_waiting_for': return markTaskDone(command.taskId)
        case 'decide_suggestion': return decideSuggestion(command.suggestionId, command.decision)
        case 'sync_calendar': return syncPendingCalendarTasks()
      }
    })
    return reply({ ok: true, result: result ?? null })
  } catch { return reply({ error: 'Something went wrong. Please retry.' }, 500) }
}
