'use client'

import { useState, useTransition } from 'react'
import { CalendarDays } from 'lucide-react'
import { captureTask } from '@/lib/actions/tasks'

interface ReviewStep2MindSweepProps {
  onNext: () => void
}

export function ReviewStep2MindSweep({ onNext }: ReviewStep2MindSweepProps) {
  const [thoughts, setThoughts] = useState('')
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

    startTransition(async () => {
      for (const line of lines) {
        await captureTask(line)
      }
      onNext()
    })
  }

  const hasContent = thoughts.trim().length > 0

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-white/50 leading-relaxed">
        Before reviewing your lists, empty your head — anything still floating around as
        commitments, ideas, or worries.
      </p>

      {/* Calendar reminder box */}
      <div className="flex gap-3 p-4 rounded-xl bg-white/[0.04] border border-white/[0.07]">
        <CalendarDays className="w-4 h-4 text-indigo-300 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-white/40 leading-relaxed">
          Also glance at{' '}
          <span className="text-white/60">last week&apos;s calendar</span> for missed
          follow-ups, and your{' '}
          <span className="text-white/60">upcoming week</span> for anything to prepare for.
        </p>
      </div>

      <textarea
        value={thoughts}
        onChange={(e) => setThoughts(e.target.value)}
        placeholder="One item per line (optional)"
        rows={6}
        className="glass-input resize-none text-sm"
        disabled={isPending}
        autoFocus
      />

      <button
        onClick={handleCapture}
        disabled={isPending}
        className="btn-primary"
      >
        {hasContent ? 'Capture to Inbox →' : 'Nothing to add →'}
      </button>
    </div>
  )
}
