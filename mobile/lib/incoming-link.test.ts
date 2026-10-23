import { describe, expect, it } from 'vitest'
import { incomingRoute, magicLinkCode } from './incoming-link'

describe('untrusted native intents', () => {
  it('removes credentials before the router parses the URL', () => {
    expect(incomingRoute('timeapp://auth?code=secret')).toBe('/auth')
    expect(magicLinkCode('timeapp://auth?code=secret')).toBe('secret')
  })
  it.each([
    'timeapp://auth?code=%FF'.repeat(1000),
    'timeapp://auth?code=%FF',
    'timeapp://auth?code=a&code=b',
    'timeapp://auth?code=a#access_token=b',
    'timeapp://auth.evil?code=a',
    'timeapp://auth/extra?code=a',
    'https://auth?code=a',
    'timeapp://auth?code=' + 'a'.repeat(2048),
  ])('rejects malformed or unexpected input before navigation', path => {
    expect(magicLinkCode(path)).toBeNull()
    expect(incomingRoute(path)).toBe('/')
  })
})
