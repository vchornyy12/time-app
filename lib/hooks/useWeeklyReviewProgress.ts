'use client'

import { useCallback, useSyncExternalStore } from 'react'

const fallback = new Map<string, number>()
const memoryOnly = new Set<string>()
const EVENT = 'time24-review-progress'
function subscribe(listener: () => void) {
  window.addEventListener('storage', listener)
  window.addEventListener(EVENT, listener)
  return () => {
    window.removeEventListener('storage', listener)
    window.removeEventListener(EVENT, listener)
  }
}

export function useWeeklyReviewProgress(userId: string) {
  const key = `weekly-review:v2:${userId}`
  const read = useCallback(() => {
    if (memoryOnly.has(key)) return fallback.get(key) ?? 0
    try {
      const step = Number(window.localStorage.getItem(key) ?? 0)
      return Number.isInteger(step) && step >= 0 && step <= 7 ? step : 0
    } catch { return fallback.get(key) ?? 0 }
  }, [key])
  const step = useSyncExternalStore(subscribe, read, () => 0)
  const setStep = useCallback((next: number) => {
    fallback.set(key, next)
    try {
      if (next === 0) window.localStorage.removeItem(key)
      else window.localStorage.setItem(key, String(next))
      memoryOnly.delete(key)
    } catch { memoryOnly.add(key) /* Review remains usable when browser storage is unavailable. */ }
    window.dispatchEvent(new Event(EVENT))
  }, [key])
  return [step, setStep] as const
}
