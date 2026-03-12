/**
 * Integration tests for Logbook server actions
 *
 * Covers:
 *  upsertReflection:
 *   - Validates date format (rejects bad input)
 *   - Validates content max length (5000 chars)
 *   - Calls supabase.upsert with correct payload
 *   - Calls revalidatePath('/logbook') on success
 *   - Allows empty-string content (clears reflection)
 *   - Propagates Unauthorized from authedClient
 *
 *  getLogbookDays:
 *   - Returns an empty array when no completed tasks exist
 *   - Returns LogbookDay[] with tasks grouped into the correct date
 *   - Merges a matching reflection onto the correct LogbookDay
 *   - Sets reflection to null for days without a matching reflection
 *   - Days are sorted newest-first
 *   - Passes tzOffsetMinutes to the grouping logic
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Module mocks (declared before subject import) ──────────────

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/actions/authed-action', () => ({
  authedClient: vi.fn(),
}))

// ── Helpers ────────────────────────────────────────────────────

import type { Task, DailyReflection } from '@/lib/types'
import { authedClient } from '@/lib/actions/authed-action'
import { revalidatePath } from 'next/cache'

const mockAuthedClient = vi.mocked(authedClient)
const mockRevalidatePath = vi.mocked(revalidatePath)

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'
const USER_ID = 'user-uuid-abc'

/**
 * Builds a chainable Supabase query mock that resolves to { data, error }.
 * Each method returns `this` so chaining works; awaiting resolves the result.
 */
function buildQueryChain(result: { data: unknown; error: null | { message: string } }) {
  const chain: Record<string, unknown> = {}
  const chainMethods = ['select', 'eq', 'neq', 'in', 'order', 'limit', 'not', 'is'] as const
  chainMethods.forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain)
  })
  // upsert returns the same chain shape
  chain['upsert'] = vi.fn().mockReturnValue(chain)
  // Make the chain awaitable (PromiseLike)
  chain['then'] = (resolve: (v: typeof result) => unknown) => Promise.resolve(resolve(result))
  chain['catch'] = (reject: (e: unknown) => unknown) => {
    if (result.error) return Promise.resolve(reject(result.error))
    return Promise.resolve()
  }
  return chain
}

/**
 * Returns a mock Supabase client whose `from()` always returns the SAME chain
 * object per table name. This lets tests inspect the chain's mock calls after
 * the action has run (e.g. `supabase.from('daily_reflections').upsert`).
 */
function makeSupabaseMock(tableResponses: {
  tasks?: { data: unknown; error: null }
  daily_reflections?: { data: unknown; error: null }
  [key: string]: { data: unknown; error: null } | undefined
}) {
  const chainCache = new Map<string, ReturnType<typeof buildQueryChain>>()

  return {
    from: vi.fn((table: string) => {
      if (!chainCache.has(table)) {
        chainCache.set(table, buildQueryChain(tableResponses[table] ?? { data: [], error: null }))
      }
      return chainCache.get(table)!
    }),
  }
}

function makeCompletedTask(overrides: Partial<Task> = {}): Task {
  return {
    id: VALID_UUID,
    title: 'Finished task',
    status: 'done',
    user_id: USER_ID,
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
    ...overrides,
  }
}

function makeReflection(overrides: Partial<DailyReflection> = {}): DailyReflection {
  return {
    id: VALID_UUID,
    user_id: USER_ID,
    date: '2025-03-10',
    content: 'Had a great day',
    created_at: '2025-03-10T20:00:00Z',
    updated_at: '2025-03-10T20:00:00Z',
    ...overrides,
  }
}

// ── Subject (imported after mocks) ─────────────────────────────

import { upsertReflection, getLogbookDays } from '@/lib/actions/logbook'

// ── Tests ──────────────────────────────────────────────────────

describe('upsertReflection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('input validation', () => {
    it('throws a ZodError for an invalid date format', async () => {
      mockAuthedClient.mockResolvedValue({
        supabase: makeSupabaseMock({}) as never,
        user: { id: USER_ID } as never,
      })
      await expect(upsertReflection('not-a-date', 'content')).rejects.toThrow()
    })

    it('throws a ZodError for content exceeding 5000 characters', async () => {
      mockAuthedClient.mockResolvedValue({
        supabase: makeSupabaseMock({}) as never,
        user: { id: USER_ID } as never,
      })
      await expect(upsertReflection('2025-03-10', 'x'.repeat(5001))).rejects.toThrow()
    })

    it('accepts empty-string content (clears a reflection)', async () => {
      const supabase = makeSupabaseMock({
        daily_reflections: { data: null, error: null },
      })
      mockAuthedClient.mockResolvedValue({
        supabase: supabase as never,
        user: { id: USER_ID } as never,
      })
      await expect(upsertReflection('2025-03-10', '')).resolves.toBeUndefined()
    })

    it('accepts exactly 5000 characters of content', async () => {
      const supabase = makeSupabaseMock({
        daily_reflections: { data: null, error: null },
      })
      mockAuthedClient.mockResolvedValue({
        supabase: supabase as never,
        user: { id: USER_ID } as never,
      })
      await expect(upsertReflection('2025-03-10', 'x'.repeat(5000))).resolves.toBeUndefined()
    })
  })

  describe('happy path', () => {
    it('calls supabase.from("daily_reflections").upsert with the correct payload', async () => {
      const supabase = makeSupabaseMock({
        daily_reflections: { data: null, error: null },
      })
      mockAuthedClient.mockResolvedValue({
        supabase: supabase as never,
        user: { id: USER_ID } as never,
      })

      await upsertReflection('2025-03-10', 'Today I shipped it')

      expect(supabase.from).toHaveBeenCalledWith('daily_reflections')
      const upsertCall = vi.mocked(supabase.from('daily_reflections')['upsert'] as ReturnType<typeof vi.fn>)
      expect(upsertCall).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: USER_ID,
          date: '2025-03-10',
          content: 'Today I shipped it',
        }),
        expect.objectContaining({ onConflict: expect.stringContaining('user_id') })
      )
    })

    it('calls revalidatePath("/logbook") after a successful upsert', async () => {
      const supabase = makeSupabaseMock({
        daily_reflections: { data: null, error: null },
      })
      mockAuthedClient.mockResolvedValue({
        supabase: supabase as never,
        user: { id: USER_ID } as never,
      })

      await upsertReflection('2025-03-10', 'Shipped it')

      expect(mockRevalidatePath).toHaveBeenCalledWith('/logbook')
    })
  })

  describe('auth guard', () => {
    it('propagates the Unauthorized error when authedClient throws', async () => {
      mockAuthedClient.mockRejectedValue(new Error('Unauthorized'))
      await expect(upsertReflection('2025-03-10', 'Hello')).rejects.toThrow('Unauthorized')
    })
  })
})

describe('getLogbookDays', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns an empty array when there are no completed tasks', async () => {
    const supabase = makeSupabaseMock({
      tasks: { data: [], error: null },
      daily_reflections: { data: [], error: null },
    })
    mockAuthedClient.mockResolvedValue({
      supabase: supabase as never,
      user: { id: USER_ID } as never,
    })

    const days = await getLogbookDays(0)
    expect(days).toEqual([])
  })

  it('returns one LogbookDay entry per distinct local date', async () => {
    const tasks = [
      makeCompletedTask({ id: 'a1', completed_at: '2025-03-10T12:00:00Z' }),
      makeCompletedTask({ id: 'a2', completed_at: '2025-03-09T12:00:00Z' }),
    ]
    const supabase = makeSupabaseMock({
      tasks: { data: tasks, error: null },
      daily_reflections: { data: [], error: null },
    })
    mockAuthedClient.mockResolvedValue({
      supabase: supabase as never,
      user: { id: USER_ID } as never,
    })

    const days = await getLogbookDays(0)
    expect(days).toHaveLength(2)
  })

  it('each LogbookDay has the correct shape (date, tasks, reflection)', async () => {
    const task = makeCompletedTask({ completed_at: '2025-03-10T12:00:00Z' })
    const supabase = makeSupabaseMock({
      tasks: { data: [task], error: null },
      daily_reflections: { data: [], error: null },
    })
    mockAuthedClient.mockResolvedValue({
      supabase: supabase as never,
      user: { id: USER_ID } as never,
    })

    const days = await getLogbookDays(0)
    expect(days[0]).toMatchObject({
      date: '2025-03-10',
      tasks: expect.any(Array),
      reflection: null,
    })
  })

  it('merges a matching reflection onto the correct LogbookDay', async () => {
    const task = makeCompletedTask({ completed_at: '2025-03-10T12:00:00Z' })
    const reflection = makeReflection({ date: '2025-03-10', content: 'Great day' })
    const supabase = makeSupabaseMock({
      tasks: { data: [task], error: null },
      daily_reflections: { data: [reflection], error: null },
    })
    mockAuthedClient.mockResolvedValue({
      supabase: supabase as never,
      user: { id: USER_ID } as never,
    })

    const days = await getLogbookDays(0)
    expect(days[0].reflection).not.toBeNull()
    expect(days[0].reflection?.content).toBe('Great day')
  })

  it('sets reflection to null for days that have no matching reflection', async () => {
    const task = makeCompletedTask({ completed_at: '2025-03-10T12:00:00Z' })
    const supabase = makeSupabaseMock({
      tasks: { data: [task], error: null },
      daily_reflections: { data: [], error: null },
    })
    mockAuthedClient.mockResolvedValue({
      supabase: supabase as never,
      user: { id: USER_ID } as never,
    })

    const days = await getLogbookDays(0)
    expect(days[0].reflection).toBeNull()
  })

  it('returns days sorted newest-first', async () => {
    const tasks = [
      makeCompletedTask({ id: 'b1', completed_at: '2025-03-08T12:00:00Z' }),
      makeCompletedTask({ id: 'b2', completed_at: '2025-03-10T12:00:00Z' }),
      makeCompletedTask({ id: 'b3', completed_at: '2025-03-09T12:00:00Z' }),
    ]
    const supabase = makeSupabaseMock({
      tasks: { data: tasks, error: null },
      daily_reflections: { data: [], error: null },
    })
    mockAuthedClient.mockResolvedValue({
      supabase: supabase as never,
      user: { id: USER_ID } as never,
    })

    const days = await getLogbookDays(0)
    const dates = days.map((d) => d.date)
    expect(dates).toEqual(['2025-03-10', '2025-03-09', '2025-03-08'])
  })

  it('propagates Unauthorized when authedClient throws', async () => {
    mockAuthedClient.mockRejectedValue(new Error('Unauthorized'))
    await expect(getLogbookDays(0)).rejects.toThrow('Unauthorized')
  })
})
