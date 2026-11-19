// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('./secrets', () => ({ getAssistantSecret: vi.fn() }))
const { isValidWebhookUrl } = await import('./notify')
const { isMuted } = await import('@/lib/google-chat/client')

describe('notification webhook URL', () => {
  it('accepts Google Chat incoming webhooks only', () => {
    expect(isValidWebhookUrl('https://chat.googleapis.com/v1/spaces/AAAAxyz/messages?key=AIza-abc_1&token=t0k%3Den')).toBe(true)
    expect(isValidWebhookUrl('https://chat.googleapis.com/v1/spaces/AAAAxyz/messages?key=abc')).toBe(false)
    expect(isValidWebhookUrl('https://evil.example/v1/spaces/A/messages?key=a&token=b')).toBe(false)
    expect(isValidWebhookUrl('http://chat.googleapis.com/v1/spaces/A/messages?key=a&token=b')).toBe(false)
    expect(isValidWebhookUrl('https://chat.googleapis.com.evil.com/v1/spaces/A/messages?key=a&token=b')).toBe(false)
  })
})

describe('muted conversations', () => {
  it('matches part of a title, case-insensitively, or the exact space name', () => {
    expect(isMuted(['kudos'], 'Kudos Hub', 'spaces/1')).toBe(true)
    expect(isMuted(['spaces/abc'], 'Team', 'spaces/abc')).toBe(true)
    expect(isMuted(['', '  '], 'Anything', 'spaces/1')).toBe(false)
    expect(isMuted(['Celebrating'], 'Binariks site', 'spaces/1')).toBe(false)
  })
})
