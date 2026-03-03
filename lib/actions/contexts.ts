'use server'

import { revalidatePath } from 'next/cache'
import { authedClient } from '@/lib/actions/authed-action'
import { contextName as contextNameSchema } from '@/lib/validation/schemas'

export async function getUserContexts(): Promise<string[]> {
  const { supabase, user } = await authedClient()

  const { data, error } = await supabase
    .from('user_contexts')
    .select('name')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []).map((row) => row.name)
}

export async function addUserContext(name: string) {
  const parsed = contextNameSchema.parse(name)
  const ctx = (parsed.startsWith('@') ? parsed : `@${parsed}`).toLowerCase()

  const { supabase, user } = await authedClient()

  const { error } = await supabase
    .from('user_contexts')
    .upsert({ user_id: user.id, name: ctx }, { onConflict: 'user_id,name' })

  if (error) throw error
  revalidatePath('/next-actions')
  revalidatePath('/inbox')
}

export async function deleteUserContext(name: string) {
  const parsed = contextNameSchema.parse(name)

  const { supabase, user } = await authedClient()

  const { error } = await supabase
    .from('user_contexts')
    .delete()
    .eq('user_id', user.id)
    .eq('name', parsed)

  if (error) throw error
  revalidatePath('/next-actions')
  revalidatePath('/inbox')
}
