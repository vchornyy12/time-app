import type { Task } from '@/lib/types'

// ── formatDayLabel ────────────────────────────────────────────

/**
 * Returns a human-readable label for a YYYY-MM-DD date string:
 * "Today", "Yesterday", or a short weekday + date (e.g. "Mon, 10 Mar 2025").
 * Uses the browser's local calendar for today/yesterday detection and UTC
 * noon to avoid off-by-one errors when formatting the fallback label.
 */
export function formatDayLabel(date: string): string {
  const today     = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  const toLocalISO = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  if (date === toLocalISO(today))     return 'Today'
  if (date === toLocalISO(yesterday)) return 'Yesterday'

  return new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', {
    weekday: 'short',
    day:     'numeric',
    month:   'short',
    year:    'numeric',
    timeZone: 'UTC',
  })
}

// ── groupTasksByLocalDate ─────────────────────────────────────

/**
 * Groups a flat list of completed tasks into YYYY-MM-DD buckets using the
 * viewer's UTC offset (minutes, as returned by `new Date().getTimezoneOffset()`).
 *
 * - Positive offset = west of UTC  (e.g. UTC-5 → 300)
 * - Negative offset = east of UTC  (e.g. UTC+5:30 → -330)
 * - Tasks with null `completed_at` are silently excluded.
 *
 * @returns Map<'YYYY-MM-DD', Task[]> with keys in newest-first order.
 */
export function groupTasksByLocalDate(
  tasks: Task[],
  tzOffsetMinutes: number
): Map<string, Task[]> {
  const withDates: Array<{ task: Task; localDate: string }> = []

  for (const task of tasks) {
    if (task.completed_at === null) continue

    const utcMs = new Date(task.completed_at).getTime()
    // local time = UTC − tzOffset  (UTC-5: localMs = utcMs − 300*60000)
    const localMs = utcMs - tzOffsetMinutes * 60_000
    const d = new Date(localMs)

    const year  = d.getUTCFullYear()
    const month = String(d.getUTCMonth() + 1).padStart(2, '0')
    const day   = String(d.getUTCDate()).padStart(2, '0')
    withDates.push({ task, localDate: `${year}-${month}-${day}` })
  }

  // Sort descending so Map insertion order equals newest-first
  withDates.sort((a, b) => b.localDate.localeCompare(a.localDate))

  const map = new Map<string, Task[]>()
  for (const { task, localDate } of withDates) {
    const bucket = map.get(localDate)
    if (bucket) {
      bucket.push(task)
    } else {
      map.set(localDate, [task])
    }
  }

  return map
}
