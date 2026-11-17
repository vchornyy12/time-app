import 'server-only'

import { suggestWithAnthropic, verifyAnthropicKey } from './anthropic'
import type { LLMProvider } from './models'
import { suggestWithOpenAI, verifyOpenAIKey } from './openai'
import type { EmailForAnalysis, EmailTaskCandidate } from './tasks'

export { LLMProviderError, type EmailTaskCandidate } from './tasks'

export interface LLMConnection { provider: LLMProvider; key: string; model: string }

export function verifyProviderKey({ provider, key, model }: LLMConnection): Promise<boolean> {
  return provider === 'anthropic' ? verifyAnthropicKey(key, model) : verifyOpenAIKey(key)
}

export function suggestEmailTasks({ provider, key, model }: LLMConnection, emails: EmailForAnalysis[]): Promise<EmailTaskCandidate[]> {
  return provider === 'anthropic' ? suggestWithAnthropic(key, model, emails) : suggestWithOpenAI(key, model, emails)
}
