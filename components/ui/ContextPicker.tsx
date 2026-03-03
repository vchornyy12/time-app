'use client'

import { useState, useTransition } from 'react'
import { X } from 'lucide-react'
import { DEFAULT_CONTEXTS } from '@/lib/constants/contexts'
import { addUserContext, deleteUserContext } from '@/lib/actions/contexts'
import { cn } from '@/lib/utils/cn'

interface ContextPickerProps {
  value: string[]
  onChange: (v: string[]) => void
  userContexts?: string[]
}

export function ContextPicker({ value, onChange, userContexts = [] }: ContextPickerProps) {
  const [customInput, setCustomInput] = useState('')
  const [, startTransition] = useTransition()

  // Local copy so newly added customs show immediately without waiting for revalidation
  const [localUserContexts, setLocalUserContexts] = useState<string[]>(userContexts)

  // Contexts selected on this task that aren't in defaults or user-saved contexts
  const unsavedCustoms = value.filter(
    (ctx) => !DEFAULT_CONTEXTS.includes(ctx) && !localUserContexts.includes(ctx)
  )
  const allPills = [...DEFAULT_CONTEXTS, ...localUserContexts, ...unsavedCustoms]

  function toggle(ctx: string) {
    onChange(value.includes(ctx) ? value.filter((c) => c !== ctx) : [...value, ctx])
  }

  function addCustom() {
    const raw = customInput.trim()
    if (!raw) return
    const ctx = (raw.startsWith('@') ? raw : `@${raw}`).toLowerCase()
    // Check for duplicates case-insensitively
    const alreadyExists = allPills.some((p) => p.toLowerCase() === ctx)
    if (!value.some((v) => v.toLowerCase() === ctx)) {
      onChange([...value, ctx])
    }
    // Persist as a user context if not already saved
    if (!alreadyExists) {
      setLocalUserContexts((prev) => [...prev, ctx])
      startTransition(async () => {
        await addUserContext(ctx)
      })
    }
    setCustomInput('')
  }

  function handleDeleteUserContext(ctx: string) {
    setLocalUserContexts((prev) => prev.filter((c) => c !== ctx))
    onChange(value.filter((c) => c !== ctx))
    startTransition(async () => {
      await deleteUserContext(ctx)
    })
  }

  const isUserContext = (ctx: string) => localUserContexts.includes(ctx)

  return (
    <div className="flex flex-col gap-3">
      {/* Context pills */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Context tags">
        {allPills.map((ctx) => {
          const active = value.includes(ctx)
          return (
            <span key={ctx} className="relative inline-flex items-center">
              <button
                type="button"
                onClick={() => toggle(ctx)}
                aria-pressed={active}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium border transition-all duration-150',
                  isUserContext(ctx) ? 'rounded-l-full' : 'rounded-full',
                  active
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                    : ''
                )}
                style={active ? undefined : { background: 'var(--bg-surface)', color: 'var(--text-tertiary)', borderColor: 'var(--border-subtle)' }}
              >
                {ctx}
              </button>
              {isUserContext(ctx) && (
                <button
                  type="button"
                  onClick={() => handleDeleteUserContext(ctx)}
                  className={cn(
                    'px-1.5 py-1.5 text-xs border border-l-0 rounded-r-full transition-all duration-150',
                    active
                      ? 'bg-indigo-500/20 text-indigo-300/60 border-indigo-500/30 hover:text-red-300 hover:bg-red-500/20'
                      : 'hover:text-red-300 hover:bg-red-500/20'
                  )}
                  aria-label={`Delete custom context ${ctx}`}
                  title={`Remove ${ctx}`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          )
        })}
      </div>

      {/* Custom context input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addCustom()
            }
          }}
          placeholder="@custom…"
          className="glass-input flex-1 text-sm"
          aria-label="Add custom context"
        />
        <button
          type="button"
          onClick={addCustom}
          disabled={!customInput.trim()}
          className="px-3 py-2 text-xs rounded-lg bg-white/[0.07] border border-white/[0.10] text-white/55 hover:text-white/80 hover:bg-white/[0.10] disabled:opacity-40 transition-all duration-150 flex-shrink-0"
        >
          Add
        </button>
      </div>
    </div>
  )
}
