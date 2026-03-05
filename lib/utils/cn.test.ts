import { describe, it, expect } from 'vitest'
import { cn } from './cn'

describe('cn', () => {
  it('joins two plain class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('returns a single class unchanged', () => {
    expect(cn('only')).toBe('only')
  })

  it('returns empty string when called with no arguments', () => {
    expect(cn()).toBe('')
  })

  it('filters out undefined values', () => {
    expect(cn('a', undefined, 'b')).toBe('a b')
  })

  it('filters out null values', () => {
    expect(cn('a', null, 'b')).toBe('a b')
  })

  it('filters out false values', () => {
    expect(cn('a', false, 'b')).toBe('a b')
  })

  it('filters out all falsy values at once', () => {
    expect(cn(null, undefined, false, 'real')).toBe('real')
  })

  it('handles conditional class via boolean expression', () => {
    const isActive = true
    expect(cn('base', isActive && 'active')).toBe('base active')
  })

  it('omits conditional class when condition is false', () => {
    const isActive = false
    expect(cn('base', isActive && 'active')).toBe('base')
  })

  it('handles multiple Tailwind classes in a single argument', () => {
    expect(cn('flex items-center', 'gap-2')).toBe('flex items-center gap-2')
  })

  it('returns empty string when all arguments are falsy', () => {
    expect(cn(false, null, undefined)).toBe('')
  })

  it('handles an empty string argument', () => {
    // empty string is falsy — it should be filtered out
    expect(cn('a', '', 'b')).toBe('a b')
  })
})
