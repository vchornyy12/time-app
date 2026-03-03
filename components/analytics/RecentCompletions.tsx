'use client'

import { CheckCircle2 } from 'lucide-react'

interface RecentTask {
  id: string
  title: string
  completed_at: string
}

interface RecentCompletionsProps {
  tasks: RecentTask[]
}

function formatCompletedAt(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / 86_400_000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function RecentCompletions({ tasks }: RecentCompletionsProps) {
  if (tasks.length === 0) {
    return (
      <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>No completed tasks yet</p>
    )
  }

  return (
    <ul className="flex flex-col gap-px">
      {tasks.map((task) => (
        <li
          key={task.id}
          className="flex items-center gap-3 px-1 py-2.5 rounded-lg transition-colors"
          style={{ background: 'transparent' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-surface)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400/50 flex-shrink-0" />
          <span className="flex-1 text-sm truncate" style={{ color: 'var(--text-secondary)' }}>{task.title}</span>
          <span className="text-xs flex-shrink-0 tabular-nums" style={{ color: 'var(--text-muted)' }}>
            {formatCompletedAt(task.completed_at)}
          </span>
        </li>
      ))}
    </ul>
  )
}
