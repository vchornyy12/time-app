import { unstable_cache } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type LandingStats = { userCount: number; taskCount: number }

const FALLBACK: LandingStats = { userCount: 120, taskCount: 4800 }

async function fetchStats(): Promise<LandingStats> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('get_public_stats')
    if (error || !data) return FALLBACK
    return {
      userCount: data.user_count ?? FALLBACK.userCount,
      taskCount: data.task_count ?? FALLBACK.taskCount,
    }
  } catch {
    return FALLBACK
  }
}

// In dev: skip disk cache so restarts always fetch fresh data.
// In prod: cache for 1 hour to avoid hammering Supabase on every page load.
export const getLandingStats =
  process.env.NODE_ENV === 'development'
    ? fetchStats
    : unstable_cache(fetchStats, ['landing-stats'], { revalidate: 3600 })
