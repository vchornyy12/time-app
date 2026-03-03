'use client'

import { useState, useOptimistic, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Inbox, Trash2, Check, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { Task } from '@/lib/types'
import {
  moveToInbox,
  deleteTask,
  toggleDelegationCommunicated,
  updateWaitingForDueDate,
} from '@/lib/actions/tasks'
import { EmptyState } from '@/components/ui'

// ── List ──────────────────────────────────────────────────────

interface WaitingForListProps {
  tasks: Task[]
}

export function WaitingForList({ tasks }: WaitingForListProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [optimisticTasks, applyOptimistic] = useOptimistic(
    tasks,
    (state: Task[], taskId: string) => state.filter((t) => t.id !== taskId)
  )

  function handleMoveToInbox(taskId: string) {
    startTransition(async () => {
      applyOptimistic(taskId)
      await moveToInbox(taskId)
      router.refresh()
    })
  }

  function handleDelete(taskId: string) {
    startTransition(async () => {
      applyOptimistic(taskId)
      await deleteTask(taskId)
      router.refresh()
    })
  }

  if (optimisticTasks.length === 0) {
    return (
      <EmptyState
        icon="⏳"
        title="Nothing delegated right now."
        description="Items waiting on others will appear here after you process them."
      />
    )
  }

  return (
    <ul className="flex flex-col gap-2" aria-label="Waiting for tasks">
      {optimisticTasks.map((task) => (
        <WaitingForCard
          key={task.id}
          task={task}
          onMoveToInbox={() => handleMoveToInbox(task.id)}
          onDelete={() => handleDelete(task.id)}
        />
      ))}
    </ul>
  )
}

// ── Card ──────────────────────────────────────────────────────

function WaitingForCard({
  task,
  onMoveToInbox,
  onDelete,
}: {
  task: Task
  onMoveToInbox: () => void
  onDelete: () => void
}) {
  const router = useRouter()
  const [communicated, setCommunicated] = useState(task.is_delegation_communicated)
  const [isEditingDate, setIsEditingDate] = useState(false)
  const [editDate, setEditDate] = useState(task.due_date ?? '')
  const [, startToggle] = useTransition()
  const [, startDateSave] = useTransition()

  const overdue =
    task.due_date && new Date(task.due_date + 'T00:00:00') < startOfToday()

  function handleToggle() {
    const next = !communicated
    setCommunicated(next)
    startToggle(async () => {
      await toggleDelegationCommunicated(task.id, next)
    })
  }

  function handleSaveDueDate(dateValue: string | null) {
    setIsEditingDate(false)
    startDateSave(async () => {
      await updateWaitingForDueDate(task.id, dateValue)
      router.refresh()
    })
  }

  return (
    <li className="group flex items-start gap-3 px-4 py-4 rounded-xl border transition-all duration-150" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
      {/* Status dot */}
      <div
        className={cn(
          'mt-2.5 w-2 h-2 rounded-full flex-shrink-0 transition-colors duration-300',
          communicated ? 'bg-green-400/60' : 'bg-amber-400'
        )}
        aria-hidden="true"
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <p className="text-base leading-snug" style={{ color: 'var(--text-primary)' }}>{task.title}</p>
          {task.due_date && !isEditingDate && (
            <span
              className={cn(
                'flex-shrink-0 text-sm px-2 py-0.5 rounded-full mt-0.5',
                overdue
                  ? 'bg-red-500/15 text-red-300 border border-red-500/20'
                  : ''
              )}
              style={overdue ? undefined : { background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}
            >
              {formatDueDate(task.due_date)}
            </span>
          )}
        </div>

        {/* Delegated to + toggle */}
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <span className="text-sm flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
            <span aria-hidden="true">👤</span>
            {task.delegated_to ?? '—'}
          </span>

          <button
            onClick={handleToggle}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all duration-200',
              communicated
                ? 'bg-green-500/15 border-green-500/25 text-green-300 hover:bg-green-500/20'
                : 'bg-amber-500/10 border-amber-500/20 text-amber-300 hover:bg-amber-500/15'
            )}
            aria-pressed={communicated}
            aria-label={
              communicated ? 'Mark as not yet communicated' : 'Mark as communicated'
            }
          >
            {communicated ? (
              <>
                <Check className="w-3 h-3" />
                Communicated
              </>
            ) : (
              'Not communicated'
            )}
          </button>

          {/* Context badges */}
          {task.contexts.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {task.contexts.map((ctx) => (
                <span
                  key={ctx}
                  className="text-sm px-2 py-0.5 rounded-full"
                  style={{ color: 'var(--text-secondary)', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
                >
                  {ctx}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Inline due date editor */}
        {isEditingDate && (
          <div className="mt-3 flex flex-col gap-2">
            <input
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              className="glass-input text-sm"
              autoFocus
            />
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleSaveDueDate(editDate || null)}
                className="text-xs text-indigo-300 hover:text-indigo-200 transition-colors"
              >
                Save
              </button>
              {task.due_date && (
                <button
                  onClick={() => handleSaveDueDate(null)}
                  className="text-xs transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Clear date
                </button>
              )}
              <button
                onClick={() => { setEditDate(task.due_date ?? ''); setIsEditingDate(false) }}
                className="text-xs transition-colors"
                style={{ color: 'var(--text-muted)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Hover / focus-within actions */}
      {!isEditingDate && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 flex-shrink-0 mt-0.5">
          <button
            onClick={() => { setEditDate(task.due_date ?? ''); setIsEditingDate(true) }}
            className="p-1.5 rounded-lg transition-all duration-150"
            style={{ color: 'var(--text-muted)' }}
            aria-label={`Set due date for "${task.title}"`}
            title="Set due date"
          >
            <Calendar className="w-3.5 h-3.5" />
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
      )}
    </li>
  )
}

// ── helpers ───────────────────────────────────────────────────

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function formatDueDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  const today = startOfToday()
  const diffDays = Math.round((date.getTime() - today.getTime()) / 86_400_000)
  if (diffDays < 0) return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · Overdue`
  if (diffDays === 0) return 'Due today'
  if (diffDays === 1) return 'Due tomorrow'
  return `Due ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}
