'use client'

import { useState, useTransition } from 'react'
import { CalendarDays } from 'lucide-react'
import { useReviewDraft } from '@/lib/hooks/useReviewDraft'
import { captureTask } from '@/lib/actions/tasks'

interface ReviewStep2MindSweepProps {
  onNext: () => void
  userId: string
}

export function ReviewStep2MindSweep({ onNext, userId }: ReviewStep2MindSweepProps) {
  const [draft, setDraft] = useReviewDraft(userId)
  const thoughts = draft.text
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleCapture() {
    const lines = thoughts
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)

    if (lines.length === 0) {
      onNext()
      return
    }

    if (lines.some((line) => line.length > 500)) {
      setError('Each item must be 500 characters or fewer. Please shorten it before capturing.')
      return
    }
    const requests = draft.requests.length > 0 ? draft.requests : lines.map((title) => ({ id: crypto.randomUUID(), title }))
    setDraft({ text: thoughts, requests })
    setError(null)
    startTransition(async () => {
      try {
        for (let index = 0; index < requests.length; index++) {
          await captureTask(requests[index].title, requests[index].id)
          const remaining = requests.slice(index + 1)
          setDraft({ text: remaining.map((request) => request.title).join('\n'), requests: remaining })
        }
        onNext()
      } catch {
        setError('Some items could not be confirmed. Your remaining items are kept here; retry safely.')
      }
    })
  }

  const hasContent = thoughts.trim().length > 0

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
        Before reviewing your lists, empty your head — anything still floating around as
        commitments, ideas, or worries.
      </p>

      {/* Calendar reminder box */}
      <div
        className="flex gap-3 p-4 rounded-xl"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
      >
        <CalendarDays className="w-4 h-4 text-indigo-500 dark:text-indigo-300 flex-shrink-0 mt-0.5" />
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
          Also glance at{' '}
          <span style={{ color: 'var(--text-secondary)' }}>last week&apos;s calendar</span> for missed
          follow-ups, and your{' '}
          <span style={{ color: 'var(--text-secondary)' }}>upcoming week</span> for anything to prepare for.
        </p>
      </div>

      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      <textarea
        value={thoughts}
        onChange={(e) => setDraft({ text: e.target.value, requests: [] })}
        placeholder="One item per line (optional)"
        rows={6}
        className="glass-input resize-none text-sm"
        disabled={isPending || draft.requests.length > 0}
        autoFocus
      />

      <button
        onClick={handleCapture}
        disabled={isPending}
        className="btn-primary"
      >
        {isPending ? 'Capturing…' : error && draft.requests.length > 0 ? 'Retry capture →' : hasContent ? 'Capture to Inbox →' : 'Nothing to add →'}
      </button>
    </div>
  )
}
