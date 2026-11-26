import type { AgentProposal, ProposedType, SuggestionKind, TaskSource } from './types'

// Plain data shared by the web and mobile apps (no React, no server code).

export const SOURCE_LABELS: Record<TaskSource, string> = {
  gmail: 'Gmail', bluedot: 'Bluedot', google_chat: 'Google Chat', slack: 'Slack',
  jira: 'Jira', calendar: 'Calendar', meeting: 'Meeting', other: 'Other',
}

export const PROPOSED_LABELS: Record<ProposedType, string> = {
  next_action: 'Next action', waiting_for: 'Waiting for', calendar: 'Calendar',
  project: 'Project', someday_maybe: 'Someday / Maybe', reference: 'Reference',
}

export const SUGGESTION_LABELS: Record<SuggestionKind, { label: string; accept: string }> = {
  close: { label: 'Looks done', accept: 'Mark done' },
  follow_up: { label: 'Follow up', accept: 'Copy draft' },
  jira_issue: { label: 'Track in Jira', accept: 'Create issue' },
}

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source as TaskSource] ?? source
}

/** "Next action · owner: Ann · due 2026-12-01 · @office (80% sure)", or '' when there is no proposal. */
export function proposalSummary(proposal: AgentProposal | null | undefined): string {
  const parts = [
    proposal?.type && PROPOSED_LABELS[proposal.type],
    proposal?.owner && `owner: ${proposal.owner}`,
    proposal?.due && `due ${proposal.due}`,
    proposal?.contexts?.length ? proposal.contexts.join(', ') : null,
  ].filter(Boolean).join(' · ')
  if (!parts) return ''
  return typeof proposal?.confidence === 'number' ? `${parts} (${Math.round(proposal.confidence * 100)}% sure)` : parts
}
