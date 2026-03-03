'use client'

import { useEffect } from 'react'
import { RefreshCw } from 'lucide-react'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function AppError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Log to an error reporting service in production
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center h-full py-24 gap-5 text-center animate-fade-in">
      <div className="text-5xl opacity-30 select-none">⚠️</div>
      <div className="flex flex-col gap-1.5">
        <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>Something went wrong</p>
        <p className="text-sm max-w-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          {error.message && error.message !== 'An error occurred in the Server Components render.'
            ? error.message
            : 'An unexpected error occurred. Try refreshing the page.'}
        </p>
      </div>
      <button
        onClick={reset}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all duration-150"
        style={{ background: 'var(--btn-glass-bg)', border: '1px solid var(--btn-glass-border)', color: 'var(--text-secondary)' }}
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Try again
      </button>
    </div>
  )
}
