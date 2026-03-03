'use client'

import { useState, useEffect } from 'react'
import { Calendar, Clock, Tag, User, FolderOpen } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { createClient } from '@/lib/supabase/client'
import { Spinner } from '@/components/ui'
import { AttachmentSection } from '@/components/tasks/AttachmentSection'
import type { Task, Attachment } from '@/lib/types'

interface TaskDetailPanelProps {
  taskId: string
}

const STATUS_LABELS: Record<string, string> = {
  inbox: 'Inbox',
  next_actions: 'Next Actions',
  waiting_for: 'Waiting For',
  calendar: 'Calendar',
  someday_maybe: 'Someday / Maybe',
  notes: 'Notes',
  trash: 'Trash',
  done: 'Done',
}

const STATUS_COLORS: Record<string, string> = {
  inbox: '',
  next_actions: 'bg-indigo-500/15 text-indigo-300',
  waiting_for: 'bg-amber-500/15 text-amber-300',
  calendar: 'bg-blue-500/15 text-blue-300',
  someday_maybe: 'bg-purple-500/15 text-purple-300',
  notes: '',
  trash: 'bg-red-500/10 text-red-300/70',
  done: 'bg-emerald-500/15 text-emerald-300',
}

const STATUS_INLINE_STYLES: Record<string, React.CSSProperties> = {
  inbox: { background: 'var(--bg-surface)', color: 'var(--text-secondary)' },
  notes: { background: 'var(--bg-surface)', color: 'var(--text-tertiary)' },
}

export function TaskDetailPanel({ taskId }: TaskDetailPanelProps) {
  const [task, setTask] = useState<Task | null>(null)
  const [projectTitle, setProjectTitle] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      const supabase = createClient()

      // Get current user id for attachments
      const { data: { user } } = await supabase.auth.getUser()
      if (mounted && user) setUserId(user.id)

      const { data } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single()
      if (!mounted) return
      setTask(data as Task | null)

      if (data?.project_id) {
        const { data: project } = await supabase
          .from('projects')
          .select('title')
          .eq('id', data.project_id)
          .single()
        if (mounted) setProjectTitle(project?.title ?? null)
      }
      setLoading(false)
    }
    load()
    return () => { mounted = false }
  }, [taskId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="md" />
      </div>
    )
  }

  if (!task) {
    return (
      <p className="text-sm text-center py-8" style={{ color: 'var(--text-tertiary)' }}>Task not found.</p>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Title */}
      <h3 className="text-base font-medium leading-snug" style={{ color: 'var(--text-primary)' }}>
        {task.title}
      </h3>

      {/* Status badge */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={cn(
            'text-xs font-medium px-2.5 py-1 rounded-full',
            STATUS_COLORS[task.status] ?? '',
          )}
          style={STATUS_INLINE_STYLES[task.status] ?? (STATUS_COLORS[task.status] ? undefined : { background: 'var(--bg-surface)', color: 'var(--text-tertiary)' })}
        >
          {STATUS_LABELS[task.status] ?? task.status}
        </span>
      </div>

      {/* Meta rows */}
      <div className="flex flex-col gap-3">
        {task.delegated_to && (
          <MetaRow icon={<User className="w-3.5 h-3.5" />} label="Delegated to">
            {task.delegated_to}
          </MetaRow>
        )}

        {task.due_date && (
          <MetaRow icon={<Calendar className="w-3.5 h-3.5" />} label="Due date">
            {formatDate(task.due_date)}
          </MetaRow>
        )}

        {task.scheduled_at && (
          <MetaRow icon={<Clock className="w-3.5 h-3.5" />} label="Scheduled">
            {formatDateTime(task.scheduled_at)}
          </MetaRow>
        )}

        {task.contexts.length > 0 && (
          <MetaRow icon={<Tag className="w-3.5 h-3.5" />} label="Contexts">
            <div className="flex gap-1.5 flex-wrap">
              {task.contexts.map((ctx) => (
                <span
                  key={ctx}
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)', border: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)' }}
                >
                  {ctx}
                </span>
              ))}
            </div>
          </MetaRow>
        )}

        {projectTitle && (
          <MetaRow icon={<FolderOpen className="w-3.5 h-3.5" />} label="Project">
            {projectTitle}
          </MetaRow>
        )}
      </div>

      {/* Attachments */}
      {userId && (
        <div className="pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <AttachmentSection
            taskId={task.id}
            userId={userId}
            attachments={task.attachments ?? []}
            onAttachmentsChange={(updated: Attachment[]) =>
              setTask((prev) => prev ? { ...prev, attachments: updated } : prev)
            }
          />
        </div>
      )}

      {/* Timestamps */}
      <div className="pt-3 border-t flex flex-col gap-1.5" style={{ borderColor: 'var(--border-subtle)' }}>
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
          Created {formatDateTime(task.created_at)}
        </p>
        {task.completed_at && (
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            Completed {formatDateTime(task.completed_at)}
          </p>
        )}
      </div>
    </div>
  )
}

function MetaRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex items-center gap-2 flex-shrink-0 w-28" style={{ color: 'var(--text-muted)' }}>
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{children}</div>
    </div>
  )
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function formatDateTime(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
