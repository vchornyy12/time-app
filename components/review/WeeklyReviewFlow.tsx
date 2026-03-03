'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { X, ClipboardList } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { ResponsiveOverlay } from '@/components/ui'
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel'
import { ProjectDetailPanel } from '@/components/projects/ProjectDetailPanel'
import { ReviewStep1Inbox } from './ReviewStep1Inbox'
import { ReviewStep2MindSweep } from './ReviewStep2MindSweep'
import { ReviewStep2WaitingFor } from './ReviewStep2WaitingFor'
import { ReviewStep3Projects } from './ReviewStep3Projects'
import { ReviewStep4NextActions } from './ReviewStep4NextActions'
import { ReviewStep5SomedayMaybe } from './ReviewStep5SomedayMaybe'
import { ReviewStep6Summary } from './ReviewStep6Summary'
import type { ReviewItemSelection } from '@/lib/types'

const STEP_NAMES: Record<number, string> = {
  1: 'Get Clear',
  2: 'Mind Sweep',
  3: 'Review Waiting For',
  4: 'Review Projects',
  5: 'Review Next Actions',
  6: 'Review Someday / Maybe',
  7: 'Summary',
}

const STEP_DESCRIPTIONS: Record<number, string> = {
  1: 'Process all inbox items to zero',
  2: "Empty your head — capture what's still floating",
  3: 'Follow up on delegated tasks',
  4: 'Ensure each project has a next action',
  5: 'Prune and update your action list',
  6: 'Activate what matters now',
  7: 'Your week in review',
}

interface WeeklyReviewFlowProps {
  inboxCount: number
  lastReviewDate: string | null
}

export function WeeklyReviewFlow({ inboxCount, lastReviewDate }: WeeklyReviewFlowProps) {
  const router = useRouter()
  const [step, setStep] = useState(0)  // 0 = intro, 1-7 = steps
  const [selectedItem, setSelectedItem] = useState<ReviewItemSelection | null>(null)

  function advance() {
    setStep((s) => s + 1)
  }

  const handleItemSelect = useCallback((item: ReviewItemSelection) => {
    setSelectedItem(item)
  }, [])

  const handleOverlayClose = useCallback(() => {
    setSelectedItem(null)
  }, [])

  // ── Intro screen ──────────────────────────────────────────
  if (step === 0) {
    const lastReviewLabel = lastReviewDate
      ? `Last reviewed ${formatLastReview(lastReviewDate)}`
      : 'Never reviewed'

    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Weekly Review</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{lastReviewLabel}</p>
        </div>

        <div className="rounded-2xl border p-6 flex flex-col gap-5" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
              <ClipboardList className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>7-step review</p>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>~15 minutes</p>
            </div>
          </div>

          <ul className="flex flex-col gap-2">
            {([1, 2, 3, 4, 5, 6, 7] as const).map((n) => (
              <li key={n} className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0" style={{ background: 'var(--bg-surface-hover)', color: 'var(--text-tertiary)' }}>
                  {n}
                </span>
                <span>
                  <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{STEP_NAMES[n]}</span>
                  {' — '}
                  {STEP_DESCRIPTIONS[n]}
                </span>
              </li>
            ))}
          </ul>

          <button onClick={advance} className="btn-primary">
            Start Weekly Review →
          </button>
        </div>
      </div>
    )
  }

  // ── Active steps 1–7 ──────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          {/* Progress dots */}
          <div className="flex items-center gap-1.5 mb-2">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <div
                key={n}
                className={cn(
                  'rounded-full transition-all duration-300',
                  n === step
                    ? 'w-5 h-1.5 bg-indigo-400'
                    : n < step
                    ? 'w-2 h-1.5 bg-indigo-500/50'
                    : 'w-2 h-1.5'
                )}
                style={n > step ? { background: 'var(--text-muted)' } : undefined}
              />
            ))}
            <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>Step {step} of 7</span>
          </div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>{STEP_NAMES[step]}</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{STEP_DESCRIPTIONS[step]}</p>
        </div>

        {/* Exit — hide on final summary step */}
        {step < 7 && (
          <button
            onClick={() => router.push('/inbox')}
            className="flex items-center gap-1.5 mt-1 text-sm transition-colors flex-shrink-0"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-secondary)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)' }}
            aria-label="Exit weekly review"
          >
            <X className="w-4 h-4" />
            Exit
          </button>
        )}
      </div>

      {/* Step content — keyed so each step starts fresh */}
      <div key={step}>
        {step === 1 && <ReviewStep1Inbox inboxCount={inboxCount} onNext={advance} />}
        {step === 2 && <ReviewStep2MindSweep onNext={advance} />}
        {step === 3 && <ReviewStep2WaitingFor onNext={advance} onItemSelect={handleItemSelect} />}
        {step === 4 && <ReviewStep3Projects onNext={advance} onItemSelect={handleItemSelect} />}
        {step === 5 && <ReviewStep4NextActions onNext={advance} onItemSelect={handleItemSelect} />}
        {step === 6 && <ReviewStep5SomedayMaybe onNext={advance} onItemSelect={handleItemSelect} />}
        {step === 7 && <ReviewStep6Summary />}
      </div>

      {/* Detail overlay — task or project */}
      <ResponsiveOverlay
        open={selectedItem !== null}
        onClose={handleOverlayClose}
        title={selectedItem?.type === 'project' ? 'Project Details' : 'Task Details'}
      >
        {selectedItem?.type === 'task' && (
          <TaskDetailPanel key={selectedItem.id} taskId={selectedItem.id} />
        )}
        {selectedItem?.type === 'project' && (
          <ProjectDetailPanel key={selectedItem.id} projectId={selectedItem.id} />
        )}
      </ResponsiveOverlay>
    </div>
  )
}

// ── helpers ───────────────────────────────────────────────────

function formatLastReview(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
