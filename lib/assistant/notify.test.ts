// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('./secrets', () => ({ getAssistantSecret: vi.fn() }))
const { isValidWebhookUrl, normalizeWebhookUrl } = await import('./notify')
const { isMuted } = await import('@/lib/google-chat/client')

describe('notification webhook URL', () => {
  it('accepts Google Chat incoming webhooks only', () => {
    expect(isValidWebhookUrl('https://chat.googleapis.com/v1/spaces/AAAAxyz/messages?key=AIza-abc_1&token=t0k%3Den')).toBe(true)
    expect(isValidWebhookUrl('https://chat.googleapis.com/v1/spaces/AAAAxyz/messages?key=abc')).toBe(false)
    expect(isValidWebhookUrl('https://evil.example/v1/spaces/A/messages?key=a&token=b')).toBe(false)
    expect(isValidWebhookUrl('http://chat.googleapis.com/v1/spaces/A/messages?key=a&token=b')).toBe(false)
    expect(isValidWebhookUrl('https://chat.googleapis.com.evil.com/v1/spaces/A/messages?key=a&token=b')).toBe(false)
  })

  it('normalizes a webhook URL copied with an unencoded token', () => {
    expect(normalizeWebhookUrl(' https://chat.googleapis.com/v1/spaces/AAQAT-KuJF0/messages?key=AIza-1&token=abc_d-e= '))
      .toBe('https://chat.googleapis.com/v1/spaces/AAQAT-KuJF0/messages?key=AIza-1&token=abc_d-e%3D')
    expect(normalizeWebhookUrl('https://chat.googleapis.com/v1/spaces/A/messages?token=t%3D&key=k&extra=1'))
      .toBe('https://chat.googleapis.com/v1/spaces/A/messages?key=k&token=t%3D')
    expect(normalizeWebhookUrl('https://user@chat.googleapis.com/v1/spaces/A/messages?key=a&token=b')).toBeNull()
    expect(normalizeWebhookUrl('https://chat.googleapis.com:8443/v1/spaces/A/messages?key=a&token=b')).toBeNull()
    expect(normalizeWebhookUrl('https://chat.googleapis.com/v1/spaces/A/members?key=a&token=b')).toBeNull()
  })
})

describe('muted conversations', () => {
  it('matches part of a title, case-insensitively, or the exact space name', () => {
    expect(isMuted(['kudos'], 'Kudos Board', 'spaces/1')).toBe(true)
    expect(isMuted(['spaces/abc'], 'Team', 'spaces/abc')).toBe(true)
    expect(isMuted(['', '  '], 'Anything', 'spaces/1')).toBe(false)
    expect(isMuted(['Birthdays'], 'Company site', 'spaces/1')).toBe(false)
  })
})
