'use client'

import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface ReviewStep1InboxProps {
  inboxCount: number
  onNext: () => void
}

export function ReviewStep1Inbox({ inboxCount, onNext }: ReviewStep1InboxProps) {
  const [confirmed, setConfirmed] = useState(inboxCount === 0)

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
        Before reviewing your lists, make sure your inbox is at zero — every item has been
        captured and processed.
      </p>

      {/* Inbox count indicator */}
      <div
        className={cn(
          'flex items-center justify-between px-4 py-3 rounded-xl border',
          inboxCount === 0
            ? 'bg-emerald-500/[0.08] border-emerald-500/20'
            : 'bg-amber-500/[0.06] border-amber-500/20'
        )}
      >
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Current inbox count</span>
        <span
          className={cn(
            'text-xl font-semibold',
            inboxCount === 0 ? 'text-emerald-300' : 'text-amber-300'
          )}
        >
          {inboxCount}
        </span>
      </div>

      {/* Link to inbox */}
      {inboxCount > 0 && (
        <a
          href="/inbox"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-indigo-300 hover:text-indigo-200 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Open Inbox in new tab
        </a>
      )}

      {/* Confirmation checkbox */}
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="w-4 h-4 rounded accent-indigo-500"
        />
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>My inbox is at zero</span>
      </label>

      <button
        onClick={onNext}
        disabled={!confirmed}
        className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Continue →
      </button>
    </div>
  )
}
