'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Tray,
  Lightning,
  Clock,
  BookmarkSimple,
  Calendar,
  Notepad,
  Trash,
  FolderOpen,
  ClipboardText,
  Gear,
  SignOut,
  MagnifyingGlass,
  ChartBar,
} from '@phosphor-icons/react'
import type { IconWeight } from '@phosphor-icons/react'
import { cn } from '@/lib/utils/cn'
import { Badge, ThemeSwitcher } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'

// ── Icon mapping ────────────────────────────────────────────

type PhosphorIcon = typeof Tray

interface NavItem {
  href: string
  label: string
  Icon: PhosphorIcon
  badge?: number
  sublabel?: string
}

interface SidebarProps {
  inboxCount: number
  lastReviewDate: string | null
  userEmail: string
  onOpenSearch: () => void
}

const ICON_SIZE = 20

export function Sidebar({ inboxCount, lastReviewDate, userEmail, onOpenSearch }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const primaryNav: NavItem[] = [
    { href: '/inbox', label: 'Inbox', Icon: Tray, badge: inboxCount },
    { href: '/next-actions', label: 'Next Actions', Icon: Lightning },
    { href: '/waiting-for', label: 'Waiting For', Icon: Clock },
    { href: '/someday', label: 'Someday / Maybe', Icon: BookmarkSimple },
    { href: '/calendar', label: 'Calendar', Icon: Calendar },
    { href: '/notes', label: 'Notes', Icon: Notepad },
  ]

  const secondaryNav: NavItem[] = [
    { href: '/projects', label: 'Projects', Icon: FolderOpen },
    {
      href: '/weekly-review',
      label: 'Weekly Review',
      Icon: ClipboardText,
      sublabel: lastReviewDate ? formatLastReview(lastReviewDate) : 'Never',
    },
    { href: '/analytics', label: 'Analytics', Icon: ChartBar },
    { href: '/trash', label: 'Trash', Icon: Trash },
    { href: '/settings', label: 'Settings', Icon: Gear },
  ]

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = userEmail.slice(0, 2).toUpperCase()

  return (
    <aside
      className="w-[248px] flex-shrink-0 flex flex-col h-full backdrop-blur-[20px]"
      style={{
        borderRight: '1px solid var(--sidebar-border)',
        background: 'var(--sidebar-bg)',
      }}
    >
      {/* Logo + search */}
      <div
        className="px-5 py-4 flex items-center gap-2"
        style={{ borderBottom: '1px solid var(--sidebar-border)' }}
      >
        <div className="flex-1">
          <span className="text-lg font-semibold tracking-tight-apple" style={{ color: 'var(--text-primary)' }}>GTD</span>
          <span className="ml-1 text-lg font-light" style={{ color: 'var(--text-muted)' }}>App</span>
        </div>
        <button
          onClick={onOpenSearch}
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
          style={{ color: 'var(--text-tertiary)' }}
          aria-label="Search (⌘K)"
          title="Search (⌘K)"
        >
          <MagnifyingGlass size={ICON_SIZE} weight="light" />
        </button>
      </div>

      {/* Screen-reader live region: announces inbox count changes */}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {inboxCount > 0
          ? `Inbox: ${inboxCount} item${inboxCount === 1 ? '' : 's'}`
          : undefined}
      </span>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 flex flex-col gap-0.5 overflow-y-auto" aria-label="Main navigation">
        {primaryNav.map((item) => (
          <NavLink key={item.href} item={item} active={pathname === item.href} />
        ))}

        <div className="my-2.5 h-px mx-2" style={{ background: 'var(--nav-divider)' }} />

        {secondaryNav.map((item) => (
          <NavLink key={item.href} item={item} active={pathname === item.href} />
        ))}
      </nav>

      {/* User area */}
      <div
        className="px-4 py-3 flex items-center gap-2.5"
        style={{ borderTop: '1px solid var(--sidebar-border)' }}
      >
        <div
          className="w-7 h-7 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0"
          aria-hidden="true"
        >
          <span className="text-[11px] font-semibold text-indigo-300">{initials}</span>
        </div>
        <span
          className="flex-1 text-sm font-medium truncate"
          style={{ color: 'var(--text-secondary)' }}
          title={userEmail}
        >
          {userEmail}
        </span>
        <ThemeSwitcher />
        <button
          onClick={handleLogout}
          className="w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
          style={{ color: 'var(--text-tertiary)' }}
          aria-label="Sign out"
        >
          <SignOut size={16} weight="light" />
        </button>
      </div>
    </aside>
  )
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const { Icon } = item
  const weight: IconWeight = active ? 'fill' : 'light'

  return (
    <Link
      href={item.href}
      className={cn(
        'relative flex items-center gap-3 px-3 py-[7px] rounded-lg text-sm transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 focus-visible:ring-offset-1',
        active ? 'font-semibold' : 'font-normal'
      )}
      style={{
        background: active ? 'var(--nav-active-bg)' : undefined,
        color: active ? 'var(--nav-text-active)' : 'var(--nav-text)',
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = 'var(--nav-hover-bg)'
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = ''
      }}
      aria-current={active ? 'page' : undefined}
    >
      {/* Active accent bar */}
      {active && (
        <span
          className="absolute left-0 top-[6px] bottom-[6px] w-[3px] rounded-full bg-indigo-400"
          aria-hidden="true"
        />
      )}
      <span
        className="flex-shrink-0 w-5 h-5 flex items-center justify-center"
        style={{ color: active ? 'var(--nav-icon-active)' : 'var(--nav-icon)' }}
      >
        <Icon size={ICON_SIZE} weight={weight} />
      </span>
      <span className="flex-1 min-w-0 tracking-body-apple">
        <span className="block leading-none">{item.label}</span>
        {item.sublabel && (
          <span
            className="block text-xs mt-0.5 leading-none font-normal"
            style={{ color: 'var(--nav-icon)' }}
          >
            {item.sublabel}
          </span>
        )}
      </span>
      {item.badge !== undefined && item.badge > 0 && (
        <Badge count={item.badge} variant="indigo" />
      )}
    </Link>
  )
}

// ── helpers ───────────────────────────────────────────────────

function formatLastReview(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000)
  if (diffDays === 0) return 'Last: today'
  if (diffDays === 1) return 'Last: yesterday'
  if (diffDays < 7) return `Last: ${diffDays}d ago`
  return `Last: ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}
