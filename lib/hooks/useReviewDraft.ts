'use client'

import { useCallback, useMemo, useSyncExternalStore } from 'react'

interface CaptureRequest { id: string; title: string }
interface Draft { text: string; requests: CaptureRequest[] }
const fallback = new Map<string, string>()
const memoryOnly = new Set<string>()
const EVENT = 'time24-review-draft'
function subscribe(listener: () => void) {
  window.addEventListener(EVENT, listener)
  return () => window.removeEventListener(EVENT, listener)
}

export function useReviewDraft(userId: string) {
  const key = `weekly-review-draft:v1:${userId}`
  const read = useCallback(() => {
    if (memoryOnly.has(key)) return fallback.get(key) ?? ''
    try { return window.sessionStorage.getItem(key) ?? '' }
    catch { return fallback.get(key) ?? '' }
  }, [key])
  const raw = useSyncExternalStore(subscribe, read, () => '')
  const draft = useMemo<Draft>(() => {
    try {
      const parsed = JSON.parse(raw)
      if (typeof parsed.text === 'string' && Array.isArray(parsed.requests) && parsed.requests.every(
        (request: CaptureRequest) => typeof request?.id === 'string' && typeof request?.title === 'string'
      )) return parsed
    } catch { /* Empty or corrupted browser draft. */ }
    return { text: '', requests: [] }
  }, [raw])
  const setDraft = useCallback((draft: Draft) => {
    const value = JSON.stringify(draft)
    fallback.set(key, value)
    try { window.sessionStorage.setItem(key, value); memoryOnly.delete(key) } catch { memoryOnly.add(key); /* Use in-memory draft. */ }
    window.dispatchEvent(new Event(EVENT))
  }, [key])
  return [draft, setDraft] as const
}
