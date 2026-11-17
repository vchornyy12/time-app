import { beforeEach, describe, expect, it, vi } from 'vitest'
import Anthropic from '@anthropic-ai/sdk'
import { suggestWithAnthropic, verifyAnthropicKey } from './anthropic'
import { LLMProviderError } from './tasks'

const api = vi.hoisted(() => ({ create: vi.fn(), retrieve: vi.fn(), options: [] as unknown[] }))
vi.mock('server-only', () => ({}))
vi.mock('@anthropic-ai/sdk', async importOriginal => {
  const actual = await importOriginal<typeof import('@anthropic-ai/sdk')>()
  class FakeClient {
    beta = { messages: { create: api.create } }
    models = { retrieve: api.retrieve }
    static APIError = actual.APIError
    static APIConnectionError = actual.APIConnectionError
    static AuthenticationError = actual.AuthenticationError
    static PermissionDeniedError = actual.PermissionDeniedError
    static NotFoundError = actual.NotFoundError
    constructor(options: unknown) { api.options.push(options) }
  }
  return { ...actual, default: FakeClient }
})

const emails = [{ subject: 'Report', from: 'sam@example.test', text: 'Please send the report.' }, { subject: 'Sale', from: 'shop@example.test', text: '50% off' }]
const reply = (text: string, stop_reason = 'end_turn') => ({ stop_reason, content: [{ type: 'thinking', thinking: '' }, { type: 'text', text }] })
const apiError = (status: number) => Anthropic.APIError.generate(status, { error: { message: 'x' } }, 'x', new Headers())

beforeEach(() => { vi.resetAllMocks(); api.options = [] })

describe('suggestWithAnthropic', () => {
  it('requests schema-constrained output and returns one result per email', async () => {
    api.create.mockResolvedValue(reply(JSON.stringify({ suggestions: [{ sourceIndex: 1, title: null }, { sourceIndex: 0, title: ' Send the report ' }] })))

    expect(await suggestWithAnthropic('sk-ant-test', 'claude-opus-5-5', emails)).toEqual([
      { sourceIndex: 0, title: 'Send the report' }, { sourceIndex: 1, title: null },
    ])

    expect(api.options[0]).toMatchObject({ apiKey: 'sk-ant-test', maxRetries: 1 })
    const request = api.create.mock.calls[0][0]
    expect(request).toMatchObject({
      model: 'claude-opus-5-5', fallbacks: 'default', betas: ['server-side-fallback-2026-07-01'],
      output_config: { effort: 'low', format: { type: 'json_schema' } },
    })
    expect(request).not.toHaveProperty('thinking')
    expect(request).not.toHaveProperty('temperature')
  })

  it('does not send the fallback parameter to Haiku', async () => {
    api.create.mockResolvedValue(reply(JSON.stringify({ suggestions: [{ sourceIndex: 0, title: null }, { sourceIndex: 1, title: null }] })))
    await suggestWithAnthropic('sk-ant-test', 'claude-haiku-5-5', emails)
    expect(api.create.mock.calls[0][0]).not.toHaveProperty('fallbacks')
    expect(api.create.mock.calls[0][0]).not.toHaveProperty('betas')
  })

  it.each([401, 429, 529])('reports HTTP %i as a provider failure', async status => {
    api.create.mockRejectedValue(apiError(status))
    await expect(suggestWithAnthropic('sk-ant-test', 'claude-opus-5-5', emails)).rejects.toBeInstanceOf(LLMProviderError)
  })

  it('treats refusals and bad output as a failure of this batch, not the provider', async () => {
    api.create.mockResolvedValue({ stop_reason: 'refusal', content: [] })
    const refusal = await suggestWithAnthropic('sk-ant-test', 'claude-opus-5-5', emails).catch(error => error)
    expect(refusal).not.toBeInstanceOf(LLMProviderError)
    expect(refusal.message).toMatch(/declined/)

    api.create.mockResolvedValue(reply(JSON.stringify({ suggestions: [{ sourceIndex: 0, title: null }] })))
    await expect(suggestWithAnthropic('sk-ant-test', 'claude-opus-5-5', emails)).rejects.toThrow('invalid suggestion list')
  })
})

describe('verifyAnthropicKey', () => {
  it('accepts a working key and rejects one Anthropic refuses', async () => {
    api.retrieve.mockResolvedValue({ id: 'claude-opus-5-5' })
    expect(await verifyAnthropicKey('sk-ant-test', 'claude-opus-5-5')).toBe(true)
    api.retrieve.mockRejectedValue(apiError(401))
    expect(await verifyAnthropicKey('sk-ant-test', 'claude-opus-5-5')).toBe(false)
    api.retrieve.mockRejectedValue(apiError(500))
    await expect(verifyAnthropicKey('sk-ant-test', 'claude-opus-5-5')).rejects.toThrow()
  })
})
