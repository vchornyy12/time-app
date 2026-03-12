import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getLogbookDays } from '@/lib/actions/logbook'
import { LogbookFeed } from '@/components/logbook/LogbookFeed'

export const metadata: Metadata = { title: 'Success Diary' }

export default async function LogbookPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch using UTC (tzOffset = 0). The client-side feed re-groups visually
  // using the browser's local timezone, which is accurate enough for display.
  const days = await getLogbookDays(0, 30)

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold gradient-heading">Success Diary</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            A record of everything you&apos;ve shipped.
          </p>
        </div>
        {days.length > 0 && (
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {days.length} {days.length === 1 ? 'day' : 'days'}
          </span>
        )}
      </div>

      <LogbookFeed initialDays={days} />
    </div>
  )
}
