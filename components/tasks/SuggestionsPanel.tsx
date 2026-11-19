'use client'

import { useOptimistic, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, ExternalLink, Sparkles, X } from 'lucide-react'
import type { AgentSuggestion, SuggestionKind } from '@/lib/types'
import { decideSuggestion } from '@/lib/actions/assistant'

const KIND: Record<SuggestionKind, { label: string; accept: string }> = {
  close: { label: 'Looks done', accept: 'Mark done' },
  follow_up: { label: 'Follow up', accept: 'Copy draft' },
  jira_issue: { label: 'Track in Jira', accept: 'Create issue' },
}

/**
 * Agent suggestions on existing tasks, shown at the top of the Inbox so every
 * decision the assistant needs from the user lives in one place.
 */
export function SuggestionsPanel({ suggestions }: { suggestions: AgentSuggestion[] }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [visible, hide] = useOptimistic(suggestions, (state: AgentSuggestion[], id: string) => state.filter((s) => s.id !== id))

  if (visible.length === 0) return null

  function decide(s: AgentSuggestion, decision: 'accept' | 'dismiss') {
    setError(null)
    if (decision === 'accept' && s.kind === 'follow_up' && s.draft_message) {
      navigator.clipboard?.writeText(s.draft_message).catch(() => {})
    }
    startTransition(async () => {
      hide(s.id)
      try {
        await decideSuggestion(s.id, decision)
      } catch {
        setError('Could not save your decision. Please try again.')
      }
      router.refresh()
    })
  }

  return (
    <section aria-label="Assistant suggestions" className="mb-6 flex flex-col gap-2">
      <h2 className="text-xs font-medium uppercase tracking-wide flex items-center gap-1.5" style={{ color: 'var(--text-tertiary)' }}>
        <Sparkles className="w-3.5 h-3.5" aria-hidden="true" /> Assistant suggestions · {visible.length}
      </h2>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <ul className="flex flex-col gap-2">
        {visible.map((s) => (
          <li key={s.id} className="px-4 py-3 rounded-xl border flex flex-col gap-2" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                  {KIND[s.kind].label}
                  {s.task?.delegated_to && ` · ${s.task.delegated_to}`}
                  {s.task?.due_date && ` · due ${s.task.due_date}`}
                </p>
                <p className="text-base leading-snug" style={{ color: 'var(--text-primary)' }}>{s.task?.title ?? 'Task'}</p>
              </div>
              {s.evidence_url && (
                <a href={s.evidence_url} target="_blank" rel="noopener noreferrer nofollow" className="shrink-0 inline-flex items-center gap-1 text-xs hover:underline" style={{ color: 'var(--text-secondary)' }}>
                  Source <ExternalLink className="w-3 h-3" aria-hidden="true" />
                </a>
              )}
            </div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{s.reason}</p>
            {s.evidence_quote && (
              <blockquote className="text-sm border-l-2 pl-3 whitespace-pre-wrap" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-tertiary)' }}>
                {s.evidence_quote}
              </blockquote>
            )}
            {s.kind === 'follow_up' && s.draft_message && (
              <p className="text-sm rounded-lg px-3 py-2 whitespace-pre-wrap" style={{ background: 'var(--bg-surface-hover)', color: 'var(--text-secondary)' }}>
                {s.draft_message}
              </p>
            )}
            {s.kind === 'jira_issue' && s.payload && (
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                {s.payload.project_key}: {s.payload.summary}
                {s.payload.assignee && ` · ${s.payload.assignee}`}
                {s.payload.due && ` · due ${s.payload.due}`}
              </p>
            )}
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => decide(s, 'accept')} className="btn-glass !px-3 !py-1.5 text-xs inline-flex items-center gap-1.5">
                {s.kind === 'follow_up' ? <Copy className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                {KIND[s.kind].accept}
              </button>
              <button type="button" onClick={() => decide(s, 'dismiss')} className="text-xs px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                <X className="w-3.5 h-3.5" /> Dismiss
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
