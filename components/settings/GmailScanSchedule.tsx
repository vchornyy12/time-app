'use client'

import { useState, useSyncExternalStore, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveGmailScanPreferences } from '@/lib/actions/gmail'

// The browser's zone is only known on the client; reading it through an
// external store keeps server and hydration output identical.
const subscribeToNothing = () => () => {}
const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
const serverTimeZone = () => 'UTC'

export function GmailScanSchedule({ initial, providerLabel }: { providerLabel?: string; initial: { frequency: 'manual' | 'daily' | 'twice_daily'; time: string; timezone: string; batchSize: 25 | 50 | 100 | 500; autoConsent: boolean } }) {
  const [frequency, setFrequency] = useState(initial.frequency)
  const [time, setTime] = useState(initial.time)
  const [editedTimezone, setTimezone] = useState<string | null>(null)
  const [batchSize, setBatchSize] = useState(initial.batchSize)
  const [autoConsent, setAutoConsent] = useState(initial.autoConsent)
  const [message, setMessage] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const localZone = useSyncExternalStore(subscribeToNothing, browserTimeZone, serverTimeZone)
  // An unset preference (the UTC default) follows the browser until the user edits it.
  const timezone = editedTimezone ?? (initial.timezone === 'UTC' ? localZone : initial.timezone)

  function save() {
    setMessage('')
    startTransition(async () => {
      const result = await saveGmailScanPreferences({ frequency, time, timezone, batchSize, autoConsent })
      setMessage(result.error ?? 'Gmail scan preferences saved.')
      if (!result.error) router.refresh()
    })
  }

  return <section className="mt-4 rounded-lg p-4" style={{ background: 'var(--bg-surface-hover)' }}>
    <h4 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Inbox scanning</h4>
    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Choose how many unprocessed messages each scan can analyze. Automatic schedules begin after the worker is deployed to the published site and may start up to 15 minutes after the selected time.</p>
    <div className="grid gap-3 mt-3 sm:grid-cols-2">
      <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Schedule<select className="block mt-1 w-full rounded-md px-2 py-2" value={frequency} onChange={event => { const value = event.target.value as typeof frequency; setFrequency(value); if (value === 'manual') setAutoConsent(false) }} style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)' }}><option value="manual">Manual only</option><option value="daily">Once a day</option><option value="twice_daily">Twice a day</option></select></label>
      <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Messages per scan<select className="block mt-1 w-full rounded-md px-2 py-2" value={batchSize} onChange={event => setBatchSize(Number(event.target.value) as typeof batchSize)} style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)' }}>{[25, 50, 100, 500].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      {frequency !== 'manual' && <>
        <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Local start time<input type="time" className="block mt-1 w-full rounded-md px-2 py-2" value={time} onChange={event => setTime(event.target.value)} style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)' }} /></label>
        <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Time zone<input className="block mt-1 w-full rounded-md px-2 py-2" value={timezone} onChange={event => setTimezone(event.target.value)} maxLength={64} style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)' }} /><span className="block mt-1">Use an IANA name, for example Europe/Warsaw.</span></label>
      </>}
    </div>
    {frequency !== 'manual' && <label className="flex gap-2 items-start mt-3 text-xs" style={{ color: 'var(--text-muted)' }}><input type="checkbox" checked={autoConsent} onChange={event => setAutoConsent(event.target.checked)} /><span>I consent to automatic scans sending up to {batchSize} messages’ text, subject, and sender to {providerLabel ? `my connected ${providerLabel} account` : 'the AI provider I connect'} on this schedule. Changing provider turns automatic scans off until I consent again. Suggestions remain for my review.</span></label>}
    <button type="button" disabled={pending} onClick={save} className="mt-3 rounded-lg px-3 py-2 text-sm disabled:opacity-50" style={{ background: 'var(--accent)', color: 'white' }}>{pending ? 'Saving…' : 'Save scan preferences'}</button>
    <p className="text-xs mt-2" role="status" aria-live="polite" style={{ color: 'var(--text-muted)' }}>{message}</p>
  </section>
}
