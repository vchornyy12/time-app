'use client'

import { useState, useOptimistic, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Inbox, Trash2, Clock, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { Task } from '@/lib/types'
import { EmptyState, ConfirmDeleteModal } from '@/components/ui'
import {
  removeCalendarTaskToTrash,
  moveCalendarTaskToInbox,
  rescheduleCalendarTask,
  syncNowCalendarTask,
} from '@/lib/actions/calendar'

// ── Types ─────────────────────────────────────────────────────

interface CalendarListProps {
  tasks: Task[]
  isGoogleConnected: boolean
}

interface DateGroup {
  label: string
  isOverdue: boolean
  items: Task[]
}

// ── List ──────────────────────────────────────────────────────

export function CalendarList({ tasks, isGoogleConnected }: CalendarListProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null)

  const [optimisticTasks, applyOptimistic] = useOptimistic(
    tasks,
    (state: Task[], taskId: string) => state.filter((t) => t.id !== taskId)
  )

  function handleConfirmDelete() {
    if (!pendingDelete) return
    const { id } = pendingDelete
    setPendingDelete(null)
    startTransition(async () => {
      applyOptimistic(id)
      await removeCalendarTaskToTrash(id)
      router.refresh()
    })
  }

  function handleMoveToInbox(taskId: string) {
    startTransition(async () => {
      applyOptimistic(taskId)
      await moveCalendarTaskToInbox(taskId)
      router.refresh()
    })
  }

  if (optimisticTasks.length === 0) {
    return (
      <EmptyState
        icon="📅"
        title="Nothing scheduled yet."
        description="Items you schedule during processing will appear here."
      />
    )
  }

  const groups = groupByDate(optimisticTasks)

  return (
    <>
      <div className="flex flex-col gap-7">
        {groups.map(({ label, isOverdue, items }) => (
          <section key={label}>
            <h2
              className={cn(
                'text-xs font-medium uppercase tracking-wide mb-2.5',
                isOverdue ? 'text-red-400/70' : ''
              )}
              style={isOverdue ? undefined : { color: 'var(--text-secondary)' }}
            >
              {label}
            </h2>
            <ul className="flex flex-col gap-2">
              {items.map((task) => (
                <CalendarCard
                  key={task.id}
                  task={task}
                  isGoogleConnected={isGoogleConnected}
                  onDelete={() => setPendingDelete({ id: task.id, title: task.title })}
                  onMoveToInbox={() => handleMoveToInbox(task.id)}
                  onRefresh={() => router.refresh()}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>

      <ConfirmDeleteModal
        open={!!pendingDelete}
        taskTitle={pendingDelete?.title ?? ''}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  )
}

// ── Card ──────────────────────────────────────────────────────

function CalendarCard({
  task,
  isGoogleConnected,
  onDelete,
  onMoveToInbox,
  onRefresh,
}: {
  task: Task
  isGoogleConnected: boolean
  onDelete: () => void
  onMoveToInbox: () => void
  onRefresh: () => void
}) {
  const [isRescheduling, setIsRescheduling] = useState(false)
  const [newDate, setNewDate] = useState(
    task.scheduled_at ? toLocalDatetimeValue(task.scheduled_at) : ''
  )
  const [isSyncing, startSyncTransition] = useTransition()
  const [isSavingReschedule, startRescheduleTransition] = useTransition()

  const timeStr = task.scheduled_at
    ? new Date(task.scheduled_at).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })
    : null

  const isSynced = !!task.google_calendar_event_id

  function handleSaveReschedule() {
    if (!newDate) return
    setIsRescheduling(false)
    startRescheduleTransition(async () => {
      await rescheduleCalendarTask(task.id, newDate)
      onRefresh()
    })
  }

  function handleSyncNow() {
    startSyncTransition(async () => {
      await syncNowCalendarTask(task.id)
      onRefresh()
    })
  }

  return (
    <li className="group flex items-start gap-3 px-4 py-4 rounded-xl border transition-all duration-150" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
      {/* Time column */}
      <div className="w-14 flex-shrink-0 text-right pt-0.5">
        {timeStr ? (
          <span className="text-sm tabular-nums" style={{ color: 'var(--text-secondary)' }}>{timeStr}</span>
        ) : (
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>—</span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-base leading-snug" style={{ color: 'var(--text-primary)' }}>{task.title}</p>

        {/* Sync status */}
        {isGoogleConnected && (
          <div className="flex items-center gap-2 mt-1.5">
            {isSynced ? (
              <span className="flex items-center gap-1 text-xs text-emerald-400/60">
                <CheckCircle2 className="w-3 h-3" />
                Synced
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-amber-400/60">
                <AlertTriangle className="w-3 h-3" />
                Not synced
                {!isSyncing ? (
                  <button
                    onClick={handleSyncNow}
                    className="ml-1 text-xs text-amber-300/80 hover:text-amber-200 underline underline-offset-2 transition-colors"
                  >
                    Sync now
                  </button>
                ) : (
                  <span className="ml-1 flex items-center gap-1 text-amber-300/60">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                    Syncing…
                  </span>
                )}
              </span>
            )}
          </div>
        )}

        {/* Reschedule inline input */}
        {isRescheduling && (
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <input
              type="datetime-local"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="glass-input text-xs py-1.5"
              autoFocus
            />
            <button
              onClick={handleSaveReschedule}
              disabled={!newDate || isSavingReschedule}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/20 text-indigo-300 hover:bg-indigo-500/25 transition-all disabled:opacity-50"
            >
              {isSavingReschedule ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                'Save'
              )}
            </button>
            <button
              onClick={() => setIsRescheduling(false)}
              className="text-xs transition-colors"
              style={{ color: 'var(--text-muted)' }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Hover / focus-within actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 flex-shrink-0 pt-0.5">
        <button
          onClick={() => setIsRescheduling((v) => !v)}
          className="p-1.5 rounded-lg transition-all duration-150"
          style={{ color: 'var(--text-muted)' }}
          aria-label="Reschedule"
          title="Reschedule"
        >
          <Clock className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onMoveToInbox}
          className="p-1.5 rounded-lg transition-all duration-150"
          style={{ color: 'var(--text-muted)' }}
          aria-label="Move back to Inbox"
          title="Back to Inbox"
        >
          <Inbox className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg hover:text-red-300 hover:bg-red-500/10 transition-all duration-150"
          style={{ color: 'var(--text-muted)' }}
          aria-label="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </li>
  )
}

// ── Date grouping ──────────────────────────────────────────────

function groupByDate(tasks: Task[]): DateGroup[] {
  const today = startOfToday()
  const map = new Map<string, Task[]>()

  for (const task of tasks) {
    const key = task.scheduled_at
      ? new Date(task.scheduled_at).toDateString()
      : '__no_date__'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(task)
  }

  return Array.from(map.entries()).map(([key, items]) => {
    if (key === '__no_date__') {
      return { label: 'No date set', isOverdue: false, items }
    }

    const date = new Date(key)
    const diffDays = Math.round((date.getTime() - today.getTime()) / 86_400_000)
    let label: string
    let isOverdue = false

    if (diffDays < 0) {
      label = `Overdue — ${formatGroupDate(date)}`
      isOverdue = true
    } else if (diffDays === 0) {
      label = 'Today'
    } else if (diffDays === 1) {
      label = 'Tomorrow'
    } else if (diffDays < 7) {
      label = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    } else {
      label = formatGroupDate(date)
    }

    return { label, isOverdue, items }
  })
}

function formatGroupDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

/** Converts ISO 8601 to the "YYYY-MM-DDTHH:mm" format required by datetime-local */
function toLocalDatetimeValue(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
