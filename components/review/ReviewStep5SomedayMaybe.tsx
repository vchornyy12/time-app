'use client'

import { useState, useEffect, useTransition } from 'react'
import { Zap, Trash2, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { createClient } from '@/lib/supabase/client'
import { moveToNextActions, deleteTask, updateSomedayReviewDate } from '@/lib/actions/tasks'
import type { Task, ReviewItemSelection } from '@/lib/types'

interface ReviewStep5SomedayMaybeProps {
  onNext: () => void
  onItemSelect?: (item: ReviewItemSelection) => void
}

export function ReviewStep5SomedayMaybe({ onNext, onItemSelect }: ReviewStep5SomedayMaybeProps) {
  const [tasks, setTasks] = useState<Task[] | null>(null)
  const [editingDateFor, setEditingDateFor] = useState<string | null>(null)
  const [editDate, setEditDate] = useState('')
  const [, startTransition] = useTransition()

  useEffect(() => {
    let mounted = true
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !mounted) return
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'someday_maybe')
        .order('due_date', { ascending: true, nullsFirst: false })
      if (mounted) setTasks(data ?? [])
    }
    load()
    return () => { mounted = false }
  }, [])

  function handleActivate(taskId: string) {
    setTasks((prev) => prev?.filter((t) => t.id !== taskId) ?? null)
    startTransition(async () => { await moveToNextActions(taskId) })
  }

  function handleTrash(taskId: string) {
    setTasks((prev) => prev?.filter((t) => t.id !== taskId) ?? null)
    startTransition(async () => { await deleteTask(taskId) })
  }

  function openDateEditor(task: Task) {
    setEditDate(task.due_date ?? '')
    setEditingDateFor(task.id)
  }

  function handleSaveDate(taskId: string) {
    const newDate = editDate || null
    setTasks((prev) =>
      prev?.map((t) => (t.id === taskId ? { ...t, due_date: newDate } : t)) ?? null
    )
    setEditingDateFor(null)
    startTransition(async () => { await updateSomedayReviewDate(taskId, newDate) })
  }

  if (tasks === null) return <StepLoading />

  const today = startOfToday()

  return (
    <div className="flex flex-col gap-4">
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
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        className="glass-input text-sm"
                        autoFocus
                      />
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleSaveDate(task.id)}
                          className="text-xs text-indigo-300 hover:text-indigo-200 transition-colors"
                        >
                          Save
                        </button>
                        {task.due_date && (
                          <button
                            onClick={() => { setEditDate(''); handleSaveDate(task.id) }}
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

      <button onClick={onNext} className="btn-primary mt-2">
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
