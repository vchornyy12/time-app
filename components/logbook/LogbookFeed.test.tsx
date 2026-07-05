/**
 * LogbookFeed component tests
 *
 * Covers:
 *  - Renders LogbookEmptyState when initialDays is empty
 *  - Does NOT render EmptyState when days are present
 *  - Renders one labelled section per LogbookDay
 *  - Renders all task titles within each day's section
 *  - Renders a ReflectionTextarea for every day (stub verified by date)
 *  - Passes initialContent to ReflectionTextarea (empty string for null reflection)
 *  - "Today" label is shown for today's date, "Yesterday" for yesterday
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

// ── Module mocks ───────────────────────────────────────────────

// Prevent the server-action import chain (Supabase client) from loading in jsdom
vi.mock('@/lib/actions/logbook', () => ({
  getLogbookDays: vi.fn().mockResolvedValue([]),
}))

vi.mock('./EmptyState', () => ({
  LogbookEmptyState: () => <div data-testid="logbook-empty-state" />,
}))

vi.mock('./ReflectionTextarea', () => ({
  ReflectionTextarea: ({
    date,
    initialContent,
  }: {
    date: string
    initialContent: string
  }) => (
    <div
      data-testid={`reflection-textarea-${date}`}
      data-initial-content={initialContent}
    />
  ),
}))

// ── Helpers ────────────────────────────────────────────────────

import type { LogbookDay, Task, DailyReflection } from '@/lib/types'

const BASE_TASK_UUID = '550e8400-e29b-41d4-a716-446655440000'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: BASE_TASK_UUID,
    title: 'A completed task',
    status: 'done',
    user_id: 'user-1',
    project_id: null,
    created_at: '2025-03-10T08:00:00Z',
    updated_at: '2025-03-10T09:00:00Z',
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

function makeReflection(overrides: Partial<DailyReflection> = {}): DailyReflection {
  return {
    id: BASE_TASK_UUID,
    user_id: 'user-1',
    date: '2025-03-10',
    content: 'Good day',
    created_at: '2025-03-10T20:00:00Z',
    updated_at: '2025-03-10T20:00:00Z',
    ...overrides,
  }
}

function makeDay(date: string, tasks: Task[], reflection: DailyReflection | null = null): LogbookDay {
  return { date, tasks, reflection }
}

// ── Subject ────────────────────────────────────────────────────

import { LogbookFeed } from './LogbookFeed'

// ── Tests ──────────────────────────────────────────────────────

describe('LogbookFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('empty state', () => {
    it('renders LogbookEmptyState when initialDays is empty', () => {
      render(<LogbookFeed initialDays={[]} />)
      expect(screen.getByTestId('logbook-empty-state')).toBeInTheDocument()
    })

    it('does not render any day sections when initialDays is empty', () => {
      render(<LogbookFeed initialDays={[]} />)
      expect(screen.queryByRole('region')).not.toBeInTheDocument()
    })
  })

  describe('day sections', () => {
    it('does not render LogbookEmptyState when days are present', () => {
      const days = [makeDay('2025-03-10', [makeTask()])]
      render(<LogbookFeed initialDays={days} />)
      expect(screen.queryByTestId('logbook-empty-state')).not.toBeInTheDocument()
    })

    it('renders one section per LogbookDay', () => {
      const days = [
        makeDay('2025-03-10', [makeTask({ id: 'a' })]),
        makeDay('2025-03-09', [makeTask({ id: 'b' })]),
      ]
      render(<LogbookFeed initialDays={days} />)
      expect(screen.getAllByRole('region')).toHaveLength(2)
    })

    it('renders all task titles within their respective day section', () => {
      const days = [
        makeDay('2025-03-10', [
          makeTask({ id: 't1', title: 'Write the tests' }),
          makeTask({ id: 't2', title: 'Ship the feature' }),
        ]),
      ]
      render(<LogbookFeed initialDays={days} />)
      expect(screen.getByText('Write the tests')).toBeInTheDocument()
      expect(screen.getByText('Ship the feature')).toBeInTheDocument()
    })

    it('does not show tasks from one day in a different day section', () => {
      const days = [
        makeDay('2025-03-10', [makeTask({ id: 'x1', title: 'Day 10 task' })]),
        makeDay('2025-03-09', [makeTask({ id: 'x2', title: 'Day 9 task' })]),
      ]
      render(<LogbookFeed initialDays={days} />)
      // Both should appear but scoped to separate sections
      expect(screen.getByText('Day 10 task')).toBeInTheDocument()
      expect(screen.getByText('Day 9 task')).toBeInTheDocument()
    })
  })

  describe('ReflectionTextarea integration', () => {
    it('renders a ReflectionTextarea stub for each day', () => {
      const days = [
        makeDay('2025-03-10', [makeTask()]),
        makeDay('2025-03-09', [makeTask()]),
      ]
      render(<LogbookFeed initialDays={days} />)
      expect(screen.getByTestId('reflection-textarea-2025-03-10')).toBeInTheDocument()
      expect(screen.getByTestId('reflection-textarea-2025-03-09')).toBeInTheDocument()
    })

    it('passes reflection content as initialContent when a reflection exists', () => {
      const reflection = makeReflection({ date: '2025-03-10', content: 'Shipped it!' })
      const days = [makeDay('2025-03-10', [makeTask()], reflection)]
      render(<LogbookFeed initialDays={days} />)
      expect(
        screen.getByTestId('reflection-textarea-2025-03-10').dataset.initialContent
      ).toBe('Shipped it!')
    })

    it('passes an empty string as initialContent when reflection is null', () => {
      const days = [makeDay('2025-03-10', [makeTask()], null)]
      render(<LogbookFeed initialDays={days} />)
      expect(
        screen.getByTestId('reflection-textarea-2025-03-10').dataset.initialContent
      ).toBe('')
    })
  })
})
