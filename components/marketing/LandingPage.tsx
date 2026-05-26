'use client'

import Link from 'next/link'
import {
  Zap, Brain, Target, Lock, ShieldCheck, Database, Globe,
  BookOpen, Sparkles, CalendarCheck, Layers,
  Calendar, Lightbulb, CheckCircle2, AlertTriangle, CheckCheck,
  Inbox, ChevronDown,
} from 'lucide-react'
import { Logo } from '@/components/ui'
import {
  motion, useInView, useScroll, useSpring, AnimatePresence,
} from 'framer-motion'
import { useRef, useState, type ElementType } from 'react'
import type { LandingStats } from '@/lib/stats'

// ─── Animation Primitives ────────────────────────────────────────────────────

function FadeUp({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

function StaggerChildren({
  children,
  className,
  stagger = 0.1,
}: {
  children: React.ReactNode
  className?: string
  stagger?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })

  return (
    <motion.div
      ref={ref}
      variants={{ hidden: {}, show: { transition: { staggerChildren: stagger } } }}
      initial="hidden"
      animate={inView ? 'show' : 'hidden'}
      className={className}
    >
      {children}
    </motion.div>
  )
}

function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 32 },
        show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

function GlowCard({
  children,
  className,
  glowColor = '#3ECF8E22',
}: {
  children: React.ReactNode
  className?: string
  glowColor?: string
}) {
  return (
    <motion.div
      whileHover={{ y: -6, scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={`relative group ${className ?? ''}`}
    >
      <motion.div
        className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ boxShadow: `0 0 36px 6px ${glowColor}` }}
      />
      {children}
    </motion.div>
  )
}

// ─── Header ────────────────────────────────────────────────────────────────

function LandingHeader() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 200, damping: 30 })

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="sticky top-0 z-50 bg-[#181818]/90 backdrop-blur-md border-b border-white/10"
    >
      {/* Scroll progress bar */}
      <motion.div
        className="absolute top-0 left-0 right-0 h-[2px] bg-[#3ECF8E] origin-left"
        style={{ scaleX }}
      />
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Logo size="md" />
        <nav className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm text-zinc-300 hover:text-zinc-100 transition-colors"
          >
            Sign in
          </Link>
          <motion.div whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.96 }}>
            <Link
              href="/register"
              className="text-sm px-4 py-1.5 rounded-full bg-[#3ECF8E] text-black font-medium hover:bg-[#34B27B] transition-colors"
            >
              Get started
            </Link>
          </motion.div>
        </nav>
      </div>
    </motion.header>
  )
}

// ─── App Mockup ───────────────────────────────────────────────────────────────

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
    <motion.div
      initial={{ opacity: 0, y: 30, rotateX: 6 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.85, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-xl border border-white/10 overflow-hidden bg-[#1c1c1c] text-sm select-none shadow-2xl"
      style={{ perspective: '800px' }}
    >
      {/* Top bar */}
      <div className="h-8 bg-[#141414] border-b border-white/10 flex items-center px-3 gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
      </div>

      {/* Body */}
      <div className="flex" style={{ minHeight: '220px' }}>
        {/* Sidebar */}
        <div className="w-44 shrink-0 border-r border-white/10 py-3 px-2 flex flex-col gap-0.5">
          {navItems.map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + i * 0.09, duration: 0.4 }}
              className={`flex items-center justify-between px-2 py-1.5 rounded-md ${
                item.label === 'Inbox' ? 'bg-white/8 text-zinc-100' : 'text-zinc-300'
              }`}
            >
              <span className="text-xs">{item.label}</span>
              {item.count !== null && (
                <span className="text-xs text-[#3ECF8E] font-medium">{item.count}</span>
              )}
            </motion.div>
          ))}
        </div>

        {/* Main pane */}
        <div className="flex-1 flex flex-col">
          <div className="px-4 py-2.5 border-b border-white/10 flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-100">Inbox</span>
            <span className="text-xs text-[#3ECF8E] bg-[#3ECF8E]/10 px-1.5 py-0.5 rounded-full">3</span>
          </div>
          <div className="flex-1 px-4 py-2 flex flex-col gap-1.5">
            {tasks.map((task, i) => (
              <motion.div
                key={task}
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.65 + i * 0.1, duration: 0.4 }}
                className="flex items-center gap-2.5 py-1"
              >
                <span className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0" />
                <span className="text-xs text-zinc-200 truncate">{task}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Capture bar */}
      <div className="border-t border-white/10 px-4 py-2.5 flex items-center gap-2">
        <span className="text-xs text-zinc-300 flex-1">Quick capture...</span>
        <span className="text-xs text-zinc-300 border border-white/10 rounded px-1 py-0.5">⌘K</span>
      </div>
    </motion.div>
  )
}

// ─── Hero ────────────────────────────────────────────────────────────────────

function HeroSection() {
  const bullets = [
    'Guided processing wizard - every item gets a decision, not just a pile',
    'Context-based filtering - only see tasks you can do right now',
    'Built-in Weekly Review ritual - stay on top, every week',
    'Google Calendar sync - your schedule and your actions in one system',
  ]

  return (
    <section className="max-w-6xl mx-auto px-6 py-12 sm:py-20 lg:py-28">
      <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        {/* Left */}
        <div className="flex flex-col gap-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center text-xs border border-white/10 text-zinc-100 rounded-full px-3 py-1">
              Public Beta - 100% Free to use
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="text-4xl sm:text-5xl font-bold leading-tight text-zinc-100"
          >
            Your mind is for having ideas,{' '}
            <motion.span
              initial={{ color: '#f4f4f5' }}
              animate={{ color: '#3ECF8E' }}
              transition={{ duration: 1, delay: 0.7 }}
            >
              not holding them.
            </motion.span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="text-zinc-200 text-lg leading-relaxed"
          >
            A modern, distraction-free task manager built strictly on the Getting Things Done
            methodology. Capture everything. Process ruthlessly. Act with clarity.
          </motion.p>

          <motion.ul
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.09, delayChildren: 0.45 } } }}
            className="flex flex-col gap-2"
          >
            {bullets.map((b) => (
              <motion.li
                key={b}
                variants={{
                  hidden: { opacity: 0, x: -18 },
                  show: { opacity: 1, x: 0, transition: { duration: 0.45 } },
                }}
                className="flex items-start gap-2.5 text-sm text-zinc-300"
              >
                <CheckCircle2 size={16} className="text-[#3ECF8E] mt-0.5 shrink-0" />
                {b}
              </motion.li>
            ))}
          </motion.ul>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            className="flex flex-wrap gap-3"
          >
            <motion.div
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.96 }}
              animate={{
                boxShadow: [
                  '0 0 0px #3ECF8E00',
                  '0 0 22px #3ECF8E66',
                  '0 0 0px #3ECF8E00',
                ],
              }}
              transition={{ boxShadow: { repeat: Infinity, duration: 2.5, delay: 2 } }}
              className="rounded-lg"
            >
              <Link
                href="/register"
                className="block px-6 py-2.5 rounded-lg bg-[#3ECF8E] text-black font-semibold text-sm hover:bg-[#34B27B] transition-colors"
              >
                Get started for free
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Link
                href="/login"
                className="block px-6 py-2.5 rounded-lg border border-white/10 text-zinc-100 text-sm hover:bg-white/5 transition-colors"
              >
                Sign in →
              </Link>
            </motion.div>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1 }}
            className="text-xs text-zinc-500"
          >
            No credit card required.
          </motion.p>
        </div>

        {/* Right - mockup */}
        <div>
          <AppMockup />
        </div>
      </div>
    </section>
  )
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function formatStat(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return new Intl.NumberFormat().format(n)
}

function StatsBar({ stats }: { stats: LandingStats }) {
  const items = [
    { value: `${formatStat(stats.userCount)}+`, label: 'Beta Users' },
    { value: `${formatStat(stats.taskCount)}+`, label: 'Tasks Processed' },
    { value: '4.9 / 5', label: 'Average Rating' },
  ]

  return (
    <div className="border-y border-white/10 bg-[#1c1c1c] py-6">
      <FadeUp>
        <div className="max-w-6xl mx-auto px-6 flex flex-wrap justify-center gap-10 md:gap-20">
          {items.map(({ value, label }) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <span className="text-3xl font-bold text-zinc-100">{value}</span>
              <span className="text-xs text-zinc-400 uppercase tracking-widest">{label}</span>
            </div>
          ))}
        </div>
      </FadeUp>
    </div>
  )
}

// ─── Pain Points ─────────────────────────────────────────────────────────────

const painPoints = [
  {
    icon: AlertTriangle,
    title: 'The overwhelmed inbox',
    description:
      'You dump tasks in, feel productive - then open the app and feel buried. Every item is a vague obligation, not a decision.',
  },
  {
    icon: AlertTriangle,
    title: 'The paralyzed list',
    description:
      '87 items, none obviously actionable. You scroll, feel anxious, close the app. Nothing actually gets done.',
  },
  {
    icon: AlertTriangle,
    title: 'The forgotten project',
    description:
      'No next action defined, so the project just sits there. Out of sight, out of mind - until it becomes urgent.',
  },
]

function PainPointSection() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-12 sm:py-20 border-t border-white/10">
      <FadeUp className="flex flex-col items-center gap-4 mb-12 text-center">
        <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
          Sound familiar?
        </span>
        <h2 className="text-3xl font-bold text-zinc-100">
          Most task apps let you collect. They don&apos;t help you <em>decide</em>.
        </h2>
        <p className="text-zinc-300 max-w-xl">
          You feel productive adding tasks. Then you open the app and feel overwhelmed. Nothing tells
          you what to do <em>next</em>.
        </p>
      </FadeUp>

      <StaggerChildren className="grid md:grid-cols-3 gap-6" stagger={0.15}>
        {painPoints.map(({ icon: Icon, title, description }) => (
          <StaggerItem key={title}>
            <GlowCard glowColor="#ef444422" className="h-full">
              <div className="p-6 rounded-xl border border-white/[0.06] bg-[#1a1a1a] flex flex-col gap-4 h-full">
                <motion.div
                  whileHover={{ rotate: [0, -12, 12, -6, 0] }}
                  transition={{ duration: 0.5 }}
                  className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center"
                >
                  <Icon size={20} className="text-red-400" />
                </motion.div>
                <h3 className="font-semibold text-zinc-100">{title}</h3>
                <p className="text-sm text-zinc-300 leading-relaxed">{description}</p>
              </div>
            </GlowCard>
          </StaggerItem>
        ))}
      </StaggerChildren>
    </section>
  )
}

// ─── GTD Workflow ─────────────────────────────────────────────────────────────

type WorkflowStep = {
  icon: ElementType
  step: string
  title: string
  description: string
}

const workflowSteps: WorkflowStep[] = [
  {
    icon: Inbox,
    step: '01',
    title: 'Capture',
    description: 'Get everything out of your head. Ideas, tasks, worries - into the inbox immediately.',
  },
  {
    icon: Brain,
    step: '02',
    title: 'Process',
    description: 'Make a decision on every item. Is it actionable? Delegate? Defer? Delete?',
  },
  {
    icon: Layers,
    step: '03',
    title: 'Organize',
    description: 'File it in the right place - Next Actions, Projects, Waiting For, Someday.',
  },
  {
    icon: Zap,
    step: '04',
    title: 'Do',
    description: 'Work from context-filtered lists. Always know the next physical action.',
  },
]

function GTDWorkflowSection() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-12 sm:py-20 border-t border-white/10">
      <FadeUp className="flex flex-col items-center gap-4 mb-12 text-center">
        <span className="text-xs font-semibold uppercase tracking-widest text-[#3ECF8E]">
          The GTD loop
        </span>
        <h2 className="text-3xl font-bold text-zinc-100">Four steps to a clear head</h2>
      </FadeUp>

      <div className="relative">
        {/* Connector line (desktop) */}
        <div className="hidden md:block absolute top-[56px] left-[12.5%] right-[12.5%] h-px bg-white/10 pointer-events-none" />

        <StaggerChildren className="grid grid-cols-2 md:grid-cols-4 gap-4" stagger={0.12}>
          {workflowSteps.map(({ icon: Icon, step, title, description }) => (
            <StaggerItem key={step}>
              <motion.div
                whileHover={{ borderColor: '#3ECF8E40' }}
                className="flex flex-col items-center text-center gap-3 p-5 rounded-xl border border-white/[0.06] bg-[#1a1a1a] cursor-default group"
              >
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  {step}
                </span>
                <div className="w-14 h-14 rounded-full border border-white/10 bg-[#1c1c1c] flex items-center justify-center">
                  <Icon size={22} className="text-[#3ECF8E]" />
                </div>
                <p className="text-sm font-semibold text-zinc-100">{title}</p>
                <p className="text-xs text-zinc-400 leading-relaxed opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
                  {description}
                </p>
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerChildren>
      </div>
    </section>
  )
}

// ─── Features ────────────────────────────────────────────────────────────────

const featuresRow1 = [
  {
    icon: Zap,
    title: 'Quick Capture',
    description:
      'Brain-dump anything instantly - text, notes, or file attachments. Everything lands in your inbox via ⌘K. Nothing gets lost.',
  },
  {
    icon: Brain,
    title: 'Smart Processing Wizard',
    description:
      'A 6-step guided decision tree forces every item to become an action, a project reference, or a delete. No more undifferentiated piles.',
  },
  {
    icon: Target,
    title: 'Next Actions + Context Filtering',
    description:
      'Filter by @home, @office, @computer, @errands, and more. Only see what you can actually do right now - zero cognitive overhead.',
  },
]

const featuresRow2 = [
  {
    icon: CalendarCheck,
    title: 'Weekly Review Ritual',
    description:
      '7-step guided review. Clear your head, update your lists, reconnect with your goals. Keeps your system trusted and alive.',
  },
  {
    icon: Layers,
    title: 'Projects with Rough Plans',
    description:
      'Multi-step outcomes with drag-and-drop ordered steps. Always know the next physical action. Never let a project go dark.',
  },
  {
    icon: Calendar,
    title: 'Google Calendar Sync',
    description:
      'Time-specific commitments auto-sync to Google Calendar. Two systems, zero duplication - your schedule and your actions unified.',
  },
]

function FeatureCard({ icon: Icon, title, description }: { icon: ElementType; title: string; description: string }) {
  return (
    <GlowCard className="h-full">
      <div className="p-6 rounded-xl border border-white/10 bg-[#1c1c1c] flex flex-col gap-4 h-full">
        <motion.div
          whileHover={{ rotate: [0, -10, 10, -5, 0], scale: 1.1 }}
          transition={{ duration: 0.5 }}
          className="w-10 h-10 rounded-lg bg-[#3ECF8E]/10 flex items-center justify-center"
        >
          <Icon size={20} className="text-[#3ECF8E]" />
        </motion.div>
        <h3 className="font-semibold text-zinc-100">{title}</h3>
        <p className="text-sm text-zinc-200 leading-relaxed">{description}</p>
      </div>
    </GlowCard>
  )
}

function FeaturesSection() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-12 sm:py-20 border-t border-white/10">
      <FadeUp className="flex flex-col items-center gap-4 mb-12 text-center">
        <span className="text-xs font-semibold uppercase tracking-widest text-[#3ECF8E]">
          How it works
        </span>
        <h2 className="text-3xl font-bold text-zinc-100">Built on the GTD methodology</h2>
        <p className="text-zinc-300 max-w-xl">
          David Allen&apos;s system distilled into a focused app. No fluff, no bloat - just the
          workflow that clears your head.
        </p>
      </FadeUp>

      <div className="flex flex-col gap-6">
        <StaggerChildren className="grid md:grid-cols-3 gap-6" stagger={0.12}>
          {featuresRow1.map((f) => (
            <StaggerItem key={f.title}>
              <FeatureCard {...f} />
            </StaggerItem>
          ))}
        </StaggerChildren>
        <StaggerChildren className="grid md:grid-cols-3 gap-6" stagger={0.12}>
          {featuresRow2.map((f) => (
            <StaggerItem key={f.title}>
              <FeatureCard {...f} />
            </StaggerItem>
          ))}
        </StaggerChildren>
      </div>
    </section>
  )
}

// ─── Differentiators ─────────────────────────────────────────────────────────

function DifferentiatorsSection() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-12 sm:py-20 border-t border-white/10">
      <FadeUp className="flex flex-col items-center gap-4 mb-12 text-center">
        <span className="text-xs font-semibold uppercase tracking-widest text-[#3ECF8E]">
          Only in time24
        </span>
        <h2 className="text-3xl font-bold text-zinc-100">
          Features you won&apos;t find anywhere else
        </h2>
        <p className="text-zinc-300 max-w-xl">
          Two capabilities built for the moments when a todo list isn&apos;t enough.
        </p>
      </FadeUp>

      <StaggerChildren className="grid md:grid-cols-2 gap-8" stagger={0.2}>
        {/* Clarity Protocol */}
        <StaggerItem>
          <motion.div
            whileHover={{ y: -8, scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            className="relative p-5 sm:p-8 rounded-xl border border-[#3ECF8E]/20 bg-[#1c1c1c] flex flex-col gap-5 h-full group overflow-hidden"
          >
            <motion.div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
              style={{
                background: 'radial-gradient(ellipse at 20% 20%, #3ECF8E10 0%, transparent 65%)',
              }}
            />
            <motion.div
              whileHover={{ rotate: 20, scale: 1.15 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
              className="w-12 h-12 rounded-xl bg-[#3ECF8E]/10 flex items-center justify-center"
            >
              <Lightbulb size={24} className="text-[#3ECF8E]" />
            </motion.div>
            <div>
              <h3 className="text-xl font-bold text-zinc-100 mb-1">Clarity Protocol</h3>
              <p className="text-xs font-semibold uppercase tracking-widest text-[#3ECF8E]">
                Worry → Action
              </p>
            </div>
            <p className="text-zinc-200 leading-relaxed">
              Stuck? Anxious? The Clarity Protocol uses the Willis Carrier formula - a structured
              4-step wizard that converts worry into a concrete next action. Define the worst case,
              accept it, then improve on it. Turn paralysis into momentum.
            </p>
            <Link
              href="/register"
              className="self-start text-sm text-[#3ECF8E] hover:text-[#34B27B] transition-colors font-medium"
            >
              Try it free →
            </Link>
          </motion.div>
        </StaggerItem>

        {/* Success Diary */}
        <StaggerItem>
          <motion.div
            whileHover={{ y: -8, scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            className="relative p-5 sm:p-8 rounded-xl border border-[#3ECF8E]/20 bg-[#1c1c1c] flex flex-col gap-5 h-full group overflow-hidden"
          >
            <motion.div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
              style={{
                background: 'radial-gradient(ellipse at 80% 20%, #3ECF8E10 0%, transparent 65%)',
              }}
            />
            <motion.div
              whileHover={{ rotate: -15, scale: 1.15 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
              className="w-12 h-12 rounded-xl bg-[#3ECF8E]/10 flex items-center justify-center"
            >
              <BookOpen size={24} className="text-[#3ECF8E]" />
            </motion.div>
            <div>
              <h3 className="text-xl font-bold text-zinc-100 mb-1">Success Diary</h3>
              <p className="text-xs font-semibold uppercase tracking-widest text-[#3ECF8E]">
                Daily wins + reflection
              </p>
            </div>
            <p className="text-zinc-200 leading-relaxed">
              Every completed task is captured in your daily log. Add reflections. See your wins.
              Stop feeling like you&apos;re doing nothing - because you&apos;re not. Your logbook
              builds a record of what you&apos;ve actually accomplished.
            </p>
            <Link
              href="/register"
              className="self-start text-sm text-[#3ECF8E] hover:text-[#34B27B] transition-colors font-medium"
            >
              Start your diary →
            </Link>
          </motion.div>
        </StaggerItem>
      </StaggerChildren>
    </section>
  )
}

// ─── Comparison Table ─────────────────────────────────────────────────────────

type ComparisonRow = {
  feature: string
  time24: boolean | string
  todoist: boolean | string
  things3: boolean | string
}

const comparisonRows: ComparisonRow[] = [
  { feature: 'Strict GTD Workflow (Capture → Process → Organize → Do)', time24: true, todoist: 'Partial', things3: 'Partial' },
  { feature: '6-Step Processing Wizard', time24: true, todoist: false, things3: false },
  { feature: 'Clarity Protocol (Worry → Action)', time24: true, todoist: false, things3: false },
  { feature: 'Success Diary / Logbook', time24: true, todoist: false, things3: false },
  { feature: 'Weekly Review Ritual (guided)', time24: true, todoist: false, things3: true },
  { feature: 'Google Calendar Sync', time24: true, todoist: true, things3: false },
  { feature: 'File Attachments', time24: true, todoist: '✓ (paid)', things3: true },
  { feature: 'Price', time24: '100% Free (for now)', todoist: '$5/mo', things3: '$49 one-time' },
]

function CellValue({ value }: { value: boolean | string }) {
  if (value === true) return <span className="text-[#3ECF8E]">✓</span>
  if (value === false) return <span className="text-zinc-600">✗</span>
  return <span className="text-zinc-200">{value}</span>
}

function ComparisonTable() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-12 sm:py-20 border-t border-white/10">
      <FadeUp className="flex flex-col items-center gap-4 mb-12 text-center">
        <span className="text-xs font-semibold uppercase tracking-widest text-[#3ECF8E]">
          How we compare
        </span>
        <h2 className="text-3xl font-bold text-zinc-100">Built for GTD. Not adapted for it.</h2>
      </FadeUp>

      <FadeUp delay={0.1}>
        {/* Mobile: card list (time24 column only) */}
        <div className="sm:hidden flex flex-col divide-y divide-white/10 rounded-xl border border-white/10 overflow-hidden">
          {comparisonRows.map((row) => (
            <div key={row.feature} className="flex items-start justify-between gap-3 px-4 py-3 bg-[#1c1c1c]">
              <span className="text-xs text-zinc-300 leading-snug flex-1">{row.feature}</span>
              <span className="shrink-0 text-sm font-medium">
                <CellValue value={row.time24} />
              </span>
            </div>
          ))}
        </div>

        {/* Desktop: full comparison table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="text-left py-3 pr-6 text-zinc-400 font-normal" />
                <th className="text-center py-3 px-4 text-[#3ECF8E] font-bold">time24</th>
                <th className="text-center py-3 px-4 text-zinc-400 font-normal">Todoist</th>
                <th className="text-center py-3 px-4 text-zinc-400 font-normal">Things 3</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => (
                <tr key={row.feature} className="border-t border-white/10">
                  <td className="text-zinc-300 py-3 pr-6">{row.feature}</td>
                  <td className="text-center py-3 px-4 bg-[#3ECF8E]/[0.04]">
                    <CellValue value={row.time24} />
                  </td>
                  <td className="text-center py-3 px-4">
                    <CellValue value={row.todoist} />
                  </td>
                  <td className="text-center py-3 px-4">
                    <CellValue value={row.things3} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FadeUp>
    </section>
  )
}

// ─── Feature Checklist ───────────────────────────────────────────────────────

const featureChecklist = [
  'Inbox with quick capture + file attachments',
  '6-step GTD processing wizard',
  'Next Actions with @context filtering',
  'Waiting For with delegation tracking',
  'Calendar with Google Calendar sync',
  'Someday / Maybe list',
  'Notes (reference material)',
  'Projects with rough plans + drag-and-drop',
  'Weekly Review flow (7 steps)',
  'Success Diary with daily reflections',
  'Clarity Protocol (worry → action)',
  'Analytics dashboard',
  'Global search (⌘K)',
  'Dark / light theme',
  'Mobile responsive',
]

function FeatureChecklistSection() {
  const half = Math.ceil(featureChecklist.length / 2)
  const col1 = featureChecklist.slice(0, half)
  const col2 = featureChecklist.slice(half)

  return (
    <section className="max-w-6xl mx-auto px-6 py-12 sm:py-20 border-t border-white/10">
      <FadeUp className="flex flex-col items-center gap-4 mb-12 text-center">
        <span className="text-xs font-semibold uppercase tracking-widest text-[#3ECF8E]">
          Everything included
        </span>
        <h2 className="text-3xl font-bold text-zinc-100">Already built. Already shipped.</h2>
        <p className="text-zinc-300 max-w-xl">
          No waitlists. No paid tiers. The full system is available to every user, right now.
        </p>
      </FadeUp>

      <StaggerChildren className="max-w-3xl mx-auto grid sm:grid-cols-2 gap-x-12 gap-y-1" stagger={0.04}>
        {[...col1, ...col2].map((item) => (
          <StaggerItem key={item}>
            <motion.div
              whileHover={{ x: 5 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="flex items-start gap-2.5 py-2"
            >
              <CheckCheck size={16} className="text-[#3ECF8E] mt-0.5 shrink-0" />
              <span className="text-sm text-zinc-200">{item}</span>
            </motion.div>
          </StaggerItem>
        ))}
      </StaggerChildren>

      {/* Roadmap teaser */}
      <FadeUp delay={0.2}>
        <div className="mt-12 max-w-3xl mx-auto p-6 rounded-xl border border-white/[0.06] bg-[#1a1a1a] flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
            <Sparkles size={20} className="text-zinc-400" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-zinc-300">AI Task De-chunker</h3>
              <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-400 border border-white/[0.06] rounded-full px-2.5 py-1">
                Coming soon
              </span>
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Paste any complex project and let AI break it into concrete, ordered next actions
              instantly.
            </p>
          </div>
        </div>
      </FadeUp>
    </section>
  )
}

// ─── Testimonials ─────────────────────────────────────────────────────────────

type Testimonial = {
  initials: string
  name: string
  role: string
  quote: string
  stars: number
}

const testimonials: Testimonial[] = [
  {
    initials: 'MK',
    name: 'Marcus K.',
    role: 'Product Manager',
    quote: 'Finally a system that doesn\'t let me lie to myself. If it\'s in my inbox, I haven\'t decided - and time24 won\'t let me forget that.',
    stars: 5,
  },
  {
    initials: 'SL',
    name: 'Sarah L.',
    role: 'Freelance Designer',
    quote: 'The Clarity Protocol alone is worth it. I had a project giving me anxiety for weeks. 4 steps and I had a next action.',
    stars: 5,
  },
  {
    initials: 'TR',
    name: 'Tom R.',
    role: 'Software Engineer',
    quote: 'I\'ve tried Todoist, Things, OmniFocus. None of them forced me to process. time24 is the first app where GTD actually sticks.',
    stars: 5,
  },
  {
    initials: 'AV',
    name: 'Ana V.',
    role: 'Startup Founder',
    quote: 'The weekly review flow is shockingly good. It\'s like having a coach walk you through the GTD ritual every Sunday.',
    stars: 5,
  },
  {
    initials: 'JH',
    name: 'James H.',
    role: 'Operations Lead',
    quote: 'Free, beautifully designed, and actually implements GTD correctly. I don\'t understand why this isn\'t huge yet.',
    stars: 5,
  },
]

function TestimonialsSection() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-12 sm:py-20 border-t border-white/10">
      <FadeUp className="flex flex-col items-center gap-4 mb-12 text-center">
        <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
          From our beta users
        </span>
        <h2 className="text-3xl font-bold text-zinc-100">Real people. Real clarity.</h2>
      </FadeUp>

      {/* Mobile: horizontal scroll; md+: 3-column grid */}
      <div className="md:hidden flex gap-4 overflow-x-auto pb-4 -mx-6 px-6 snap-x snap-mandatory">
        {testimonials.map((t) => (
          <div key={t.name} className="shrink-0 w-72 snap-start">
            <TestimonialCard testimonial={t} />
          </div>
        ))}
      </div>

      <StaggerChildren className="hidden md:grid md:grid-cols-3 gap-6" stagger={0.12}>
        {testimonials.slice(0, 3).map((t) => (
          <StaggerItem key={t.name}>
            <TestimonialCard testimonial={t} />
          </StaggerItem>
        ))}
      </StaggerChildren>
    </section>
  )
}

function TestimonialCard({ testimonial: t }: { testimonial: Testimonial }) {
  return (
    <GlowCard className="h-full">
      <div className="p-6 rounded-xl border border-white/10 bg-[#1c1c1c] flex flex-col gap-4 h-full">
        {/* Stars */}
        <div className="flex gap-0.5">
          {Array.from({ length: t.stars }).map((_, i) => (
            <span key={i} className="text-[#3ECF8E] text-sm">★</span>
          ))}
        </div>
        {/* Quote */}
        <p className="text-sm text-zinc-200 leading-relaxed italic flex-1">
          &ldquo;{t.quote}&rdquo;
        </p>
        {/* Divider */}
        <div className="border-t border-white/10 pt-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#3ECF8E]/15 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-[#3ECF8E]">{t.initials}</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-100">{t.name}</p>
            <p className="text-xs text-zinc-400">{t.role}</p>
          </div>
        </div>
      </div>
    </GlowCard>
  )
}

// ─── Trust Banner ────────────────────────────────────────────────────────────

const trustItems = [
  {
    icon: Lock,
    label: 'Your data, only yours',
    description: 'Your tasks are only ever visible to you - enforced at every layer of the system.',
  },
  {
    icon: ShieldCheck,
    label: 'Sign in with Google',
    description: 'We never see your password - Google handles authentication entirely.',
  },
  {
    icon: Database,
    label: 'Architecturally isolated',
    description: "Every database query is scoped to your account. It's impossible to access someone else's data.",
  },
  {
    icon: Globe,
    label: 'Private by default',
    description: 'No ads. No analytics sold to third parties. Your tasks are not a product.',
  },
]

function TrustBanner() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-12 sm:py-20 border-t border-white/10">
      <StaggerChildren className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6" stagger={0.1}>
        {trustItems.map(({ icon: Icon, label, description }) => (
          <StaggerItem key={label}>
            <motion.div
              whileHover={{ y: -5 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              className="flex flex-col gap-3"
            >
              <div className="w-8 h-8 rounded-md bg-[#3ECF8E]/10 flex items-center justify-center">
                <Icon size={16} className="text-[#3ECF8E]" />
              </div>
              <p className="text-sm font-semibold text-zinc-100">{label}</p>
              <p className="text-xs text-zinc-300 leading-relaxed">{description}</p>
            </motion.div>
          </StaggerItem>
        ))}
      </StaggerChildren>
    </section>
  )
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────

type FAQItem = { q: string; a: string }

const faqs: FAQItem[] = [
  {
    q: 'How is this different from Todoist or Things 3?',
    a: "Most task apps are general-purpose lists. time24 enforces the GTD methodology at every step - your inbox requires processing before items become actions, every project needs a next action, and the Weekly Review keeps your whole system current. It's the difference between a notebook and a workflow.",
  },
  {
    q: 'What is GTD?',
    a: "Getting Things Done (GTD) is a productivity methodology by David Allen. The core idea: your brain is for having ideas, not storing them. You capture everything, process each item into a concrete next action or reference, and review regularly. time24 implements this as a structured app.",
  },
  {
    q: 'Is there a mobile app?',
    a: 'time24 is fully mobile-responsive and works in any browser on iOS and Android. A dedicated native app is on the roadmap - sign up to get notified when it launches.',
  },
  {
    q: 'Will there ever be a paid version?',
    a: "time24 is 100% free during public beta. If a paid tier is introduced, all current features will remain free. We'll give existing users plenty of notice and a generous grandfather window.",
  },
  {
    q: 'Is my data safe?',
    a: "Every database query is scoped to your account. It's architecturally impossible to access another user's tasks - this is enforced at the database layer, not just in application code. We use Google OAuth, so we never store your password.",
  },
]

function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section className="max-w-6xl mx-auto px-6 py-12 sm:py-20 border-t border-white/10">
      <FadeUp className="flex flex-col items-center gap-4 mb-12 text-center">
        <span className="text-xs font-semibold uppercase tracking-widest text-[#3ECF8E]">FAQ</span>
        <h2 className="text-3xl font-bold text-zinc-100">Common questions</h2>
      </FadeUp>

      <FadeUp delay={0.1}>
        <div className="max-w-2xl mx-auto">
          {faqs.map((faq, i) => (
            <div key={faq.q} className="border-b border-white/10">
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between py-4 text-left cursor-pointer"
              >
                <span className={`text-sm font-medium transition-colors ${openIndex === i ? 'text-[#3ECF8E]' : 'text-zinc-100'}`}>
                  {faq.q}
                </span>
                <motion.div
                  animate={{ rotate: openIndex === i ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="shrink-0 ml-4"
                >
                  <ChevronDown size={16} className="text-zinc-400" />
                </motion.div>
              </button>
              <AnimatePresence initial={false}>
                {openIndex === i && (
                  <motion.div
                    key="answer"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <p className="text-sm text-zinc-300 leading-relaxed pb-4">{faq.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </FadeUp>
    </section>
  )
}

// ─── Final CTA ───────────────────────────────────────────────────────────────

function FinalCTASection() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-12 sm:py-20 border-t border-white/10">
      <FadeUp>
        <div className="relative rounded-2xl bg-[#1c1c1c] border border-white/10 px-8 py-14 flex flex-col items-center gap-6 text-center overflow-hidden">
          {/* Animated background glow */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            animate={{
              background: [
                'radial-gradient(ellipse at 50% 130%, #3ECF8E14 0%, transparent 60%)',
                'radial-gradient(ellipse at 50% 90%, #3ECF8E24 0%, transparent 60%)',
                'radial-gradient(ellipse at 50% 130%, #3ECF8E14 0%, transparent 60%)',
              ],
            }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
          />
          <h2 className="text-3xl sm:text-4xl font-bold text-zinc-100 relative z-10">
            Start clearing your head today.
          </h2>
          <p className="text-zinc-300 max-w-md relative z-10">
            Free. No credit card. Your data stays yours.
          </p>
          <div className="flex flex-wrap gap-3 justify-center relative z-10">
            <motion.div
              whileHover={{ scale: 1.07 }}
              whileTap={{ scale: 0.96 }}
              animate={{
                boxShadow: [
                  '0 0 0px #3ECF8E00',
                  '0 0 28px #3ECF8E66',
                  '0 0 0px #3ECF8E00',
                ],
              }}
              transition={{ boxShadow: { repeat: Infinity, duration: 2.2 } }}
              className="rounded-lg"
            >
              <Link
                href="/register"
                className="block px-8 py-3 rounded-lg bg-[#3ECF8E] text-black font-semibold text-sm hover:bg-[#34B27B] transition-colors"
              >
                Get started for free
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
              <Link
                href="/login"
                className="block px-8 py-3 rounded-lg border border-white/10 text-zinc-100 text-sm hover:bg-white/5 transition-colors"
              >
                Sign in →
              </Link>
            </motion.div>
          </div>
        </div>
      </FadeUp>
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
          <Link href="/privacy" className="text-xs text-zinc-300 hover:text-zinc-100 transition-colors">
            Privacy Policy
          </Link>
          <Link href="/terms" className="text-xs text-zinc-300 hover:text-zinc-100 transition-colors">
            Terms of Service
          </Link>
          <p className="text-xs text-zinc-300">
            &copy; {new Date().getFullYear()} time24. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function LandingPage({ stats }: { stats: LandingStats }) {
  return (
    <div
      className="min-h-screen bg-[#181818] text-zinc-100"
      style={{ '--text-primary': '#f4f4f5' } as React.CSSProperties}
    >
      <LandingHeader />
      <main>
        <HeroSection />
        <StatsBar stats={stats} />
        <PainPointSection />
        <GTDWorkflowSection />
        <FeaturesSection />
        <DifferentiatorsSection />
        <ComparisonTable />
        <FeatureChecklistSection />
        <TestimonialsSection />
        <TrustBanner />
        <FAQSection />
        <FinalCTASection />
      </main>
      <LandingFooter />
    </div>
  )
}
