import { beforeEach, describe, expect, it, vi } from 'vitest'
import { captureTask } from './tasks'

const { from, upsert, select, eq, maybeSingle, single, revalidatePath } = vi.hoisted(() => ({
  from: vi.fn(), upsert: vi.fn(), select: vi.fn(), eq: vi.fn(),
  maybeSingle: vi.fn(), single: vi.fn(), revalidatePath: vi.fn(),
}))
vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/lib/actions/authed-action', () => ({
  authedClient: async () => ({ supabase: { from }, user: { id: 'user-1' } }),
}))
vi.mock('@/lib/google/reminders', () => ({ cleanupWaitingForReminder: vi.fn() }))
vi.mock('@/lib/actions/calendar', () => ({ syncWaitingForReminder: vi.fn() }))
const requestId = '550e8400-e29b-41d4-a716-446655440000'

describe('captureTask idempotency', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    const query = { upsert, select, eq, maybeSingle, single }
    from.mockReturnValue(query)
    upsert.mockReturnValue(query)
    select.mockReturnValue(query)
    eq.mockReturnValue(query)
    maybeSingle.mockResolvedValue({ data: { id: requestId }, error: null })
    single.mockResolvedValue({ data: { id: requestId }, error: null })
  })

  it('uses an immutable request ID and never updates an existing task on retry', async () => {
    await expect(captureTask('  Thought  ', requestId)).resolves.toEqual({ id: requestId })
    expect(upsert).toHaveBeenCalledWith(
      { id: requestId, title: 'Thought', user_id: 'user-1', status: 'inbox' },
      { onConflict: 'id', ignoreDuplicates: true }
    )
  })

  it('verifies ownership before acknowledging an already saved task', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null })
    await expect(captureTask('Thought', requestId)).resolves.toEqual({ id: requestId })
    expect(eq).toHaveBeenCalledWith('id', requestId)
    expect(eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(single).toHaveBeenCalledOnce()
  })

  it('does not acknowledge a conflicting ID owned by another user', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null })
    single.mockResolvedValue({ data: null, error: new Error('Not found') })
    await expect(captureTask('Thought', requestId)).rejects.toThrow('Not found')
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('propagates database failures and rejects malformed IDs before writing', async () => {
    await expect(captureTask('Thought', 'bad-id')).rejects.toThrow()
    expect(upsert).not.toHaveBeenCalled()
    maybeSingle.mockResolvedValue({ data: null, error: new Error('Unavailable') })
    await expect(captureTask('Thought', requestId)).rejects.toThrow('Unavailable')
  })

  it('keeps the existing one-argument API working', async () => {
    const result = await captureTask('Thought')
    expect(result.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(upsert.mock.calls[0][0].id).toBe(result.id)
  })
})
