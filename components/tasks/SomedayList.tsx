'use client'

import { useState, useOptimistic, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { Inbox, Trash2, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { Task } from '@/lib/types'
import { moveToInbox, deleteTask, updateSomedayReviewDate } from '@/lib/actions/tasks'
import { EmptyState, ConfirmDeleteModal } from '@/components/ui'

// ── List ──────────────────────────────────────────────────────

interface SomedayListProps {
  tasks: Task[]
}

export function SomedayList({ tasks }: SomedayListProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null)

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

  function handleConfirmDelete() {
    if (!pendingDelete) return
    const { id } = pendingDelete
    setPendingDelete(null)
    startTransition(async () => {
      applyOptimistic(id)
      await deleteTask(id)
      router.refresh()
    })
  }

  if (optimisticTasks.length === 0) {
    return (
      <EmptyState
        icon="🌅"
        title="No deferred ideas yet."
        description="Things you might do someday will appear here."
      />
    )
  }

  return (
    <>
      <ul className="flex flex-col gap-2" aria-label="Someday / Maybe tasks">
        {optimisticTasks.map((task) => (
          <SomedayCard
            key={task.id}
            task={task}
            onMoveToInbox={() => handleMoveToInbox(task.id)}
            onDelete={() => setPendingDelete({ id: task.id, title: task.title })}
          />
        ))}
      </ul>

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

function SomedayCard({
  task,
  onMoveToInbox,
  onDelete,
}: {
  task: Task
  onMoveToInbox: () => void
  onDelete: () => void
}) {
  const router = useRouter()
  const [isEditingDate, setIsEditingDate] = useState(false)
  const [editDate, setEditDate] = useState(task.due_date ?? '')
  const [, startDateSave] = useTransition()

  const reviewOverdue =
    task.due_date && new Date(task.due_date + 'T00:00:00') <= startOfToday()

  function handleSaveReviewDate(dateValue: string | null) {
    setIsEditingDate(false)
    startDateSave(async () => {
      await updateSomedayReviewDate(task.id, dateValue)
      router.refresh()
    })
  }

  return (
    <li className="group flex items-start gap-3 px-4 py-4 rounded-xl border transition-all duration-150" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <p className="text-base leading-snug" style={{ color: 'var(--text-primary)' }}>{task.title}</p>
          {task.due_date && !isEditingDate && (
            <span
              className={cn(
                'flex-shrink-0 text-xs px-2 py-0.5 rounded-full mt-0.5',
                reviewOverdue
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
                  : ''
              )}
              style={reviewOverdue ? undefined : { background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}
            >
              {reviewOverdue ? 'Review now' : `Review ${formatReviewDate(task.due_date)}`}
            </span>
          )}
        </div>

        <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
        </p>

        {/* Inline review date editor */}
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
                onClick={() => handleSaveReviewDate(editDate || null)}
                className="text-xs text-indigo-300 hover:text-indigo-200 transition-colors"
              >
                Save
              </button>
              {task.due_date && (
                <button
                  onClick={() => handleSaveReviewDate(null)}
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
            aria-label={`Set review date for "${task.title}"`}
            title="Set review date"
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

function formatReviewDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
