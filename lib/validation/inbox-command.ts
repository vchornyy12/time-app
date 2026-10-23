import { z } from 'zod'
import { taskId, contexts, title, dateString, datetimeString, recurrenceRule, createProjectSchema } from './schemas'

const base = { taskId, version: z.string().datetime({ offset: true }) }
const realDate = dateString.refine(value => {
  const date = new Date(`${value}T12:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}, 'Choose a valid date.')
export const inboxCommandSchema = z.discriminatedUnion('action', [
  z.object({ ...base, action: z.literal('trash') }),
  z.object({ ...base, action: z.literal('notes') }),
  z.object({ ...base, action: z.literal('done') }),
  z.object({ ...base, action: z.literal('waiting_for'), delegatedTo: z.string().trim().min(1).max(200), dueDate: realDate.optional(), contexts: contexts.default([]) }),
  z.object({ ...base, action: z.literal('calendar'), scheduledAt: datetimeString, recurrenceRule: recurrenceRule.nullable().default(null) }),
  z.object({ ...base, action: z.literal('someday_maybe'), reviewDate: realDate.optional() }),
  z.object({ ...base, action: z.literal('next_actions'), nextActionTitle: title, contexts: contexts.default([]), recurrenceRule: recurrenceRule.nullable().default(null) }),
  createProjectSchema.omit({ originTaskId: true }).extend({ ...base, action: z.literal('project') }),
])
export type InboxCommand = z.infer<typeof inboxCommandSchema>
