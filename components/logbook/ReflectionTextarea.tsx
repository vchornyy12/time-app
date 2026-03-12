'use client'

import { useState, useRef, useCallback } from 'react'
import { upsertReflection } from '@/lib/actions/logbook'

const DEBOUNCE_MS = 800

interface ReflectionTextareaProps {
  date: string
  initialContent: string
}

export function ReflectionTextarea({ date, initialContent }: ReflectionTextareaProps) {
  const [content, setContent] = useState(initialContent)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const save = useCallback(async (text: string) => {
    setIsSaving(true)
    setError(null)
    try {
      await upsertReflection(date, text)
    } catch {
      setError('Failed to save. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }, [date])

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value
    setContent(value)
    setError(null)

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => save(value), DEBOUNCE_MS)
  }

  return (
    <div className="mt-3">
      <textarea
        value={content}
        onChange={handleChange}
        placeholder="Write a quick note about today…"
        rows={20}
        className="w-full resize-none rounded-lg px-3 py-2 text-sm transition-colors duration-150 focus:outline-none focus:ring-2"
        style={{
          background: 'var(--input-bg)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border)',
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = '#3ECF8E')}
        onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
      />

      <div className="flex items-center gap-2 mt-1 min-h-[18px]">
        {isSaving && (
          <span role="status" className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Saving…
          </span>
        )}
        {error && (
          <p role="alert" className="text-xs text-red-400">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
