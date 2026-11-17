'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { authedClient } from '@/lib/actions/authed-action'
import { verifyProviderKey } from '@/lib/llm'
import { clearUserLLMKey, getUserLLMKey, saveUserLLMKey } from '@/lib/llm/integration'
import { LLM_CATALOG, LLM_PROVIDERS, isLLMProvider, isSupportedModel } from '@/lib/llm/models'

const settingsSchema = z.object({
  provider: z.enum(LLM_PROVIDERS),
  key: z.string().trim().min(20).max(500),
  model: z.string().max(100),
}).refine(value => isSupportedModel(value.provider, value.model))

export async function connectLLMProvider(input: { provider: string; key: string; model: string }): Promise<{ error?: string }> {
  const { user } = await authedClient()
  const parsed = settingsSchema.safeParse(input)
  if (!parsed.success) return { error: 'Enter a valid API key and choose a model.' }
  const { provider, key, model } = parsed.data
  const label = LLM_CATALOG[provider].label
  try {
    if (!await verifyProviderKey({ provider, key, model })) return { error: `${label} did not accept this API key for the selected model.` }
    await saveUserLLMKey(user.id, provider, key, model)
    revalidatePath('/settings')
    return {}
  } catch {
    return { error: `Could not verify or save the ${label} key. Please retry.` }
  }
}

/** Change the model for the connected provider. The key never leaves the server. */
export async function updateLLMModel(model: string): Promise<{ error?: string }> {
  const { supabase, user } = await authedClient()
  try {
    const { data: settings } = await supabase.from('user_llm_settings').select('provider,connected').eq('user_id', user.id).maybeSingle()
    const provider = settings?.connected ? settings.provider : null
    if (!isLLMProvider(provider)) return { error: 'Connect an AI provider key first.' }
    if (typeof model !== 'string' || !isSupportedModel(provider, model)) return { error: 'Choose a supported model.' }
    const key = await getUserLLMKey(user.id)
    if (!key) return { error: 'Connect an AI provider key first.' }
    await saveUserLLMKey(user.id, provider, key, model)
    revalidatePath('/settings')
    return {}
  } catch {
    return { error: 'Could not save the model. Please retry.' }
  }
}

export async function removeLLMProvider(): Promise<{ error?: string }> {
  const { user } = await authedClient()
  try {
    const key = await getUserLLMKey(user.id)
    if (key) await clearUserLLMKey(user.id)
    revalidatePath('/settings')
    return {}
  } catch {
    return { error: 'Could not remove the API key. Please retry.' }
  }
}
