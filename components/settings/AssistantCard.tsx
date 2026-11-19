'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, MessageSquare, SlidersHorizontal } from 'lucide-react'
import {
  disconnectGoogleChat,
  disconnectNotifications,
  saveAgentProfile,
  saveNotificationWebhook,
  sendTestNotification,
} from '@/lib/actions/assistant'

export interface AssistantCardProps {
  chatConfigured: boolean
  chatConnected: boolean
  chatEmail: string | null
  notifyConnected: boolean
  instructions: string
  muted: string[]
  justConnectedChat?: boolean
}

const box = { background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }

function Row({ icon, title, description, children }: { icon: React.ReactNode; title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 pt-4 first:pt-0 border-t first:border-t-0" style={{ borderColor: 'var(--border-subtle)' }}>
      <div>
        <p className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>{icon} {title}</p>
        <p className="text-xs mt-1 leading-relaxed max-w-md" style={{ color: 'var(--text-tertiary)' }}>{description}</p>
      </div>
      {children}
    </div>
  )
}

export function AssistantCard(props: AssistantCardProps) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [webhook, setWebhook] = useState('')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    props.justConnectedChat ? { ok: true, text: 'Google Chat connected.' } : null,
  )
  const [instructions, setInstructions] = useState(props.instructions)
  const [muted, setMuted] = useState(props.muted.join('\n'))

  const run = (fn: () => Promise<{ ok: boolean; text: string } | void>) => start(async () => {
    try {
      const result = await fn()
      if (result) setMessage(result)
      router.refresh()
    } catch {
      setMessage({ ok: false, text: 'Something went wrong. Please try again.' })
    }
  })

  return (
    <div className="px-5 py-5 rounded-xl flex flex-col gap-4" style={box}>
      <Row
        icon={<MessageSquare className="w-4 h-4" aria-hidden="true" />}
        title="Google Chat as a source"
        description="Lets your assistant read your Google Chat conversations (read-only) and capture action items into the Inbox."
      >
        {!props.chatConfigured ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Not available on this server yet.</p>
        ) : props.chatConnected ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-300">Connected{props.chatEmail ? ` · ${props.chatEmail}` : ''}</span>
            <button type="button" disabled={pending} className="text-xs" style={{ color: 'var(--text-muted)' }}
              onClick={() => run(async () => { await disconnectGoogleChat(); return { ok: true, text: 'Google Chat disconnected.' } })}>
              Disconnect
            </button>
          </div>
        ) : (
          <a href="/api/google-chat/auth" className="btn-glass !px-3 !py-2 text-sm self-start">Connect Google Chat</a>
        )}
      </Row>

      <Row
        icon={<Bell className="w-4 h-4" aria-hidden="true" />}
        title="Notifications in Google Chat"
        description="Create a space for yourself (e.g. “Time24 Assistant”), open Apps & integrations → Webhooks → Add webhook, and paste its URL here. Digests, reminders and urgent items arrive there."
      >
        {props.notifyConnected ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-300">Connected</span>
            <div className="flex items-center gap-3">
              <button type="button" disabled={pending} className="text-xs" style={{ color: 'var(--text-secondary)' }}
                onClick={() => run(async () => { const r = await sendTestNotification(); return { ok: r.ok, text: r.ok ? 'Test message sent.' : r.error ?? 'Could not send.' } })}>
                Send test
              </button>
              <button type="button" disabled={pending} className="text-xs" style={{ color: 'var(--text-muted)' }}
                onClick={() => run(async () => { await disconnectNotifications(); return { ok: true, text: 'Notifications turned off.' } })}>
                Disconnect
              </button>
            </div>
          </div>
        ) : (
          <form className="flex items-center gap-2" onSubmit={(e) => {
            e.preventDefault()
            run(async () => {
              const r = await saveNotificationWebhook(webhook)
              if (r.ok) setWebhook('')
              return r.ok ? { ok: true, text: 'Connected. A test message was sent to the space.' } : { ok: false, text: r.error }
            })
          }}>
            <input type="url" required value={webhook} onChange={(e) => setWebhook(e.target.value)} autoComplete="off"
              placeholder="https://chat.googleapis.com/v1/spaces/…" className="glass-input text-sm flex-1 min-w-0" aria-label="Google Chat webhook URL" />
            <button type="submit" disabled={pending} className="btn-glass !px-3 !py-2 text-sm">Save</button>
          </form>
        )}
      </Row>

      <Row
        icon={<SlidersHorizontal className="w-4 h-4" aria-hidden="true" />}
        title="Assistant instructions"
        description="Your standing rules for the assistant: projects and their Jira keys, key people, what to ignore. Conversations listed under “Muted” are never read."
      >
        <form className="flex flex-col gap-2" onSubmit={(e) => {
          e.preventDefault()
          run(async () => {
            await saveAgentProfile({ instructions, muted: muted.split('\n') })
            return { ok: true, text: 'Instructions saved.' }
          })
        }}>
          <label className="text-xs" style={{ color: 'var(--text-tertiary)' }} htmlFor="assistant-instructions">Instructions</label>
          <textarea id="assistant-instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={4000} rows={6}
            className="glass-input text-sm" placeholder={'Projects: WrangleWorks (client), Binariks site (Jira N30), Finance tool…\nAlways capture requests from Eric Hills.\nIgnore INVOICES check.'} />
          <label className="text-xs" style={{ color: 'var(--text-tertiary)' }} htmlFor="assistant-muted">Muted conversations (one per line, part of the name is enough)</label>
          <textarea id="assistant-muted" value={muted} onChange={(e) => setMuted(e.target.value)} rows={4}
            className="glass-input text-sm" placeholder={'Celebrating Together\nKudos Hub\nBinariks site monitoring'} />
          <button type="submit" disabled={pending} className="btn-glass !px-3 !py-2 text-sm self-start">Save instructions</button>
        </form>
      </Row>

      {message && (
        <p role="status" className={`text-xs ${message.ok ? 'text-emerald-300' : 'text-red-300'}`}>{message.text}</p>
      )}
    </div>
  )
}
