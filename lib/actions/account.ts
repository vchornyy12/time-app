'use server'

import { redirect } from 'next/navigation'
import { authedClient } from '@/lib/actions/authed-action'
import { createAdminClient } from '@/lib/supabase/admin'

export async function signOut(): Promise<void> {
  const { supabase } = await authedClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function deleteAccount(
  confirmedEmail: string
): Promise<{ error: string } | never> {
  const { supabase, user } = await authedClient()

  // Security: confirmed email must exactly match the account email
  if (confirmedEmail.toLowerCase().trim() !== user.email?.toLowerCase()) {
    return { error: 'The email address you entered does not match your account.' }
  }

  // Delete all user data explicitly before removing the auth user.
  // All tables have ON DELETE CASCADE on auth.users, but we do this
  // belt-and-suspenders to ensure a clean wipe even in edge cases.
  const tables = [
    'tasks',
    'projects',
    'user_integrations',
    'user_contexts',
    'user_preferences',
  ] as const

  for (const table of tables) {
    try {
      await supabase.from(table).delete().eq('user_id', user.id)
    } catch {
      // Table may not exist yet (e.g. user_preferences) — safe to skip
    }
  }

  // Delete the auth user via service-role client
  const admin = createAdminClient()
  const { error: adminError } = await admin.auth.admin.deleteUser(user.id)
  if (adminError) {
    return { error: 'Failed to delete account. Please try again or contact support.' }
  }

  // Sign out the current session and send to login
  await supabase.auth.signOut()
  redirect('/login')
}
