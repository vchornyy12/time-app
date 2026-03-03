'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const themes = ['light', 'dark', 'system'] as const

const icons = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return <div className="w-7 h-7" />
  }

  const current = (theme ?? 'dark') as (typeof themes)[number]
  const nextIndex = (themes.indexOf(current) + 1) % themes.length
  const next = themes[nextIndex]
  const Icon = icons[current] ?? Moon

  return (
    <button
      onClick={() => setTheme(next)}
      className={cn(
        'w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-150',
        'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]',
        'hover:bg-[var(--nav-hover-bg)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60',
      )}
      aria-label={`Switch to ${next} theme`}
      title={`Theme: ${current}`}
    >
      <Icon className="w-4 h-4" />
    </button>
  )
}
