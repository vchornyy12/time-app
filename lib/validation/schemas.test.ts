import { describe, it, expect } from 'vitest'
import {
  taskId,
  projectId,
  itemId,
  title,
  optionalTitle,
  dateString,
  optionalDateString,
  datetimeString,
  contexts,
  contextName,
  captureTaskSchema,
  processToWaitingForSchema,
  processToCalendarSchema,
  processToNextActionsSchema,
  processToSomedayMaybeSchema,
  createProjectSchema,
  reorderRoughPlanSchema,
  addRoughPlanStepSchema,
  rescheduleCalendarTaskSchema,
  updateWaitingForDueDateSchema,
  updateSomedayReviewDateSchema,
  delegateTaskSchema,
  attachmentSchema,
  updateAttachmentsSchema,
} from './schemas'

// ── Primitives ─────────────────────────────────────────────

describe('taskId / projectId', () => {
  it('accepts a valid UUID', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000'
    expect(taskId.parse(uuid)).toBe(uuid)
    expect(projectId.parse(uuid)).toBe(uuid)
  })

  it('rejects non-UUID strings', () => {
    expect(() => taskId.parse('not-a-uuid')).toThrow('Invalid task ID')
    expect(() => taskId.parse('')).toThrow()
    expect(() => taskId.parse('12345')).toThrow()
  })

  it('rejects SQL injection attempts in IDs', () => {
    expect(() => taskId.parse("'; DROP TABLE tasks; --")).toThrow()
    expect(() => taskId.parse('1 OR 1=1')).toThrow()
  })
})

describe('title', () => {
  it('accepts a valid title', () => {
    expect(title.parse('Buy groceries')).toBe('Buy groceries')
  })

  it('trims whitespace', () => {
    expect(title.parse('  hello  ')).toBe('hello')
  })

  it('rejects empty or whitespace-only titles', () => {
    expect(() => title.parse('')).toThrow('Title is required')
    expect(() => title.parse('   ')).toThrow('Title is required')
  })

  it('rejects titles over 500 chars', () => {
    expect(() => title.parse('x'.repeat(501))).toThrow()
  })

  it('accepts exactly 500 chars', () => {
    const long = 'x'.repeat(500)
    expect(title.parse(long)).toBe(long)
  })
})

describe('dateString', () => {
  it('accepts YYYY-MM-DD format', () => {
    expect(dateString.parse('2025-01-15')).toBe('2025-01-15')
    expect(dateString.parse('2024-12-31')).toBe('2024-12-31')
  })

  it('rejects invalid formats', () => {
    expect(() => dateString.parse('01-15-2025')).toThrow()
    expect(() => dateString.parse('2025/01/15')).toThrow()
    expect(() => dateString.parse('Jan 15, 2025')).toThrow()
    expect(() => dateString.parse('')).toThrow()
  })
})

describe('datetimeString', () => {
  it('accepts ISO 8601 datetimes', () => {
    expect(datetimeString.parse('2025-01-15T10:30:00Z')).toBe('2025-01-15T10:30:00Z')
    expect(datetimeString.parse('2025-01-15T10:30:00.000Z')).toBe('2025-01-15T10:30:00.000Z')
  })

  it('accepts datetime-local format', () => {
    expect(datetimeString.parse('2025-01-15T10:30')).toBe('2025-01-15T10:30')
  })

  it('rejects unparseable strings', () => {
    expect(() => datetimeString.parse('not-a-date')).toThrow('Invalid datetime')
    expect(() => datetimeString.parse('')).toThrow()
  })
})

describe('contexts', () => {
  it('accepts an array of strings', () => {
    expect(contexts.parse(['@home', '@work'])).toEqual(['@home', '@work'])
  })

  it('accepts empty array', () => {
    expect(contexts.parse([])).toEqual([])
  })

  it('rejects arrays with strings over 50 chars', () => {
    expect(() => contexts.parse(['x'.repeat(51)])).toThrow()
  })

  it('rejects arrays with more than 20 items', () => {
    const tooMany = Array.from({ length: 21 }, (_, i) => `ctx-${i}`)
    expect(() => contexts.parse(tooMany)).toThrow()
  })
})

// ── Composite schemas ──────────────────────────────────────

describe('captureTaskSchema', () => {
  it('parses valid input', () => {
    expect(captureTaskSchema.parse({ title: 'Buy milk' })).toEqual({
      title: 'Buy milk',
    })
  })

  it('trims title', () => {
    expect(captureTaskSchema.parse({ title: '  hello  ' })).toEqual({
      title: 'hello',
    })
  })

  it('rejects missing title', () => {
    expect(() => captureTaskSchema.parse({})).toThrow()
  })
})

describe('processToWaitingForSchema', () => {
  const validId = '550e8400-e29b-41d4-a716-446655440000'

  it('accepts valid input with due date', () => {
    const result = processToWaitingForSchema.parse({
      taskId: validId,
      delegatedTo: 'Alice',
      dueDate: '2025-03-01',
    })
    expect(result.delegatedTo).toBe('Alice')
    expect(result.dueDate).toBe('2025-03-01')
  })

  it('accepts valid input without due date', () => {
    const result = processToWaitingForSchema.parse({
      taskId: validId,
      delegatedTo: 'Bob',
    })
    expect(result.dueDate).toBeUndefined()
  })

  it('rejects empty delegatedTo', () => {
    expect(() =>
      processToWaitingForSchema.parse({
        taskId: validId,
        delegatedTo: '',
      })
    ).toThrow('Delegated to is required')
  })

  it('rejects invalid task ID', () => {
    expect(() =>
      processToWaitingForSchema.parse({
        taskId: 'bad-id',
        delegatedTo: 'Alice',
      })
    ).toThrow()
  })
})

describe('processToCalendarSchema', () => {
  const validId = '550e8400-e29b-41d4-a716-446655440000'

  it('accepts valid datetime', () => {
    const result = processToCalendarSchema.parse({
      taskId: validId,
      scheduledAt: '2025-03-01T14:00:00Z',
    })
    expect(result.scheduledAt).toBe('2025-03-01T14:00:00Z')
  })

  it('rejects invalid datetime', () => {
    expect(() =>
      processToCalendarSchema.parse({
        taskId: validId,
        scheduledAt: 'not-a-datetime',
      })
    ).toThrow()
  })
})

describe('processToNextActionsSchema', () => {
  const validId = '550e8400-e29b-41d4-a716-446655440000'

  it('defaults contexts to empty array', () => {
    const result = processToNextActionsSchema.parse({ taskId: validId })
    expect(result.contexts).toEqual([])
  })

  it('accepts contexts array', () => {
    const result = processToNextActionsSchema.parse({
      taskId: validId,
      contexts: ['@home', '@errands'],
    })
    expect(result.contexts).toEqual(['@home', '@errands'])
  })
})

describe('createProjectSchema', () => {
  const validId = '550e8400-e29b-41d4-a716-446655440000'

  it('parses valid input', () => {
    const result = createProjectSchema.parse({
      title: 'New project',
      completionCriteria: 'When all tasks are done',
      roughPlanLines: ['Step 1', 'Step 2'],
      firstStepTitle: 'Do step 1',
      originTaskId: validId,
    })
    expect(result.title).toBe('New project')
    expect(result.roughPlanLines).toHaveLength(2)
  })

  it('defaults optional fields', () => {
    const result = createProjectSchema.parse({
      title: 'Minimal project',
      roughPlanLines: [],
      originTaskId: validId,
    })
    expect(result.completionCriteria).toBe('')
    expect(result.firstStepTitle).toBe('')
  })

  it('rejects too many rough plan lines', () => {
    expect(() =>
      createProjectSchema.parse({
        title: 'Big project',
        roughPlanLines: Array.from({ length: 51 }, (_, i) => `Step ${i}`),
        originTaskId: validId,
      })
    ).toThrow()
  })
})

describe('rescheduleCalendarTaskSchema', () => {
  const validId = '550e8400-e29b-41d4-a716-446655440000'

  it('accepts valid reschedule', () => {
    const result = rescheduleCalendarTaskSchema.parse({
      taskId: validId,
      scheduledAt: '2025-06-15T09:00:00Z',
    })
    expect(result.taskId).toBe(validId)
  })
})

describe('updateWaitingForDueDateSchema', () => {
  const validId = '550e8400-e29b-41d4-a716-446655440000'

  it('accepts a date', () => {
    const result = updateWaitingForDueDateSchema.parse({
      taskId: validId,
      dueDate: '2025-04-01',
    })
    expect(result.dueDate).toBe('2025-04-01')
  })

  it('accepts null to clear date', () => {
    const result = updateWaitingForDueDateSchema.parse({
      taskId: validId,
      dueDate: null,
    })
    expect(result.dueDate).toBeNull()
  })
})

// ── Additional primitives ────────────────────────────────────

describe('itemId', () => {
  it('accepts a valid UUID', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000'
    expect(itemId.parse(uuid)).toBe(uuid)
  })

  it('rejects non-UUID strings', () => {
    expect(() => itemId.parse('bad')).toThrow('Invalid item ID')
    expect(() => itemId.parse('')).toThrow()
  })
})

describe('optionalTitle', () => {
  it('accepts a valid string', () => {
    expect(optionalTitle.parse('A title')).toBe('A title')
  })

  it('trims whitespace', () => {
    expect(optionalTitle.parse('  hello  ')).toBe('hello')
  })

  it('accepts undefined (field is optional)', () => {
    expect(optionalTitle.parse(undefined)).toBeUndefined()
  })

  it('rejects strings over 500 chars', () => {
    expect(() => optionalTitle.parse('x'.repeat(501))).toThrow()
  })

  it('accepts exactly 500 chars', () => {
    const s = 'x'.repeat(500)
    expect(optionalTitle.parse(s)).toBe(s)
  })

  it('accepts empty string (optional field allows empty)', () => {
    expect(optionalTitle.parse('')).toBe('')
  })
})

describe('optionalDateString', () => {
  it('accepts a valid date string', () => {
    expect(optionalDateString.parse('2025-06-15')).toBe('2025-06-15')
  })

  it('accepts undefined', () => {
    expect(optionalDateString.parse(undefined)).toBeUndefined()
  })

  it('rejects invalid format', () => {
    expect(() => optionalDateString.parse('15/06/2025')).toThrow()
  })
})

describe('contextName', () => {
  it('accepts a valid context name', () => {
    expect(contextName.parse('@home')).toBe('@home')
  })

  it('trims whitespace', () => {
    expect(contextName.parse('  @office  ')).toBe('@office')
  })

  it('rejects empty or whitespace-only names', () => {
    expect(() => contextName.parse('')).toThrow('Context name is required')
    expect(() => contextName.parse('   ')).toThrow('Context name is required')
  })

  it('rejects names over 50 chars', () => {
    expect(() => contextName.parse('x'.repeat(51))).toThrow()
  })

  it('accepts exactly 50 chars', () => {
    const s = 'x'.repeat(50)
    expect(contextName.parse(s)).toBe(s)
  })
})

// ── Schemas not previously tested ───────────────────────────

describe('processToSomedayMaybeSchema', () => {
  const validId = '550e8400-e29b-41d4-a716-446655440000'

  it('accepts taskId with no reviewDate', () => {
    const result = processToSomedayMaybeSchema.parse({ taskId: validId })
    expect(result.taskId).toBe(validId)
    expect(result.reviewDate).toBeUndefined()
  })

  it('accepts taskId with a valid reviewDate', () => {
    const result = processToSomedayMaybeSchema.parse({
      taskId: validId,
      reviewDate: '2025-12-01',
    })
    expect(result.reviewDate).toBe('2025-12-01')
  })

  it('rejects invalid reviewDate format', () => {
    expect(() =>
      processToSomedayMaybeSchema.parse({ taskId: validId, reviewDate: '12/01/2025' })
    ).toThrow()
  })

  it('rejects invalid taskId', () => {
    expect(() =>
      processToSomedayMaybeSchema.parse({ taskId: 'not-a-uuid', reviewDate: '2025-12-01' })
    ).toThrow()
  })
})

describe('updateSomedayReviewDateSchema', () => {
  const validId = '550e8400-e29b-41d4-a716-446655440000'

  it('accepts a valid date', () => {
    const result = updateSomedayReviewDateSchema.parse({ taskId: validId, reviewDate: '2025-09-30' })
    expect(result.reviewDate).toBe('2025-09-30')
  })

  it('accepts null to clear the review date', () => {
    const result = updateSomedayReviewDateSchema.parse({ taskId: validId, reviewDate: null })
    expect(result.reviewDate).toBeNull()
  })

  it('rejects invalid taskId', () => {
    expect(() =>
      updateSomedayReviewDateSchema.parse({ taskId: 'bad', reviewDate: null })
    ).toThrow()
  })
})

describe('delegateTaskSchema', () => {
  const validId = '550e8400-e29b-41d4-a716-446655440000'

  it('accepts full valid input', () => {
    const result = delegateTaskSchema.parse({
      taskId: validId,
      delegatedTo: 'Alice',
      dueDate: '2025-06-01',
      isCommunicated: true,
    })
    expect(result.delegatedTo).toBe('Alice')
    expect(result.dueDate).toBe('2025-06-01')
    expect(result.isCommunicated).toBe(true)
  })

  it('defaults isCommunicated to false', () => {
    const result = delegateTaskSchema.parse({
      taskId: validId,
      delegatedTo: 'Bob',
    })
    expect(result.isCommunicated).toBe(false)
  })

  it('accepts without dueDate', () => {
    const result = delegateTaskSchema.parse({ taskId: validId, delegatedTo: 'Charlie' })
    expect(result.dueDate).toBeUndefined()
  })

  it('rejects empty delegatedTo', () => {
    expect(() =>
      delegateTaskSchema.parse({ taskId: validId, delegatedTo: '' })
    ).toThrow('Delegated to is required')
  })

  it('rejects delegatedTo over 200 chars', () => {
    expect(() =>
      delegateTaskSchema.parse({ taskId: validId, delegatedTo: 'x'.repeat(201) })
    ).toThrow()
  })

  it('rejects whitespace-only delegatedTo', () => {
    expect(() =>
      delegateTaskSchema.parse({ taskId: validId, delegatedTo: '   ' })
    ).toThrow()
  })

  it('rejects invalid taskId', () => {
    expect(() =>
      delegateTaskSchema.parse({ taskId: 'bad', delegatedTo: 'Alice' })
    ).toThrow('Invalid task ID')
  })
})

describe('reorderRoughPlanSchema', () => {
  const validId = '550e8400-e29b-41d4-a716-446655440000'
  const anotherUuid = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'

  it('accepts valid projectId and orderedIds', () => {
    const result = reorderRoughPlanSchema.parse({
      projectId: validId,
      orderedIds: [anotherUuid],
    })
    expect(result.projectId).toBe(validId)
    expect(result.orderedIds).toHaveLength(1)
  })

  it('accepts empty orderedIds array', () => {
    const result = reorderRoughPlanSchema.parse({ projectId: validId, orderedIds: [] })
    expect(result.orderedIds).toEqual([])
  })

  it('rejects orderedIds with non-UUID entries', () => {
    expect(() =>
      reorderRoughPlanSchema.parse({ projectId: validId, orderedIds: ['not-a-uuid'] })
    ).toThrow()
  })

  it('rejects more than 100 ordered IDs', () => {
    const manyUuids = Array.from({ length: 101 }, () => validId)
    expect(() =>
      reorderRoughPlanSchema.parse({ projectId: validId, orderedIds: manyUuids })
    ).toThrow()
  })

  it('rejects invalid projectId', () => {
    expect(() =>
      reorderRoughPlanSchema.parse({ projectId: 'bad', orderedIds: [] })
    ).toThrow('Invalid project ID')
  })
})

describe('addRoughPlanStepSchema', () => {
  const validId = '550e8400-e29b-41d4-a716-446655440000'

  it('accepts valid projectId and text', () => {
    const result = addRoughPlanStepSchema.parse({ projectId: validId, text: 'Write tests' })
    expect(result.text).toBe('Write tests')
  })

  it('trims text whitespace', () => {
    const result = addRoughPlanStepSchema.parse({ projectId: validId, text: '  trimmed  ' })
    expect(result.text).toBe('trimmed')
  })

  it('rejects empty text', () => {
    expect(() =>
      addRoughPlanStepSchema.parse({ projectId: validId, text: '' })
    ).toThrow('Step text is required')
  })

  it('rejects whitespace-only text', () => {
    expect(() =>
      addRoughPlanStepSchema.parse({ projectId: validId, text: '   ' })
    ).toThrow('Step text is required')
  })

  it('rejects text over 500 chars', () => {
    expect(() =>
      addRoughPlanStepSchema.parse({ projectId: validId, text: 'x'.repeat(501) })
    ).toThrow()
  })

  it('accepts exactly 500 chars', () => {
    const s = 'x'.repeat(500)
    const result = addRoughPlanStepSchema.parse({ projectId: validId, text: s })
    expect(result.text).toBe(s)
  })
})

describe('attachmentSchema', () => {
  const valid = { name: 'report.pdf', path: 'user123/task456/report.pdf', type: 'application/pdf', size: 204800 }

  it('accepts a valid attachment', () => {
    expect(attachmentSchema.parse(valid)).toEqual(valid)
  })

  it('rejects empty name', () => {
    expect(() => attachmentSchema.parse({ ...valid, name: '' })).toThrow()
  })

  it('rejects name over 255 chars', () => {
    expect(() => attachmentSchema.parse({ ...valid, name: 'x'.repeat(256) })).toThrow()
  })

  it('rejects empty path', () => {
    expect(() => attachmentSchema.parse({ ...valid, path: '' })).toThrow()
  })

  it('rejects path over 1000 chars', () => {
    expect(() => attachmentSchema.parse({ ...valid, path: 'x'.repeat(1001) })).toThrow()
  })

  it('rejects empty type', () => {
    expect(() => attachmentSchema.parse({ ...valid, type: '' })).toThrow()
  })

  it('rejects negative size', () => {
    expect(() => attachmentSchema.parse({ ...valid, size: -1 })).toThrow()
  })

  it('rejects non-integer size', () => {
    expect(() => attachmentSchema.parse({ ...valid, size: 1.5 })).toThrow()
  })

  it('accepts size of 0', () => {
    expect(attachmentSchema.parse({ ...valid, size: 0 })).toMatchObject({ size: 0 })
  })
})

describe('updateAttachmentsSchema', () => {
  const validId = '550e8400-e29b-41d4-a716-446655440000'
  const validAttachment = { name: 'doc.txt', path: 'uid/tid/doc.txt', type: 'text/plain', size: 1024 }

  it('accepts a valid taskId and empty attachments array', () => {
    const result = updateAttachmentsSchema.parse({ taskId: validId, attachments: [] })
    expect(result.attachments).toHaveLength(0)
  })

  it('accepts multiple valid attachments', () => {
    const result = updateAttachmentsSchema.parse({
      taskId: validId,
      attachments: [validAttachment, { ...validAttachment, name: 'img.png', path: 'uid/tid/img.png', type: 'image/png' }],
    })
    expect(result.attachments).toHaveLength(2)
  })

  it('rejects more than 20 attachments', () => {
    const many = Array.from({ length: 21 }, (_, i) => ({
      ...validAttachment,
      name: `file${i}.txt`,
      path: `uid/tid/file${i}.txt`,
    }))
    expect(() => updateAttachmentsSchema.parse({ taskId: validId, attachments: many })).toThrow()
  })

  it('rejects invalid taskId', () => {
    expect(() =>
      updateAttachmentsSchema.parse({ taskId: 'bad', attachments: [] })
    ).toThrow('Invalid task ID')
  })

  it('rejects attachment with negative size', () => {
    expect(() =>
      updateAttachmentsSchema.parse({
        taskId: validId,
        attachments: [{ ...validAttachment, size: -100 }],
      })
    ).toThrow()
  })
})
