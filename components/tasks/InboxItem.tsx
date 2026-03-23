'use client'

import { useState, useTransition, useRef } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Trash2, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { updateTaskTitle } from '@/lib/actions/tasks'
import { useOverflowing } from '@/lib/hooks/useOverflowing'
import type { Task } from '@/lib/types'

const DBLCLICK_DELAY = 220 // ms

interface InboxItemProps {
  task: Task
  onDelete: () => void
  onProcess?: () => void
  onTitleClick?: () => void
  isNew?: boolean
}

export function InboxItem({ task, onDelete, onProcess, onTitleClick, isNew }: InboxItemProps) {
  const timeAgo = formatDistanceToNow(new Date(task.created_at), { addSuffix: true })
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(task.title)
  const [isPending, startTransition] = useTransition()
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { ref: titleRef, isOverflowing } = useOverflowing<HTMLButtonElement>()

  function startEdit() {
    setEditTitle(task.title)
    setIsEditing(true)
  }

  // Delay single-click so a double-click can cancel it and start editing instead
  function handleTitleClick() {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current)
      clickTimer.current = null
      startEdit()
    } else {
      clickTimer.current = setTimeout(() => {
        clickTimer.current = null
        onTitleClick?.()
      }, DBLCLICK_DELAY)
    }
  }

  function cancelEdit() {
    setEditTitle(task.title)
    setIsEditing(false)
  }

  function commitEdit() {
    const trimmed = editTitle.trim()
    if (!trimmed || trimmed === task.title) {
      cancelEdit()
      return
    }
    setIsEditing(false)
    startTransition(() => updateTaskTitle(task.id, trimmed))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitEdit()
    } else if (e.key === 'Escape') {
      cancelEdit()
    }
  }

  return (
    <li className={cn(
      'group flex items-center gap-3 px-4 py-4 rounded-xl border transition-colors duration-150',
      isNew && 'animate-slide-down-in'
    )} style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
      {/* Content */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            autoFocus
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={commitEdit}
            aria-label="Edit task title"
            className={cn(
              'bg-transparent border-b border-zinc-500 focus:border-[#3ECF8E] outline-none w-full',
              'text-base leading-snug transition-colors duration-150',
              isPending && 'opacity-50'
            )}
            style={{ color: 'var(--text-primary)' }}
          />
        ) : (
          <button
            ref={titleRef}
            type="button"
            onClick={handleTitleClick}
            className="text-base leading-snug text-left hover:text-indigo-300 transition-colors duration-150 cursor-pointer w-full truncate"
            style={{ color: 'var(--text-primary)' }}
            title={isOverflowing ? task.title : undefined}
          >
            {task.title}
          </button>
        )}
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{timeAgo}</p>
      </div>

      {/* Actions — visible on hover or keyboard focus within */}
      {!isEditing && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 flex-shrink-0">
          <button
            onClick={onDelete}
            className="p-2 rounded-lg hover:text-red-300 hover:bg-red-500/10 transition-all duration-150"
            style={{ color: 'var(--text-muted)' }}
            aria-label={`Delete "${task.title}"`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onProcess}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-600 dark:text-indigo-300 hover:text-indigo-700 dark:hover:text-white bg-indigo-500/10 hover:bg-indigo-500/20 transition-all duration-150"
            aria-label={`Process "${task.title}"`}
          >
            Process
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      )}
    </li>
  )
}
