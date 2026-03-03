import { z } from 'zod'

// ── Primitives ───────────────────────────────────────────────

export const taskId = z.string().uuid('Invalid task ID')
export const projectId = z.string().uuid('Invalid project ID')
export const itemId = z.string().uuid('Invalid item ID')

export const title = z.string().trim().min(1, 'Title is required').max(500)
export const optionalTitle = z.string().trim().max(500).optional()

/** YYYY-MM-DD */
export const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format')
export const optionalDateString = dateString.optional()

/** ISO 8601 or datetime-local value parseable by new Date() */
export const datetimeString = z.string().refine(
  (v) => !isNaN(new Date(v).getTime()),
  'Invalid datetime'
)

export const contexts = z.array(z.string().max(50)).max(20)

export const contextName = z.string().trim().min(1, 'Context name is required').max(50)

// ── Server action schemas ────────────────────────────────────

export const captureTaskSchema = z.object({
  title,
})

export const processToWaitingForSchema = z.object({
  taskId,
  delegatedTo: z.string().trim().min(1, 'Delegated to is required').max(200),
  dueDate: optionalDateString,
  contexts: contexts.default([]),
})

export const processToCalendarSchema = z.object({
  taskId,
  scheduledAt: datetimeString,
})

export const processToSomedayMaybeSchema = z.object({
  taskId,
  reviewDate: optionalDateString,
})

export const processToNextActionsSchema = z.object({
  taskId,
  contexts: contexts.default([]),
  nextActionTitle: optionalTitle,
})

export const createProjectSchema = z.object({
  title,
  completionCriteria: z.string().max(1000).default(''),
  roughPlanLines: z.array(z.string().max(500)).max(50),
  firstStepTitle: z.string().max(500).default(''),
  originTaskId: taskId,
})

export const reorderRoughPlanSchema = z.object({
  projectId,
  orderedIds: z.array(z.string().uuid()).max(100),
})

export const addRoughPlanStepSchema = z.object({
  projectId,
  text: z.string().trim().min(1, 'Step text is required').max(500),
})

export const updateWaitingForDueDateSchema = z.object({
  taskId,
  dueDate: dateString.nullable(),
})

export const updateSomedayReviewDateSchema = z.object({
  taskId,
  reviewDate: dateString.nullable(),
})

export const rescheduleCalendarTaskSchema = z.object({
  taskId,
  scheduledAt: datetimeString,
})

export const delegateTaskSchema = z.object({
  taskId,
  delegatedTo: z.string().trim().min(1, 'Delegated to is required').max(200),
  dueDate: optionalDateString,
  isCommunicated: z.boolean().default(false),
})

// ── Attachment schemas ──────────────────────────────────────

export const attachmentSchema = z.object({
  name: z.string().min(1).max(255),
  path: z.string().min(1).max(1000),
  type: z.string().min(1).max(100),
  size: z.number().int().nonnegative(),
})

export const updateAttachmentsSchema = z.object({
  taskId,
  attachments: z.array(attachmentSchema).max(20),
})
