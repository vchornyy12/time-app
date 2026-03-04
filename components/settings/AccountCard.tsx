'use client'

import { useState, useTransition } from 'react'
import { LogOut, Trash2, AlertTriangle, Loader2, X } from 'lucide-react'
import { signOut, deleteAccount } from '@/lib/actions/account'

interface AccountCardProps {
  email: string
}

export function AccountCard({ email }: AccountCardProps) {
  const [signOutPending, startSignOut] = useTransition()
  const [deletePending, startDelete] = useTransition()

  // 'idle' | 'confirming'
  const [stage, setStage] = useState<'idle' | 'confirming'>('idle')
  const [confirmEmail, setConfirmEmail] = useState('')
  const [error, setError] = useState<string | null>(null)

  const emailMatches = confirmEmail.toLowerCase().trim() === email.toLowerCase()

  function handleSignOut() {
    startSignOut(() => signOut())
  }

  function handleOpenConfirm() {
    setStage('confirming')
    setConfirmEmail('')
    setError(null)
  }

  function handleCancel() {
    setStage('idle')
    setConfirmEmail('')
    setError(null)
  }

  function handleDelete() {
    setError(null)
    startDelete(async () => {
      const result = await deleteAccount(confirmEmail)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Account info ── */}
      <div
        className="px-5 py-5 rounded-xl flex items-center justify-between gap-4"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
      >
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            Signed in as
          </p>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
            {email}
          </p>
        </div>
        <button
          onClick={handleSignOut}
          disabled={signOutPending}
          className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          style={{
            background: 'var(--bg-surface-hover)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)',
          }}
        >
          {signOutPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <LogOut className="w-4 h-4" />
          )}
          Sign out
        </button>
      </div>

      {/* ── Danger zone ── */}
      <div className="rounded-xl border border-red-500/20 overflow-hidden">
        {/* Header row */}
        <div className="px-5 py-4 flex items-center justify-between gap-4 bg-red-500/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-300">Delete account</p>
              <p className="text-xs mt-0.5 text-red-400/70">
                Permanently deletes your account and all data. This cannot be undone.
              </p>
            </div>
          </div>

          {stage === 'idle' && (
            <button
              onClick={handleOpenConfirm}
              className="shrink-0 flex items-center gap-2 text-sm px-4 py-2 rounded-lg border border-red-500/30 text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete account
            </button>
          )}
        </div>

        {/* Confirmation panel */}
        {stage === 'confirming' && (
          <div className="px-5 py-5 border-t border-red-500/20 bg-[#1a1010] flex flex-col gap-4">
            {/* What gets deleted */}
            <div className="text-xs text-red-400/80 leading-relaxed space-y-1">
              <p className="font-medium text-red-300">The following will be permanently deleted:</p>
              <ul className="list-disc list-inside flex flex-col gap-0.5 mt-1 text-red-400/70">
                <li>All your tasks, inbox items, and notes</li>
                <li>All your projects and rough plans</li>
                <li>Google Calendar connection and tokens</li>
                <li>All settings and preferences</li>
                <li>Your account credentials</li>
              </ul>
            </div>

            {/* Email confirmation input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-red-400/80">
                Type your email address{' '}
                <span className="font-mono text-red-300">{email}</span> to confirm:
              </label>
              <input
                type="email"
                value={confirmEmail}
                onChange={(e) => {
                  setConfirmEmail(e.target.value)
                  setError(null)
                }}
                placeholder={email}
                autoComplete="off"
                className="w-full px-3 py-2 rounded-lg text-sm bg-black/30 border border-red-500/30 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-red-500/60"
              />
            </div>

            {/* Error */}
            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleDelete}
                disabled={!emailMatches || deletePending}
                className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg border border-red-500/40 text-red-300 bg-red-500/15 hover:bg-red-500/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deletePending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Permanently delete account
              </button>
              <button
                onClick={handleCancel}
                disabled={deletePending}
                className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-40"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
