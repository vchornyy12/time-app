'use client'

import { useEffect, useCallback, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useFocusTrap } from '@/lib/hooks/useFocusTrap'

interface ResponsiveOverlayProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  title?: string
  /** Extra classes on the panel container */
  className?: string
}

/**
 * Responsive overlay: centered modal on mobile, slide-over panel on md+ screens.
 * Uses the Liquid Glass design system and supports focus trap, Escape key, and
 * click-outside-to-close.
 */
export function ResponsiveOverlay({
  open,
  onClose,
  children,
  title,
  className,
}: ResponsiveOverlayProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useFocusTrap(panelRef, open)

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose],
  )

  useEffect(() => {
    if (!open) return
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [open, handleKey])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 animate-fade-in" role="presentation">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* ── Mobile: centered modal ─────────────────────────── */}
      {/* ── Desktop (md+): slide-over from right ───────────── */}
      <div
        ref={panelRef}
        className={cn(
          // Shared
          'relative flex flex-col overflow-hidden',
          // Mobile: centered modal
          'mx-auto mt-[10vh] max-h-[80vh] w-[calc(100%-2rem)] max-w-lg rounded-2xl',
          'glass-card animate-slide-up',
          // Desktop: slide-over panel
          'md:m-0 md:ml-auto md:mt-0 md:max-h-none md:h-full md:w-full md:max-w-md md:rounded-none md:rounded-l-2xl',
          'md:animate-slide-in-from-right',
          className,
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'overlay-title' : undefined}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 flex-shrink-0">
          {title ? (
            <h2
              id="overlay-title"
              className="text-lg font-semibold truncate"
              style={{ color: 'var(--text-primary)' }}
            >
              {title}
            </h2>
          ) : (
            <span />
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-all duration-150 flex-shrink-0 overlay-close-btn"
            style={{ color: 'var(--text-tertiary)' }}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {children}
        </div>
      </div>
    </div>
  )
}
