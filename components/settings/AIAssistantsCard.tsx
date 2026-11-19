'use client'

import { useState } from 'react'
import { Check, Copy, Sparkles } from 'lucide-react'

interface AIAssistantsCardProps {
  connectorUrl: string
  lastActivityAt: string | null
  capturedLast7Days: number
}

const STEPS = {
  claude: [
    'Open Claude → Settings → Connectors → Add custom connector.',
    'Name it "Time24" and paste the URL above. Leave the OAuth fields empty.',
    'Click Connect, sign in to Time24 and allow access.',
    'On Team or Enterprise plans, an owner may need to add the connector first.',
  ],
  chatgpt: [
    'Open ChatGPT → Settings → Apps & Connectors → Advanced, and turn on Developer mode.',
    'Create a connector: name it "Time24", paste the URL above, choose OAuth.',
    'Sign in to Time24 and allow access.',
    'On Business or Enterprise plans, an admin may need to allow custom connectors.',
  ],
} as const

export function AIAssistantsCard({ connectorUrl, lastActivityAt, capturedLast7Days }: AIAssistantsCardProps) {
  const [copied, setCopied] = useState(false)
  const [tab, setTab] = useState<keyof typeof STEPS>('claude')

  async function copy() {
    try {
      await navigator.clipboard.writeText(connectorUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard unavailable: the URL stays selectable */ }
  }

  return (
    <div className="px-5 py-5 rounded-xl flex flex-col gap-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Sparkles className="w-4 h-4" aria-hidden="true" /> AI assistants (Claude, ChatGPT)
          </p>
          <p className="text-xs mt-1.5 leading-relaxed max-w-md" style={{ color: 'var(--text-tertiary)' }}>
            Let your assistant capture action items from email, meetings and chats into your Inbox.
            It can only propose items and read your lists; you process everything here.
          </p>
        </div>
        {lastActivityAt && (
          <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-300 whitespace-nowrap">Active</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <code
          className="flex-1 min-w-0 truncate text-xs px-3 py-2 rounded-lg font-mono select-all"
          style={{ background: 'var(--bg-base, transparent)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
        >
          {connectorUrl}
        </code>
        <button type="button" onClick={copy} className="btn-glass !px-3 !py-2" aria-label="Copy connector URL">
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>

      <div>
        <div role="tablist" aria-label="Assistant" className="flex gap-1 mb-2">
          {(['claude', 'chatgpt'] as const).map((key) => (
            <button
              key={key}
              role="tab"
              type="button"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className="text-xs px-3 py-1 rounded-full transition-colors"
              style={tab === key
                ? { background: 'var(--border-subtle)', color: 'var(--text-primary)' }
                : { color: 'var(--text-tertiary)' }}
            >
              {key === 'claude' ? 'Claude' : 'ChatGPT'}
            </button>
          ))}
        </div>
        <ol role="tabpanel" className="list-decimal pl-5 flex flex-col gap-1 text-xs leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
          {STEPS[tab].map((step) => <li key={step}>{step}</li>)}
        </ol>
      </div>

      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {lastActivityAt
          ? `${capturedLast7Days} item${capturedLast7Days === 1 ? '' : 's'} captured in the last 7 days · last activity ${new Date(lastActivityAt).toLocaleString()}`
          : 'No assistant has connected yet.'}
      </p>
    </div>
  )
}
