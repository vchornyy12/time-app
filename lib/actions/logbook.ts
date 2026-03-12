'use server'

import { revalidatePath } from 'next/cache'
import { authedClient } from '@/lib/actions/authed-action'
import { upsertReflectionSchema } from '@/lib/validation/schemas'
import { groupTasksByLocalDate } from '@/lib/utils/logbook'
import type { Task, DailyReflection, LogbookDay } from '@/lib/types'

// ── getLogbookDays ────────────────────────────────────────────

/**
 * Returns up to `limit` calendar days (newest first) on which the user
 * completed at least one task, merged with any saved daily reflections.
 *
 * @param tzOffsetMinutes - `new Date().getTimezoneOffset()` from the client
 * @param limit           - max number of distinct days to return (default 30)
 */
export async function getLogbookDays(
  tzOffsetMinutes: number,
  limit: number = 30,
  /** ISO timestamp — when set, only tasks completed strictly before this are returned */
  beforeTimestamp?: string
): Promise<LogbookDay[]> {
  const { supabase, user } = await authedClient()

  // Build the base query, optionally scoped to tasks older than the cursor
  const baseQuery = supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'done')
    .not('completed_at', 'is', null)

  const { data: rawTasks, error: tasksError } = await (
    beforeTimestamp ? baseQuery.lt('completed_at', beforeTimestamp) : baseQuery
  )
    .order('completed_at', { ascending: false })
    .limit(limit * 30)

  if (tasksError) throw tasksError
  if (!rawTasks || rawTasks.length === 0) return []

  const tasks = rawTasks as Task[]
  const grouped = groupTasksByLocalDate(tasks, tzOffsetMinutes)

  // Take only the first `limit` dates
  const limitedDates = Array.from(grouped.keys()).slice(0, limit)
  if (limitedDates.length === 0) return []

  // Fetch reflections for the date range in one query
  const { data: rawReflections, error: reflectionsError } = await supabase
    .from('daily_reflections')
    .select('*')
    .eq('user_id', user.id)
    .in('date', limitedDates)

  if (reflectionsError) throw reflectionsError

  const reflectionMap = new Map<string, DailyReflection>()
  const reflections = (rawReflections ?? []) as DailyReflection[]
  reflections.forEach((r) => reflectionMap.set(r.date, r))

  return limitedDates.map((date) => ({
    date,
    tasks: grouped.get(date) ?? [],
    reflection: reflectionMap.get(date) ?? null,
  }))
}

// ── upsertReflection ──────────────────────────────────────────

/**
 * Creates or updates the daily reflection for `date`.
 * Last-write wins; the UNIQUE (user_id, date) constraint makes this idempotent.
 */
export async function upsertReflection(date: string, content: string): Promise<void> {
  const parsed = upsertReflectionSchema.parse({ date, content })
  const { supabase, user } = await authedClient()

  const { error } = await supabase
    .from('daily_reflections')
    .upsert(
      { user_id: user.id, date: parsed.date, content: parsed.content },
      { onConflict: 'user_id,date' }
    )

  if (error) throw error
  revalidatePath('/logbook')
}
