'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, CheckCircle2, Link2Off } from 'lucide-react'
import { disconnectGoogleCalendar } from '@/lib/actions/calendar'

interface GoogleCalendarCardProps {
  isConnected: boolean
  errorMessage?: string
  justConnected?: boolean
}

export function GoogleCalendarCard({
  isConnected,
  errorMessage,
  justConnected,
}: GoogleCalendarCardProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleDisconnect() {
    startTransition(async () => {
      await disconnectGoogleCalendar()
      router.refresh()
    })
  }

  return (
    <div
      className="px-5 py-5 rounded-xl"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            {/* Google Calendar icon */}
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M19.5 3h-2.25V1.5h-1.5V3h-7.5V1.5h-1.5V3H4.5A1.5 1.5 0 003 4.5v15A1.5 1.5 0 004.5 21h15a1.5 1.5 0 001.5-1.5v-15A1.5 1.5 0 0019.5 3z"
              />
              <path fill="#fff" d="M4.5 9h15V4.5h-15V9z" />
              <path
                fill="#EA4335"
                d="M8.25 5.25h1.5v1.5h-1.5zM14.25 5.25h1.5v1.5h-1.5z"
              />
              <path
                fill="#34A853"
                d="M8.25 11.25h1.5v1.5h-1.5zM11.25 11.25h1.5v1.5h-1.5zM14.25 11.25h1.5v1.5h-1.5zM8.25 14.25h1.5v1.5h-1.5zM11.25 14.25h1.5v1.5h-1.5zM14.25 14.25h1.5v1.5h-1.5z"
              />
            </svg>
            <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Google Calendar</h3>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
            Sync calendar items to your Google Calendar automatically
          </p>
        </div>

        {/* Status badge */}
        {isConnected ? (
          <span className="flex-shrink-0 flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-emerald-500/12 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3 h-3" />
            Connected
          </span>
        ) : (
          <span
            className="flex-shrink-0 text-xs px-2.5 py-1 rounded-full"
            style={{
              background: 'var(--bg-surface-hover)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-tertiary)',
            }}
          >
            Not connected
          </span>
        )}
      </div>

      {/* Success message */}
      {justConnected && (
        <p className="mt-3 text-xs text-emerald-600 dark:text-emerald-400 animate-fade-in">
          ✓ Google Calendar connected — future calendar items will sync automatically
        </p>
      )}

      {/* Error message */}
      {errorMessage && (
        <p className="mt-3 text-xs text-red-500 dark:text-red-400 animate-fade-in">
          {errorMessage}
        </p>
      )}

      {/* Actions */}
      <div className="mt-4">
        {isConnected ? (
          <button
            onClick={handleDisconnect}
            disabled={isPending}
            className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg transition-all duration-150 disabled:opacity-50"
            style={{
              background: 'var(--bg-surface-hover)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-tertiary)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text-secondary)'
              e.currentTarget.style.background = 'var(--bg-surface-hover)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-tertiary)'
              e.currentTarget.style.background = 'var(--bg-surface-hover)'
            }}
          >
            {isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Link2Off className="w-3.5 h-3.5" />
            )}
            Disconnect
          </button>
        ) : (
          <a
            href="/api/google/auth"
            className="inline-flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/20 text-indigo-600 dark:text-indigo-300 hover:text-indigo-700 dark:hover:text-indigo-200 font-medium transition-all duration-150"
          >
            Connect Google Calendar
          </a>
        )}
      </div>
    </div>
  )
}
