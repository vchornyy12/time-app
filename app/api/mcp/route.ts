import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { mcpEnabled, resourceMetadataUrl, verifyAgentToken } from '@/lib/mcp/auth'
import { handleMessage } from '@/lib/mcp/protocol'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY = 64_000
const baseHeaders = { 'Cache-Control': 'private, no-store' }

const json = (value: unknown, status = 200, headers: Record<string, string> = {}) =>
  NextResponse.json(value, { status, headers: { ...baseHeaders, ...headers } })

function unauthorized(request: NextRequest) {
  return json({ error: 'unauthorized', error_description: 'Connect the Time24 connector again.' }, 401, {
    'WWW-Authenticate': `Bearer resource_metadata="${resourceMetadataUrl(request.url)}"`,
  })
}

export async function POST(request: NextRequest) {
  if (!mcpEnabled()) return json({ error: 'not_found' }, 404)
  const auth = await verifyAgentToken(request.headers.get('authorization'))
  if (!auth) return unauthorized(request)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Expected application/json.' } }, 415)
  }

  let raw: unknown
  try {
    const text = await request.text()
    if (text.length > MAX_BODY) return json({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Request too large.' } }, 413)
    raw = JSON.parse(text)
  } catch {
    return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error.' } }, 400)
  }

  const response = await handleMessage(raw, auth)
  if (!response) return new NextResponse(null, { status: 202, headers: baseHeaders })
  if ((raw as { method?: string }).method === 'tools/call') {
    revalidatePath('/inbox')
    revalidatePath('/', 'layout')
  }
  return json(response)
}

// Stateless server: no server-to-client stream and no sessions to end.
export async function GET() {
  return json({ error: 'method_not_allowed' }, 405, { Allow: 'POST' })
}

export async function DELETE() {
  return json({ error: 'method_not_allowed' }, 405, { Allow: 'POST' })
}
