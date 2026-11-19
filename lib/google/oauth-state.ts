import 'server-only'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { safeInternalPath } from '@/lib/utils/safe-internal-path'

export { safeInternalPath }

export const GOOGLE_OAUTH_COOKIE = process.env.NODE_ENV === 'production' ? '__Host-google-calendar-oauth' : 'google-calendar-oauth'
export const GOOGLE_OAUTH_TTL = 600

export function createGoogleOAuthState(userId: string, next: string) {
  const state = randomBytes(32).toString('base64url')
  const verifier = randomBytes(32).toString('base64url')
  const cookie = JSON.stringify({ state, verifier, userId, next: safeInternalPath(next), expiresAt: Date.now() + GOOGLE_OAUTH_TTL * 1000 })
  return { state, verifier, cookie, challenge: createHash('sha256').update(verifier).digest('base64url') }
}

export function verifyGoogleOAuthState(rawCookie: string | undefined, state: string | null, userId: string) {
  if (!rawCookie || !state || !/^[A-Za-z0-9_-]{43}$/.test(state)) return null
  try {
    const saved = JSON.parse(rawCookie)
    if (typeof saved.state !== 'string' || typeof saved.verifier !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(saved.verifier)
      || saved.userId !== userId || !Number.isFinite(saved.expiresAt) || saved.expiresAt <= Date.now()
      || saved.expiresAt > Date.now() + GOOGLE_OAUTH_TTL * 1000) return null
    const expected = Buffer.from(saved.state)
    const actual = Buffer.from(state)
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null
    return { next: safeInternalPath(saved.next), verifier: saved.verifier as string }
  } catch { return null }
}
