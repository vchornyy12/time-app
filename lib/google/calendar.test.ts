// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createGCalEvent, deleteGCalEvent, getAccessToken, GoogleApiError, GoogleAuthError, updateGCalEvent } from './calendar'

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status })
const mockFetch = (res: Response) => vi.spyOn(globalThis, 'fetch').mockResolvedValue(res)

afterEach(() => vi.restoreAllMocks())

describe('getAccessToken', () => {
  it('returns the access token', async () => {
    mockFetch(json(200, { access_token: 'tok' }))
    await expect(getAccessToken('r')).resolves.toBe('tok')
  })

  it('treats invalid_grant (revoked or expired refresh token) as an auth error', async () => {
    mockFetch(json(400, { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' }))
    await expect(getAccessToken('r')).rejects.toBeInstanceOf(GoogleAuthError)
  })

  it('treats a Google outage as a transient error', async () => {
    mockFetch(json(503, { error: 'backend_error' }))
    const error = await getAccessToken('r').catch((e) => e)
    expect(error).toBeInstanceOf(Error)
    expect(error).not.toBeInstanceOf(GoogleAuthError)
  })
})

describe('createGCalEvent', () => {
  it('creates a one-hour UTC event with recurrence and returns its ID', async () => {
    const fetch = mockFetch(json(200, { id: 'evt1' }))
    await expect(createGCalEvent('a', 'primary', {
      summary: 'Dentist', scheduledAt: '2026-12-01T09:00:00.000Z', recurrence: ['RRULE:FREQ=WEEKLY'],
    })).resolves.toBe('evt1')
    const body = JSON.parse(fetch.mock.calls[0][1]!.body as string)
    expect(body).toEqual({
      summary: 'Dentist',
      start: { dateTime: '2026-12-01T09:00:00.000Z', timeZone: 'UTC' },
      end: { dateTime: '2026-12-01T10:00:00.000Z', timeZone: 'UTC' },
      recurrence: ['RRULE:FREQ=WEEKLY'],
    })
  })

  it('flags a missing calendar scope as an auth error', async () => {
    mockFetch(json(403, { error: { message: 'Request had insufficient authentication scopes.', status: 'PERMISSION_DENIED', errors: [{ reason: 'insufficientPermissions' }] } }))
    await expect(createGCalEvent('a', 'primary', { summary: 'x', scheduledAt: '2026-12-01T09:00:00Z' }))
      .rejects.toBeInstanceOf(GoogleAuthError)
  })

  it('flags a 401 as an auth error', async () => {
    mockFetch(json(401, { error: { message: 'Invalid Credentials' } }))
    await expect(createGCalEvent('a', 'primary', { summary: 'x', scheduledAt: '2026-12-01T09:00:00Z' }))
      .rejects.toBeInstanceOf(GoogleAuthError)
  })

  it('keeps rate limits transient', async () => {
    mockFetch(json(403, { error: { message: 'Rate Limit Exceeded', errors: [{ reason: 'rateLimitExceeded' }] } }))
    const error = await createGCalEvent('a', 'primary', { summary: 'x', scheduledAt: '2026-12-01T09:00:00Z' }).catch((e) => e)
    expect(error).toBeInstanceOf(GoogleApiError)
    expect(error).not.toBeInstanceOf(GoogleAuthError)
  })
})

describe('updateGCalEvent / deleteGCalEvent', () => {
  it('reports the status of a missing event on update', async () => {
    mockFetch(json(404, { error: { message: 'Not Found' } }))
    const error = await updateGCalEvent('a', 'primary', 'evt', '2026-12-01T09:00:00Z').catch((e) => e)
    expect(error).toBeInstanceOf(GoogleApiError)
    expect(error.status).toBe(404)
  })

  it('treats an already deleted event as deleted', async () => {
    mockFetch(json(410, {}))
    await expect(deleteGCalEvent('a', 'primary', 'evt')).resolves.toBeUndefined()
  })
})
