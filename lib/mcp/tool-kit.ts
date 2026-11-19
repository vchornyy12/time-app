import 'server-only'
import { z } from 'zod'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { TASK_SOURCES } from '@/lib/types'

export type ToolContext = { supabase: SupabaseClient; user: User; clientId: string }

export type ToolAnnotations = { title: string; readOnlyHint: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint: boolean }
export type Tool<S extends z.ZodType> = {
  name: string
  description: string
  input: S
  annotations: ToolAnnotations
  run: (args: z.infer<S>, ctx: ToolContext) => Promise<unknown>
}
export const tool = <S extends z.ZodType>(t: Tool<S>) => t

export const source = z.enum(TASK_SOURCES)

export async function audit(ctx: ToolContext, toolName: string, ok: boolean, taskId: string | null, detail?: string) {
  // Best effort: an audit failure must not turn a successful call into an error
  // the agent would retry, but it is reported in server logs.
  const { error } = await ctx.supabase.from('agent_events').insert({
    user_id: ctx.user.id, client_id: ctx.clientId.slice(0, 200), tool: toolName, task_id: taskId, ok, detail: detail?.slice(0, 500) ?? null,
  })
  if (error) console.error('agent_events insert failed', error.code)
}

/** Runs async work over items with bounded concurrency, preserving order. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i])
    }
  }))
  return out
}
