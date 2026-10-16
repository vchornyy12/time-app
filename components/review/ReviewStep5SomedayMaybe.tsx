'use client'

import { useState } from 'react'
import { Zap, Trash2, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useReviewTasks } from '@/lib/hooks/useReviewTasks'
import { ReviewError } from './ReviewError'
import { moveToNextActions, deleteTask, updateSomedayReviewDate } from '@/lib/actions/tasks'
import type { Task, ReviewItemSelection } from '@/lib/types'

interface ReviewStep5SomedayMaybeProps {
  onNext: () => void
  onItemSelect?: (item: ReviewItemSelection) => void
}

export function ReviewStep5SomedayMaybe({ onNext, onItemSelect }: ReviewStep5SomedayMaybeProps) {
  const { tasks, error, retry, isPending, remove, mutate } = useReviewTasks('someday_maybe')
  const [editingDateFor, setEditingDateFor] = useState<string | null>(null)
  const [editDate, setEditDate] = useState('')

  function handleActivate(taskId: string) {
    remove(taskId, () => moveToNextActions(taskId))
  }

  function handleTrash(taskId: string) {
    remove(taskId, () => deleteTask(taskId))
  }

  function openDateEditor(task: Task) {
    setEditDate(task.due_date ?? '')
    setEditingDateFor(task.id)
  }

  function handleSaveDate(taskId: string, date = editDate) {
    const newDate = date || null
    mutate(async () => {
      await updateSomedayReviewDate(taskId, newDate)
      setEditingDateFor(null)
    }, (tasks) => tasks.map((task) => task.id === taskId ? { ...task, due_date: newDate } : task))
  }

  if (tasks === null) return error ? <ReviewError error={error} retry={retry} /> : <StepLoading />

  const today = startOfToday()

  return (
    <div className="flex flex-col gap-4">
      {error && <ReviewError error={error} retry={retry} disabled={isPending} />}
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
        Is anything ready to activate? Archive what&apos;s no longer interesting, and update
        review dates to stay on top of the rest.
      </p>

      {tasks.length === 0 ? (
        <EmptySection label="No Someday / Maybe items." />
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Someday / Maybe tasks">
          {tasks.map((task) => {
            const reviewOverdue =
              task.due_date && new Date(task.due_date + 'T00:00:00') <= today
            const isEditing = editingDateFor === task.id

            return (
              <li
                key={task.id}
                className={cn(
                  'flex items-start gap-3 px-4 py-3.5 rounded-xl border transition-colors',
                  reviewOverdue
                    ? 'bg-amber-500/[0.06] border-amber-500/20'
                    : ''
                )}
                style={!reviewOverdue ? { background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' } : undefined}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onItemSelect?.({ type: 'task', id: task.id })}
                      className="text-sm leading-snug text-left hover:text-indigo-300 transition-colors"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {task.title}
                    </button>
                    {task.due_date && !isEditing && (
                      <span
                        className={cn(
                          'flex-shrink-0 text-xs px-2 py-0.5 rounded-full',
                          reviewOverdue
                            ? 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
                            : ''
                        )}
                        style={!reviewOverdue ? { background: 'var(--bg-surface-hover)', color: 'var(--text-tertiary)' } : undefined}
                      >
                        {reviewOverdue ? 'Review now' : formatDate(task.due_date)}
                      </span>
                    )}
                  </div>

                  {/* Inline date editor */}
                  {isEditing && (
                    <div className="mt-2 flex flex-col gap-2">
                      <input
                        type="date"
                        disabled={isPending}
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        className="glass-input text-sm"
                        autoFocus
                      />
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleSaveDate(task.id)}
                          disabled={isPending}
                          className="text-xs text-indigo-300 hover:text-indigo-200 transition-colors"
                        >
                          Save
                        </button>
                        {task.due_date && (
                          <button
                            onClick={() => handleSaveDate(task.id, '')}
                            disabled={isPending}
                            className="text-xs transition-colors"
                            style={{ color: 'var(--text-tertiary)' }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-secondary)' }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
                          >
                            Clear date
                          </button>
                        )}
                        <button
                          onClick={() => setEditingDateFor(null)}
                          className="text-xs transition-colors"
                          style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {!isEditing && (
                  <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                    <button
                      onClick={() => handleActivate(task.id)}
                        disabled={isPending}
                      className="p-1.5 rounded-lg hover:text-indigo-300 hover:bg-indigo-500/10 transition-all duration-150"
                      style={{ color: 'var(--text-muted)' }}
                      title="Activate — move to Next Actions"
                      aria-label={`Activate "${task.title}"`}
                    >
                      <Zap className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => openDateEditor(task)}
                      className="p-1.5 rounded-lg transition-all duration-150 hover:bg-black/[0.06] dark:hover:bg-white/[0.08] hover:text-indigo-500 dark:hover:text-white"
                      style={{ color: 'var(--text-muted)' }}
                      title="Update review date"
                      aria-label={`Update review date for "${task.title}"`}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleTrash(task.id)}
                        disabled={isPending}
                      className="p-1.5 rounded-lg transition-all duration-150 hover:text-red-500 dark:hover:text-red-300 hover:bg-red-500/10"
                      style={{ color: 'var(--text-muted)' }}
                      title="Archive to Trash"
                      aria-label={`Archive "${task.title}"`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <button onClick={onNext} disabled={isPending || error !== null} className="btn-primary mt-2">
        Someday / Maybe reviewed →
      </button>
    </div>
  )
}

// ── helpers ───────────────────────────────────────────────────

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function StepLoading() {
  return (
    <div className="flex flex-col gap-2">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: 'var(--bg-surface)' }} />
      ))}
    </div>
  )
}

function EmptySection({ label }: { label: string }) {
  return (
    <div
      className="px-4 py-5 rounded-xl text-center text-sm"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)' }}
    >
      {label} ✓
    </div>
  )
}
