import 'server-only'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { PROPOSED_TYPES, TASK_SOURCES } from '@/lib/types'
import { dateString, title } from '@/lib/validation/schemas'

export type ToolContext = { supabase: SupabaseClient; user: User; clientId: string }

type ToolAnnotations = { title: string; readOnlyHint: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint: boolean }
type Tool<S extends z.ZodType> = {
  name: string
  description: string
  input: S
  annotations: ToolAnnotations
  run: (args: z.infer<S>, ctx: ToolContext) => Promise<unknown>
}
const tool = <S extends z.ZodType>(t: Tool<S>) => t

const source = z.enum(TASK_SOURCES)
const limit = z.number().int().min(1).max(100).default(50)
  .describe('Maximum number of tasks to return (1-100, default 50).')

// Fields returned to the agent. The quote is only returned by get_task.
const LIST_COLUMNS = 'id, title, status, created_at, due_date, scheduled_at, delegated_to, contexts, source, source_url'
const DETAIL_COLUMNS = `${LIST_COLUMNS}, project_id, completed_at, source_ref, source_quote, agent_proposal, captured_by`

/**
 * The dedupe key is derived on the server from stable identifiers, never chosen
 * by the model: the same source item always maps to the same Inbox task.
 */
export function dedupeKey(src: string, sourceRef: string, itemKey: string) {
  const digest = createHash('sha256').update(`${src}\u0000${sourceRef}\u0000${itemKey.trim().toLowerCase()}`).digest('base64url')
  return `${src}:${digest.slice(0, 43)}`
}

async function audit(ctx: ToolContext, toolName: string, ok: boolean, taskId: string | null, detail?: string) {
  // Best effort: an audit failure must not turn a successful capture into an error
  // the agent would retry, but it is reported in server logs.
  const { error } = await ctx.supabase.from('agent_events').insert({
    user_id: ctx.user.id, client_id: ctx.clientId.slice(0, 200), tool: toolName, task_id: taskId, ok, detail: detail?.slice(0, 500) ?? null,
  })
  if (error) console.error('agent_events insert failed', error.code)
}

async function listByStatus(ctx: ToolContext, status: string, max: number, context?: string) {
  let query = ctx.supabase.from('tasks').select(LIST_COLUMNS).eq('user_id', ctx.user.id).eq('status', status)
  if (context) query = query.contains('contexts', [context])
  const { data, error } = await query.order('created_at', { ascending: false }).limit(max)
  if (error) throw new Error('Could not read tasks.')
  return { tasks: data ?? [], count: data?.length ?? 0 }
}

export const captureInput = z.object({
  title: title.describe('Short, verb-first description of the action or commitment (max 500 characters).'),
  source: source.describe('Where the item came from.'),
  source_ref: z.string().trim().min(1).max(300)
    .describe('Stable ID of the source object: Gmail message or thread ID, Bluedot meeting ID, chat message ID. Required for deduplication.'),
  item_key: z.string().trim().min(1).max(100).default('1')
    .describe('Distinguishes several items from the same source object, e.g. "1", "2" in order of appearance. Keep it stable across runs.'),
  source_url: z.url({ protocol: /^https$/ }).max(2000).optional()
    .describe('HTTPS link that opens the source (email, meeting, message).'),
  source_quote: z.string().trim().max(1000).optional()
    .describe('Short verbatim excerpt that shows the commitment. Leave out personal or HR details.'),
  proposed: z.object({
    type: z.enum(PROPOSED_TYPES).optional().describe('How you think the user should process it. Only a suggestion.'),
    owner: z.string().trim().max(200).optional().describe('Who is expected to act, if not the user.'),
    due: dateString.optional().describe('Due date mentioned in the source, YYYY-MM-DD.'),
    contexts: z.array(z.string().trim().min(1).max(50)).max(5).optional(),
  }).strict().optional(),
  confidence: z.number().min(0).max(1).optional().describe('How sure you are that this is a real action item (0-1).'),
  notes: z.string().trim().max(1000).optional().describe('Anything the user needs to decide, in one or two sentences.'),
}).strict()

export const TOOLS = [
  tool({
    name: 'capture_inbox_item',
    description: 'Add one candidate action item to the user\'s GTD Inbox as a proposal. The user processes it in the app; '
      + 'you cannot complete, move, delegate or delete tasks. Capturing the same source_ref and item_key again returns the '
      + 'existing task instead of creating a duplicate.',
    input: captureInput,
    annotations: { title: 'Capture to Inbox', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async run(args, ctx) {
      const key = dedupeKey(args.source, args.source_ref, args.item_key)
      const proposal = { ...args.proposed, confidence: args.confidence, notes: args.notes }
      const hasProposal = Object.values(proposal).some((v) => v !== undefined)
      const { data, error } = await ctx.supabase.from('tasks').upsert({
        user_id: ctx.user.id, title: args.title, status: 'inbox', source: args.source, source_ref: args.source_ref,
        source_url: args.source_url ?? null, source_quote: args.source_quote || null, dedupe_key: key,
        agent_proposal: hasProposal ? proposal : null, captured_by: ctx.clientId.slice(0, 200),
      }, { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true }).select('id, status').maybeSingle()
      if (error) { await audit(ctx, 'capture_inbox_item', false, null, error.code); throw new Error('Could not capture the item.') }
      if (data) {
        await audit(ctx, 'capture_inbox_item', true, data.id, 'created')
        return { created: true, task_id: data.id, status: data.status }
      }
      const existing = await ctx.supabase.from('tasks').select('id, status')
        .eq('user_id', ctx.user.id).eq('dedupe_key', key).single()
      if (existing.error) throw new Error('Could not capture the item.')
      return { created: false, duplicate: true, task_id: existing.data.id, status: existing.data.status }
    },
  }),
  tool({
    name: 'list_inbox',
    description: 'List unprocessed items in the user\'s Inbox, newest first. Use it to avoid capturing something that is already there.',
    input: z.object({ limit }).strict(),
    annotations: { title: 'List Inbox', readOnlyHint: true, openWorldHint: false },
    run: (args, ctx) => listByStatus(ctx, 'inbox', args.limit),
  }),
  tool({
    name: 'list_next_actions',
    description: 'List the user\'s Next Actions, optionally filtered by one context (for example "@computer").',
    input: z.object({ limit, context: z.string().trim().min(1).max(50).optional() }).strict(),
    annotations: { title: 'List Next Actions', readOnlyHint: true, openWorldHint: false },
    run: (args, ctx) => listByStatus(ctx, 'next_actions', args.limit, args.context),
  }),
  tool({
    name: 'list_waiting_for',
    description: 'List items the user is waiting on from other people, with who owns them and when they are due.',
    input: z.object({ limit }).strict(),
    annotations: { title: 'List Waiting For', readOnlyHint: true, openWorldHint: false },
    run: (args, ctx) => listByStatus(ctx, 'waiting_for', args.limit),
  }),
  tool({
    name: 'get_task',
    description: 'Get one task by ID, including its source quote and the original proposal.',
    input: z.object({ task_id: z.uuid() }).strict(),
    annotations: { title: 'Get task', readOnlyHint: true, openWorldHint: false },
    async run(args, ctx) {
      const { data, error } = await ctx.supabase.from('tasks').select(DETAIL_COLUMNS)
        .eq('user_id', ctx.user.id).eq('id', args.task_id).maybeSingle()
      if (error) throw new Error('Could not read the task.')
      if (!data) throw new Error('Task not found.')
      return { task: data }
    },
  }),
  tool({
    name: 'get_source_cursor',
    description: 'Read where the previous capture run stopped for a source (for example the time or ID of the last processed email). '
      + 'Returns null on the first run.',
    input: z.object({ source }).strict(),
    annotations: { title: 'Get source cursor', readOnlyHint: true, openWorldHint: false },
    async run(args, ctx) {
      const { data, error } = await ctx.supabase.from('agent_cursors').select('cursor, updated_at')
        .eq('user_id', ctx.user.id).eq('source', args.source).maybeSingle()
      if (error) throw new Error('Could not read the cursor.')
      return { source: args.source, cursor: data?.cursor ?? null, updated_at: data?.updated_at ?? null }
    },
  }),
  tool({
    name: 'set_source_cursor',
    description: 'Save where this capture run stopped for a source. Call it only after every item up to that point was captured, '
      + 'so a failed run is retried next time.',
    input: z.object({ source, cursor: z.string().trim().min(1).max(500) }).strict(),
    annotations: { title: 'Save source cursor', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async run(args, ctx) {
      const { error } = await ctx.supabase.from('agent_cursors').upsert(
        { user_id: ctx.user.id, source: args.source, cursor: args.cursor, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,source' },
      )
      await audit(ctx, 'set_source_cursor', !error, null, args.source)
      if (error) throw new Error('Could not save the cursor.')
      return { source: args.source, cursor: args.cursor }
    },
  }),
] as const

export function listTools() {
  return TOOLS.map((t) => ({
    name: t.name,
    title: t.annotations.title,
    description: t.description,
    inputSchema: z.toJSONSchema(t.input, { io: 'input' }),
    annotations: t.annotations,
  }))
}

export function findTool(name: string) {
  return (TOOLS as readonly Tool<z.ZodType>[]).find((t) => t.name === name)
}
