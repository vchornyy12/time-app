/**
 * Validation contract tests for processing server actions.
 *
 * processing.ts calls Zod schemas before DB operations.
 * We test each schema used by each processing action:
 *
 *  processToTrash        → taskId
 *  processToNotes        → taskId
 *  processToWaitingFor   → processToWaitingForSchema
 *  processToCalendar     → processToCalendarSchema
 *  processToSomedayMaybe → processToSomedayMaybeSchema
 *  processToNextActions  → processToNextActionsSchema
 *  processAsDone         → taskId
 */
import { describe, it, expect } from 'vitest'
import {
  taskId as taskIdSchema,
  processToWaitingForSchema,
  processToCalendarSchema,
  processToSomedayMaybeSchema,
  processToNextActionsSchema,
} from '@/lib/validation/schemas'

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'

// ── processToTrash / processToNotes / processAsDone ──────────
// All three use only taskId validation before auth + DB.

describe('processToTrash / processToNotes / processAsDone (taskId)', () => {
  it('accepts a valid UUID', () => {
    expect(taskIdSchema.parse(VALID_UUID)).toBe(VALID_UUID)
  })

  it('rejects a non-UUID string', () => {
    expect(() => taskIdSchema.parse('trash-this')).toThrow('Invalid task ID')
  })

  it('rejects an empty string', () => {
    expect(() => taskIdSchema.parse('')).toThrow()
  })

  it('rejects null', () => {
    expect(() => taskIdSchema.parse(null)).toThrow()
  })
})

// ── processToWaitingFor ───────────────────────────────────────

describe('processToWaitingFor validation', () => {
  it('accepts full valid input with contexts', () => {
    const result = processToWaitingForSchema.parse({
      taskId: VALID_UUID,
      delegatedTo: 'Alice',
      dueDate: '2025-06-15',
      contexts: ['@phone'],
    })
    expect(result.delegatedTo).toBe('Alice')
    expect(result.contexts).toEqual(['@phone'])
  })

  it('defaults contexts to empty array when omitted', () => {
    const result = processToWaitingForSchema.parse({
      taskId: VALID_UUID,
      delegatedTo: 'Bob',
    })
    expect(result.contexts).toEqual([])
  })

  it('accepts without dueDate', () => {
    const result = processToWaitingForSchema.parse({ taskId: VALID_UUID, delegatedTo: 'Carol' })
    expect(result.dueDate).toBeUndefined()
  })

  it('rejects empty delegatedTo', () => {
    expect(() =>
      processToWaitingForSchema.parse({ taskId: VALID_UUID, delegatedTo: '' })
    ).toThrow('Delegated to is required')
  })

  it('rejects delegatedTo over 200 chars', () => {
    expect(() =>
      processToWaitingForSchema.parse({ taskId: VALID_UUID, delegatedTo: 'x'.repeat(201) })
    ).toThrow()
  })

  it('rejects invalid dueDate format', () => {
    expect(() =>
      processToWaitingForSchema.parse({ taskId: VALID_UUID, delegatedTo: 'Alice', dueDate: '06-15-2025' })
    ).toThrow('Invalid date format')
  })

  it('rejects contexts with an entry over 50 chars', () => {
    expect(() =>
      processToWaitingForSchema.parse({
        taskId: VALID_UUID,
        delegatedTo: 'Alice',
        contexts: ['x'.repeat(51)],
      })
    ).toThrow()
  })

  it('rejects more than 20 contexts', () => {
    const tooMany = Array.from({ length: 21 }, (_, i) => `ctx${i}`)
    expect(() =>
      processToWaitingForSchema.parse({ taskId: VALID_UUID, delegatedTo: 'Alice', contexts: tooMany })
    ).toThrow()
  })

  it('rejects invalid taskId', () => {
    expect(() =>
      processToWaitingForSchema.parse({ taskId: 'bad', delegatedTo: 'Alice' })
    ).toThrow('Invalid task ID')
  })
})

// ── processToCalendar ─────────────────────────────────────────

describe('processToCalendar validation', () => {
  it('accepts a valid ISO 8601 datetime', () => {
    const result = processToCalendarSchema.parse({
      taskId: VALID_UUID,
      scheduledAt: '2025-07-04T09:00:00Z',
    })
    expect(result.scheduledAt).toBe('2025-07-04T09:00:00Z')
  })

  it('accepts datetime-local format (without timezone)', () => {
    const result = processToCalendarSchema.parse({
      taskId: VALID_UUID,
      scheduledAt: '2025-07-04T09:00',
    })
    expect(result.scheduledAt).toBe('2025-07-04T09:00')
  })

  it('rejects a non-datetime string', () => {
    expect(() =>
      processToCalendarSchema.parse({ taskId: VALID_UUID, scheduledAt: 'next Tuesday' })
    ).toThrow('Invalid datetime')
  })

  it('rejects missing scheduledAt', () => {
    expect(() =>
      processToCalendarSchema.parse({ taskId: VALID_UUID })
    ).toThrow()
  })

  it('rejects an invalid taskId', () => {
    expect(() =>
      processToCalendarSchema.parse({ taskId: 'not-uuid', scheduledAt: '2025-07-04T09:00:00Z' })
    ).toThrow('Invalid task ID')
  })
})

// ── processToSomedayMaybe ────────────────────────────────────

describe('processToSomedayMaybe validation', () => {
  it('accepts taskId without reviewDate', () => {
    const result = processToSomedayMaybeSchema.parse({ taskId: VALID_UUID })
    expect(result.taskId).toBe(VALID_UUID)
    expect(result.reviewDate).toBeUndefined()
  })

  it('accepts taskId with a valid reviewDate', () => {
    const result = processToSomedayMaybeSchema.parse({ taskId: VALID_UUID, reviewDate: '2025-09-01' })
    expect(result.reviewDate).toBe('2025-09-01')
  })

  it('rejects invalid reviewDate format', () => {
    expect(() =>
      processToSomedayMaybeSchema.parse({ taskId: VALID_UUID, reviewDate: '9/1/2025' })
    ).toThrow()
  })

  it('rejects invalid taskId', () => {
    expect(() =>
      processToSomedayMaybeSchema.parse({ taskId: 'bad' })
    ).toThrow('Invalid task ID')
  })
})

// ── processToNextActions ──────────────────────────────────────

describe('processToNextActions validation', () => {
  it('defaults contexts to empty array', () => {
    const result = processToNextActionsSchema.parse({ taskId: VALID_UUID })
    expect(result.contexts).toEqual([])
  })

  it('accepts contexts array', () => {
    const result = processToNextActionsSchema.parse({
      taskId: VALID_UUID,
      contexts: ['@home', '@errands'],
    })
    expect(result.contexts).toEqual(['@home', '@errands'])
  })

  it('accepts a nextActionTitle', () => {
    const result = processToNextActionsSchema.parse({
      taskId: VALID_UUID,
      nextActionTitle: 'Call plumber',
    })
    expect(result.nextActionTitle).toBe('Call plumber')
  })

  it('trims nextActionTitle whitespace', () => {
    const result = processToNextActionsSchema.parse({
      taskId: VALID_UUID,
      nextActionTitle: '  Call plumber  ',
    })
    expect(result.nextActionTitle).toBe('Call plumber')
  })

  it('accepts without nextActionTitle (field is optional)', () => {
    const result = processToNextActionsSchema.parse({ taskId: VALID_UUID })
    expect(result.nextActionTitle).toBeUndefined()
  })

  it('rejects nextActionTitle over 500 chars', () => {
    expect(() =>
      processToNextActionsSchema.parse({ taskId: VALID_UUID, nextActionTitle: 'x'.repeat(501) })
    ).toThrow()
  })

  it('rejects invalid taskId', () => {
    expect(() =>
      processToNextActionsSchema.parse({ taskId: 'bad-id' })
    ).toThrow('Invalid task ID')
  })

  it('rejects more than 20 contexts', () => {
    const tooMany = Array.from({ length: 21 }, (_, i) => `c${i}`)
    expect(() =>
      processToNextActionsSchema.parse({ taskId: VALID_UUID, contexts: tooMany })
    ).toThrow()
  })
})
