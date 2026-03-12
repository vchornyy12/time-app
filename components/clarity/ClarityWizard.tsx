'use client'

import { useState } from 'react'
import { CheckCircle } from '@phosphor-icons/react'
import { cn } from '@/lib/utils/cn'
import { submitClaritySession } from '@/lib/actions/clarity'

// ── Types ────────────────────────────────────────────────────

type WizardStep = 1 | 2 | 3 | 4 | 'success'

interface WizardState {
  step: WizardStep
  worryDescription: string
  worstCaseScenario: string
  accepted: boolean
  actionTitle: string
  isSubmitting: boolean
  serverError: string | null
}

const INITIAL: WizardState = {
  step: 1,
  worryDescription: '',
  worstCaseScenario: '',
  accepted: false,
  actionTitle: '',
  isSubmitting: false,
  serverError: null,
}

// ── Design tokens ────────────────────────────────────────────

// Shared base for both textarea and text input
const FIELD_BASE =
  'w-full rounded-lg bg-black/20 border border-white/10 text-zinc-100 placeholder-zinc-600 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#3ECF8E]/40 focus:border-[#3ECF8E]/40 transition-colors duration-150'

const PRIMARY_BTN =
  'inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-sm font-semibold bg-[#3ECF8E] text-black transition-opacity duration-150 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3ECF8E]/60'

const SECONDARY_BTN =
  'inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-sm font-medium border border-white/10 text-zinc-300 hover:text-zinc-100 hover:border-white/20 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20'

// ── Step indicator ───────────────────────────────────────────

function StepIndicator({ step }: { step: 1 | 2 | 3 | 4 }) {
  return (
    <div className="flex items-center gap-1.5 mb-6" aria-label={`Step ${step} of 4`}>
      {([1, 2, 3, 4] as const).map((n) => (
        <span
          key={n}
          className="h-1 rounded-full transition-all duration-200"
          style={{
            width: n === step ? '24px' : '8px',
            background: n <= step ? '#3ECF8E' : 'rgba(255,255,255,0.12)',
          }}
        />
      ))}
      <span className="ml-2 text-xs text-zinc-500">Step {step} of 4</span>
    </div>
  )
}

// ── CTA row ──────────────────────────────────────────────────

function CtaRow({ children }: { children: React.ReactNode }) {
  return <div className="flex justify-end mt-4">{children}</div>
}

// ── Step heading + sub-copy ───────────────────────────────────

function StepHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xl font-semibold text-zinc-100 mb-1">{children}</h2>
}

function StepSubcopy({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-zinc-400 mb-5">{children}</p>
}

// ── Main component ───────────────────────────────────────────

export function ClarityWizard() {
  const [state, setState] = useState<WizardState>(INITIAL)

  function patch(updates: Partial<WizardState>) {
    setState((s) => ({ ...s, ...updates }))
  }

  async function handleSubmit() {
    // Snapshot the field values before the async call to avoid stale-closure issues
    const { worryDescription, worstCaseScenario, actionTitle } = state
    patch({ isSubmitting: true, serverError: null })
    try {
      await submitClaritySession({ worryDescription, worstCaseScenario, actionTitle })
      patch({ step: 'success', isSubmitting: false })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      patch({ isSubmitting: false, serverError: message })
    }
  }

  // ── Success screen ─────────────────────────────────────────

  if (state.step === 'success') {
    return (
      <div className="flex flex-col items-center text-center py-12 gap-6">
        <CheckCircle size={52} color="#3ECF8E" weight="fill" aria-hidden="true" />
        <div>
          <h2 className="text-2xl font-semibold text-zinc-100">Mind cleared.</h2>
          <p className="mt-2 text-sm text-zinc-400">Your action has been added to Inbox.</p>
        </div>
        <div className="flex items-center gap-4 mt-2">
          <a href="/inbox" className={PRIMARY_BTN} aria-label="Go to Inbox">
            Go to Inbox →
          </a>
          <button type="button" onClick={() => setState(INITIAL)} className={SECONDARY_BTN}>
            Start Again
          </button>
        </div>
      </div>
    )
  }

  // ── Wizard steps ──────────────────────────────────────────

  return (
    <div className="max-w-xl mx-auto">
      <StepIndicator step={state.step as 1 | 2 | 3 | 4} />

      {/* Step 1: Worry */}
      {state.step === 1 && (
        <div>
          <StepHeading>
            <span id="s1-heading">What are you worrying about right now?</span>
          </StepHeading>
          <StepSubcopy>Be specific. Name it.</StepSubcopy>

          <textarea
            aria-labelledby="s1-heading"
            className={cn(FIELD_BASE, 'resize-none')}
            rows={5}
            maxLength={2000}
            autoFocus
            value={state.worryDescription}
            onChange={(e) => patch({ worryDescription: e.target.value })}
            placeholder="Write it out in full…"
          />
          <CtaRow>
            <button
              type="button"
              className={PRIMARY_BTN}
              disabled={!state.worryDescription.trim()}
              onClick={() => patch({ step: 2 })}
            >
              Next →
            </button>
          </CtaRow>
        </div>
      )}

      {/* Step 2: Worst case */}
      {state.step === 2 && (
        <div>
          <StepHeading>
            <span id="s2-heading">What is the absolute worst thing that could happen?</span>
          </StepHeading>
          <StepSubcopy>{"Don't soften it. Write the honest worst."}</StepSubcopy>

          <textarea
            aria-labelledby="s2-heading"
            className={cn(FIELD_BASE, 'resize-none')}
            rows={5}
            maxLength={2000}
            autoFocus
            value={state.worstCaseScenario}
            onChange={(e) => patch({ worstCaseScenario: e.target.value })}
            placeholder="The absolute worst outcome would be…"
          />
          <CtaRow>
            <button
              type="button"
              className={PRIMARY_BTN}
              disabled={!state.worstCaseScenario.trim()}
              onClick={() => patch({ step: 3 })}
            >
              Next →
            </button>
          </CtaRow>
        </div>
      )}

      {/* Step 3: Acceptance */}
      {state.step === 3 && (
        <div>
          <StepHeading>Accept the worst — then let it go.</StepHeading>
          <StepSubcopy>Read this calmly. Accept it as a possible truth.</StepSubcopy>

          <blockquote className="px-4 py-3 mb-6 rounded-lg border border-white/10 bg-black/20 text-sm text-zinc-300 italic leading-relaxed">
            {state.worstCaseScenario}
          </blockquote>

          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/20 accent-[#3ECF8E] cursor-pointer focus:ring-[#3ECF8E]/40"
              checked={state.accepted}
              onChange={() => patch({ accepted: !state.accepted })}
            />
            <span className="text-sm text-zinc-300 group-hover:text-zinc-100 transition-colors duration-150">
              I accept this as a possible outcome. I no longer fear it.
            </span>
          </label>

          <div className="flex justify-end mt-6">
            <button
              type="button"
              className={PRIMARY_BTN}
              disabled={!state.accepted}
              onClick={() => patch({ step: 4 })}
            >
              I Accept →
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Action */}
      {state.step === 4 && (
        <div>
          <StepHeading>Now improve upon it.</StepHeading>
          <StepSubcopy>
            What is one concrete action you can take right now to make this better?
          </StepSubcopy>

          <label htmlFor="action-input" className="block text-xs font-medium text-zinc-400 mb-2">
            One concrete action
          </label>
          <input
            id="action-input"
            type="text"
            className={FIELD_BASE}
            maxLength={500}
            autoFocus
            value={state.actionTitle}
            onChange={(e) => patch({ actionTitle: e.target.value })}
            placeholder="e.g. Update my CV and send one application today"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && state.actionTitle.trim() && !state.isSubmitting) {
                handleSubmit()
              }
            }}
          />

          {state.serverError && (
            <p role="alert" className="mt-3 text-sm text-red-400">
              {state.serverError}
            </p>
          )}

          <CtaRow>
            <button
              type="button"
              className={PRIMARY_BTN}
              disabled={!state.actionTitle.trim() || state.isSubmitting}
              onClick={handleSubmit}
              aria-label="Add to Inbox →"
            >
              {state.isSubmitting ? 'Saving…' : 'Add to Inbox →'}
            </button>
          </CtaRow>
        </div>
      )}
    </div>
  )
}
