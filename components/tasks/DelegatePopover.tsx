'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, X } from 'lucide-react'
import { delegateTask } from '@/lib/actions/tasks'

interface DelegatePopoverProps {
  taskId: string
  taskTitle: string
  onClose: () => void
}

export function DelegatePopover({ taskId, taskTitle, onClose }: DelegatePopoverProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [delegatedTo, setDelegatedTo] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [communicated, setCommunicated] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  // Close on click outside
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [onClose])

  function handleSubmit() {
    if (!delegatedTo.trim()) return
    startTransition(async () => {
      await delegateTask(taskId, delegatedTo, dueDate || undefined, communicated)
      router.refresh()
      onClose()
    })
  }

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 z-50 w-72 rounded-xl bg-[#1a1a2e]/95 backdrop-blur-xl border shadow-2xl shadow-black/40 animate-fade-in"
      style={{ borderColor: 'var(--border-default)' }}
      role="dialog"
      aria-label={`Delegate "${taskTitle}"`}
    >
      <div className="p-4 flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Delegate task</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg transition-all duration-150"
            style={{ color: 'var(--text-muted)' }}
            aria-label="Cancel delegation"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Delegated to */}
        <input
          type="text"
          placeholder="Who are you delegating this to?"
          value={delegatedTo}
          onChange={(e) => setDelegatedTo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && delegatedTo.trim()) handleSubmit()
          }}
          className="glass-input text-sm"
          autoFocus
          disabled={isPending}
        />

        {/* Due date */}
        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Deadline (optional)</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="glass-input text-sm"
            disabled={isPending}
          />
        </div>

        {/* Communicated checkbox */}
        <label className="flex items-center gap-2 cursor-pointer group/cb">
          <input
            type="checkbox"
            checked={communicated}
            onChange={(e) => setCommunicated(e.target.checked)}
            className="sr-only peer"
            disabled={isPending}
          />
          <span className="w-4 h-4 rounded flex items-center justify-center transition-all duration-150 peer-checked:bg-indigo-500/30 peer-checked:border-indigo-500/40 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500/50" style={{ border: '1px solid var(--border-default)', background: 'var(--bg-surface)' }}>
            {communicated && (
              <svg className="w-2.5 h-2.5 text-indigo-300" fill="none" viewBox="0 0 10 10" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M1.5 5l2.5 2.5 4.5-4.5" />
              </svg>
            )}
          </span>
          <span className="text-xs transition-colors" style={{ color: 'var(--text-tertiary)' }}>
            I have already notified them
          </span>
        </label>

        {/* Confirm */}
        <button
          onClick={handleSubmit}
          disabled={!delegatedTo.trim() || isPending}
          className="btn-primary text-sm"
        >
          {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          Confirm
        </button>
      </div>
    </div>
  )
}
