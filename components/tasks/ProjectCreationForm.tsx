'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'

interface ProjectCreationFormProps {
  /** Pre-fill project title from the original task */
  defaultTitle: string
  onSubmit: (data: {
    title: string
    completionCriteria: string
    roughPlanLines: string[]
    firstStepTitle: string
  }) => void
  disabled?: boolean
  isPending?: boolean
}

export function ProjectCreationForm({
  defaultTitle,
  onSubmit,
  disabled,
  isPending,
}: ProjectCreationFormProps) {
  const [title, setTitle] = useState(defaultTitle)
  const [completionCriteria, setCompletionCriteria] = useState('')
  const [roughPlan, setRoughPlan] = useState('')
  const [firstStep, setFirstStep] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !firstStep.trim()) return
    onSubmit({
      title: title.trim(),
      completionCriteria: completionCriteria.trim(),
      roughPlanLines: roughPlan.split('\n'),
      firstStepTitle: firstStep.trim(),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">

      {/* Project title */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
          Project title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Launch redesigned website"
          className="glass-input"
          autoFocus
          required
          disabled={disabled}
        />
      </div>

      {/* Completion criteria */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
          Done when… <span className="normal-case font-normal " style={{ color: 'var(--text-muted)' }}>(optional)</span>
        </label>
        <textarea
          value={completionCriteria}
          onChange={(e) => setCompletionCriteria(e.target.value)}
          placeholder="What does success look like? e.g. Site is live and traffic redirected"
          className="glass-input resize-none"
          rows={2}
          disabled={disabled}
        />
      </div>

      {/* Rough plan */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
          Rough plan <span className="normal-case font-normal" style={{ color: 'var(--text-muted)' }}>(optional — one step per line)</span>
        </label>
        <textarea
          value={roughPlan}
          onChange={(e) => setRoughPlan(e.target.value)}
          placeholder={"Write copy\nDesign mockup\nGet approval\nDeploy"}
          className="glass-input resize-none font-mono text-sm"
          rows={4}
          disabled={disabled}
        />
      </div>

      {/* First next action */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
          First next action
        </label>
        <input
          type="text"
          value={firstStep}
          onChange={(e) => setFirstStep(e.target.value)}
          placeholder="What's the very first physical action? e.g., Call Max"
          className="glass-input"
          required
          disabled={disabled}
        />
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          This task moves to Next Actions right away
        </p>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={!title.trim() || !firstStep.trim() || disabled}
        className="btn-primary mt-1"
      >
        {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
        Create Project →
      </button>
    </form>
  )
}
