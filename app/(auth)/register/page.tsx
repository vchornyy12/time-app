'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="glass-card w-full max-w-md p-8 flex flex-col gap-4 text-center">
        <div className="text-4xl">📬</div>
        <h1 className="text-xl font-semibold " style={{ color: 'var(--text-primary)' }}>Check your email</h1>
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
          We sent a confirmation link to <span style={{ color: 'var(--text-secondary)' }}>{email}</span>. Click it
          to activate your account.
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
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Create account</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-tertiary)' }}>Start your time24 journey</p>
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
        <input
          type="password"
          placeholder="Password (min. 8 characters)"
          autoComplete="new-password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          aria-label="Password"
          className="glass-input"
        />
        <button type="submit" disabled={loading} className="btn-primary mt-1">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Create account
        </button>
      </form>

      <p className="text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
        Already have an account?{' '}
        <Link href="/login" className="transition-colors" style={{ color: 'var(--text-secondary)' }}>
          Sign in
        </Link>
      </p>
    </div>
  )
}
