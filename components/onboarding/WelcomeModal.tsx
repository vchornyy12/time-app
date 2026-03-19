'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Inbox, ListChecks, Tag, ArrowRight, X } from 'lucide-react'
import { useFocusTrap } from '@/lib/hooks/useFocusTrap'
import { cn } from '@/lib/utils/cn'

// v2: key renamed so opt-in "don't show again" logic takes effect for all users
const STORAGE_KEY = 'gtd_onboarding_v2'

const SLIDES = [
  {
    icon: Inbox,
    label: 'Mind Sweep',
    title: 'Step 1: The Massive Mind Sweep',
    tagline: 'Your mind is for having ideas, not holding them.',
    body: 'Your first task is to empty your brain completely. Dedicate a day or two to this. Add at least 100 items to your Inbox — every worry, idea, and obligation. Do not process anything yet. Just get it all out.',
  },
  {
    icon: ListChecks,
    label: 'Process',
    title: 'Step 2: Process to Zero',
    tagline: "Don't let your Inbox become a graveyard.",
    body: 'Once your head is empty, use our 6-step Processing Wizard to force a decision on every item. Is it actionable? Does it belong to a project?',
  },
  {
    icon: Tag,
    label: 'Contexts',
    title: 'Step 3: Context-Based Execution',
    tagline: 'Only look at what you can do right now.',
    body: 'Filter your Next Actions by @home, @office, or @computer. Clear your head. Start executing.',
  },
] as const

export function WelcomeModal() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [fading, setFading] = useState(false)
  const [doNotShow, setDoNotShow] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useFocusTrap(panelRef, open)

  // Determine visibility after mount to avoid SSR/hydration mismatch
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!localStorage.getItem(STORAGE_KEY)) {
      setOpen(true)
    }
  }, [])

  const dismiss = useCallback(() => {
    if (doNotShow) {
      localStorage.setItem(STORAGE_KEY, 'true')
    }
    setOpen(false)
  }, [doNotShow])

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss()
    },
    [dismiss]
  )

  useEffect(() => {
    if (!open) return
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [open, handleKey])

  const goTo = useCallback(
    (next: number) => {
      setFading(true)
      setTimeout(() => {
        setStep(next)
        setFading(false)
      }, 180)
    },
    []
  )

  const handleNext = () => {
    if (step < SLIDES.length - 1) {
      goTo(step + 1)
    } else {
      dismiss()
    }
  }

  if (!open) return null

  const slide = SLIDES[step]
  const Icon = slide.icon
  const isLast = step === SLIDES.length - 1

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80"
        onClick={dismiss}
        aria-hidden="true"
      />

      {/* Card */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        className={cn(
          'relative w-full max-w-md rounded-2xl border border-white/10',
          'flex flex-col gap-0 overflow-hidden',
          'shadow-2xl'
        )}
        style={{ background: '#181818' }}
      >
        {/* Skip button */}
        <button
          onClick={dismiss}
          aria-label="Skip onboarding"
          className="absolute top-4 right-4 p-1.5 rounded-lg text-white/30 hover:text-white/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3ECF8E]"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Emerald top bar */}
        <div className="h-1 w-full" style={{ background: '#3ECF8E' }} aria-hidden="true" />

        {/* Step dots */}
        <div className="flex items-center justify-center gap-2 pt-6 pb-0" aria-label={`Step ${step + 1} of ${SLIDES.length}`}>
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => i < step ? goTo(i) : undefined}
              aria-label={`Go to step ${i + 1}`}
              disabled={i > step}
              className={cn(
                'rounded-full transition-all duration-300 focus-visible:outline-none',
                i === step
                  ? 'w-6 h-1.5'
                  : 'w-1.5 h-1.5',
                i <= step
                  ? 'cursor-pointer'
                  : 'cursor-default opacity-30'
              )}
              style={{
                background: i <= step ? '#3ECF8E' : 'rgba(255,255,255,0.2)',
              }}
            />
          ))}
        </div>

        {/* Slide content */}
        <div
          className={cn(
            'flex flex-col items-center text-center px-8 pt-8 pb-8 transition-opacity duration-[180ms]',
            fading ? 'opacity-0' : 'opacity-100'
          )}
        >
          {/* Icon */}
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 flex-shrink-0"
            style={{ background: 'rgba(62,207,142,0.12)', border: '1px solid rgba(62,207,142,0.25)' }}
            aria-hidden="true"
          >
            <Icon className="w-6 h-6" style={{ color: '#3ECF8E' }} />
          </div>

          {/* Text */}
          <h2
            id="onboarding-title"
            className="text-xl font-semibold text-white mb-2 leading-snug"
          >
            {slide.title}
          </h2>
          <p className="text-sm font-medium mb-3" style={{ color: '#3ECF8E' }}>
            {slide.tagline}
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
            {slide.body}
          </p>
        </div>

        {/* Footer actions */}
        <div
          className="flex items-center justify-between px-8 pb-7 pt-0"
        >
          <label className="flex items-center gap-2 cursor-pointer select-none group">
            {/* Hidden native checkbox — drives state, provides keyboard/a11y */}
            <input
              type="checkbox"
              checked={doNotShow}
              onChange={e => setDoNotShow(e.target.checked)}
              className="peer sr-only"
              aria-label="Do not show again"
            />
            {/* Custom box */}
            <span
              className={cn(
                'relative flex items-center justify-center w-3.5 h-3.5 rounded flex-shrink-0',
                'border transition-colors duration-150',
                'peer-focus-visible:ring-2 peer-focus-visible:ring-[#3ECF8E] peer-focus-visible:ring-offset-1 peer-focus-visible:ring-offset-[#181818]',
                doNotShow
                  ? 'border-[#3ECF8E]'
                  : 'border-white/20 bg-white/5 group-hover:border-white/40'
              )}
              style={doNotShow ? { background: '#3ECF8E' } : undefined}
              aria-hidden="true"
            >
              {doNotShow && (
                <svg
                  viewBox="0 0 10 8"
                  className="w-2 h-2 text-black"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="1,4 3.5,6.5 9,1" />
                </svg>
              )}
            </span>
            <span className="text-xs text-white/30 group-hover:text-white/50 transition-colors">
              Don't show again
            </span>
          </label>

          <button
            onClick={handleNext}
            className={cn(
              'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold',
              'transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3ECF8E] focus-visible:ring-offset-1 focus-visible:ring-offset-[#181818]',
              'text-black'
            )}
            style={{ background: '#3ECF8E' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#34B27B')}
            onMouseLeave={e => (e.currentTarget.style.background = '#3ECF8E')}
          >
            {isLast ? "Let's Go" : 'Next'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
