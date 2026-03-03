'use client'

import { useState, useEffect, useTransition } from 'react'
import { CheckCircle2, Bookmark, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { markTaskDone, deleteTask } from '@/lib/actions/tasks'
import { processToSomedayMaybe } from '@/lib/actions/processing'
import type { Task, ReviewItemSelection } from '@/lib/types'

interface ReviewStep4NextActionsProps {
  onNext: () => void
  onItemSelect?: (item: ReviewItemSelection) => void
}

export function ReviewStep4NextActions({ onNext, onItemSelect }: ReviewStep4NextActionsProps) {
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
        .eq('status', 'next_actions')
        .order('created_at', { ascending: false })
      if (mounted) setTasks(data ?? [])
    }
    load()
    return () => { mounted = false }
  }, [])

  function handleDone(taskId: string) {
    setTasks((prev) => prev?.filter((t) => t.id !== taskId) ?? null)
    startTransition(async () => { await markTaskDone(taskId) })
  }

  function handleDefer(taskId: string) {
    setTasks((prev) => prev?.filter((t) => t.id !== taskId) ?? null)
    startTransition(async () => { await processToSomedayMaybe(taskId) })
  }

  function handleTrash(taskId: string) {
    setTasks((prev) => prev?.filter((t) => t.id !== taskId) ?? null)
    startTransition(async () => { await deleteTask(taskId) })
  }

  if (tasks === null) return <StepLoading />

  const groups = groupByContext(tasks)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
        Review each next action. Mark done anything completed, defer what isn&apos;t timely,
        or trash what&apos;s no longer relevant.
      </p>

      {tasks.length === 0 ? (
        <EmptySection label="No next actions." />
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map(({ ctx, tasks: groupTasks }) => (
            <div key={ctx ?? '__none__'}>
              {/* Context header */}
              <p className="text-xs font-medium uppercase tracking-wider mb-2 px-1" style={{ color: 'var(--text-muted)' }}>
                {ctx ?? 'No context'}
              </p>
              <ul className="flex flex-col gap-1.5">
                {groupTasks.map((task) => (
                  <li
                    key={task.id}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border"
                    style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
                  >
                    <button
                      type="button"
                      onClick={() => onItemSelect?.({ type: 'task', id: task.id })}
                      className="flex-1 min-w-0 text-sm leading-snug truncate text-left hover:text-indigo-300 transition-colors"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {task.title}
                    </button>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleDone(task.id)}
                        className="p-1.5 rounded-lg hover:text-emerald-300 hover:bg-emerald-500/10 transition-all duration-150"
                        style={{ color: 'var(--text-muted)' }}
                        title="Mark done"
                        aria-label={`Mark "${task.title}" as done`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDefer(task.id)}
                        className="p-1.5 rounded-lg hover:text-purple-300 hover:bg-purple-500/10 transition-all duration-150"
                        style={{ color: 'var(--text-muted)' }}
                        title="Defer to Someday/Maybe"
                        aria-label={`Defer "${task.title}" to Someday/Maybe`}
                      >
                        <Bookmark className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleTrash(task.id)}
                        className="p-1.5 rounded-lg hover:text-red-300 hover:bg-red-500/10 transition-all duration-150"
                        style={{ color: 'var(--text-muted)' }}
                        title="Move to Trash"
                        aria-label={`Move "${task.title}" to trash`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <button onClick={onNext} className="btn-primary mt-2">
        Next Actions reviewed →
      </button>
    </div>
  )
}

// ── helpers ───────────────────────────────────────────────────

type Group = { ctx: string | null; tasks: Task[] }

function groupByContext(tasks: Task[]): Group[] {
  const ungrouped: Task[] = []
  const grouped = new Map<string, Task[]>()

  for (const task of tasks) {
    if (task.contexts.length === 0) {
      ungrouped.push(task)
    } else {
      const ctx = task.contexts[0]
      if (!grouped.has(ctx)) grouped.set(ctx, [])
      grouped.get(ctx)!.push(task)
    }
  }

  const result: Group[] = []
  grouped.forEach((ts, ctx) => result.push({ ctx, tasks: ts }))
  result.sort((a, b) => (a.ctx ?? '').localeCompare(b.ctx ?? ''))
  if (ungrouped.length > 0) result.push({ ctx: null, tasks: ungrouped })
  return result
}

function StepLoading() {
  return (
    <div className="flex flex-col gap-2">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: 'var(--bg-surface)' }} />
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
