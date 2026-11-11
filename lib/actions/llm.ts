'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { authedClient } from '@/lib/actions/authed-action'
import { OPENAI_MODELS, verifyOpenAIKey } from '@/lib/llm/openai'
import { clearUserLLMKey, getUserLLMKey, saveUserLLMKey } from '@/lib/llm/integration'

const settingsSchema = z.object({
  key: z.string().trim().min(20).max(500),
  model: z.enum(OPENAI_MODELS),
})

export async function connectOpenAI(input: { key: string; model: string }): Promise<{ error?: string }> {
  const { user } = await authedClient()
  const parsed = settingsSchema.safeParse(input)
  if (!parsed.success) return { error: 'Enter a valid OpenAI API key and choose a model.' }
  try {
    if (!await verifyOpenAIKey(parsed.data.key)) return { error: 'OpenAI did not accept this API key.' }
    await saveUserLLMKey(user.id, parsed.data.key, parsed.data.model)
    revalidatePath('/settings')
    return {}
  } catch {
    return { error: 'Could not verify or save the OpenAI key. Please retry.' }
  }
}

export async function removeOpenAI(): Promise<{ error?: string }> {
  const { user } = await authedClient()
  try {
    const key = await getUserLLMKey(user.id)
    if (key) await clearUserLLMKey(user.id)
    revalidatePath('/settings')
    return {}
  } catch {
    return { error: 'Could not remove the OpenAI key. Please retry.' }
  }
}
