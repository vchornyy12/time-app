import { NextRequest, NextResponse } from 'next/server'
import { mcpEnabled, protectedResourceMetadata } from '@/lib/mcp/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Serves both /.well-known/oauth-protected-resource and the path-suffixed
// /.well-known/oauth-protected-resource/api/mcp form (RFC 9728 §3.1).
export async function GET(request: NextRequest, { params }: { params: Promise<{ resource?: string[] }> }) {
  const { resource } = await params
  const path = resource?.join('/') ?? ''
  if (!mcpEnabled() || (path !== '' && path !== 'api/mcp')) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  return NextResponse.json(protectedResourceMetadata(request.url), {
    headers: { 'Cache-Control': 'public, max-age=300', 'Access-Control-Allow-Origin': '*' },
  })
}
