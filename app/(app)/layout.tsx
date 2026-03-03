import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppLayout } from '@/components/layout'

// Authenticated app pages should never be indexed by search engines
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function AppRouteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Belt-and-suspenders: middleware already redirects, but guard here too
  if (!user) redirect('/login')

  let inboxCount = 0
  let lastReviewDate: string | null = null

  try {
    const { count } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'inbox')

    inboxCount = count ?? 0
  } catch {
    // DB not yet set up — silently fall back to 0
  }

  try {
    const { data: prefs } = await supabase
      .from('user_preferences')
      .select('last_weekly_review')
      .eq('user_id', user.id)
      .single()
    lastReviewDate = prefs?.last_weekly_review ?? null
  } catch {
    // user_preferences table not yet created — silently fall back to null
  }

  return (
    <AppLayout
      inboxCount={inboxCount}
      lastReviewDate={lastReviewDate}
      userEmail={user.email ?? ''}
    >
      {children}
    </AppLayout>
  )
}
