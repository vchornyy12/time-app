'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { acceptGmailSuggestion, dismissGmailSuggestion, getGmailScanRun, startGmailScan, type GmailScanRun, type GmailTaskSuggestion } from '@/lib/actions/gmail'

const batches = [25, 50, 100, 500] as const

export function GmailInboxScanner({ connected, batchSize: initialBatchSize = 50, suggestions: initialSuggestions, initialRun = null }: {
  connected: boolean
  batchSize?: (typeof batches)[number]
  suggestions: GmailTaskSuggestion[]
  initialRun?: GmailScanRun | null
}) {
  const [suggestions, setSuggestions] = useState(initialSuggestions)
  const [batchSize, setBatchSize] = useState<(typeof batches)[number]>(initialBatchSize)
  const [consent, setConsent] = useState(false)
  const [run, setRun] = useState<GmailScanRun | null>(initialRun)
  const [message, setMessage] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  useEffect(() => setSuggestions(initialSuggestions), [initialSuggestions])
  useEffect(() => {
    if (!run || !['queued', 'running'].includes(run.status)) return
    let active = true
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      let current: GmailScanRun | null
      try { current = await getGmailScanRun(run.id) } catch {
        if (active) timer = setTimeout(poll, 5000)
        return
      }
      if (!active) return
      if (current) setRun(current)
      if (current && ['completed', 'failed'].includes(current.status)) {
        setMessage(current.status === 'completed'
          ? `Scan complete. ${current.suggestion_count} suggestion(s) are ready for review.`
          : current.error_message || 'Gmail scan failed. Please retry.')
        router.refresh()
      } else timer = setTimeout(poll, 2000)
    }
    timer = setTimeout(poll, 1000)
    return () => { active = false; clearTimeout(timer) }
  }, [run?.id, run?.status, router])

  function scan() {
    if (!consent || pending) return
    setConsent(false)
    setMessage('')
    startTransition(async () => {
      const response = await startGmailScan(true, batchSize)
      if (response.error) setMessage(response.error)
      else if (response.run) setRun(response.run)
    })
  }

  const scanning = !!run && ['queued', 'running'].includes(run.status)

  return <section className="mb-6 rounded-xl p-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
    <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Gmail task suggestions</h2>
    {!connected ? <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>Connect Gmail in Settings to scan your Inbox.</p> : <>
      <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>Scan your Gmail Inbox from newest to oldest. Previously processed messages are skipped. Email text is sent to your connected OpenAI account only after you consent.</p>
      <div className="flex flex-wrap items-center gap-3 mt-4">
        <label className="text-sm">Messages to scan <select aria-label="Messages to scan" value={batchSize} disabled={pending} onChange={event => setBatchSize(Number(event.target.value) as (typeof batches)[number])} className="ml-2 rounded-md px-2 py-1" style={{ background: 'var(--bg-surface-hover)', color: 'var(--text-primary)' }}>{batches.map(count => <option key={count} value={count}>{count}</option>)}</select></label>
        <button type="button" disabled={pending || scanning || !consent} onClick={scan} className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50" style={{ background: 'var(--accent)', color: 'white' }}>{pending ? 'Starting…' : scanning ? 'Scanning…' : 'Scan now'}</button>
      </div>
      <label className="flex gap-2 items-start mt-3 text-xs" style={{ color: 'var(--text-muted)' }}><input type="checkbox" checked={consent} disabled={pending || scanning} onChange={event => setConsent(event.target.checked)} /><span>I consent to sending up to {batchSize} messages’ text, subject, and sender to OpenAI to suggest tasks. I will review every suggestion before it is added.</span></label>
      {scanning && <div className="mt-3" role="status" aria-live="polite"><p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Processed {run.processed_count} of up to {run.batch_size} messages</p><progress className="w-full" max={run.batch_size} value={Math.min(run.processed_count, run.batch_size)} /></div>}
    </>}
    {!!message && <p className="text-sm mt-3" role="status" aria-live="polite" style={{ color: 'var(--text-muted)' }}>{message}</p>}
    {!!suggestions.length && <div className="mt-5 space-y-3"><h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Review suggested tasks</h3>
      {suggestions.map(suggestion => <article key={suggestion.id} className="rounded-lg p-4" style={{ background: 'var(--bg-surface-hover)' }}>
        <h4 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{suggestion.title}</h4>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>From {suggestion.from} · {suggestion.date} · {suggestion.subject || '(no subject)'}</p>
        <a className="text-xs underline mt-2 inline-block" href={`https://mail.google.com/mail/u/0/#all/${encodeURIComponent(suggestion.messageId)}`} target="_blank" rel="noopener noreferrer">Open source email</a>
        <div className="flex gap-2 mt-3"><button type="button" disabled={pending} onClick={() => startTransition(async () => { const response = await acceptGmailSuggestion(suggestion.id, suggestion.title); setMessage(response.error ?? 'Task added to your inbox.'); if (!response.error) setSuggestions(items => items.filter(item => item.id !== suggestion.id)) })} className="text-xs rounded-md px-3 py-1.5" style={{ background: 'var(--accent)', color: 'white' }}>Accept and add task</button><button type="button" disabled={pending} onClick={() => startTransition(async () => { const response = await dismissGmailSuggestion(suggestion.id); setMessage(response.error ?? 'Suggestion dismissed.'); if (!response.error) setSuggestions(items => items.filter(item => item.id !== suggestion.id)) })} className="text-xs rounded-md px-3 py-1.5" style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>Dismiss</button></div>
      </article>)}
    </div>}
  </section>
}
