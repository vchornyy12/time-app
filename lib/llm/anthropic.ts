import 'server-only'

import Anthropic from '@anthropic-ai/sdk'
import {
  EMAIL_TASK_INSTRUCTIONS, EMAIL_TASK_SCHEMA, LLMProviderError, emailTaskInput, parseEmailTaskOutput,
  type EmailForAnalysis, type EmailTaskCandidate,
} from './tasks'

// Claude Haiku 5.5 has no server-side refusal fallback; sending the parameter is pointless there.
const NO_SERVER_FALLBACK = new Set(['claude-haiku-5-5'])

function client(key: string, timeout: number) {
  // One retry at most: the scan worker's stale-claim window assumes a bounded batch.
  return new Anthropic({ apiKey: key, timeout, maxRetries: 1 })
}

/** True when the key is accepted and can use `model`; false when Anthropic rejects either. */
export async function verifyAnthropicKey(key: string, model: string): Promise<boolean> {
  try {
    await client(key, 10_000).models.retrieve(model)
    return true
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError
      || error instanceof Anthropic.NotFoundError) return false
    throw error
  }
}

export async function suggestWithAnthropic(key: string, model: string, emails: EmailForAnalysis[]): Promise<EmailTaskCandidate[]> {
  let response: Anthropic.Beta.BetaMessage
  try {
    response = await client(key, 60_000).beta.messages.create({
      model,
      max_tokens: 16000,
      system: EMAIL_TASK_INSTRUCTIONS,
      messages: [{ role: 'user', content: emailTaskInput(emails) }],
      // Thinking is always on for these models; short extraction needs little of it.
      output_config: { effort: 'low', format: { type: 'json_schema', schema: EMAIL_TASK_SCHEMA } },
      // If a safety classifier declines a batch, let Anthropic retry it on its recommended model.
      ...(NO_SERVER_FALLBACK.has(model) ? {} : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }),
    })
  } catch (error) {
    if (error instanceof Anthropic.APIConnectionError) {
      throw new LLMProviderError('Anthropic did not respond in time. Please retry the scan.')
    }
    if (error instanceof Anthropic.APIError) {
      throw new LLMProviderError('Anthropic could not analyze these messages. Check your key, model, and API billing.', error.status)
    }
    throw error
  }
  // A refusal or a truncated reply is about this batch's content, not the provider.
  if (response.stop_reason === 'refusal') throw new Error('Anthropic declined to analyze these messages.')
  if (response.stop_reason === 'max_tokens') throw new Error('Anthropic returned an incomplete suggestion list.')
  const output = response.content.find((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')?.text
  if (typeof output !== 'string') throw new Error('Anthropic returned no task suggestions.')
  return parseEmailTaskOutput(output, emails.length, 'Anthropic')
}
