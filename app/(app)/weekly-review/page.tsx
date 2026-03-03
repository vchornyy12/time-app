import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { WeeklyReviewFlow } from '@/components/review/WeeklyReviewFlow'
import { getLastWeeklyReview } from '@/lib/actions/preferences'

export const metadata: Metadata = { title: 'Weekly Review' }

export default async function WeeklyReviewPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ count: inboxCount }, lastReviewDate] = await Promise.all([
    supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'inbox'),
    getLastWeeklyReview(),
  ])

  return (
    <div className="max-w-2xl mx-auto">
      <WeeklyReviewFlow inboxCount={inboxCount ?? 0} lastReviewDate={lastReviewDate} />
    </div>
  )
}
