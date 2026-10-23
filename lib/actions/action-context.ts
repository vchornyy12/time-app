import 'server-only'
import { AsyncLocalStorage } from 'node:async_hooks'
import type { SupabaseClient, User } from '@supabase/supabase-js'

export type ActionContext = { supabase: SupabaseClient; user: User; inboxVersion?: string }
// Only the verified HTTP adapter supplies this context. It is request-local,
// so existing web actions and their nested calendar actions share the same user.
export const actionContext = new AsyncLocalStorage<ActionContext>()
