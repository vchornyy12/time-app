import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/supabase/server'
import { WeeklyReviewFlow } from '@/components/review/WeeklyReviewFlow'
import { getLastWeeklyReview } from '@/lib/actions/preferences'

export const metadata: Metadata = { title: 'Weekly Review' }

export default async function WeeklyReviewPage() {
  const {
    data: { user },
  } = await getUser()

  if (!user) redirect('/login')

  const lastReviewDate = await getLastWeeklyReview()

  return (
    <div className="max-w-2xl mx-auto">
      <WeeklyReviewFlow userId={user.id} lastReviewDate={lastReviewDate} />
    </div>
  )
}
