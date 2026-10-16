'use client'

import { useState, useEffect } from 'react'
import { ExternalLink } from 'lucide-react'
import { getReviewInboxCount } from '@/lib/actions/review'

interface ReviewStep1InboxProps { onNext: () => void }

export function ReviewStep1Inbox({ onNext }: ReviewStep1InboxProps) {
  const [count, setCount] = useState<number | null>(null)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState(false)
  const [skip, setSkip] = useState(false)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let mounted = true
    let request = 0
    async function refresh() {
      const current = ++request
      setChecking(true)
      try {
        const count = await getReviewInboxCount()
        if (mounted && current === request) { setCount(count); setError(false) }
      } catch {
        if (mounted && current === request) setError(true)
      } finally {
        if (mounted && current === request) setChecking(false)
      }
    }
    function onVisible() { if (document.visibilityState === 'visible') void refresh() }
    void refresh()
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      mounted = false
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [reload])

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm">Process the items you collected, including your mind sweep, before reviewing your lists.</p>
      <div className="flex justify-between text-sm" aria-live="polite">
        <span>Current inbox count</span><span>{checking ? 'Checking…' : error ? 'Unavailable' : count}</span>
      </div>
      {error && <p role="alert">Could not check your inbox. Please retry.</p>}
      <a href="/inbox" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-indigo-300">
        <ExternalLink className="w-3.5 h-3.5" /> Open Inbox in new tab
      </a>
      <button onClick={() => setReload((value) => value + 1)} disabled={checking} className="text-sm self-start">Refresh inbox count</button>
      {count !== null && count > 0 && (
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" checked={skip} onChange={(event) => setSkip(event.target.checked)} />
          Continue with {count} items to process later
        </label>
      )}
      <button onClick={onNext} disabled={checking || error || count === null || (count > 0 && !skip)}
        className="btn-primary disabled:opacity-40">
        {count !== null && count > 0 ? 'Continue with remaining items →' : 'Continue →'}
      </button>
    </div>
  )
}
