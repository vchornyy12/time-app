'use client'

import { useOptimistic, useTransition, useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Task } from '@/lib/types'
import { deleteTask, restoreTask } from '@/lib/actions/tasks'
import { InboxItem } from './InboxItem'
import { ProcessingOverlay } from './ProcessingOverlay'
import { TaskDetailOverlay } from './TaskDetailOverlay'
import { EmptyState, Toast, ConfirmDeleteModal } from '@/components/ui'

interface InboxListProps {
  tasks: Task[]
  userContexts?: string[]
}

export function InboxList({ tasks, userContexts = [] }: InboxListProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  // Track which task IDs have already been rendered so we can identify new arrivals.
  // seenIds is only mutated inside the effect (never during render) — concurrent-mode safe.
  const seenIds = useRef(new Set(tasks.map((t) => t.id)))
  const [newIds, setNewIds] = useState(new Set<string>())

  useEffect(() => {
    const discovered = new Set<string>()
    for (const task of tasks) {
      if (!seenIds.current.has(task.id)) {
        discovered.add(task.id)
        seenIds.current.add(task.id)
      }
    }
    if (discovered.size > 0) setNewIds(discovered)
  }, [tasks])

  const [optimisticTasks, applyOptimistic] = useOptimistic(
    tasks,
    (state: Task[], taskId: string) => state.filter((t) => t.id !== taskId)
  )

  const [toast, setToast] = useState<{ taskId: string; title: string } | null>(null)
  const [processingTask, setProcessingTask] = useState<Task | null>(null)
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null)

  function handleDelete(task: Task) {
    setPendingDelete(task)
  }

  function handleConfirmDelete() {
    if (!pendingDelete) return
    const task = pendingDelete
    setPendingDelete(null)
    setToast({ taskId: task.id, title: task.title })
    startTransition(async () => {
      applyOptimistic(task.id)
      await deleteTask(task.id)
      router.refresh()
    })
  }

  function handleUndo() {
    if (!toast) return
    const { taskId } = toast
    setToast(null)
    startTransition(async () => {
      await restoreTask(taskId)
      router.refresh()
    })
  }

  if (optimisticTasks.length === 0 && !processingTask) {
    return (
      <EmptyState
        icon="🧠"
        title="Your mind is clear."
        description="Nothing to process. Capture something new or enjoy the calm."
      />
    )
  }

  return (
    <>
      <ul className="flex flex-col gap-2" aria-label="Inbox tasks">
        {optimisticTasks.map((task) => (
          <InboxItem
            key={task.id}
            task={task}
            onDelete={() => handleDelete(task)}
            onProcess={() => setProcessingTask(task)}
            onTitleClick={() => setDetailTaskId(task.id)}
            isNew={newIds.has(task.id)}
          />
        ))}
      </ul>

      {toast && (
        <Toast
          message={`"${toast.title.length > 40 ? toast.title.slice(0, 40) + '…' : toast.title}" moved to Trash`}
          onUndo={handleUndo}
          onDismiss={() => setToast(null)}
        />
      )}

      {processingTask && (
        <ProcessingOverlay
          task={processingTask}
          userContexts={userContexts}
          onClose={() => setProcessingTask(null)}
        />
      )}

      <TaskDetailOverlay
        taskId={detailTaskId}
        onClose={() => setDetailTaskId(null)}
      />

      <ConfirmDeleteModal
        open={!!pendingDelete}
        taskTitle={pendingDelete?.title ?? ''}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  )
}
