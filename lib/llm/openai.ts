import 'server-only'

import {
  EMAIL_TASK_INSTRUCTIONS, EMAIL_TASK_SCHEMA, LLMProviderError, emailTaskInput, parseEmailTaskOutput,
  type EmailForAnalysis, type EmailTaskCandidate,
} from './tasks'

export async function verifyOpenAIKey(key: string): Promise<boolean> {
  const response = await fetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(10000),
    cache: 'no-store',
  })
  return response.ok
}

export async function suggestWithOpenAI(key: string, model: string, emails: EmailForAnalysis[]): Promise<EmailTaskCandidate[]> {
  let response: Response
  try {
    response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(60000),
      body: JSON.stringify({
        model,
        store: false,
        input: [
          { role: 'system', content: EMAIL_TASK_INSTRUCTIONS },
          { role: 'user', content: emailTaskInput(emails) },
        ],
        text: { format: { type: 'json_schema', name: 'email_task_suggestions', strict: true, schema: EMAIL_TASK_SCHEMA } },
        // Reasoning tokens count toward this limit on current models, so leave
        // headroom beyond the few hundred tokens the answer itself needs.
        max_output_tokens: 8000,
      }),
    })
  } catch {
    throw new LLMProviderError('OpenAI did not respond in time. Please retry the scan.')
  }
  if (!response.ok) {
    throw new LLMProviderError('OpenAI could not analyze these messages. Check your key, model, and API billing.', response.status)
  }
  const result = await response.json().catch(() => null)
  const output = result?.output?.flatMap((item: { content?: Array<{ type: string; text?: string }> }) => item.content ?? [])
    .find((item: { type: string }) => item.type === 'output_text')?.text
  if (typeof output !== 'string') throw new Error('OpenAI returned no task suggestions.')
  return parseEmailTaskOutput(output, emails.length, 'OpenAI')
}
