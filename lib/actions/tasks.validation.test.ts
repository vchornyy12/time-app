/**
 * Validation contract tests for task server actions.
 *
 * Server actions (tasks.ts) call Zod schemas before any DB interaction.
 * These tests verify that the validation layer correctly accepts or rejects
 * inputs, covering the same schema branches exercised by each action.
 *
 * We do NOT invoke the server actions directly (they require Next.js runtime
 * and Supabase cookies), but we exercise every schema used by each action:
 *
 *  captureTask            → captureTaskSchema
 *  deleteTask             → taskId primitive
 *  markTaskDone           → taskId primitive
 *  restoreTask            → taskId primitive
 *  moveToInbox            → taskId primitive
 *  moveToNextActions      → taskId primitive
 *  hardDeleteTask         → taskId primitive
 *  emptyTrash             → (no schema — relies on auth only)
 *  delegateTask           → delegateTaskSchema
 *  updateTaskContexts     → taskId + contexts
 *  updateWaitingForDueDate → updateWaitingForDueDateSchema
 *  updateSomedayReviewDate → updateSomedayReviewDateSchema
 *  toggleDelegationCommunicated → taskId primitive
 */
import { describe, it, expect } from 'vitest'
import {
  captureTaskSchema,
  taskId as taskIdSchema,
  contexts as contextsSchema,
  delegateTaskSchema,
  updateWaitingForDueDateSchema,
  updateSomedayReviewDateSchema,
} from '@/lib/validation/schemas'

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'

// ── captureTask ──────────────────────────────────────────────

describe('captureTask validation (captureTaskSchema)', () => {
  it('accepts a valid title', () => {
    const { title } = captureTaskSchema.parse({ title: 'Buy groceries' })
    expect(title).toBe('Buy groceries')
  })

  it('trims leading/trailing whitespace', () => {
    const { title } = captureTaskSchema.parse({ title: '  Buy groceries  ' })
    expect(title).toBe('Buy groceries')
  })

  it('rejects an empty title', () => {
    expect(() => captureTaskSchema.parse({ title: '' })).toThrow('Title is required')
  })

  it('rejects a whitespace-only title', () => {
    expect(() => captureTaskSchema.parse({ title: '   ' })).toThrow('Title is required')
  })

  it('rejects a title over 500 characters', () => {
    expect(() => captureTaskSchema.parse({ title: 'x'.repeat(501) })).toThrow()
  })

  it('accepts a title of exactly 500 characters', () => {
    const long = 'x'.repeat(500)
    expect(captureTaskSchema.parse({ title: long }).title).toBe(long)
  })

  it('rejects missing title field', () => {
    expect(() => captureTaskSchema.parse({})).toThrow()
  })
})

// ── taskId (used by deleteTask, markTaskDone, restoreTask, etc.) ──

describe('taskId schema (used by multiple actions)', () => {
  it('accepts a valid UUID', () => {
    expect(taskIdSchema.parse(VALID_UUID)).toBe(VALID_UUID)
  })

  it('rejects plain strings', () => {
    expect(() => taskIdSchema.parse('not-a-uuid')).toThrow('Invalid task ID')
  })

  it('rejects an empty string', () => {
    expect(() => taskIdSchema.parse('')).toThrow()
  })

  it('rejects numeric strings', () => {
    expect(() => taskIdSchema.parse('12345')).toThrow()
  })

  it('rejects SQL injection strings', () => {
    expect(() => taskIdSchema.parse("'; DROP TABLE tasks; --")).toThrow()
    expect(() => taskIdSchema.parse('1 OR 1=1')).toThrow()
  })

  it('rejects null', () => {
    expect(() => taskIdSchema.parse(null)).toThrow()
  })

  it('rejects undefined', () => {
    expect(() => taskIdSchema.parse(undefined)).toThrow()
  })
})

// ── updateTaskContexts ────────────────────────────────────────

describe('updateTaskContexts validation (taskId + contexts)', () => {
  it('accepts valid UUID and empty contexts', () => {
    expect(taskIdSchema.parse(VALID_UUID)).toBe(VALID_UUID)
    expect(contextsSchema.parse([])).toEqual([])
  })

  it('accepts valid UUID and populated contexts', () => {
    expect(contextsSchema.parse(['@home', '@office'])).toEqual(['@home', '@office'])
  })

  it('rejects contexts with an entry over 50 chars', () => {
    expect(() => contextsSchema.parse(['x'.repeat(51)])).toThrow()
  })

  it('rejects more than 20 contexts', () => {
    const tooMany = Array.from({ length: 21 }, (_, i) => `ctx-${i}`)
    expect(() => contextsSchema.parse(tooMany)).toThrow()
  })

  it('accepts exactly 20 contexts', () => {
    const exactly20 = Array.from({ length: 20 }, (_, i) => `ctx${i}`)
    expect(contextsSchema.parse(exactly20)).toHaveLength(20)
  })

  it('rejects an invalid taskId alongside valid contexts', () => {
    expect(() => taskIdSchema.parse('bad-id')).toThrow('Invalid task ID')
  })
})

// ── delegateTask ─────────────────────────────────────────────

describe('delegateTask validation (delegateTaskSchema)', () => {
  it('accepts full valid input', () => {
    const result = delegateTaskSchema.parse({
      taskId: VALID_UUID,
      delegatedTo: 'Alice',
      dueDate: '2025-06-01',
      isCommunicated: true,
    })
    expect(result.delegatedTo).toBe('Alice')
    expect(result.dueDate).toBe('2025-06-01')
    expect(result.isCommunicated).toBe(true)
  })

  it('defaults isCommunicated to false when omitted', () => {
    const result = delegateTaskSchema.parse({ taskId: VALID_UUID, delegatedTo: 'Bob' })
    expect(result.isCommunicated).toBe(false)
  })

  it('accepts without dueDate', () => {
    const result = delegateTaskSchema.parse({ taskId: VALID_UUID, delegatedTo: 'Charlie' })
    expect(result.dueDate).toBeUndefined()
  })

  it('rejects empty delegatedTo', () => {
    expect(() =>
      delegateTaskSchema.parse({ taskId: VALID_UUID, delegatedTo: '' })
    ).toThrow('Delegated to is required')
  })

  it('rejects whitespace-only delegatedTo', () => {
    expect(() =>
      delegateTaskSchema.parse({ taskId: VALID_UUID, delegatedTo: '   ' })
    ).toThrow()
  })

  it('rejects delegatedTo longer than 200 chars', () => {
    expect(() =>
      delegateTaskSchema.parse({ taskId: VALID_UUID, delegatedTo: 'x'.repeat(201) })
    ).toThrow()
  })

  it('accepts delegatedTo of exactly 200 chars', () => {
    const result = delegateTaskSchema.parse({
      taskId: VALID_UUID,
      delegatedTo: 'x'.repeat(200),
    })
    expect(result.delegatedTo).toHaveLength(200)
  })

  it('rejects invalid taskId', () => {
    expect(() =>
      delegateTaskSchema.parse({ taskId: 'invalid', delegatedTo: 'Alice' })
    ).toThrow('Invalid task ID')
  })

  it('rejects invalid dueDate format', () => {
    expect(() =>
      delegateTaskSchema.parse({ taskId: VALID_UUID, delegatedTo: 'Alice', dueDate: '06/01/2025' })
    ).toThrow()
  })
})

// ── updateWaitingForDueDate ───────────────────────────────────

describe('updateWaitingForDueDate validation', () => {
  it('accepts a valid date string', () => {
    const result = updateWaitingForDueDateSchema.parse({ taskId: VALID_UUID, dueDate: '2025-08-15' })
    expect(result.dueDate).toBe('2025-08-15')
  })

  it('accepts null to clear the due date', () => {
    const result = updateWaitingForDueDateSchema.parse({ taskId: VALID_UUID, dueDate: null })
    expect(result.dueDate).toBeNull()
  })

  it('rejects invalid date format', () => {
    expect(() =>
      updateWaitingForDueDateSchema.parse({ taskId: VALID_UUID, dueDate: '15-08-2025' })
    ).toThrow('Invalid date format')
  })

  it('rejects invalid taskId', () => {
    expect(() =>
      updateWaitingForDueDateSchema.parse({ taskId: 'bad', dueDate: null })
    ).toThrow('Invalid task ID')
  })
})

// ── updateSomedayReviewDate ───────────────────────────────────

describe('updateSomedayReviewDate validation', () => {
  it('accepts a valid date string', () => {
    const result = updateSomedayReviewDateSchema.parse({ taskId: VALID_UUID, reviewDate: '2025-12-01' })
    expect(result.reviewDate).toBe('2025-12-01')
  })

  it('accepts null to clear the review date', () => {
    const result = updateSomedayReviewDateSchema.parse({ taskId: VALID_UUID, reviewDate: null })
    expect(result.reviewDate).toBeNull()
  })

  it('rejects invalid date format', () => {
    expect(() =>
      updateSomedayReviewDateSchema.parse({ taskId: VALID_UUID, reviewDate: '2025/12/01' })
    ).toThrow('Invalid date format')
  })

  it('rejects invalid taskId', () => {
    expect(() =>
      updateSomedayReviewDateSchema.parse({ taskId: 'bad', reviewDate: null })
    ).toThrow('Invalid task ID')
  })
})
