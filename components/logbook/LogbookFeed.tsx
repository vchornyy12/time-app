'use client'

import { useState, useTransition } from 'react'
import { CheckCircle } from '@phosphor-icons/react'
import type { LogbookDay } from '@/lib/types'
import { formatDayLabel } from '@/lib/utils/logbook'
import { getLogbookDays } from '@/lib/actions/logbook'
import { LogbookEmptyState } from './EmptyState'
import { ReflectionTextarea } from './ReflectionTextarea'

const PAGE_SIZE = 30

interface LogbookFeedProps {
  initialDays: LogbookDay[]
}

export function LogbookFeed({ initialDays }: LogbookFeedProps) {
  const [days, setDays]     = useState(initialDays)
  const [hasMore, setHasMore] = useState(initialDays.length >= PAGE_SIZE)
  const [isPending, startTransition] = useTransition()

  if (days.length === 0) {
    return <LogbookEmptyState />
  }

  function loadMore() {
    // Cursor = earliest completed_at across all tasks in the oldest visible day
    const oldestDayTasks = days[days.length - 1]?.tasks ?? []
    const cursor = oldestDayTasks
      .map((t) => t.completed_at)
      .filter(Boolean)
      .sort()
      .at(0)

    if (!cursor) return

    startTransition(async () => {
      const more = await getLogbookDays(
        new Date().getTimezoneOffset(),
        PAGE_SIZE,
        cursor
      )
      setHasMore(more.length >= PAGE_SIZE)
      setDays((prev) => [...prev, ...more])
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {days.map((day) => (
        <DaySection key={day.date} day={day} />
      ))}

      {hasMore && (
        <div className="flex justify-center pt-2 pb-6">
          <button
            onClick={loadMore}
            disabled={isPending}
            className="px-4 py-2 text-sm rounded-lg transition-colors duration-150 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            style={{
              background: 'var(--nav-hover-bg)',
              color:      'var(--text-secondary)',
              border:     '1px solid var(--border)',
            }}
          >
            {isPending ? 'Loading…' : 'Load earlier entries'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── DaySection ────────────────────────────────────────────────

function DaySection({ day }: { day: LogbookDay }) {
  return (
    <section
      role="region"
      aria-label={`Tasks completed on ${day.date}`}
      className="rounded-xl p-5"
      style={{
        background: 'var(--card-bg)',
        border:     '1px solid var(--border)',
      }}
    >
      <DayHeader date={day.date} taskCount={day.tasks.length} />

      <ul className="mt-3 flex flex-col gap-1.5" aria-label={`Completed tasks for ${day.date}`}>
        {day.tasks.map((task) => (
          <li key={task.id} className="flex items-start gap-2.5">
            <CheckCircle
              size={16}
              weight="fill"
              className="mt-0.5 flex-shrink-0"
              style={{ color: '#3ECF8E' }}
              aria-hidden="true"
            />
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {task.title}
            </span>
          </li>
        ))}
      </ul>

      <ReflectionTextarea
        date={day.date}
        initialContent={day.reflection?.content ?? ''}
      />
    </section>
  )
}

// ── DayHeader ─────────────────────────────────────────────────

function DayHeader({ date, taskCount }: { date: string; taskCount: number }) {
  return (
    <div className="flex items-baseline justify-between">
      <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
        {formatDayLabel(date)}
      </h2>
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
      </span>
    </div>
  )
}
