'use client'

import { useOptimistic, useTransition, useState, useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils/cn'
import type { Task } from '@/lib/types'
import { markTaskDone } from '@/lib/actions/tasks'
import { TaskCard } from './TaskCard'
import { TaskDetailOverlay } from './TaskDetailOverlay'
import { EmptyState } from '@/components/ui'

export type TaskWithProject = Task & {
  projects: { title: string } | null
}

interface TaskListProps {
  tasks: TaskWithProject[]
  userContexts?: string[]
  initialContext?: string | null
  emptyTitle?: string
  emptyDescription?: string
  emptyIcon?: string
}

export function TaskList({
  tasks,
  userContexts = [],
  initialContext = null,
  emptyTitle = "You're all caught up.",
  emptyDescription = 'Enjoy the calm — nothing left to do right now.',
  emptyIcon = '⚡',
}: TaskListProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [activeContext, setActiveContext] = useState<string | null>(initialContext ?? null)
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const setContextFilter = useCallback(
    (ctx: string | null) => {
      setActiveContext(ctx)
      const params = new URLSearchParams(searchParams.toString())
      if (ctx) {
        params.set('context', ctx)
      } else {
        params.delete('context')
      }
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [router, pathname, searchParams]
  )

  const [optimisticTasks, applyOptimistic] = useOptimistic(
    tasks,
    (state: TaskWithProject[], taskId: string) => state.filter((t) => t.id !== taskId)
  )

  const [completingId, setCompletingId] = useState<string | null>(null)
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null)

  // Derive unique contexts from the full (non-optimistic) list so chips don't flicker
  const allContexts = [...new Set(tasks.flatMap((t) => t.contexts))].sort()

  // Apply context filter
  const filtered =
    activeContext !== null
      ? optimisticTasks.filter((t) => t.contexts.includes(activeContext))
      : optimisticTasks

  /** Step 1: trigger the CSS animation — don't remove yet */
  function handleComplete(task: TaskWithProject) {
    setCompletingId(task.id)
  }

  /** Step 2: called by onAnimationEnd — now actually remove and persist */
  function handleCompletionEnd(task: TaskWithProject) {
    setCompletingId(null)
    startTransition(async () => {
      applyOptimistic(task.id)
      await markTaskDone(task.id)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Context filter chips */}
      {allContexts.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Filter by context">
          <ContextChip
            label="All"
            active={activeContext === null}
            onClick={() => setContextFilter(null)}
          />
          {allContexts.map((ctx) => (
            <ContextChip
              key={ctx}
              label={ctx}
              active={activeContext === ctx}
              onClick={() => setContextFilter(activeContext === ctx ? null : ctx)}
            />
          ))}
        </div>
      )}

      {/* Task list */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={emptyIcon}
          title={activeContext ? `All caught up in ${activeContext}!` : emptyTitle}
          description={
            activeContext ? 'Time to change your context or take a break!' : emptyDescription
          }
        />
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Tasks">
          {filtered.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              projectTitle={task.projects?.title ?? null}
              userContexts={userContexts}
              onComplete={() => handleComplete(task)}
              isCompleting={completingId === task.id}
              onAnimationEnd={() => handleCompletionEnd(task)}
              onTitleClick={() => setDetailTaskId(task.id)}
            />
          ))}
        </ul>
      )}

      {/* Task detail slide-over */}
      <TaskDetailOverlay
        taskId={detailTaskId}
        onClose={() => setDetailTaskId(null)}
      />
    </div>
  )
}

// ── Context chip ──────────────────────────────────────────────

function ContextChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150',
        active
          ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
          : ''
      )}
      style={active ? undefined : { background: 'var(--bg-surface)', color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)' }}
    >
      {label}
    </button>
  )
}
