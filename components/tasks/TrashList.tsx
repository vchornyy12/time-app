'use client'

import { useOptimistic, useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { RotateCcw, X } from 'lucide-react'
import type { Task } from '@/lib/types'
import { restoreTask, hardDeleteTask, emptyTrash } from '@/lib/actions/tasks'
import { EmptyState, Button } from '@/components/ui'

interface TrashListProps {
  tasks: Task[]
}

export function TrashList({ tasks }: TrashListProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [confirmEmpty, setConfirmEmpty] = useState(false)
  const [emptyPending, startEmpty] = useTransition()

  const [optimisticTasks, applyOptimistic] = useOptimistic(
    tasks,
    (state: Task[], taskId: string) => state.filter((t) => t.id !== taskId)
  )

  function handleRestore(taskId: string) {
    startTransition(async () => {
      applyOptimistic(taskId)
      await restoreTask(taskId)
      router.refresh()
    })
  }

  function handleHardDelete(taskId: string) {
    startTransition(async () => {
      applyOptimistic(taskId)
      await hardDeleteTask(taskId)
      router.refresh()
    })
  }

  function handleEmptyTrash() {
    startEmpty(async () => {
      await emptyTrash()
      setConfirmEmpty(false)
      router.refresh()
    })
  }

  if (tasks.length === 0) {
    return (
      <EmptyState
        icon="🗑️"
        title="Trash is empty."
        description="Deleted items will appear here."
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Empty Trash control */}
      <div className="flex items-center justify-end gap-3">
        {confirmEmpty ? (
          <>
            <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Permanently delete all {tasks.length} items?</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmEmpty(false)}
              disabled={emptyPending}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={emptyPending}
              onClick={handleEmptyTrash}
            >
              Delete all
            </Button>
          </>
        ) : (
          <Button
            variant="danger"
            size="sm"
            onClick={() => setConfirmEmpty(true)}
          >
            Empty Trash
          </Button>
        )}
      </div>

      {/* Task list */}
      <ul className="flex flex-col gap-2" aria-label="Trashed tasks">
        {optimisticTasks.map((task) => (
          <li
            key={task.id}
            className="group flex items-center gap-3 px-4 py-4 rounded-xl border transition-all duration-150"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
          >
            <div className="flex-1 min-w-0">
              <p className="text-base leading-snug line-through" style={{ color: 'var(--text-secondary)' }}>{task.title}</p>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                Deleted{' '}
                {formatDistanceToNow(new Date(task.updated_at), { addSuffix: true })}
              </p>
            </div>

            {/* Hover / focus-within actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 flex-shrink-0">
              <button
                onClick={() => handleRestore(task.id)}
                className="p-1.5 rounded-lg hover:text-green-300 hover:bg-green-500/10 transition-all duration-150"
                style={{ color: 'var(--text-muted)' }}
                aria-label={`Restore "${task.title}" to Inbox`}
                title="Restore to Inbox"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleHardDelete(task.id)}
                className="p-1.5 rounded-lg hover:text-red-300 hover:bg-red-500/10 transition-all duration-150"
                style={{ color: 'var(--text-muted)' }}
                aria-label={`Permanently delete "${task.title}"`}
                title="Delete permanently"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
