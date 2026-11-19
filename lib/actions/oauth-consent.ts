'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { safeClientRedirect } from '@/lib/mcp/redirect'

const authorizationId = z.string().trim().min(1).max(200).regex(/^[A-Za-z0-9_-]+$/)

async function decide(rawId: unknown, approve: boolean) {
  const id = authorizationId.safeParse(rawId)
  if (!id.success) redirect('/oauth/consent?error=invalid_request')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data, error } = approve
    ? await supabase.auth.oauth.approveAuthorization(id.data, { skipBrowserRedirect: true })
    : await supabase.auth.oauth.denyAuthorization(id.data, { skipBrowserRedirect: true })
  if (error || !data?.redirect_url) redirect('/oauth/consent?error=expired')
  const target = safeClientRedirect(data.redirect_url)
  if (!target) redirect('/oauth/consent?error=invalid_redirect')
  redirect(target)
}

export async function approveConnector(formData: FormData) {
  await decide(formData.get('authorization_id'), true)
}

export async function denyConnector(formData: FormData) {
  await decide(formData.get('authorization_id'), false)
}
