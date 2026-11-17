// Provider and model catalog shared by the server and the settings UI.
// Model IDs verified against each provider's published model list on 2026-11-16.

export const LLM_PROVIDERS = ['openai', 'anthropic'] as const
export type LLMProvider = typeof LLM_PROVIDERS[number]

interface ProviderInfo {
  label: string
  keyLabel: string
  keyPlaceholder: string
  defaultModel: string
  models: ReadonlyArray<{ id: string; label: string }>
}

export const LLM_CATALOG: Record<LLMProvider, ProviderInfo> = {
  openai: {
    label: 'OpenAI',
    keyLabel: 'OpenAI API key',
    keyPlaceholder: 'sk-…',
    defaultModel: 'gpt-6-luna',
    models: [
      { id: 'gpt-6-luna', label: 'GPT-6 Luna — fastest, lowest cost' },
      { id: 'gpt-6.1-sol', label: 'GPT-6.1 Sol — balanced' },
      { id: 'gpt-6-astra', label: 'GPT-6 Astra — most capable' },
    ],
  },
  anthropic: {
    label: 'Anthropic',
    keyLabel: 'Anthropic API key',
    keyPlaceholder: 'sk-ant-…',
    defaultModel: 'claude-opus-5-5',
    models: [
      { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 — fastest, lowest cost' },
      { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 — balanced' },
      { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 — most capable' },
    ],
  },
}

export function isLLMProvider(value: unknown): value is LLMProvider {
  return (LLM_PROVIDERS as readonly unknown[]).includes(value)
}

export function isSupportedModel(provider: LLMProvider, model: string): boolean {
  return LLM_CATALOG[provider].models.some(entry => entry.id === model)
}

/**
 * The model to call for a saved setting. A model that is no longer offered
 * (for example a retired `gpt-4o-mini` saved before this catalog changed)
 * falls back to the provider default instead of breaking the connection.
 */
export function resolveModel(provider: LLMProvider, model: string | null | undefined): string {
  return model && isSupportedModel(provider, model) ? model : LLM_CATALOG[provider].defaultModel
}
