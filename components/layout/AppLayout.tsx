'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { MobileNav } from './MobileNav'
import { QuickCaptureBar } from './QuickCaptureBar'
import { SearchPalette } from '@/components/ui'

interface AppLayoutProps {
  children: React.ReactNode
  inboxCount: number
  lastReviewDate: string | null
  userEmail: string
}

export function AppLayout({ children, inboxCount, lastReviewDate, userEmail }: AppLayoutProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  // Global Cmd/Ctrl+K to open search
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsSearchOpen(true)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-page)' }}>
      {/* Skip-to-main-content link — visible only on keyboard focus */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Sidebar — hidden on mobile, visible md+ */}
      <div className="hidden md:flex">
        <Sidebar
          inboxCount={inboxCount}
          lastReviewDate={lastReviewDate}
          userEmail={userEmail}
          onOpenSearch={() => setIsSearchOpen(true)}
        />
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6 pb-36 md:pb-28" id="main-content" tabIndex={-1}>
          {children}
        </main>
        <QuickCaptureBar />
      </div>

      {/* Mobile bottom navigation */}
      <MobileNav
        inboxCount={inboxCount}
        onOpenSearch={() => setIsSearchOpen(true)}
      />

      {/* Search palette */}
      <SearchPalette open={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </div>
  )
}
