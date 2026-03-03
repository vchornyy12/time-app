import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProjectCard } from '@/components/projects/ProjectCard'
import { EmptyState } from '@/components/ui'
import type { Project } from '@/lib/types'

export const metadata: Metadata = { title: 'Projects' }

export default async function ProjectsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data } = await supabase
    .from('projects')
    .select('*, first_step_task:tasks!fk_first_step_task(id, title)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  const projects = data ?? []

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold gradient-heading">Projects</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Multi-step outcomes you&apos;re committed to
          </p>
        </div>
        {projects.length > 0 && (
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {projects.length} {projects.length === 1 ? 'project' : 'projects'}
          </span>
        )}
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon="📁"
          title="No active projects."
          description="When you process an inbox item that needs multiple steps, it becomes a project."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {projects.map((project) => (
            <li key={project.id}>
              <ProjectCard
                project={project as unknown as Project & { first_step_task: { id: string; title: string } | null }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
