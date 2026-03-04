import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { LandingPage } from '@/components/marketing/LandingPage'

export const metadata: Metadata = {
  title: 'time24 — Your mind is for having ideas, not holding them.',
  description:
    'A modern, distraction-free task manager built strictly on the Getting Things Done methodology.',
}

export default async function RootPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) redirect('/inbox')
  return <LandingPage />
}
