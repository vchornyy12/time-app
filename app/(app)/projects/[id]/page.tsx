import { cache } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { ProjectDetail } from '@/components/projects/ProjectDetail'
import type { Task, Project } from '@/lib/types'

interface PageProps {
  params: Promise<{ id: string }>
}

/**
 * Per-request cache: deduplicates the DB call between generateMetadata and the page.
 * React.cache() memoises the result for the lifetime of a single server render.
 */
const fetchProject = cache(async (id: string) => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('projects')
    .select('*, first_step_task:tasks!fk_first_step_task(id, title, status, contexts, due_date)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  return data ?? null
})

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const project = await fetchProject(id)
  return {
    title: project?.title ?? 'Project',
  }
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { id } = await params
  const project = await fetchProject(id)   // ← hits React cache: no extra DB round-trip

  if (!project) notFound()

  // Separate the joined task from the project data
  const firstStepTask = (project.first_step_task as Pick<
    Task,
    'id' | 'title' | 'status' | 'contexts' | 'due_date'
  > | null) ?? null

  // Strip the join from the project object so types stay clean
  const { first_step_task: _, ...projectData } = project

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back link */}
      <Link
        href="/projects"
        className="inline-flex items-center gap-1 text-sm transition-colors mb-6"
        style={{ color: 'var(--text-tertiary)' }}
      >
        <ChevronLeft className="w-4 h-4" />
        Projects
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-semibold leading-snug gradient-heading">
            {project.title}
          </h1>
          <span className="flex-shrink-0 text-xs px-2.5 py-1 rounded-full bg-emerald-500/12 border border-emerald-500/20 text-emerald-400 mt-1">
            Active
          </span>
        </div>
      </div>

      <ProjectDetail project={projectData as Project} firstStepTask={firstStepTask} />
    </div>
  )
}
