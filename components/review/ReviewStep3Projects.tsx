'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import { getReviewProjects, type ReviewProject } from '@/lib/actions/review'
import { getProjectHealth } from '@/lib/projects/health'
import { promoteRoughPlanItem } from '@/lib/actions/projects'
import type { RoughPlanItem, ReviewItemSelection } from '@/lib/types'

interface ReviewStep3ProjectsProps {
  refreshKey?: number
  onNext: () => void
  onItemSelect?: (item: ReviewItemSelection) => void
}

export function ReviewStep3Projects({ onNext, onItemSelect, refreshKey = 0 }: ReviewStep3ProjectsProps) {
  const [projects, setProjects] = useState<ReviewProject[] | null>(null)
  const [isPending, startTransition] = useTransition()

  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let mounted = true
    getReviewProjects().then((data) => {
      if (mounted) { setProjects(data); setError(null) }
    }).catch(() => {
      if (mounted) setError('Could not load projects. Please retry.')
    })
    return () => { mounted = false }
  }, [reload, refreshKey])

  const retry = useCallback(() => setReload((value) => value + 1), [])

  function handlePromote(project: ReviewProject) {
    const firstItem = project.rough_plan[0]
    if (!firstItem || isPending) return
    setError(null)
    startTransition(async () => {
      try {
        await promoteRoughPlanItem(project.id, firstItem.id)
        // Reload authoritative tasks/plan, including retries that already committed.
        setProjects(await getReviewProjects())
      } catch {
        setError('Could not confirm the next step. Retry to refresh projects.')
        retry()
      }
    })
  }

  if (error && projects === null) return (
    <div role="alert"><p>{error}</p><button onClick={retry} className="btn-primary">Retry</button></div>
  )

  if (projects === null) return <StepLoading />

  return (
    <div className="flex flex-col gap-4">
      {error && <p role="alert">{error} <button onClick={retry}>Retry</button></p>}
      <button type="button" onClick={retry} disabled={isPending} className="text-sm self-start">Refresh projects</button>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
        Each active project should have a clear next action. Promote one if it&apos;s missing.
      </p>

      {projects.length === 0 ? (
        <EmptySection label="No active projects." />
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Active projects">
          {projects.map((project) => {
            const plan = project.rough_plan as RoughPlanItem[]
            const health = getProjectHealth(project.tasks)
            const hasNextAction = health !== 'missing'
            const canPromote = !hasNextAction && plan.length > 0

            return (
              <li
                key={project.id}
                className="flex items-start gap-3 px-4 py-3.5 rounded-xl border"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => onItemSelect?.({ type: 'project', id: project.id })}
                      className="text-sm hover:text-indigo-300 leading-snug text-left transition-colors"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {project.title}
                    </button>
                    {hasNextAction ? (
                      <span className="flex-shrink-0 flex items-center gap-1 text-xs text-emerald-400/70">
                        <CheckCircle2 className="w-3 h-3" />
                        {health === 'actionable' ? 'Next action set' : health === 'waiting' ? 'Waiting for response' : 'Scheduled commitment'}
                      </span>
                    ) : (
                      <span className="flex-shrink-0 flex items-center gap-1 text-xs text-amber-400">
                        <AlertCircle className="w-3 h-3" />
                        No next action
                      </span>
                    )}
                  </div>

                  {canPromote && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs truncate min-w-0" style={{ color: 'var(--text-tertiary)' }}>
                        Promote: &ldquo;{plan[0].text}&rdquo;
                      </span>
                      <button
                        onClick={() => handlePromote(project)}
                        disabled={isPending}
                        className="flex-shrink-0 text-xs text-indigo-300 hover:text-indigo-200 transition-colors"
                      >
                        Promote →
                      </button>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <button onClick={onNext} disabled={isPending || error !== null} className="btn-primary mt-2">
        Projects reviewed →
      </button>
    </div>
  )
}

function StepLoading() {
  return (
    <div className="flex flex-col gap-2">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: 'var(--bg-surface)' }} />
      ))}
    </div>
  )
}

function EmptySection({ label }: { label: string }) {
  return (
    <div className="px-4 py-5 rounded-xl border text-center text-sm" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)', color: 'var(--text-tertiary)' }}>
      {label} ✓
    </div>
  )
}
