'use client'

import { useState, useEffect, useTransition } from 'react'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { promoteRoughPlanItem } from '@/lib/actions/projects'
import type { Project, RoughPlanItem, ReviewItemSelection } from '@/lib/types'

interface ReviewStep3ProjectsProps {
  onNext: () => void
  onItemSelect?: (item: ReviewItemSelection) => void
}

export function ReviewStep3Projects({ onNext, onItemSelect }: ReviewStep3ProjectsProps) {
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    let mounted = true
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !mounted) return
      const { data } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
      if (mounted) setProjects((data as Project[]) ?? [])
    }
    load()
    return () => { mounted = false }
  }, [])

  function handlePromote(project: Project) {
    const plan = project.rough_plan as RoughPlanItem[]
    const firstItem = plan[0]
    if (!firstItem) return
    // Optimistically mark the project as having a next action
    setProjects((prev) =>
      prev?.map((p) =>
        p.id === project.id
          ? { ...p, first_step_task_id: 'promoted', rough_plan: plan.slice(1) as RoughPlanItem[] }
          : p
      ) ?? null
    )
    startTransition(async () => { await promoteRoughPlanItem(project.id, firstItem.id) })
  }

  if (projects === null) return <StepLoading />

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
        Each active project should have a clear next action. Promote one if it&apos;s missing.
      </p>

      {projects.length === 0 ? (
        <EmptySection label="No active projects." />
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Active projects">
          {projects.map((project) => {
            const plan = project.rough_plan as RoughPlanItem[]
            const hasNextAction = project.first_step_task_id !== null
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
                        Next action set
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

      <button onClick={onNext} className="btn-primary mt-2">
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
