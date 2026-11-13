'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { acceptGmailSuggestion, dismissGmailSuggestion, getGmailScanRun, startGmailScan, type GmailScanRun, type GmailTaskSuggestion } from '@/lib/actions/gmail'
import { Toast } from '@/components/ui'

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
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [actingSuggestion, setActingSuggestion] = useState<{ id: string; action: 'accept' | 'dismiss' } | null>(null)
  const [exitingSuggestionId, setExitingSuggestionId] = useState<string | null>(null)
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

  function decideSuggestion(suggestion: GmailTaskSuggestion, action: 'accept' | 'dismiss') {
    if (pending || actingSuggestion) return
    setActingSuggestion({ id: suggestion.id, action })
    startTransition(async () => {
      const response = action === 'accept'
        ? await acceptGmailSuggestion(suggestion.id, suggestion.title)
        : await dismissGmailSuggestion(suggestion.id)
      if (response.error) {
        setMessage(response.error)
        setActingSuggestion(null)
        return
      }

      setMessage('')
      setToastMessage(action === 'accept' ? 'Task added to your Inbox.' : 'Suggestion dismissed.')
      setExitingSuggestionId(suggestion.id)
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (!reducedMotion) await new Promise(resolve => setTimeout(resolve, 280))
      setSuggestions(items => items.filter(item => item.id !== suggestion.id))
      setExitingSuggestionId(null)
      setActingSuggestion(null)
      if (action === 'accept') router.refresh()
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
      {suggestions.map(suggestion => {
        const exiting = exitingSuggestionId === suggestion.id
        const actionInProgress = actingSuggestion?.id === suggestion.id ? actingSuggestion.action : null
        return <article key={suggestion.id} aria-busy={actionInProgress !== null} className={`rounded-lg p-4 border transition-[opacity,transform,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-opacity ${exiting ? 'opacity-0 -translate-y-1 scale-[0.99]' : 'opacity-100 translate-y-0 scale-100'}`} style={{ background: 'var(--bg-surface-hover)', borderColor: 'var(--border-subtle)' }}>
        <h4 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{suggestion.title}</h4>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>From {suggestion.from} · {suggestion.date} · {suggestion.subject || '(no subject)'}</p>
        <a className="text-xs underline underline-offset-2 mt-2 inline-block transition-colors duration-300 hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] rounded-sm" href={`https://mail.google.com/mail/u/0/#all/${encodeURIComponent(suggestion.messageId)}`} target="_blank" rel="noopener noreferrer">Open source email</a>
        <div className="flex flex-wrap gap-2 mt-3">
          <button type="button" disabled={pending || !!actingSuggestion} onClick={() => decideSuggestion(suggestion, 'accept')} className="text-xs rounded-md px-3 py-1.5 font-medium border border-transparent transition-[background-color,transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 disabled:opacity-50 disabled:transform-none" style={{ background: 'var(--accent)', color: '#07130D' }}>{actionInProgress === 'accept' ? 'Adding…' : 'Accept and add task'}</button>
          <button type="button" disabled={pending || !!actingSuggestion} onClick={() => decideSuggestion(suggestion, 'dismiss')} className="text-xs rounded-md px-3 py-1.5 font-medium border transition-[background-color,color,border-color,transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 disabled:opacity-50 disabled:transform-none" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>{actionInProgress === 'dismiss' ? 'Dismissing…' : 'Dismiss'}</button>
        </div>
      </article>
      })}
    </div>}
    {toastMessage && <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />}
  </section>
}
