/**
 * Tests for the Clarity Protocol server action.
 *
 * Covers:
 *  claritySessionSchema (Zod validation):
 *   - Accepts valid input for all three fields
 *   - Trims whitespace on all text fields
 *   - Rejects empty worryDescription
 *   - Rejects whitespace-only worryDescription
 *   - Rejects worryDescription over 2000 characters
 *   - Rejects empty worstCaseScenario
 *   - Rejects empty actionTitle
 *   - Rejects actionTitle over 500 characters
 *
 *  submitClaritySession (server action integration):
 *   - Happy path: inserts task then session, returns { sessionId, taskId }
 *   - Happy path: calls revalidatePath('/inbox') and revalidatePath('/', 'layout')
 *   - Happy path: task is inserted with status 'inbox'
 *   - Happy path: session is inserted with the correct task ID as resulting_task_id
 *   - Task insert failure: throws immediately, no session insert attempted
 *   - Session insert failure: deletes the orphaned task (rollback), then re-throws
 *   - Session insert failure: the re-thrown error is the original DB error
 *   - Zod validation failure: throws before any DB write
 *   - Auth guard: propagates Unauthorized when authedClient throws
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Module mocks (declared before subject import) ──────────────

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/actions/authed-action', () => ({
  authedClient: vi.fn(),
}))

// ── Helpers ────────────────────────────────────────────────────

import { authedClient } from '@/lib/actions/authed-action'
import { revalidatePath } from 'next/cache'
import { claritySessionSchema } from '@/lib/validation/schemas'

const mockAuthedClient = vi.mocked(authedClient)
const mockRevalidatePath = vi.mocked(revalidatePath)

const TASK_ID = '11111111-1111-1111-1111-111111111111'
const SESSION_ID = '22222222-2222-2222-2222-222222222222'
const USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

const VALID_INPUT = {
  worryDescription: 'I might lose my job',
  worstCaseScenario: 'I get fired and cannot pay rent for 3 months',
  actionTitle: 'Update my CV and apply to one job today',
}

/**
 * Builds a minimal awaitable Supabase query chain.
 * Every method returns `this` for chaining; awaiting the chain resolves to `result`.
 */
function makeChain(result: { data: unknown; error: { message: string } | null }) {
  const chain: Record<string, unknown> = {}
  for (const m of ['insert', 'select', 'single', 'delete', 'eq', 'update', 'upsert']) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  chain['then'] = (
    onFulfilled: (v: { data: unknown; error: { message: string } | null }) => unknown,
  ) => Promise.resolve(result).then(onFulfilled)
  return chain
}

/**
 * Builds a mock Supabase client whose `from()` returns chains in sequence,
 * one per `mockReturnValueOnce` call on the `from` mock.
 */
function makeSupabaseMock() {
  return { from: vi.fn() }
}

// ── Subject (imported after mocks) ─────────────────────────────

import { submitClaritySession } from '@/lib/actions/clarity'

// ── Schema tests ───────────────────────────────────────────────

describe('claritySessionSchema', () => {
  it('accepts valid input for all three fields', () => {
    const result = claritySessionSchema.parse(VALID_INPUT)
    expect(result.worryDescription).toBe(VALID_INPUT.worryDescription)
    expect(result.worstCaseScenario).toBe(VALID_INPUT.worstCaseScenario)
    expect(result.actionTitle).toBe(VALID_INPUT.actionTitle)
  })

  it('trims whitespace on worryDescription', () => {
    const result = claritySessionSchema.parse({ ...VALID_INPUT, worryDescription: '  my worry  ' })
    expect(result.worryDescription).toBe('my worry')
  })

  it('trims whitespace on worstCaseScenario', () => {
    const result = claritySessionSchema.parse({ ...VALID_INPUT, worstCaseScenario: '  worst case  ' })
    expect(result.worstCaseScenario).toBe('worst case')
  })

  it('trims whitespace on actionTitle', () => {
    const result = claritySessionSchema.parse({ ...VALID_INPUT, actionTitle: '  do something  ' })
    expect(result.actionTitle).toBe('do something')
  })

  it('rejects empty worryDescription', () => {
    expect(() => claritySessionSchema.parse({ ...VALID_INPUT, worryDescription: '' })).toThrow(
      'Please describe your worry',
    )
  })

  it('rejects whitespace-only worryDescription', () => {
    expect(() => claritySessionSchema.parse({ ...VALID_INPUT, worryDescription: '   ' })).toThrow()
  })

  it('rejects worryDescription over 2000 characters', () => {
    expect(() =>
      claritySessionSchema.parse({ ...VALID_INPUT, worryDescription: 'x'.repeat(2001) }),
    ).toThrow()
  })

  it('accepts worryDescription of exactly 2000 characters', () => {
    const long = 'x'.repeat(2000)
    expect(claritySessionSchema.parse({ ...VALID_INPUT, worryDescription: long }).worryDescription).toBe(long)
  })

  it('rejects empty worstCaseScenario', () => {
    expect(() => claritySessionSchema.parse({ ...VALID_INPUT, worstCaseScenario: '' })).toThrow(
      'Please describe the worst case',
    )
  })

  it('rejects worstCaseScenario over 2000 characters', () => {
    expect(() =>
      claritySessionSchema.parse({ ...VALID_INPUT, worstCaseScenario: 'x'.repeat(2001) }),
    ).toThrow()
  })

  it('rejects empty actionTitle', () => {
    expect(() => claritySessionSchema.parse({ ...VALID_INPUT, actionTitle: '' })).toThrow(
      'Please enter one concrete action',
    )
  })

  it('rejects actionTitle over 500 characters', () => {
    expect(() =>
      claritySessionSchema.parse({ ...VALID_INPUT, actionTitle: 'x'.repeat(501) }),
    ).toThrow()
  })

  it('accepts actionTitle of exactly 500 characters', () => {
    const long = 'x'.repeat(500)
    expect(claritySessionSchema.parse({ ...VALID_INPUT, actionTitle: long }).actionTitle).toBe(long)
  })
})

// ── Server action integration tests ────────────────────────────

describe('submitClaritySession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('happy path', () => {
    it('returns { sessionId, taskId } on success', async () => {
      const supabase = makeSupabaseMock()
      supabase.from
        .mockReturnValueOnce(makeChain({ data: { id: TASK_ID }, error: null }))
        .mockReturnValueOnce(makeChain({ data: { id: SESSION_ID }, error: null }))

      mockAuthedClient.mockResolvedValue({
        supabase: supabase as never,
        user: { id: USER_ID } as never,
      })

      const result = await submitClaritySession(VALID_INPUT)

      expect(result).toEqual({ sessionId: SESSION_ID, taskId: TASK_ID })
    })

    it('inserts the task with status "inbox" and the correct title', async () => {
      const tasksChain = makeChain({ data: { id: TASK_ID }, error: null })
      const supabase = makeSupabaseMock()
      supabase.from
        .mockReturnValueOnce(tasksChain)
        .mockReturnValueOnce(makeChain({ data: { id: SESSION_ID }, error: null }))

      mockAuthedClient.mockResolvedValue({
        supabase: supabase as never,
        user: { id: USER_ID } as never,
      })

      await submitClaritySession(VALID_INPUT)

      expect(supabase.from).toHaveBeenNthCalledWith(1, 'tasks')
      const insertFn = vi.mocked(tasksChain['insert'] as ReturnType<typeof vi.fn>)
      expect(insertFn).toHaveBeenCalledWith(
        expect.objectContaining({
          title: VALID_INPUT.actionTitle,
          status: 'inbox',
          user_id: USER_ID,
        }),
      )
    })

    it('inserts the clarity session with the correct payload including resulting_task_id', async () => {
      const sessionsChain = makeChain({ data: { id: SESSION_ID }, error: null })
      const supabase = makeSupabaseMock()
      supabase.from
        .mockReturnValueOnce(makeChain({ data: { id: TASK_ID }, error: null }))
        .mockReturnValueOnce(sessionsChain)

      mockAuthedClient.mockResolvedValue({
        supabase: supabase as never,
        user: { id: USER_ID } as never,
      })

      await submitClaritySession(VALID_INPUT)

      expect(supabase.from).toHaveBeenNthCalledWith(2, 'clarity_sessions')
      const insertFn = vi.mocked(sessionsChain['insert'] as ReturnType<typeof vi.fn>)
      expect(insertFn).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: USER_ID,
          worry_description: VALID_INPUT.worryDescription,
          worst_case_scenario: VALID_INPUT.worstCaseScenario,
          resulting_task_id: TASK_ID,
        }),
      )
    })

    it('calls revalidatePath("/inbox") after success', async () => {
      const supabase = makeSupabaseMock()
      supabase.from
        .mockReturnValueOnce(makeChain({ data: { id: TASK_ID }, error: null }))
        .mockReturnValueOnce(makeChain({ data: { id: SESSION_ID }, error: null }))

      mockAuthedClient.mockResolvedValue({
        supabase: supabase as never,
        user: { id: USER_ID } as never,
      })

      await submitClaritySession(VALID_INPUT)

      expect(mockRevalidatePath).toHaveBeenCalledWith('/inbox')
    })

    it('calls revalidatePath("/", "layout") after success', async () => {
      const supabase = makeSupabaseMock()
      supabase.from
        .mockReturnValueOnce(makeChain({ data: { id: TASK_ID }, error: null }))
        .mockReturnValueOnce(makeChain({ data: { id: SESSION_ID }, error: null }))

      mockAuthedClient.mockResolvedValue({
        supabase: supabase as never,
        user: { id: USER_ID } as never,
      })

      await submitClaritySession(VALID_INPUT)

      expect(mockRevalidatePath).toHaveBeenCalledWith('/', 'layout')
    })
  })

  describe('task insert failure', () => {
    it('throws immediately without attempting to insert a clarity session', async () => {
      const supabase = makeSupabaseMock()
      supabase.from.mockReturnValueOnce(
        makeChain({ data: null, error: { message: 'Task insert failed' } }),
      )

      mockAuthedClient.mockResolvedValue({
        supabase: supabase as never,
        user: { id: USER_ID } as never,
      })

      await expect(submitClaritySession(VALID_INPUT)).rejects.toBeTruthy()

      // from() should only have been called once (tasks insert), never for clarity_sessions
      expect(supabase.from).toHaveBeenCalledTimes(1)
    })
  })

  describe('session insert failure (rollback)', () => {
    it('deletes the orphaned task when the session insert fails', async () => {
      const tasksDeleteChain = makeChain({ data: null, error: null })
      const supabase = makeSupabaseMock()
      supabase.from
        .mockReturnValueOnce(makeChain({ data: { id: TASK_ID }, error: null }))
        .mockReturnValueOnce(makeChain({ data: null, error: { message: 'Session insert failed' } }))
        .mockReturnValueOnce(tasksDeleteChain)

      mockAuthedClient.mockResolvedValue({
        supabase: supabase as never,
        user: { id: USER_ID } as never,
      })

      await expect(submitClaritySession(VALID_INPUT)).rejects.toBeTruthy()

      // Third call to from() should be the rollback delete on 'tasks'
      expect(supabase.from).toHaveBeenNthCalledWith(3, 'tasks')
      const deleteFn = vi.mocked(tasksDeleteChain['delete'] as ReturnType<typeof vi.fn>)
      expect(deleteFn).toHaveBeenCalled()
    })

    it('re-throws the original DB error after the rollback', async () => {
      const supabase = makeSupabaseMock()
      supabase.from
        .mockReturnValueOnce(makeChain({ data: { id: TASK_ID }, error: null }))
        .mockReturnValueOnce(makeChain({ data: null, error: { message: 'Session insert failed' } }))
        .mockReturnValueOnce(makeChain({ data: null, error: null }))

      mockAuthedClient.mockResolvedValue({
        supabase: supabase as never,
        user: { id: USER_ID } as never,
      })

      await expect(submitClaritySession(VALID_INPUT)).rejects.toMatchObject({
        message: 'Session insert failed',
      })
    })

    it('does NOT call revalidatePath when the session insert fails', async () => {
      const supabase = makeSupabaseMock()
      supabase.from
        .mockReturnValueOnce(makeChain({ data: { id: TASK_ID }, error: null }))
        .mockReturnValueOnce(makeChain({ data: null, error: { message: 'Session insert failed' } }))
        .mockReturnValueOnce(makeChain({ data: null, error: null }))

      mockAuthedClient.mockResolvedValue({
        supabase: supabase as never,
        user: { id: USER_ID } as never,
      })

      await expect(submitClaritySession(VALID_INPUT)).rejects.toBeTruthy()

      expect(mockRevalidatePath).not.toHaveBeenCalled()
    })
  })

  describe('validation guard', () => {
    it('throws a ZodError before any DB write when worryDescription is empty', async () => {
      const supabase = makeSupabaseMock()
      mockAuthedClient.mockResolvedValue({
        supabase: supabase as never,
        user: { id: USER_ID } as never,
      })

      await expect(
        submitClaritySession({ ...VALID_INPUT, worryDescription: '' }),
      ).rejects.toThrow()

      expect(supabase.from).not.toHaveBeenCalled()
    })

    it('throws a ZodError before any DB write when actionTitle is empty', async () => {
      const supabase = makeSupabaseMock()
      mockAuthedClient.mockResolvedValue({
        supabase: supabase as never,
        user: { id: USER_ID } as never,
      })

      await expect(
        submitClaritySession({ ...VALID_INPUT, actionTitle: '   ' }),
      ).rejects.toThrow()

      expect(supabase.from).not.toHaveBeenCalled()
    })
  })

  describe('auth guard', () => {
    it('propagates Unauthorized when authedClient throws', async () => {
      mockAuthedClient.mockRejectedValue(new Error('Unauthorized'))

      await expect(submitClaritySession(VALID_INPUT)).rejects.toThrow('Unauthorized')
    })
  })
})
