'use server'

import { redirect } from 'next/navigation'
import { authedClient } from '@/lib/actions/authed-action'
import { getGoogleIntegration } from '@/lib/google/integration'
import { deleteUserAttachments } from '@/lib/storage/delete-user-files'
import { revokeGoogleToken } from '@/lib/google/revoke'
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

  // Account deletion requires a recent login, not only knowledge of the email.
  const signedInAt = Date.parse(user.last_sign_in_at ?? '')
  if (!Number.isFinite(signedInAt) || Date.now() - signedInAt > 15 * 60 * 1000) {
    return { error: 'For security, sign out and sign in again before deleting your account.' }
  }
  // Check server configuration before any external or data deletion operation.
  let admin: ReturnType<typeof createAdminClient>
  try { admin = createAdminClient() } catch {
    return { error: 'Account deletion is temporarily unavailable. Please contact support.' }
  }
  try {
    const integration = await getGoogleIntegration(user.id)
    if (integration?.google_refresh_token) await revokeGoogleToken(integration.google_refresh_token)
    await deleteUserAttachments(admin, user.id)
  } catch {
    return { error: 'Could not finish account cleanup. Your account is still active; please retry.' }
  }
  // Auth deletion cascades all public rows in one database transaction. Do not
  // erase tasks before this succeeds. External cleanup is retryable, not atomic.
  const { error: adminError } = await admin.auth.admin.deleteUser(user.id)
  if (adminError) {
    return { error: 'Failed to delete account. Please try again or contact support.' }
  }

  // Sign out the current session and send to login
  await supabase.auth.signOut()
  redirect('/login')
}
