'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      // After exchange, callback redirects to /update-password
      redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSent(true)
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="glass-card w-full max-w-md p-8 flex flex-col gap-4 text-center">
        <div className="text-4xl">✉️</div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Check your email</h1>
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
          We sent a password reset link to{' '}
          <span style={{ color: 'var(--text-secondary)' }}>{email}</span>.
        </p>
        <Link
          href="/login"
          className="mt-2 text-sm transition-colors"
          style={{ color: 'var(--text-tertiary)' }}
        >
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="glass-card w-full max-w-md p-8 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Reset password</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-tertiary)' }}>
          Enter your email and we&apos;ll send you a reset link
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="email"
          placeholder="Email address"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          aria-label="Email address"
          className="glass-input"
        />
        <button type="submit" disabled={loading} className="btn-primary mt-1">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Send reset link
        </button>
      </form>

      <p className="text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
        Remembered it?{' '}
        <Link href="/login" className="transition-colors" style={{ color: 'var(--text-secondary)' }}>
          Back to sign in
        </Link>
      </p>
    </div>
  )
}
