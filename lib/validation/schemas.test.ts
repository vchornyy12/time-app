import { describe, it, expect } from 'vitest'
import {
  taskId,
  projectId,
  title,
  dateString,
  datetimeString,
  contexts,
  captureTaskSchema,
  processToWaitingForSchema,
  processToCalendarSchema,
  processToNextActionsSchema,
  createProjectSchema,
  rescheduleCalendarTaskSchema,
  updateWaitingForDueDateSchema,
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
