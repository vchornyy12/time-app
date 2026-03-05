import Link from 'next/link'
import { Zap, Brain, Target, Lock, ShieldCheck, Database, Globe, BookOpen, Sparkles, BarChart3 } from 'lucide-react'
import { Logo } from '@/components/ui'

// ─── Header ────────────────────────────────────────────────────────────────

function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 bg-[#181818] border-b border-white/10">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Logo size="md" />
        <nav className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="text-sm px-4 py-1.5 rounded-full bg-[#3ECF8E] text-black font-medium hover:bg-[#34B27B] transition-colors"
          >
            Get started
          </Link>
        </nav>
      </div>
    </header>
  )
}

// ─── App Mockup ─────────────────────────────────────────────────────────────

function AppMockup() {
  const navItems = [
    { label: 'Inbox', count: 3 },
    { label: 'Next Actions', count: null },
    { label: 'Waiting For', count: null },
    { label: 'Projects', count: null },
  ]

  const tasks = [
    'Buy groceries for the week',
    'Draft Q2 proposal slides',
    'Call dentist to schedule',
    'Review team pull requests',
  ]

  return (
    <div className="rounded-xl border border-white/10 overflow-hidden bg-[#1c1c1c] text-sm select-none">
      {/* Top bar */}
      <div className="h-8 bg-[#141414] border-b border-white/10 flex items-center px-3 gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
        <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
        <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
      </div>

      {/* Body */}
      <div className="flex" style={{ minHeight: '220px' }}>
        {/* Sidebar */}
        <div className="w-44 shrink-0 border-r border-white/10 py-3 px-2 flex flex-col gap-0.5">
          {navItems.map((item) => (
            <div
              key={item.label}
              className={`flex items-center justify-between px-2 py-1.5 rounded-md ${item.label === 'Inbox' ? 'bg-white/8 text-zinc-100' : 'text-zinc-400'
                }`}
            >
              <span className="text-xs">{item.label}</span>
              {item.count !== null && (
                <span className="text-xs text-[#3ECF8E] font-medium">{item.count}</span>
              )}
            </div>
          ))}
        </div>

        {/* Main pane */}
        <div className="flex-1 flex flex-col">
          {/* Pane header */}
          <div className="px-4 py-2.5 border-b border-white/10 flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-100">Inbox</span>
            <span className="text-xs text-[#3ECF8E] bg-[#3ECF8E]/10 px-1.5 py-0.5 rounded-full">3</span>
          </div>

          {/* Task rows */}
          <div className="flex-1 px-4 py-2 flex flex-col gap-1.5">
            {tasks.map((task) => (
              <div key={task} className="flex items-center gap-2.5 py-1">
                <span className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0" />
                <span className="text-xs text-zinc-400 truncate">{task}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Capture bar */}
      <div className="border-t border-white/10 px-4 py-2.5 flex items-center gap-2">
        <span className="text-xs text-zinc-400 flex-1">Quick capture…</span>
        <span className="text-xs text-zinc-400 border border-white/10 rounded px-1 py-0.5">⌘K</span>
      </div>
    </div>
  )
}

// ─── Hero ────────────────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-20 lg:py-28">
      <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        {/* Left */}
        <div className="flex flex-col gap-6">
          <div>
            <span className="inline-flex items-center text-xs border border-white/10 text-zinc-400 rounded-full px-3 py-1">
              Public Beta — 100% Free to use
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight text-zinc-100">
            Your mind is for having ideas,{' '}
            <span className="text-[#3ECF8E]">not holding them.</span>
          </h1>
          <p className="text-zinc-400 text-lg leading-relaxed">
            A modern, distraction-free task manager built strictly on the Getting Things Done
            methodology. Capture everything. Process ruthlessly. Act with clarity.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/register"
              className="px-6 py-2.5 rounded-lg bg-[#3ECF8E] text-black font-semibold text-sm hover:bg-[#34B27B] transition-colors"
            >
              Get started for free
            </Link>
            <Link
              href="/login"
              className="px-6 py-2.5 rounded-lg border border-white/10 text-zinc-300 text-sm hover:bg-white/5 transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>

        {/* Right — mockup */}
        <div>
          <AppMockup />
        </div>
      </div>
    </section>
  )
}

// ─── Features ────────────────────────────────────────────────────────────────

const features = [
  {
    icon: Zap,
    title: 'Quick Capture',
    description:
      'Brain-dump ideas instantly. Paste screenshots, jot notes, or speak your thoughts. Everything lands in your inbox — nothing gets lost.',
  },
  {
    icon: Brain,
    title: 'Smart Processing',
    description:
      'Our guided wizard forces you to decide: Is it actionable? Does it belong in a project? Never let tasks rot in an undifferentiated pile.',
  },
  {
    icon: Target,
    title: 'Next Actions Focus',
    description:
      'Only see what you can actually do right now. No overwhelming lists. Just the next step, clearly defined and immediately actionable.',
  },
]

function FeaturesSection() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-20 border-t border-white/10">
      <div className="flex flex-col items-center gap-4 mb-12 text-center">
        <span className="text-xs font-semibold uppercase tracking-widest text-[#3ECF8E]">
          How it works
        </span>
        <h2 className="text-3xl font-bold text-zinc-100">Built on the GTD methodology</h2>
        <p className="text-zinc-400 max-w-xl">
          David Allen&apos;s system distilled into a focused app. No fluff, no bloat — just the
          workflow that clears your head.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {features.map(({ icon: Icon, title, description }) => (
          <div
            key={title}
            className="p-6 rounded-xl border border-white/10 bg-[#1c1c1c] flex flex-col gap-4"
          >
            <div className="w-10 h-10 rounded-lg bg-[#3ECF8E]/10 flex items-center justify-center">
              <Icon size={20} className="text-[#3ECF8E]" />
            </div>
            <h3 className="font-semibold text-zinc-100">{title}</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">{description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── Roadmap ─────────────────────────────────────────────────────────────────

const roadmapItems = [
  {
    icon: BookOpen,
    title: 'Success Diary & Reflection',
    description:
      'A daily log to capture wins, lessons, and reflections — so you can learn from your week, not just survive it.',
  },
  {
    icon: Sparkles,
    title: 'AI Task De-chunker',
    description:
      'Paste any complex project and let AI break it into concrete, ordered next actions instantly.',
  },
  {
    icon: BarChart3,
    title: 'Advanced Productivity Analytics',
    description:
      'Trend charts, completion velocity, context performance — know exactly where your time and energy go.',
  },
]

function RoadmapSection() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-20 border-t border-white/10">
      <div className="flex flex-col items-center gap-4 mb-12 text-center">
        <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
          Coming soon
        </span>
        <h2 className="text-3xl font-bold text-zinc-100">What&apos;s on the roadmap</h2>
        <p className="text-zinc-400 max-w-xl">
          Built by one developer, shaped by real GTD practice. Here&apos;s what&apos;s coming next.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {roadmapItems.map(({ icon: Icon, title, description }) => (
          <div
            key={title}
            className="p-6 rounded-xl border border-white/[0.06] bg-[#1a1a1a] flex flex-col gap-4"
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                <Icon size={20} className="text-zinc-400" />
              </div>
              <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-400 border border-white/[0.06] rounded-full px-2.5 py-1">
                Planned
              </span>
            </div>
            <h3 className="font-semibold text-zinc-300">{title}</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">{description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── Trust Banner ────────────────────────────────────────────────────────────

const trustItems = [
  {
    icon: Lock,
    label: 'Row Level Security',
    description: 'Data locked at the database level — no cross-user access possible.',
  },
  {
    icon: ShieldCheck,
    label: 'OAuth 2.0',
    description: 'Sign in with Google. No passwords stored by us.',
  },
  {
    icon: Database,
    label: 'Isolated data',
    description: 'Each account is siloed. RLS policies enforced at every query.',
  },
  {
    icon: Globe,
    label: 'Private by default',
    description: 'No tracking. No selling. Your tasks stay yours.',
  },
]

function TrustBanner() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-20 border-t border-white/10">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {trustItems.map(({ icon: Icon, label, description }) => (
          <div key={label} className="flex flex-col gap-3">
            <div className="w-8 h-8 rounded-md bg-[#3ECF8E]/10 flex items-center justify-center">
              <Icon size={16} className="text-[#3ECF8E]" />
            </div>
            <p className="text-sm font-semibold text-zinc-100">{label}</p>
            <p className="text-xs text-zinc-400 leading-relaxed">{description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── Footer ──────────────────────────────────────────────────────────────────

function LandingFooter() {
  return (
    <footer className="border-t border-white/10">
      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-wrap items-center justify-between gap-4">
        <Logo size="sm" />
        <div className="flex items-center gap-6">
          <Link href="/privacy" className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors">
            Privacy Policy
          </Link>
          <Link href="/terms" className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors">
            Terms of Service
          </Link>
          <p className="text-xs text-zinc-400">
            &copy; {new Date().getFullYear()} time24. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function LandingPage() {
  return (
    <div
      className="min-h-screen bg-[#181818] text-zinc-100"
      style={{ '--text-primary': '#f4f4f5' } as React.CSSProperties}
    >
      <LandingHeader />
      <main>
        <HeroSection />
        <FeaturesSection />
        <RoadmapSection />
        <TrustBanner />
      </main>
      <LandingFooter />
    </div>
  )
}
