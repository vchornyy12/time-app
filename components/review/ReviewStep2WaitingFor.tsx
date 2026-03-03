'use client'

import { useState, useEffect, useTransition } from 'react'
import { CheckCircle2, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { createClient } from '@/lib/supabase/client'
import { markTaskDone, moveToNextActions } from '@/lib/actions/tasks'
import type { Task, ReviewItemSelection } from '@/lib/types'

interface ReviewStep2WaitingForProps {
  onNext: () => void
  onItemSelect?: (item: ReviewItemSelection) => void
}

export function ReviewStep2WaitingFor({ onNext, onItemSelect }: ReviewStep2WaitingForProps) {
  const [tasks, setTasks] = useState<Task[] | null>(null)
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
        .eq('status', 'waiting_for')
        .order('due_date', { ascending: true, nullsFirst: false })
      if (mounted) setTasks(data ?? [])
    }
    load()
    return () => { mounted = false }
  }, [])

  function handleDone(taskId: string) {
    setTasks((prev) => prev?.filter((t) => t.id !== taskId) ?? null)
    startTransition(async () => { await markTaskDone(taskId) })
  }

  function handleActivate(taskId: string) {
    setTasks((prev) => prev?.filter((t) => t.id !== taskId) ?? null)
    startTransition(async () => { await moveToNextActions(taskId) })
  }

  if (tasks === null) return <StepLoading />

  const today = startOfToday()

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
        Check each delegated item. Has it come back? Is it still relevant? Mark done or
        activate anything that needs action now.
      </p>

      {tasks.length === 0 ? (
        <EmptySection label="No waiting-for items." />
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Waiting for tasks">
          {tasks.map((task) => {
            const overdue = task.due_date && new Date(task.due_date + 'T00:00:00') < today
            return (
              <li
                key={task.id}
                className={cn(
                  'flex items-start gap-3 px-4 py-3.5 rounded-xl border',
                  overdue
                    ? 'bg-amber-500/[0.06] border-amber-500/20'
                    : ''
                )}
                style={!overdue ? { background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' } : undefined}
              >
                <div className="flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => onItemSelect?.({ type: 'task', id: task.id })}
                    className="text-sm leading-snug text-left hover:text-indigo-300 transition-colors"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {task.title}
                  </button>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {task.delegated_to && (
                      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>👤 {task.delegated_to}</span>
                    )}
                    {task.due_date && (
                      <span
                        className={cn(
                          'text-xs',
                          overdue ? 'text-amber-400' : ''
                        )}
                        style={!overdue ? { color: 'var(--text-tertiary)' } : undefined}
                      >
                        {overdue ? 'Overdue' : `Due ${formatDate(task.due_date)}`}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                  <button
                    onClick={() => handleDone(task.id)}
                    className="p-1.5 rounded-lg hover:text-emerald-300 hover:bg-emerald-500/10 transition-all duration-150"
                    style={{ color: 'var(--text-muted)' }}
                    title="Mark done"
                    aria-label={`Mark "${task.title}" as done`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleActivate(task.id)}
                    className="p-1.5 rounded-lg hover:text-indigo-300 hover:bg-indigo-500/10 transition-all duration-150"
                    style={{ color: 'var(--text-muted)' }}
                    title="Move to Next Actions"
                    aria-label={`Move "${task.title}" to Next Actions`}
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <button onClick={onNext} className="btn-primary mt-2">
        Waiting For reviewed →
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
        <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--bg-surface)' }} />
      ))}
    </div>
  )
}

function EmptySection({ label }: { label: string }) {
  return (
    <div className="px-4 py-5 rounded-xl border text-center text-sm" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)', color: 'var(--text-tertiary)' }}>
      {label} ✓
    </div>
  )
}
