'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Spinner } from '@/components/ui'
import { ProjectDetail } from './ProjectDetail'
import type { Project, Task } from '@/lib/types'

type FirstStepTask = Pick<Task, 'id' | 'title' | 'status' | 'contexts' | 'due_date'>

interface ProjectDetailPanelProps {
  projectId: string
}

/**
 * Fetches project + first-step task client-side, then renders ProjectDetail.
 * Designed for use inside ResponsiveOverlay during the Weekly Review flow.
 */
export function ProjectDetailPanel({ projectId }: ProjectDetailPanelProps) {
  const [project, setProject] = useState<Project | null>(null)
  const [firstStepTask, setFirstStepTask] = useState<FirstStepTask | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let mounted = true
    async function load() {
      const supabase = createClient()
      const { data: proj } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single()

      if (!mounted) return
      if (!proj) {
        setError(true)
        setLoading(false)
        return
      }

      const project = proj as Project
      setProject(project)

      if (project.first_step_task_id) {
        const { data: task } = await supabase
          .from('tasks')
          .select('id, title, status, contexts, due_date')
          .eq('id', project.first_step_task_id)
          .single()
        if (mounted) setFirstStepTask(task as FirstStepTask | null)
      }

      if (mounted) setLoading(false)
    }
    load()
    return () => { mounted = false }
  }, [projectId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="md" />
      </div>
    )
  }

  if (error || !project) {
    return (
      <p className="text-sm text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
        Project not found.
      </p>
    )
  }

  return <ProjectDetail project={project} firstStepTask={firstStepTask} />
}
