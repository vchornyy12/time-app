'use client'

/**
 * Reusable list for Someday/Maybe and Notes.
 * Each item can be moved back to Inbox or soft-deleted.
 */

import { useOptimistic, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { Inbox, Trash2 } from 'lucide-react'
import type { Task } from '@/lib/types'
import { moveToInbox, deleteTask } from '@/lib/actions/tasks'
import { EmptyState } from '@/components/ui'

interface SimpleListProps {
  tasks: Task[]
  emptyIcon?: string
  emptyTitle: string
  emptyDescription?: string
}

export function SimpleList({
  tasks,
  emptyIcon,
  emptyTitle,
  emptyDescription,
}: SimpleListProps) {
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
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription}
      />
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {optimisticTasks.map((task) => (
        <li
          key={task.id}
          className="group flex items-center gap-3 px-4 py-4 rounded-xl border transition-all duration-150"
          style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-base leading-snug" style={{ color: 'var(--text-primary)' }}>{task.title}</p>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
            </p>
          </div>

          {/* Hover / focus-within actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 flex-shrink-0">
            <button
              onClick={() => handleMoveToInbox(task.id)}
              className="p-1.5 rounded-lg transition-all duration-150"
              style={{ color: 'var(--text-muted)' }}
              aria-label={`Move "${task.title}" back to Inbox`}
              title="Back to Inbox"
            >
              <Inbox className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleDelete(task.id)}
              className="p-1.5 rounded-lg hover:text-red-300 hover:bg-red-500/10 transition-all duration-150"
              style={{ color: 'var(--text-muted)' }}
              aria-label={`Delete "${task.title}"`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
