import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient, getUser } from '@/lib/supabase/server'
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
  } = await getUser()

  // Belt-and-suspenders: middleware already redirects, but guard here too
  if (!user) redirect('/login')

  const [inboxResult, preferencesResult] = await Promise.allSettled([
    supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'inbox'),
    supabase
      .from('user_preferences')
      .select('last_weekly_review')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])
  const inboxCount = inboxResult.status === 'fulfilled'
    ? inboxResult.value.count ?? 0 : 0
  const lastReviewDate = preferencesResult.status === 'fulfilled'
    ? preferencesResult.value.data?.last_weekly_review ?? null : null

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
