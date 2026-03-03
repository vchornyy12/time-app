import Link from 'next/link'
import type { Project } from '@/lib/types'

interface ProjectCardProps {
  project: Project & {
    first_step_task: { id: string; title: string } | null
  }
}

export function ProjectCard({ project }: ProjectCardProps) {
  const planCount = project.rough_plan.length
  const criteriaExcerpt = project.completion_criteria
    ? project.completion_criteria.length > 80
      ? project.completion_criteria.slice(0, 80) + '…'
      : project.completion_criteria
    : null

  return (
    <Link
      href={`/projects/${project.id}`}
      className="block px-5 py-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] transition-all duration-150 group"
    >
      {/* Title */}
      <p className="text-sm font-medium transition-colors leading-snug" style={{ color: 'var(--text-primary)' }}>
        {project.title}
      </p>

      {/* Completion criteria excerpt */}
      {criteriaExcerpt && (
        <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
          Done when: {criteriaExcerpt}
        </p>
      )}

      {/* Active step + plan count */}
      <div className="flex items-center gap-3 mt-2.5 flex-wrap">
        {project.first_step_task ? (
          <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#3ECF8E] flex-shrink-0" aria-hidden="true" />
            {project.first_step_task.title}
          </span>
        ) : (
          <span className="text-xs italic" style={{ color: 'var(--text-muted)' }}>No active step</span>
        )}

        {planCount > 0 && (
          <span className="text-xs ml-auto flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
            {planCount} {planCount === 1 ? 'step' : 'steps'} planned
          </span>
        )}
      </div>
    </Link>
  )
}
