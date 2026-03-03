'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Tray,
  Lightning,
  Calendar,
  FolderOpen,
  List,
  X,
  Clock,
  BookmarkSimple,
  Notepad,
  Trash,
  ClipboardText,
  Gear,
  ChartBar,
  MagnifyingGlass,
} from '@phosphor-icons/react'
import type { IconWeight } from '@phosphor-icons/react'
import { cn } from '@/lib/utils/cn'
import { Badge } from '@/components/ui'

type PhosphorIcon = typeof Tray

interface MobileNavProps {
  inboxCount: number
  onOpenSearch: () => void
}

const primaryTabs: { href: string; label: string; Icon: PhosphorIcon }[] = [
  { href: '/inbox', label: 'Inbox', Icon: Tray },
  { href: '/next-actions', label: 'Actions', Icon: Lightning },
  { href: '/calendar', label: 'Calendar', Icon: Calendar },
  { href: '/projects', label: 'Projects', Icon: FolderOpen },
]

const moreItems: { href: string; label: string; Icon: PhosphorIcon }[] = [
  { href: '/waiting-for', label: 'Waiting For', Icon: Clock },
  { href: '/someday', label: 'Someday / Maybe', Icon: BookmarkSimple },
  { href: '/notes', label: 'Notes', Icon: Notepad },
  { href: '/weekly-review', label: 'Weekly Review', Icon: ClipboardText },
  { href: '/analytics', label: 'Analytics', Icon: ChartBar },
  { href: '/trash', label: 'Trash', Icon: Trash },
  { href: '/settings', label: 'Settings', Icon: Gear },
]

const ICON_SIZE = 20
const TAB_ICON_SIZE = 22

export function MobileNav({ inboxCount, onOpenSearch }: MobileNavProps) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  const isMoreActive = moreItems.some((item) => pathname === item.href)

  return (
    <>
      {/* More menu overlay */}
      {moreOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 backdrop-blur-sm"
            style={{ background: 'var(--backdrop-bg)' }}
            onClick={() => setMoreOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute bottom-16 left-0 right-0 px-3 pb-2">
            <nav
              className="glass-card p-2 flex flex-col gap-0.5"
              aria-label="More navigation"
            >
              <button
                onClick={() => {
                  onOpenSearch()
                  setMoreOpen(false)
                }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-normal transition-all duration-150"
                style={{ color: 'var(--nav-text)' }}
              >
                <span className="w-5 h-5 flex items-center justify-center" style={{ color: 'var(--nav-icon)' }}>
                  <MagnifyingGlass size={ICON_SIZE} weight="light" />
                </span>
                <span>Search</span>
                <kbd
                  className="ml-auto text-[11px] rounded px-1.5 py-0.5"
                  style={{ color: 'var(--kbd-text)', background: 'var(--kbd-bg)' }}
                >
                  ⌘K
                </kbd>
              </button>
              <div className="h-px my-0.5 mx-2" style={{ background: 'var(--nav-divider)' }} />
              {moreItems.map((item) => {
                const active = pathname === item.href
                const weight: IconWeight = active ? 'fill' : 'light'
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150',
                      active ? 'font-semibold' : 'font-normal'
                    )}
                    style={{
                      background: active ? 'var(--nav-active-bg)' : undefined,
                      color: active ? 'var(--nav-text-active)' : 'var(--nav-text)',
                    }}
                    aria-current={active ? 'page' : undefined}
                  >
                    <span
                      className="w-5 h-5 flex items-center justify-center"
                      style={{ color: active ? 'var(--nav-icon-active)' : 'var(--nav-icon)' }}
                    >
                      <item.Icon size={ICON_SIZE} weight={weight} />
                    </span>
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Bottom tab bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 backdrop-blur-[20px]"
        style={{
          borderTop: '1px solid var(--sidebar-border)',
          background: 'var(--mobile-nav-bg)',
        }}
        aria-label="Mobile navigation"
      >
        <div className="flex items-stretch">
          {primaryTabs.map((tab) => {
            const active = pathname === tab.href
            const weight: IconWeight = active ? 'fill' : 'light'
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'flex-1 flex flex-col items-center gap-0.5 py-2 pt-2.5 transition-colors duration-150',
                  active ? 'text-indigo-400 dark:text-indigo-300' : ''
                )}
                style={!active ? { color: 'var(--nav-icon)' } : undefined}
                aria-current={active ? 'page' : undefined}
              >
                <span className="relative w-[22px] h-[22px] flex items-center justify-center">
                  <tab.Icon size={TAB_ICON_SIZE} weight={weight} />
                  {tab.href === '/inbox' && inboxCount > 0 && (
                    <span className="absolute -top-1.5 -right-2.5">
                      <Badge count={inboxCount} variant="indigo" />
                    </span>
                  )}
                </span>
                <span className={cn('text-[10px] leading-tight', active ? 'font-semibold' : 'font-normal')}>
                  {tab.label}
                </span>
              </Link>
            )
          })}

          {/* More button */}
          <button
            onClick={() => setMoreOpen((prev) => !prev)}
            className={cn(
              'flex-1 flex flex-col items-center gap-0.5 py-2 pt-2.5 transition-colors duration-150',
              moreOpen || isMoreActive ? 'text-indigo-400 dark:text-indigo-300' : ''
            )}
            style={!(moreOpen || isMoreActive) ? { color: 'var(--nav-icon)' } : undefined}
            aria-expanded={moreOpen}
            aria-label="More navigation options"
          >
            <span className="w-[22px] h-[22px] flex items-center justify-center">
              {moreOpen ? (
                <X size={TAB_ICON_SIZE} weight="light" />
              ) : (
                <List size={TAB_ICON_SIZE} weight={moreOpen || isMoreActive ? 'fill' : 'light'} />
              )}
            </span>
            <span className={cn('text-[10px] leading-tight', moreOpen || isMoreActive ? 'font-semibold' : 'font-normal')}>
              More
            </span>
          </button>
        </div>

        {/* Safe area padding for devices with home indicator */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>
    </>
  )
}
