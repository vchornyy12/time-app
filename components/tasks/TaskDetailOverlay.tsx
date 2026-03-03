'use client'

import { ResponsiveOverlay } from '@/components/ui'
import { TaskDetailPanel } from './TaskDetailPanel'

interface TaskDetailOverlayProps {
  taskId: string | null
  onClose: () => void
}

export function TaskDetailOverlay({ taskId, onClose }: TaskDetailOverlayProps) {
  return (
    <ResponsiveOverlay open={taskId !== null} onClose={onClose} title="Task Details">
      {taskId && <TaskDetailPanel taskId={taskId} />}
    </ResponsiveOverlay>
  )
}
