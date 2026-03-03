'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, Loader2, ChevronLeft } from 'lucide-react'
import { useFocusTrap } from '@/lib/hooks/useFocusTrap'
import { ContextPicker } from '@/components/ui/ContextPicker'
import { cn } from '@/lib/utils/cn'
import type { Task } from '@/lib/types'
import {
  processToTrash,
  processToNotes,
  processToWaitingFor,
  processToCalendar,
  processToSomedayMaybe,
  processToNextActions,
  processAsDone,
} from '@/lib/actions/processing'
import { createProject } from '@/lib/actions/projects'
import { ProjectCreationForm } from '@/components/tasks/ProjectCreationForm'

// ── Step types ────────────────────────────────────────────────

type Step =
  | 'step1'   // Actionable?
  | 'step1b'  // Trash or Notes?
  | 'step2'   // 2-minute rule
  | 'step3'   // Mine to do?
  | 'step3b'  // Who or what are you waiting on?
  | 'step4'   // Date/time specific?
  | 'step4b'  // Calendar datetime picker
  | 'step4c'  // Someday/Maybe review date
  | 'step5'   // Single step?
  | 'step5b'  // Project creation form
  | 'step6b'  // Next action clarification + contexts

const STEP_NUMBER: Record<Step, number> = {
  step1: 1, step1b: 1,
  step2: 2,
  step3: 3, step3b: 3,
  step4: 4, step4b: 4, step4c: 4,
  step5: 5, step5b: 5,
  step6b: 5,
}

// ── Props ─────────────────────────────────────────────────────

interface ProcessingOverlayProps {
  task: Task
  userContexts?: string[]
  onClose: () => void
}

// ── Main component ────────────────────────────────────────────

export function ProcessingOverlay({ task, userContexts = [], onClose }: ProcessingOverlayProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState<Step>('step1')
  const [stepHistory, setStepHistory] = useState<Step[]>([])
  const [delegatedTo, setDelegatedTo] = useState('')
  const [wfDueDate, setWfDueDate] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [somedayReviewDate, setSomedayReviewDate] = useState('')
  const [selectedContexts, setSelectedContexts] = useState<string[]>([])
  const [selectedWFContexts, setSelectedWFContexts] = useState<string[]>([])
  const [nextActionTitle, setNextActionTitle] = useState(task.title)
  const panelRef = useRef<HTMLDivElement>(null)

  // Trap focus inside the dialog; restores on close/unmount
  useFocusTrap(panelRef, true)

  // When the step changes, shift focus to the first interactive element in the new step
  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const first = panel.querySelector<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    first?.focus()
  }, [step])

  // Keyboard shortcut: Escape to close, Backspace or Alt+← to go back
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (stepHistory.length === 0) return
      const el = e.target as HTMLElement
      // Don't intercept Backspace when typing in a text field
      if (e.key === 'Backspace' && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return
      if (e.key === 'Backspace' || (e.key === 'ArrowLeft' && e.altKey)) {
        e.preventDefault()
        const prevStep = stepHistory[stepHistory.length - 1]
        setStep(prevStep)
        setStepHistory((prev) => prev.slice(0, -1))
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [stepHistory, onClose])

  const stepNumber = STEP_NUMBER[step]

  /** Run a terminal processing action then close */
  function finish(action: () => Promise<void>) {
    startTransition(async () => {
      await action()
      router.refresh()
      onClose()
    })
  }

  /** Advance to the next step, pushing current step onto the history stack */
  function advance(next: Step) {
    setStepHistory((prev) => [...prev, step])
    setStep(next)
  }

  function handleBack() {
    if (stepHistory.length === 0) return
    const prevStep = stepHistory[stepHistory.length - 1]
    setStep(prevStep)
    setStepHistory((prev) => prev.slice(0, -1))
  }

  // ── Step renderers ─────────────────────────────────────────

  function renderContent() {
    switch (step) {
      case 'step1':
        return (
          <StepCard
            question="Is this actionable?"
            hint="Can you or someone else do something about this?"
          >
            <YesNo
              onYes={() => advance('step2')}
              onNo={() => advance('step1b')}
              disabled={isPending}
            />
          </StepCard>
        )

      case 'step1b':
        return (
          <StepCard
            question="Where should it go?"
            hint="Non-actionable items live in Trash or Notes for future reference"
          >
            <div className="flex gap-3">
              <ChoiceButton
                onClick={() => finish(() => processToTrash(task.id))}
                disabled={isPending}
                variant="danger"
                icon="🗑️"
                label="Trash"
              />
              <ChoiceButton
                onClick={() => finish(() => processToNotes(task.id))}
                disabled={isPending}
                icon="📝"
                label="Notes"
              />
            </div>
          </StepCard>
        )

      case 'step2':
        return (
          <StepCard
            question="Can you do this in 2 minutes or less?"
            hint="If yes, do it right now — it's faster than tracking it"
          >
            <YesNo
              onYes={() => finish(() => processAsDone(task.id))}
              onNo={() => advance('step3')}
              yesLabel="Yes — do it now ✓"
              noLabel="No — keep processing"
              disabled={isPending}
            />
          </StepCard>
        )

      case 'step3':
        return (
          <StepCard
            question="Is this yours to do?"
            hint="Or should someone else handle it?"
          >
            <YesNo
              onYes={() => advance('step4')}
              onNo={() => advance('step3b')}
              noLabel="No — I'm waiting on someone"
              disabled={isPending}
            />
          </StepCard>
        )

      case 'step3b':
        return (
          <StepCard
            question="Who or what are you waiting on?"
            hint="Capture who needs to act, or what needs to happen"
          >
            <div className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="Person, company, or event"
                value={delegatedTo}
                onChange={(e) => setDelegatedTo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && delegatedTo.trim()) {
                    finish(() => processToWaitingFor(task.id, delegatedTo, wfDueDate || undefined, selectedWFContexts))
                  }
                }}
                className="glass-input"
                autoFocus
                disabled={isPending}
              />
              <div className="flex flex-col gap-1">
                <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Expected by (optional)</label>
                <input
                  type="date"
                  value={wfDueDate}
                  onChange={(e) => setWfDueDate(e.target.value)}
                  className="glass-input text-sm"
                  disabled={isPending}
                />
              </div>
              <ContextPicker value={selectedWFContexts} onChange={setSelectedWFContexts} userContexts={userContexts} />
              <ActionButton
                onClick={() => finish(() => processToWaitingFor(task.id, delegatedTo, wfDueDate || undefined, selectedWFContexts))}
                disabled={!delegatedTo.trim() || isPending}
                loading={isPending}
              >
                Move to Waiting For →
              </ActionButton>
            </div>
          </StepCard>
        )

      case 'step4':
        return (
          <StepCard
            question="Does this have a specific date or time?"
            hint="Hard-landscape commitments go to Calendar — everything else to Next Actions"
          >
            <div className="flex flex-col gap-2">
              <ChoiceButton
                onClick={() => advance('step4b')}
                disabled={isPending}
                icon="📅"
                label="Yes — pick a date or time"
              />
              <ChoiceButton
                onClick={() => advance('step5')}
                disabled={isPending}
                icon="⚡"
                label="No — do it as soon as possible"
                variant="accent"
              />
              <ChoiceButton
                onClick={() => advance('step4c')}
                disabled={isPending}
                icon="🌅"
                label="No — defer to Someday/Maybe"
              />
            </div>
          </StepCard>
        )

      case 'step4b':
        return (
          <StepCard
            question="When should this happen?"
            hint="Pick a date and time — it will appear in your Calendar view"
          >
            <div className="flex flex-col gap-3">
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="glass-input"
                autoFocus
                disabled={isPending}
              />
              <ActionButton
                onClick={() => finish(() => processToCalendar(task.id, scheduledAt))}
                disabled={!scheduledAt || isPending}
                loading={isPending}
              >
                Add to Calendar →
              </ActionButton>
            </div>
          </StepCard>
        )

      case 'step4c':
        return (
          <StepCard
            question="When should you review this?"
            hint="Optional — set a date to be reminded to revisit this idea"
          >
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Review on (optional)</label>
                <input
                  type="date"
                  value={somedayReviewDate}
                  onChange={(e) => setSomedayReviewDate(e.target.value)}
                  className="glass-input text-sm"
                  autoFocus
                  disabled={isPending}
                />
              </div>
              <ActionButton
                onClick={() => finish(() => processToSomedayMaybe(task.id, somedayReviewDate || undefined))}
                loading={isPending}
                disabled={isPending}
              >
                Save to Someday/Maybe →
              </ActionButton>
            </div>
          </StepCard>
        )

      case 'step5':
        return (
          <StepCard
            question="Can this be done in a single step?"
            hint="Multiple steps = a Project. Single step = a Next Action."
          >
            <YesNo
              onYes={() => advance('step6b')}
              onNo={() => advance('step5b')}
              noLabel="No — it's a Project"
              disabled={isPending}
            />
          </StepCard>
        )

      case 'step5b':
        return (
          <div className="flex flex-col gap-4">
            <div>
              <h2 id="processing-dialog-title" className="text-lg font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>Create a project</h2>
              <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
                Define the outcome and your first next action
              </p>
            </div>
            <ProjectCreationForm
              defaultTitle={task.title}
              isPending={isPending}
              disabled={isPending}
              onSubmit={({ title, completionCriteria, roughPlanLines, firstStepTitle }) => {
                finish(() =>
                  createProject({
                    title,
                    completionCriteria,
                    roughPlanLines,
                    firstStepTitle,
                    originTaskId: task.id,
                  }).then(() => {})
                )
              }}
            />
          </div>
        )

      case 'step6b':
        return (
          <StepCard
            question="What's the next physical action?"
            hint="Make it specific and concrete — start with a verb. Then tag the context."
          >
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Next action</label>
                <input
                  type="text"
                  placeholder="Call, write, review, schedule..."
                  value={nextActionTitle}
                  onChange={(e) => setNextActionTitle(e.target.value)}
                  className="glass-input"
                  autoFocus
                  disabled={isPending}
                />
              </div>
              <ContextPicker value={selectedContexts} onChange={setSelectedContexts} userContexts={userContexts} />
              <ActionButton
                onClick={() => finish(() => processToNextActions(task.id, selectedContexts, nextActionTitle.trim() || undefined))}
                loading={isPending}
                disabled={isPending || !nextActionTitle.trim()}
              >
                Add to Next Actions →
              </ActionButton>
            </div>
          </StepCard>
        )
    }
  }

  // ── Render ─────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      role="presentation"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-md"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="relative glass-card w-full max-w-md overflow-hidden animate-slide-up"
        role="dialog"
        aria-modal="true"
        aria-labelledby="processing-dialog-title"
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          {/* Progress dots + step label + close */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <div
                  key={n}
                  className={cn(
                    'rounded-full transition-all duration-300',
                    n === stepNumber
                      ? 'w-5 h-1.5 bg-indigo-400'
                      : n < stepNumber
                      ? 'w-2 h-1.5 bg-indigo-500/50'
                      : 'w-2 h-1.5'
                  )}
                  style={n > stepNumber ? { background: 'var(--border-subtle)' } : undefined}
                />
              ))}
              <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>Step {stepNumber} of 5</span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg transition-all duration-150"
              style={{ color: 'var(--text-muted)' }}
              aria-label="Cancel — return to Inbox"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Task title */}
          <p className="text-sm leading-snug line-clamp-2">
            <span style={{ color: 'var(--text-muted)' }}>Processing: </span>
            <span style={{ color: 'var(--text-secondary)' }}>{task.title}</span>
          </p>
        </div>

        {/* Step content — keyed so each step animates in */}
        <div key={step} className="p-6 animate-step-in">
          {isPending ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
            </div>
          ) : (
            <>
              {renderContent()}
              {/* Back button — shown at any step that has history */}
              {stepHistory.length > 0 && (
                <button
                  onClick={handleBack}
                  className="mt-5 flex items-center gap-1 text-sm transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  aria-label="Go back to previous step"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Back
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────

function StepCard({
  question,
  hint,
  children,
}: {
  question: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2
          id="processing-dialog-title"
          className="text-lg font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}
        >
          {question}
        </h2>
        <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>{hint}</p>
      </div>
      <div>{children}</div>
    </div>
  )
}

function YesNo({
  onYes,
  onNo,
  yesLabel = 'Yes',
  noLabel = 'No',
  disabled,
}: {
  onYes: () => void
  onNo: () => void
  yesLabel?: string
  noLabel?: string
  disabled?: boolean
}) {
  return (
    <div className="flex gap-3">
      <button
        onClick={onYes}
        disabled={disabled}
        className="flex-1 py-3 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/20 text-indigo-300 hover:text-indigo-200 text-sm font-medium transition-all duration-150 disabled:opacity-50"
      >
        {yesLabel}
      </button>
      <button
        onClick={onNo}
        disabled={disabled}
        className="flex-1 py-3 rounded-xl border text-sm font-medium transition-all duration-150 disabled:opacity-50"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
      >
        {noLabel}
      </button>
    </div>
  )
}

function ChoiceButton({
  onClick,
  disabled,
  icon,
  label,
  variant = 'default',
}: {
  onClick: () => void
  disabled?: boolean
  icon: string
  label: string
  variant?: 'default' | 'danger' | 'accent'
}) {
  const cls = {
    default: '',
    danger:  'bg-red-500/10 hover:bg-red-500/18 border-red-500/20 text-red-300',
    accent:  'bg-indigo-500/12 hover:bg-indigo-500/22 border-indigo-500/18 text-indigo-300',
  }[variant]

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex-1 flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium transition-all duration-150 disabled:opacity-50',
        cls
      )}
      style={variant === 'default' ? { background: 'var(--bg-surface)', borderColor: 'var(--border-default)', color: 'var(--text-secondary)' } : undefined}
    >
      <span className="text-base leading-none">{icon}</span>
      {label}
    </button>
  )
}

function ActionButton({
  onClick,
  disabled,
  loading,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  children: React.ReactNode
}) {
  return (
    <button onClick={onClick} disabled={disabled} className="btn-primary">
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  )
}
