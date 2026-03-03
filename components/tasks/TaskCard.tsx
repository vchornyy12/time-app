'use client'

import { useState, useTransition } from 'react'
import { Loader2, Tag, UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { ContextPicker } from '@/components/ui/ContextPicker'
import { DelegatePopover } from '@/components/tasks/DelegatePopover'
import { updateTaskContexts } from '@/lib/actions/tasks'
import type { Task } from '@/lib/types'

interface TaskCardProps {
  task: Task
  projectTitle?: string | null
  userContexts?: string[]
  onComplete: () => void
  isCompleting?: boolean
  onAnimationEnd?: () => void
  onTitleClick?: () => void
}

export function TaskCard({ task, projectTitle, userContexts = [], onComplete, isCompleting, onAnimationEnd, onTitleClick }: TaskCardProps) {
  const overdue = isOverdue(task.due_date)
  const [isEditingContexts, setIsEditingContexts] = useState(false)
  const [isDelegating, setIsDelegating] = useState(false)
  const [editContexts, setEditContexts] = useState<string[]>(task.contexts)
  const [, startTransition] = useTransition()

  function handleSaveContexts() {
    startTransition(async () => {
      await updateTaskContexts(task.id, editContexts)
      setIsEditingContexts(false)
    })
  }

  function handleCancelContextEdit() {
    setEditContexts([...task.contexts])
    setIsEditingContexts(false)
  }

  return (
    <li
      className={cn(
        'group flex items-start gap-3 px-4 py-4 rounded-xl transition-colors duration-150',
        isCompleting && 'animate-task-complete-out pointer-events-none'
      )}
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--glass-panel-border)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--bg-surface-hover)'
        e.currentTarget.style.borderColor = 'var(--glass-border)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--bg-surface)'
        e.currentTarget.style.borderColor = 'var(--glass-panel-border)'
      }}
      onAnimationEnd={isCompleting ? onAnimationEnd : undefined}
    >
      {/* Complete button */}
      <button
        onClick={onComplete}
        className={cn(
          'mt-0.5 flex-shrink-0 w-[18px] h-[18px] rounded-full border-2 transition-all duration-150',
          'flex items-center justify-center',
          'border-[var(--text-muted)] hover:border-[#3ECF8E] hover:bg-[#3ECF8E]/15',
          'group/check'
        )}
        aria-label={`Mark "${task.title}" as done`}
      >
        <svg
          className="w-2.5 h-2.5 text-[#3ECF8E] opacity-0 group-hover/check:opacity-100 transition-opacity duration-150"
          fill="none"
          viewBox="0 0 10 10"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M1.5 5l2.5 2.5 4.5-4.5" />
        </svg>
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <button
          type="button"
          onClick={onTitleClick}
          className="text-base leading-snug text-left hover:text-[var(--accent)] transition-colors duration-150 cursor-pointer"
          style={{ color: 'var(--text-primary)' }}
        >
          {task.title}
        </button>

        {/* Metadata chips */}
        {!isEditingContexts && (projectTitle || task.contexts.length > 0) && (
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {projectTitle && (
              <span className="inline-flex items-center gap-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <span aria-hidden="true">📁</span>
                {projectTitle}
              </span>
            )}
            {task.contexts.map((ctx) => (
              <span
                key={ctx}
                className="text-sm px-2 py-0.5 rounded-full"
                style={{
                  color: 'var(--text-secondary)',
                  background: 'var(--chip-bg)',
                  border: '1px solid var(--chip-border)',
                }}
              >
                {ctx}
              </span>
            ))}
          </div>
        )}

        {/* Inline context editor */}
        {isEditingContexts && (
          <div className="mt-3">
            <ContextPicker value={editContexts} onChange={setEditContexts} userContexts={userContexts} />
            <div className="flex items-center gap-3 mt-3">
              <button
                onClick={handleSaveContexts}
                className="btn-primary py-1.5 text-xs"
              >
                Save
              </button>
              <button
                onClick={handleCancelContextEdit}
                className="text-xs transition-colors"
                style={{ color: 'var(--text-tertiary)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Due date badge */}
      {task.due_date && !isEditingContexts && (
        <span
          className={cn(
            'flex-shrink-0 text-sm px-2 py-0.5 rounded-full mt-0.5',
            overdue
              ? 'bg-red-500/15 text-red-400 dark:text-red-300 border border-red-500/20'
              : ''
          )}
          style={!overdue ? {
            background: 'var(--chip-bg)',
            color: 'var(--text-secondary)',
          } : undefined}
        >
          {formatDueDate(task.due_date)}
        </span>
      )}

      {/* Hover / focus-within actions */}
      {!isEditingContexts && (
        <div className="relative flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 flex-shrink-0">
          <button
            onClick={() => setIsDelegating(true)}
            className="p-1.5 rounded-lg transition-all duration-150"
            style={{ color: 'var(--text-muted)' }}
            aria-label={`Delegate "${task.title}"`}
            title="Delegate task"
          >
            <UserPlus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              setEditContexts([...task.contexts])
              setIsEditingContexts(true)
            }}
            className="p-1.5 rounded-lg transition-all duration-150"
            style={{ color: 'var(--text-muted)' }}
            aria-label={`Edit contexts for "${task.title}"`}
            title="Edit context tags"
          >
            <Tag className="w-3.5 h-3.5" />
          </button>
          {isDelegating && (
            <DelegatePopover
              taskId={task.id}
              taskTitle={task.title}
              onClose={() => setIsDelegating(false)}
            />
          )}
        </div>
      )}
    </li>
  )
}

// ── helpers ───────────────────────────────────────────────────

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(dateStr + 'T00:00:00') < today
}

function formatDueDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const diffDays = Math.round((date.getTime() - today.getTime()) / 86_400_000)

  if (diffDays < 0)  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays < 7)   return date.toLocaleDateString('en-US', { weekday: 'short' })

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
