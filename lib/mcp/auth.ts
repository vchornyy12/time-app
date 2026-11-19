import 'server-only'
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

export const MCP_PATH = '/api/mcp'

export function mcpEnabled() {
  return process.env.MCP_AGENT_ENABLED === 'true'
}

/**
 * Public origin of the app. Hosting adapters can expose immutable deploy
 * hostnames, so a configured APP_ORIGIN wins over the request URL.
 */
export function publicOrigin(requestUrl: string) {
  const configured = process.env.APP_ORIGIN?.trim()
  if (configured) {
    const url = new URL(configured)
    if (url.origin === configured.replace(/\/$/, '')) return url.origin
  }
  return new URL(requestUrl).origin
}

export function resourceUrl(requestUrl: string) {
  return `${publicOrigin(requestUrl)}${MCP_PATH}`
}

export function resourceMetadataUrl(requestUrl: string) {
  return `${publicOrigin(requestUrl)}/.well-known/oauth-protected-resource${MCP_PATH}`
}

export function authorizationServer() {
  return `${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin}/auth/v1`
}

/** RFC 9728 protected resource metadata. */
export function protectedResourceMetadata(requestUrl: string) {
  return {
    resource: resourceUrl(requestUrl),
    authorization_servers: [authorizationServer()],
    bearer_methods_supported: ['header'],
    resource_name: 'Time24 GTD',
    resource_documentation: `${publicOrigin(requestUrl)}/settings`,
  }
}

/** Reads a JWT payload. Only call this after Supabase has verified the token. */
function jwtClaims(token: string): Record<string, unknown> {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch { return {} }
}

export type McpAuth = { supabase: SupabaseClient; user: User; clientId: string }

/**
 * Verifies an OAuth access token issued by Supabase's OAuth 2.1 server.
 * Ordinary app session tokens have no client_id and are rejected, so the MCP
 * endpoint is reachable only through a connector the user approved.
 */
export async function verifyAgentToken(authorization: string | null): Promise<McpAuth | null> {
  const bearer = authorization?.match(/^Bearer ([A-Za-z0-9._~+/=-]+)$/i)?.[1]
  if (!bearer || bearer.length > 8192) return null
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${bearer}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { data: { user }, error } = await supabase.auth.getUser(bearer)
  if (error || !user) return null
  const clientId = jwtClaims(bearer).client_id
  if (typeof clientId !== 'string' || clientId.length === 0 || clientId.length > 200) return null
  return { supabase, user, clientId }
}
