'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useFocusTrap } from '@/lib/hooks/useFocusTrap'
import { createClient } from '@/lib/supabase/client'
import type { TaskStatus } from '@/lib/types'

// ── Types ──────────────────────────────────────────────────────

type TaskResult = {
  type: 'task'
  id: string
  title: string
  status: TaskStatus
  due_date: string | null
}

type ProjectResult = {
  type: 'project'
  id: string
  title: string
  status: 'active' | 'completed'
}

type SearchResult = TaskResult | ProjectResult

// ── Constants ─────────────────────────────────────────────────

const TASK_LIST_URLS: Partial<Record<TaskStatus, string>> = {
  inbox: '/inbox',
  next_actions: '/next-actions',
  waiting_for: '/waiting-for',
  calendar: '/calendar',
  someday_maybe: '/someday',
  notes: '/notes',
  trash: '/trash',
}

const STATUS_LABELS: Partial<Record<TaskStatus, string>> = {
  inbox: 'Inbox',
  next_actions: 'Next Action',
  waiting_for: 'Waiting',
  calendar: 'Calendar',
  someday_maybe: 'Someday',
  notes: 'Notes',
  trash: 'Trash',
  done: 'Done',
}

// ── Component ─────────────────────────────────────────────────

interface SearchPaletteProps {
  open: boolean
  onClose: () => void
}

export function SearchPalette({ open, onClose }: SearchPaletteProps) {
  const router = useRouter()
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [includeTrash, setIncludeTrash] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useFocusTrap(containerRef, open)

  // Reset and focus on open — setState calls in effect are intentional here (reset on prop change)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (open) {
      setTerm('')
      setResults([])
      setSelectedIndex(-1)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Debounced search — early-return setState calls are correct: clear stale results synchronously
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (!open) return
    if (!term.trim()) { setResults([]); setLoading(false); return }
    setLoading(true)
    setSelectedIndex(-1)

    const timer = setTimeout(async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const escaped = term.trim().replace(/[%_\\]/g, '\\$&')

      let taskQuery = supabase
        .from('tasks')
        .select('id, title, status, due_date')
        .eq('user_id', user.id)
        .ilike('title', `%${escaped}%`)
        .limit(10)

      if (!includeTrash) taskQuery = taskQuery.neq('status', 'trash')

      const [{ data: tasks }, { data: projects }] = await Promise.all([
        taskQuery,
        supabase
          .from('projects')
          .select('id, title, status')
          .eq('user_id', user.id)
          .ilike('title', `%${escaped}%`)
          .limit(5),
      ])

      const taskResults: TaskResult[] = (tasks ?? []).map((t) => ({
        type: 'task' as const,
        id: t.id as string,
        title: t.title as string,
        status: t.status as TaskStatus,
        due_date: t.due_date as string | null,
      }))

      const projectResults: ProjectResult[] = (projects ?? []).map((p) => ({
        type: 'project' as const,
        id: p.id as string,
        title: p.title as string,
        status: p.status as 'active' | 'completed',
      }))

      setResults([...taskResults, ...projectResults])
      setLoading(false)
    }, 250)

    return () => clearTimeout(timer)
  }, [term, includeTrash, open])

  const navigateTo = useCallback((result: SearchResult) => {
    if (result.type === 'task') {
      router.push(TASK_LIST_URLS[result.status] ?? '/inbox')
    } else {
      router.push(`/projects/${result.id}`)
    }
    onClose()
  }, [router, onClose])

  // Keyboard navigation
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, -1))
      } else if (e.key === 'Enter') {
        const target = selectedIndex >= 0 ? results[selectedIndex] : results[0]
        if (target) navigateTo(target)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, results, selectedIndex, onClose, navigateTo])

  if (!open) return null

  const taskResults = results.filter((r): r is TaskResult => r.type === 'task')
  const projectResults = results.filter((r): r is ProjectResult => r.type === 'project')

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] p-4"
      role="presentation"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 backdrop-blur-sm"
        style={{ background: 'var(--backdrop-bg)' }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={containerRef}
        className="relative w-full max-w-lg glass-card overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Search"
      >
        {/* Search input */}
        <div
          className="flex items-center gap-3 px-4 py-3.5"
          style={{ borderBottom: '1px solid var(--glass-border)' }}
        >
          <Search className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search tasks and projects…"
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--text-primary)' }}
            aria-label="Search"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-autocomplete="list"
            aria-controls="search-results"
          />
          {term && (
            <button
              onClick={() => setTerm('')}
              className="transition-colors"
              style={{ color: 'var(--text-muted)' }}
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <kbd
            className="text-xs rounded px-1.5 py-0.5 select-none"
            style={{ color: 'var(--kbd-text)', background: 'var(--kbd-bg)' }}
          >
            Esc
          </kbd>
        </div>

        {/* Results */}
        {term.trim() && (
          <div id="search-results" className="max-h-[55vh] overflow-y-auto">
            {loading && (
              <div className="flex flex-col gap-2 p-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-10 rounded-lg animate-pulse" style={{ background: 'var(--bg-surface)' }} />
                ))}
              </div>
            )}

            {!loading && results.length === 0 && (
              <p className="px-4 py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                No results for &ldquo;{term}&rdquo;
              </p>
            )}

            {!loading && taskResults.length > 0 && (
              <ResultGroup label="Tasks">
                {taskResults.map((task) => (
                  <ResultRow
                    key={task.id}
                    title={task.title}
                    term={term}
                    selected={results.indexOf(task) === selectedIndex}
                    badge={STATUS_LABELS[task.status] ?? task.status}
                    badgeCls="bg-indigo-500/10 text-indigo-600 dark:text-indigo-300/70"
                    sublabel={task.due_date ? `Due ${task.due_date}` : undefined}
                    onClick={() => navigateTo(task)}
                  />
                ))}
              </ResultGroup>
            )}

            {!loading && projectResults.length > 0 && (
              <ResultGroup label="Projects">
                {projectResults.map((project) => (
                  <ResultRow
                    key={project.id}
                    title={project.title}
                    term={term}
                    selected={results.indexOf(project) === selectedIndex}
                    badge={project.status === 'active' ? 'Active' : 'Completed'}
                    badgeCls={
                      project.status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300/70'
                        : 'bg-[var(--chip-bg)] text-[var(--text-tertiary)]'
                    }
                    onClick={() => navigateTo(project)}
                  />
                ))}
              </ResultGroup>
            )}
          </div>
        )}

        {/* Footer */}
        <div
          className="px-4 py-2.5 flex items-center gap-3"
          style={{ borderTop: '1px solid var(--glass-border)' }}
        >
          <label className="flex items-center gap-2 text-xs cursor-pointer select-none" style={{ color: 'var(--text-muted)' }}>
            <input
              type="checkbox"
              checked={includeTrash}
              onChange={(e) => setIncludeTrash(e.target.checked)}
              className="w-3 h-3 accent-indigo-500"
            />
            Include trash
          </label>
          {results.length > 0 && (
            <span className="text-xs ml-auto select-none" style={{ color: 'var(--text-muted)' }}>
              ↑↓ navigate · Enter select
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────

function ResultGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-1">
      <p
        className="px-4 py-1.5 text-xs font-medium uppercase tracking-wider"
        style={{ color: 'var(--text-muted)' }}
      >
        {label}
      </p>
      <ul role="listbox">{children}</ul>
    </div>
  )
}

function ResultRow({
  title,
  term,
  selected,
  badge,
  badgeCls,
  sublabel,
  onClick,
}: {
  title: string
  term: string
  selected: boolean
  badge: string
  badgeCls: string
  sublabel?: string
  onClick: () => void
}) {
  return (
    <li role="option" aria-selected={selected}>
      <button
        onClick={onClick}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100',
        )}
        style={{
          background: selected ? 'var(--nav-active-bg)' : undefined,
        }}
        onMouseEnter={(e) => {
          if (!selected) e.currentTarget.style.background = 'var(--bg-surface)'
        }}
        onMouseLeave={(e) => {
          if (!selected) e.currentTarget.style.background = ''
        }}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm leading-snug truncate" style={{ color: 'var(--text-secondary)' }}>
            <HighlightMatch text={title} term={term} />
          </p>
          {sublabel && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{sublabel}</p>}
        </div>
        <span className={cn('flex-shrink-0 text-xs px-2 py-0.5 rounded-full', badgeCls)}>
          {badge}
        </span>
      </button>
    </li>
  )
}

function HighlightMatch({ text, term }: { text: string; term: string }) {
  const idx = text.toLowerCase().indexOf(term.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{text.slice(idx, idx + term.length)}</span>
      {text.slice(idx + term.length)}
    </>
  )
}
