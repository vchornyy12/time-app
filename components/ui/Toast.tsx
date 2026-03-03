'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface ToastProps {
  message: string
  onUndo?: () => void
  onDismiss: () => void
  duration?: number
}

export function Toast({ message, onUndo, onDismiss, duration = 5000 }: ToastProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    timerRef.current = setTimeout(onDismiss, duration)
    return () => clearTimeout(timerRef.current)
  }, [onDismiss, duration])

  function dismiss() {
    clearTimeout(timerRef.current)
    onDismiss()
  }

  function undo() {
    clearTimeout(timerRef.current)
    onUndo?.()
  }

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up"
      role="status"
      aria-live="polite"
    >
      <div className="glass-card flex items-center gap-3 px-4 py-3 min-w-64">
        <p className="text-sm flex-1" style={{ color: 'var(--text-secondary)' }}>{message}</p>
        {onUndo && (
          <button
            onClick={undo}
            className="text-sm font-medium text-indigo-500 dark:text-indigo-300 hover:text-indigo-400 dark:hover:text-indigo-200 transition-colors flex-shrink-0"
          >
            Undo
          </button>
        )}
        <button
          onClick={dismiss}
          className="p-1 rounded-md transition-colors flex-shrink-0"
          style={{ color: 'var(--text-muted)' }}
          aria-label="Dismiss notification"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
