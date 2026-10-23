import { describe, expect, it } from 'vitest'
import { inboxCommandSchema } from './inbox-command'
const base = { taskId: '00000000-0000-4000-8000-000000000001', version: '2026-10-23T12:00:00.123456+00:00' }
describe('Inbox command contract shared by native and server', () => {
  it.each([
    { action: 'trash' }, { action: 'notes' }, { action: 'done' },
    { action: 'waiting_for', delegatedTo: 'Accountant', dueDate: '2026-10-30', contexts: ['@phone'] },
    { action: 'calendar', scheduledAt: '2026-10-30T09:00:00+01:00', recurrenceRule: 'weekly' },
    { action: 'someday_maybe', reviewDate: '2026-11-01' },
    { action: 'next_actions', nextActionTitle: 'Call accountant', contexts: ['@phone'], recurrenceRule: 'daily' },
    { action: 'project', title: 'Launch', completionCriteria: 'Live', roughPlanLines: ['Prepare'], firstStepTitle: 'Draft' },
  ])('accepts the %j terminal branch', command => {
    expect(inboxCommandSchema.safeParse({ ...base, ...command }).success).toBe(true)
  })
  it.each([
    { action: 'waiting_for', delegatedTo: '' },
    { action: 'waiting_for', delegatedTo: 'Alice', dueDate: '2026-02-30' },
    { action: 'someday_maybe', reviewDate: '2026-13-01' },
    { action: 'calendar', scheduledAt: '' },
    { action: 'next_actions', nextActionTitle: ' ', contexts: [] },
    { action: 'project', title: '', roughPlanLines: [] },
    { action: 'unknown' },
  ])('rejects invalid input %j', command => expect(inboxCommandSchema.safeParse({ ...base, ...command }).success).toBe(false))
})
