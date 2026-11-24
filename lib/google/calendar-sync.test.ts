// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/google/integration', () => ({
  getGoogleIntegration: vi.fn(),
  clearGoogleIntegration: vi.fn(),
}))
vi.mock('@/lib/google/calendar', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/google/calendar')>()
  return {
    ...actual,
    getAccessToken: vi.fn(),
    createGCalEvent: vi.fn(),
    updateGCalEvent: vi.fn(),
    deleteGCalEvent: vi.fn(),
  }
})

import { clearGoogleIntegration, getGoogleIntegration } from '@/lib/google/integration'
import { createGCalEvent, deleteGCalEvent, getAccessToken, GoogleApiError, GoogleAuthError, updateGCalEvent } from '@/lib/google/calendar'
import { MAX_PENDING_SYNC, rescheduleTaskInGoogle, syncPendingTasks, syncTaskToGoogle } from './calendar-sync'

type Row = Record<string, unknown>

/** Minimal in-memory stand-in for the Supabase query builder used by calendar-sync. */
function fakeSupabase(rows: Row[], opts: { stealEventId?: boolean } = {}) {
  const updates: Row[] = []
  const supabase = {
    from: () => {
      const filters: Array<(r: Row) => boolean> = []
      let patch: Row | null = null
      let limit = Infinity
      const run = () => {
        const matched = rows.filter((r) => filters.every((f) => f(r)))
        if (patch) {
          if (opts.stealEventId) return { data: [], error: null }
          for (const r of matched) Object.assign(r, patch)
          updates.push(patch)
        }
        return { data: matched.slice(0, limit).map((r) => ({ ...r })), error: null }
      }
      const builder: Record<string, unknown> = {
        select: () => builder,
        update: (p: Row) => { patch = p; return builder },
        eq: (k: string, v: unknown) => { filters.push((r) => r[k] === v); return builder },
        is: (k: string, v: unknown) => { filters.push((r) => (r[k] ?? null) === v); return builder },
        not: (k: string) => { filters.push((r) => r[k] != null); return builder },
        order: () => builder,
        limit: (n: number) => { limit = n; return builder },
        maybeSingle: async () => ({ data: run().data[0] ?? null, error: null }),
        then: (resolve: (v: unknown) => unknown) => resolve(run()),
      }
      return builder
    },
  }
  return { ctx: { supabase: supabase as never, user: { id: 'u1' } }, updates }
}

const task = (over: Row = {}): Row => ({
  id: 't1', user_id: 'u1', title: 'Dentist', status: 'calendar',
  scheduled_at: '2026-12-01T09:00:00.000Z', recurrence_rule: null, google_calendar_event_id: null, ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.mocked(getGoogleIntegration).mockResolvedValue({ google_refresh_token: 'refresh', google_calendar_id: 'primary' })
  vi.mocked(getAccessToken).mockResolvedValue('access')
  vi.mocked(createGCalEvent).mockResolvedValue('evt-new')
  vi.mocked(clearGoogleIntegration).mockResolvedValue(undefined)
  vi.mocked(deleteGCalEvent).mockResolvedValue(undefined)
  vi.mocked(updateGCalEvent).mockResolvedValue(undefined)
})

describe('syncTaskToGoogle', () => {
  it('creates the event and stores its ID', async () => {
    const rows = [task({ recurrence_rule: 'weekly' })]
    const { ctx } = fakeSupabase(rows)
    await expect(syncTaskToGoogle(ctx, 't1')).resolves.toBe('synced')
    expect(createGCalEvent).toHaveBeenCalledWith('access', 'primary', {
      summary: 'Dentist', scheduledAt: '2026-12-01T09:00:00.000Z', recurrence: ['RRULE:FREQ=WEEKLY'],
    })
    expect(rows[0].google_calendar_event_id).toBe('evt-new')
  })

  it('skips a task that is already synced', async () => {
    const { ctx } = fakeSupabase([task({ google_calendar_event_id: 'evt-old' })])
    await expect(syncTaskToGoogle(ctx, 't1')).resolves.toBe('skipped')
    expect(createGCalEvent).not.toHaveBeenCalled()
  })

  it('reports not_connected without a Google grant', async () => {
    vi.mocked(getGoogleIntegration).mockResolvedValue(null)
    const { ctx } = fakeSupabase([task()])
    await expect(syncTaskToGoogle(ctx, 't1')).resolves.toBe('not_connected')
  })

  it('clears a revoked or expired connection instead of throwing', async () => {
    vi.mocked(getAccessToken).mockRejectedValue(new GoogleAuthError('Token refresh failed: invalid_grant'))
    const { ctx } = fakeSupabase([task()])
    await expect(syncTaskToGoogle(ctx, 't1')).resolves.toBe('reconnect')
    expect(clearGoogleIntegration).toHaveBeenCalledWith('u1')
  })

  it('keeps the connection on a transient failure', async () => {
    vi.mocked(createGCalEvent).mockRejectedValue(new GoogleApiError('Backend Error', 503))
    const rows = [task()]
    const { ctx } = fakeSupabase(rows)
    await expect(syncTaskToGoogle(ctx, 't1')).resolves.toBe('failed')
    expect(clearGoogleIntegration).not.toHaveBeenCalled()
    expect(rows[0].google_calendar_event_id).toBeNull()
  })

  it('deletes its own event when a concurrent sync stored one first', async () => {
    const { ctx } = fakeSupabase([task()], { stealEventId: true })
    await expect(syncTaskToGoogle(ctx, 't1')).resolves.toBe('synced')
    expect(deleteGCalEvent).toHaveBeenCalledWith('access', 'primary', 'evt-new')
  })
})

describe('rescheduleTaskInGoogle', () => {
  it('moves the existing event', async () => {
    const { ctx } = fakeSupabase([task({ google_calendar_event_id: 'evt-old' })])
    await expect(rescheduleTaskInGoogle(ctx, 't1')).resolves.toBe('synced')
    expect(updateGCalEvent).toHaveBeenCalledWith('access', 'primary', 'evt-old', '2026-12-01T09:00:00.000Z')
  })

  it('recreates an event that was deleted in Google', async () => {
    vi.mocked(updateGCalEvent).mockRejectedValue(new GoogleApiError('Not Found', 404))
    const rows = [task({ google_calendar_event_id: 'evt-old' })]
    const { ctx } = fakeSupabase(rows)
    await expect(rescheduleTaskInGoogle(ctx, 't1')).resolves.toBe('synced')
    expect(rows[0].google_calendar_event_id).toBe('evt-new')
  })

  it('creates an event for a task that was never synced', async () => {
    const { ctx } = fakeSupabase([task()])
    await expect(rescheduleTaskInGoogle(ctx, 't1')).resolves.toBe('synced')
    expect(createGCalEvent).toHaveBeenCalledOnce()
  })
})

describe('syncPendingTasks', () => {
  it('syncs every unsynced calendar task with a time, and nothing else', async () => {
    const rows = [
      task({ id: 'a' }), task({ id: 'b' }),
      task({ id: 'c', google_calendar_event_id: 'evt-c' }),
      task({ id: 'd', scheduled_at: null }),
      task({ id: 'e', status: 'inbox' }),
      task({ id: 'f', user_id: 'other' }),
    ]
    const { ctx } = fakeSupabase(rows)
    await expect(syncPendingTasks(ctx)).resolves.toEqual({ synced: 2, failed: 0, remaining: 0, status: 'synced' })
    expect(createGCalEvent).toHaveBeenCalledTimes(2)
  })

  it('does not contact Google when nothing is pending', async () => {
    const { ctx } = fakeSupabase([task({ google_calendar_event_id: 'x' })])
    await expect(syncPendingTasks(ctx)).resolves.toMatchObject({ synced: 0, status: 'skipped' })
    expect(getGoogleIntegration).not.toHaveBeenCalled()
  })

  it('stops and reports reconnect when Google rejects the grant', async () => {
    vi.mocked(createGCalEvent).mockRejectedValue(new GoogleAuthError('401'))
    const { ctx } = fakeSupabase([task({ id: 'a' }), task({ id: 'b' })])
    await expect(syncPendingTasks(ctx)).resolves.toMatchObject({ synced: 0, status: 'reconnect' })
    expect(createGCalEvent).toHaveBeenCalledOnce()
  })

  it('continues past a transient failure', async () => {
    vi.mocked(createGCalEvent).mockRejectedValueOnce(new GoogleApiError('Backend Error', 500))
    const { ctx } = fakeSupabase([task({ id: 'a' }), task({ id: 'b' })])
    await expect(syncPendingTasks(ctx)).resolves.toEqual({ synced: 1, failed: 1, remaining: 0, status: 'failed' })
  })

  it('caps one pass', async () => {
    const rows = Array.from({ length: MAX_PENDING_SYNC + 3 }, (_, i) => task({ id: `t${i}` }))
    const { ctx } = fakeSupabase(rows)
    const result = await syncPendingTasks(ctx)
    expect(result.synced).toBe(MAX_PENDING_SYNC)
    expect(result.remaining).toBe(1)
  })
})
