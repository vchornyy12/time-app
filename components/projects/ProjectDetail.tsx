'use client'

import { useId, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CheckCircle2, Loader2, ArrowRight, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { Project, Task, RoughPlanItem } from '@/lib/types'
import {
  completeFirstStep,
  promoteRoughPlanItem,
  completeProject,
  reorderRoughPlan,
  addRoughPlanStep,
} from '@/lib/actions/projects'

// ── Types ─────────────────────────────────────────────────────

type FirstStepTask = Pick<Task, 'id' | 'title' | 'status' | 'contexts' | 'due_date'>

interface ProjectDetailProps {
  project: Project
  firstStepTask: FirstStepTask | null
}

// ── Helpers ───────────────────────────────────────────────────

function moveInArray<T>(arr: T[], from: number, to: number): T[] {
  const result = [...arr]
  const [item] = result.splice(from, 1)
  result.splice(to, 0, item)
  return result
}

const DROPZONE_ID = 'first-step-dropzone'

// ── Main component ────────────────────────────────────────────

export function ProjectDetail({ project, firstStepTask: initialFirstStep }: ProjectDetailProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [firstStep, setFirstStep] = useState<FirstStepTask | null>(initialFirstStep)
  const [roughPlan, setRoughPlan] = useState<RoughPlanItem[]>(project.rough_plan)
  const [isDone, setIsDone] = useState(project.status === 'completed')
  const [justCompleted, setJustCompleted] = useState(false)
  const [activeItem, setActiveItem] = useState<RoughPlanItem | null>(null)
  const [newStepText, setNewStepText] = useState('')
  const dndId = useId()

  // Require 8px of movement to start a drag — prevents click hijacking
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // ── Action handlers ────────────────────────────────────────

  function handleCompleteFirstStep() {
    if (!firstStep) return
    startTransition(async () => {
      await completeFirstStep(project.id, firstStep.id)
      setFirstStep(null)
      setJustCompleted(roughPlan.length > 0)
      router.refresh()
    })
  }

  function handlePromote(item: RoughPlanItem) {
    startTransition(async () => {
      const task = await promoteRoughPlanItem(project.id, item.id)
      setRoughPlan((prev) => prev.filter((i) => i.id !== item.id))
      setFirstStep({
        id: task.id,
        title: task.title,
        status: 'next_actions',
        contexts: task.contexts as string[],
        due_date: task.due_date,
      })
      setJustCompleted(false)
      router.refresh()
    })
  }

  function handleCompleteProject() {
    startTransition(async () => {
      await completeProject(project.id)
      setIsDone(true)
      router.refresh()
    })
  }

  function handleAddStep() {
    const text = newStepText.trim()
    if (!text) return
    setNewStepText('')
    startTransition(async () => {
      const newItem = await addRoughPlanStep(project.id, text)
      setRoughPlan((prev) => [...prev, newItem])
      router.refresh()
    })
  }

  // ── DnD handlers ───────────────────────────────────────────

  function handleDragStart(event: DragStartEvent) {
    const item = roughPlan.find((i) => i.id === event.active.id)
    setActiveItem(item ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveItem(null)

    if (!over) return

    // Dropped on the promote drop zone
    if (over.id === DROPZONE_ID && !firstStep) {
      const item = roughPlan.find((i) => i.id === active.id)
      if (item) handlePromote(item)
      return
    }

    // Reorder within the list
    if (active.id !== over.id) {
      const oldIndex = roughPlan.findIndex((i) => i.id === active.id)
      const newIndex = roughPlan.findIndex((i) => i.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      const reordered = moveInArray(roughPlan, oldIndex, newIndex).map((item, idx) => ({
        ...item,
        order: idx,
      }))
      setRoughPlan(reordered)

      startTransition(async () => {
        await reorderRoughPlan(project.id, reordered.map((i) => i.id))
        router.refresh()
      })
    }
  }

  // ── Completed state ────────────────────────────────────────

  if (isDone) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <div className="text-5xl">🎉</div>
        <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Project complete!</h2>
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{project.title} is done.</p>
      </div>
    )
  }

  const canCompleteProject = !firstStep && roughPlan.length === 0

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col gap-8">

        {/* Completion criteria */}
        {project.completion_criteria && (
          <div className="px-5 py-4 rounded-xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
            <p className="text-xs font-medium uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-tertiary)' }}>
              Done when
            </p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {project.completion_criteria}
            </p>
          </div>
        )}

        {/* "What's next?" nudge banner */}
        {justCompleted && (
          <div className="px-4 py-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center gap-3 animate-fade-in">
            <span className="text-base" aria-hidden="true">✓</span>
            <p className="text-sm text-indigo-300">
              Step done! What&apos;s next for <span className="font-medium">{project.title}</span>?
            </p>
          </div>
        )}

        {/* Active first step */}
        <section>
          <h2 className="text-xs font-medium uppercase tracking-wide mb-3" style={{ color: 'var(--text-tertiary)' }}>
            Active first step
          </h2>

          {firstStep ? (
            <FirstStepCard
              task={firstStep}
              onComplete={handleCompleteFirstStep}
              isPending={isPending}
            />
          ) : (
            <PromoteDropZone hasDragInProgress={!!activeItem} />
          )}
        </section>

        {/* Rough plan */}
        <section>
          <h2 className="text-xs font-medium uppercase tracking-wide mb-3" style={{ color: 'var(--text-tertiary)' }}>
            Rough plan
            {roughPlan.length > 0 && (
              <span className="normal-case font-normal" style={{ color: 'var(--text-muted)' }}>
                {' '}· {roughPlan.length} {roughPlan.length === 1 ? 'step' : 'steps'} remaining
              </span>
            )}
          </h2>

          {roughPlan.length > 0 ? (
            <SortableContext
              items={roughPlan.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="flex flex-col gap-2">
                {roughPlan.map((item, i) => (
                  <SortableRoughPlanRow
                    key={item.id}
                    item={item}
                    index={i}
                    onPromote={() => handlePromote(item)}
                    disabled={isPending || !!firstStep}
                  />
                ))}
              </ul>
            </SortableContext>
          ) : (
            <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>
              The plan is empty. What&apos;s the next move?
            </p>
          )}

          {!!firstStep && roughPlan.length > 0 && (
            <p className="text-xs mt-2.5 text-center" style={{ color: 'var(--text-muted)' }}>
              Complete the active step first, then promote the next one
            </p>
          )}

          {/* Add new step input */}
          <div className="flex gap-2 mt-3">
            <input
              type="text"
              value={newStepText}
              onChange={(e) => setNewStepText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddStep()
                }
              }}
              placeholder="Add a new step to the plan..."
              className="glass-input flex-1 text-sm"
              disabled={isPending}
              aria-label="Add a new step to the rough plan"
            />
            <button
              type="button"
              onClick={handleAddStep}
              disabled={!newStepText.trim() || isPending}
              className="px-4 py-2 text-xs rounded-lg disabled:opacity-40 transition-all duration-150 flex-shrink-0 border"
              style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-default)', color: 'var(--text-tertiary)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'var(--bg-surface-hover)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'var(--bg-surface)' }}
            >
              Add
            </button>
          </div>
        </section>

        {/* Complete project */}
        {canCompleteProject && (
          <div className="flex justify-center pt-2">
            <button
              onClick={handleCompleteProject}
              disabled={isPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500/[0.12] hover:bg-emerald-500/[0.22] border border-emerald-500/20 text-emerald-300 hover:text-emerald-200 text-sm font-medium transition-all duration-150 disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Mark project complete
            </button>
          </div>
        )}
      </div>

      {/* Drag overlay — follows the cursor */}
      <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
        {activeItem ? <DragOverlayCard item={activeItem} /> : null}
      </DragOverlay>
    </DndContext>
  )
}

// ── Drop zone (shown when no first step) ──────────────────────

function PromoteDropZone({ hasDragInProgress }: { hasDragInProgress: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: DROPZONE_ID })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'px-4 py-6 rounded-xl border-2 border-dashed text-center transition-all duration-150',
        isOver
          ? 'border-indigo-500/60 bg-indigo-500/10'
          : hasDragInProgress
            ? 'border-indigo-500/30 bg-indigo-500/[0.05]'
            : ''
      )}
      aria-label="Drop here to set as next step"
      style={!isOver && !hasDragInProgress ? { borderColor: 'var(--border-subtle)', background: 'var(--bg-surface)' } : undefined}
    >
      <p
        className={cn(
          'text-sm transition-colors duration-150',
          isOver
            ? 'text-indigo-300'
            : hasDragInProgress
              ? 'text-indigo-300/60'
              : ''
        )}
        style={!isOver && !hasDragInProgress ? { color: 'var(--text-muted)' } : undefined}
      >
        {isOver
          ? 'Drop to set as next step'
          : hasDragInProgress
            ? 'Drop here to promote this step'
            : 'Promote a step below — or drag one here'}
      </p>
    </div>
  )
}

// ── First step card ────────────────────────────────────────────

function FirstStepCard({
  task,
  onComplete,
  isPending,
}: {
  task: FirstStepTask
  onComplete: () => void
  isPending: boolean
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-4 rounded-xl bg-indigo-500/[0.07] border border-indigo-500/[0.15]">
      <button
        onClick={onComplete}
        disabled={isPending}
        className={cn(
          'mt-0.5 flex-shrink-0 w-[20px] h-[20px] rounded-full border-2',
          'flex items-center justify-center transition-all duration-150',
          'border-indigo-400/50 hover:border-indigo-400 hover:bg-indigo-400/15',
          'disabled:opacity-50 group/check'
        )}
        aria-label={`Mark "${task.title}" as done`}
      >
        <svg
          className="w-3 h-3 text-indigo-400 opacity-0 group-hover/check:opacity-100 transition-opacity duration-150"
          fill="none"
          viewBox="0 0 10 10"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M1.5 5l2.5 2.5 4.5-4.5" />
        </svg>
      </button>

      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug" style={{ color: 'var(--text-primary)' }}>{task.title}</p>
        {task.contexts.length > 0 && (
          <div className="flex gap-1.5 mt-1.5 flex-wrap">
            {task.contexts.map((ctx) => (
              <span
                key={ctx}
                className="text-xs px-2 py-0.5 rounded-full border"
                style={{ color: 'var(--text-tertiary)', background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
              >
                {ctx}
              </span>
            ))}
          </div>
        )}
      </div>

      {isPending && (
        <Loader2 className="w-4 h-4 text-indigo-400 animate-spin flex-shrink-0 mt-0.5" />
      )}
    </div>
  )
}

// ── Sortable rough plan row ────────────────────────────────────

function SortableRoughPlanRow({
  item,
  index,
  onPromote,
  disabled,
}: {
  item: RoughPlanItem
  index: number
  onPromote: () => void
  disabled: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    background: 'var(--bg-surface)',
    borderColor: 'var(--border-subtle)',
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-xl border group transition-opacity duration-150',
        isDragging && 'opacity-30'
      )}
    >
      {/* Drag handle */}
      <button
        {...listeners}
        {...attributes}
        className="flex-shrink-0 cursor-grab active:cursor-grabbing transition-colors touch-none"
        style={{ color: 'var(--text-muted)' }}
        aria-label={`Drag to reorder "${item.text}"`}
        tabIndex={-1}
      >
        <GripVertical className="w-4 h-4" />
      </button>

      <span className="text-xs w-4 flex-shrink-0 text-right tabular-nums" style={{ color: 'var(--text-muted)' }}>
        {index + 1}
      </span>

      <span className="flex-1 text-sm leading-snug min-w-0" style={{ color: 'var(--text-tertiary)' }}>{item.text}</span>

      {/* "Set as next step" button — keyboard fallback for promotion */}
      <button
        onClick={onPromote}
        disabled={disabled}
        className={cn(
          'flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-all duration-150 border',
          disabled
            ? 'cursor-not-allowed'
            : 'opacity-0 group-hover:opacity-100 focus:opacity-100'
        )}
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)', color: disabled ? 'var(--text-muted)' : 'var(--text-tertiary)' }}
        onMouseEnter={(e) => { if (!disabled) { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'var(--bg-surface-hover)'; e.currentTarget.style.borderColor = 'var(--border-default)' } }}
        onMouseLeave={(e) => { if (!disabled) { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.borderColor = 'var(--border-subtle)' } }}
        aria-label={`Set "${item.text}" as next step`}
      >
        <ArrowRight className="w-3 h-3" />
        Set as next step
      </button>
    </li>
  )
}

// ── Drag overlay card ──────────────────────────────────────────

function DragOverlayCard({ item }: { item: RoughPlanItem }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl cursor-grabbing" style={{ background: 'var(--bg-surface-hover)', borderColor: 'var(--border-default)' }}>
      <GripVertical className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
      <span className="text-sm leading-snug" style={{ color: 'var(--text-secondary)' }}>{item.text}</span>
    </div>
  )
}
