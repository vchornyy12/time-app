import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getUser } from '@/lib/supabase/server'
import { LandingPage } from '@/components/marketing/LandingPage'
import { getLandingStats } from '@/lib/stats'

export const metadata: Metadata = {
  title: 'time24 — Your mind is for having ideas, not holding them.',
  description:
    'A modern, distraction-free task manager built strictly on the Getting Things Done methodology.',
}

export default async function RootPage() {
  const {
    data: { user },
  } = await getUser()
  if (user) redirect('/inbox')
  const stats = await getLandingStats()
  return <LandingPage stats={stats} />
}
