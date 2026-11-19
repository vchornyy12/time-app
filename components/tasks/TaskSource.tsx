import { ExternalLink, Sparkles } from 'lucide-react'
import type { Task, TaskSource as Source, ProposedType } from '@/lib/types'

export const SOURCE_LABELS: Record<Source, string> = {
  gmail: 'Gmail', bluedot: 'Bluedot', google_chat: 'Google Chat', slack: 'Slack',
  jira: 'Jira', calendar: 'Calendar', meeting: 'Meeting', other: 'Other',
}

const PROPOSED_LABELS: Record<ProposedType, string> = {
  next_action: 'Next action', waiting_for: 'Waiting for', calendar: 'Calendar',
  project: 'Project', someday_maybe: 'Someday / Maybe', reference: 'Reference',
}

/** Small "via Gmail" badge for agent-captured Inbox items. */
export function SourceBadge({ task }: { task: Task }) {
  if (!task.source) return null
  const label = SOURCE_LABELS[task.source] ?? task.source
  return (
    <span
      className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)' }}
      title={task.captured_by ? `Captured by an AI assistant (${task.captured_by})` : 'Captured by an AI assistant'}
    >
      <Sparkles className="w-3 h-3" aria-hidden="true" />
      <span>via {label}</span>
    </span>
  )
}

/** Source, quote and the agent's proposal, shown in the task detail panel. */
export function SourceDetails({ task }: { task: Task }) {
  if (!task.source) return null
  const proposal = task.agent_proposal
  const suggestion = [
    proposal?.type && PROPOSED_LABELS[proposal.type],
    proposal?.owner && `owner: ${proposal.owner}`,
    proposal?.due && `due ${proposal.due}`,
    proposal?.contexts?.length ? proposal.contexts.join(', ') : null,
  ].filter(Boolean).join(' · ')

  return (
    <section aria-label="Source" className="pt-3 border-t flex flex-col gap-2" style={{ borderColor: 'var(--border-subtle)' }}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          Captured from {SOURCE_LABELS[task.source] ?? task.source}
        </p>
        {task.source_url && (
          <a
            href={task.source_url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-center gap-1 text-xs hover:underline"
            style={{ color: 'var(--text-secondary)' }}
          >
            Open source <ExternalLink className="w-3 h-3" aria-hidden="true" />
          </a>
        )}
      </div>
      {task.source_quote && (
        <blockquote className="text-sm border-l-2 pl-3 whitespace-pre-wrap" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
          {task.source_quote}
        </blockquote>
      )}
      {suggestion && (
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
          Suggested: {suggestion}
          {typeof proposal?.confidence === 'number' && ` (${Math.round(proposal.confidence * 100)}% sure)`}
        </p>
      )}
      {proposal?.notes && (
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{proposal.notes}</p>
      )}
    </section>
  )
}
