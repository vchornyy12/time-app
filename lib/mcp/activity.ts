import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { MCP_PATH, publicOrigin } from './auth'

/** Connector URL and recent agent activity for the Settings card. */
export async function agentActivity(supabase: SupabaseClient, userId: string, requestUrl: string) {
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
  const [{ data: last }, { count }] = await Promise.all([
    supabase.from('agent_events').select('created_at').eq('user_id', userId)
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('agent_events').select('id', { count: 'exact', head: true }).eq('user_id', userId)
      .eq('tool', 'capture_inbox_item').eq('ok', true).gte('created_at', since),
  ])
  return {
    connectorUrl: `${publicOrigin(requestUrl)}${MCP_PATH}`,
    lastActivityAt: (last?.created_at as string | undefined) ?? null,
    capturedLast7Days: count ?? 0,
  }
}
