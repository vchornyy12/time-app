/**
 * Unit tests for groupTasksByLocalDate
 *
 * Covers:
 *  - Empty input → empty Map
 *  - Single task on one date
 *  - Multiple tasks grouped into the same date bucket
 *  - Tasks spanning multiple dates → separate buckets, newest-first order
 *  - Timezone west of UTC (positive offset): task shifts to previous local date
 *  - Timezone east of UTC (negative offset): task shifts to next local date
 *  - Tasks with null completed_at are silently excluded
 *  - Map keys are in descending (newest-first) order
 */
import { describe, it, expect } from 'vitest'
import type { Task } from '@/lib/types'
import { groupTasksByLocalDate } from '@/lib/utils/logbook'

// ── Helpers ────────────────────────────────────────────────────

const BASE_ID = '550e8400-e29b-41d4-a716-446655440000'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: BASE_ID,
    title: 'Test task',
    status: 'done',
    user_id: 'user-1',
    project_id: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    scheduled_at: null,
    due_date: null,
    delegated_to: null,
    is_delegation_communicated: false,
    google_calendar_event_id: null,
    contexts: [],
    completed_at: '2025-03-10T12:00:00Z',
    attachments: [],
    recurrence_rule: null,
    ...overrides,
  }
}

// ── Tests ──────────────────────────────────────────────────────

describe('groupTasksByLocalDate', () => {
  describe('empty input', () => {
    it('returns an empty Map when given an empty tasks array', () => {
      const result = groupTasksByLocalDate([], 0)
      expect(result.size).toBe(0)
    })
  })

  describe('single task', () => {
    it('returns a Map with one entry for a single task at UTC offset 0', () => {
      const task = makeTask({ id: 'a', completed_at: '2025-03-10T12:00:00Z' })
      const result = groupTasksByLocalDate([task], 0)

      expect(result.size).toBe(1)
      expect(result.has('2025-03-10')).toBe(true)
      expect(result.get('2025-03-10')).toHaveLength(1)
      expect(result.get('2025-03-10')![0].id).toBe('a')
    })

    it('preserves all task fields in the grouped output', () => {
      const task = makeTask({ id: 'b', title: 'Ship the feature', completed_at: '2025-03-10T09:00:00Z' })
      const result = groupTasksByLocalDate([task], 0)
      expect(result.get('2025-03-10')![0].title).toBe('Ship the feature')
    })
  })

  describe('multiple tasks same date', () => {
    it('groups multiple tasks completed on the same UTC date into one bucket', () => {
      const tasks = [
        makeTask({ id: 'c1', completed_at: '2025-03-10T08:00:00Z' }),
        makeTask({ id: 'c2', completed_at: '2025-03-10T14:30:00Z' }),
        makeTask({ id: 'c3', completed_at: '2025-03-10T23:59:00Z' }),
      ]
      const result = groupTasksByLocalDate(tasks, 0)

      expect(result.size).toBe(1)
      expect(result.get('2025-03-10')).toHaveLength(3)
    })
  })

  describe('multiple dates', () => {
    it('creates separate buckets for tasks on different dates', () => {
      const tasks = [
        makeTask({ id: 'd1', completed_at: '2025-03-12T10:00:00Z' }),
        makeTask({ id: 'd2', completed_at: '2025-03-11T10:00:00Z' }),
        makeTask({ id: 'd3', completed_at: '2025-03-10T10:00:00Z' }),
      ]
      const result = groupTasksByLocalDate(tasks, 0)

      expect(result.size).toBe(3)
      expect(result.has('2025-03-12')).toBe(true)
      expect(result.has('2025-03-11')).toBe(true)
      expect(result.has('2025-03-10')).toBe(true)
    })

    it('each bucket contains only its own tasks', () => {
      const tasks = [
        makeTask({ id: 'e1', completed_at: '2025-03-12T10:00:00Z' }),
        makeTask({ id: 'e2', completed_at: '2025-03-11T10:00:00Z' }),
      ]
      const result = groupTasksByLocalDate(tasks, 0)

      expect(result.get('2025-03-12')![0].id).toBe('e1')
      expect(result.get('2025-03-11')![0].id).toBe('e2')
    })
  })

  describe('key ordering (newest first)', () => {
    it('returns Map keys in descending (newest-first) date order', () => {
      const tasks = [
        makeTask({ id: 'f3', completed_at: '2025-03-08T10:00:00Z' }),
        makeTask({ id: 'f1', completed_at: '2025-03-10T10:00:00Z' }),
        makeTask({ id: 'f2', completed_at: '2025-03-09T10:00:00Z' }),
      ]
      const result = groupTasksByLocalDate(tasks, 0)
      const keys = Array.from(result.keys())

      expect(keys).toEqual(['2025-03-10', '2025-03-09', '2025-03-08'])
    })
  })

  describe('timezone: west of UTC (positive offset)', () => {
    it('shifts a task completed just after midnight UTC to the previous local date (UTC-5)', () => {
      // 01:00 UTC on March 10 = 20:00 on March 9 in UTC-5 (offset = 300 min)
      const task = makeTask({ id: 'g1', completed_at: '2025-03-10T01:00:00Z' })
      const result = groupTasksByLocalDate([task], 300) // UTC-5

      expect(result.has('2025-03-09')).toBe(true)
      expect(result.has('2025-03-10')).toBe(false)
    })

    it('keeps the same local date when the task was completed mid-day UTC in a westward zone', () => {
      // 18:00 UTC on March 10 = 13:00 on March 10 in UTC-5 (offset = 300)
      const task = makeTask({ id: 'g2', completed_at: '2025-03-10T18:00:00Z' })
      const result = groupTasksByLocalDate([task], 300)

      expect(result.has('2025-03-10')).toBe(true)
    })
  })

  describe('timezone: east of UTC (negative offset)', () => {
    it('shifts a task completed late UTC to the next local date (UTC+5:30)', () => {
      // 22:00 UTC on March 10 = 03:30 on March 11 in UTC+5:30 (offset = -330 min)
      const task = makeTask({ id: 'h1', completed_at: '2025-03-10T22:00:00Z' })
      const result = groupTasksByLocalDate([task], -330) // UTC+5:30

      expect(result.has('2025-03-11')).toBe(true)
      expect(result.has('2025-03-10')).toBe(false)
    })
  })

  describe('null completed_at', () => {
    it('excludes tasks with null completed_at', () => {
      const tasks = [
        makeTask({ id: 'i1', completed_at: null }),
        makeTask({ id: 'i2', completed_at: '2025-03-10T10:00:00Z' }),
      ]
      const result = groupTasksByLocalDate(tasks, 0)

      expect(result.size).toBe(1)
      expect(result.get('2025-03-10')![0].id).toBe('i2')
    })

    it('returns an empty Map when all tasks have null completed_at', () => {
      const tasks = [
        makeTask({ id: 'j1', completed_at: null }),
        makeTask({ id: 'j2', completed_at: null }),
      ]
      const result = groupTasksByLocalDate(tasks, 0)
      expect(result.size).toBe(0)
    })
  })
})
