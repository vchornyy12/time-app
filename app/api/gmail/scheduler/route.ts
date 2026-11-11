import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { gmailAvailable } from '@/lib/gmail/config'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

function authorized(request: Request): boolean {
  const expected = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (!expected || !supplied) return false
  const left = Buffer.from(expected)
  const right = Buffer.from(supplied)
  return left.length === right.length && timingSafeEqual(left, right)
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!gmailAvailable()) return NextResponse.json({ dispatched: 0, failed: 0, skipped: 'Gmail is disabled on this deployment.' })
  const { data: runIds, error } = await createAdminClient().rpc('enqueue_due_gmail_scan_runs', { p_limit: 10 })
  if (error) return NextResponse.json({ error: 'Could not enqueue due Gmail scans.' }, { status: 500 })
  const origin = process.env.APP_ORIGIN || process.env.GMAIL_APP_ORIGIN
  if (!origin) return NextResponse.json({ error: 'Gmail worker origin is not configured.' }, { status: 503 })
  const endpoint = new URL('/.netlify/functions/gmail-scan-worker-background', origin)
  const admin = createAdminClient()
  const results = await Promise.all((runIds ?? []).map(async ({ run_id }: { run_id: string }) => {
    try {
      const response = await fetch(endpoint, {
        method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(8000),
        headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: run_id }),
      })
      if (!response.ok && response.status !== 202) throw new Error('Background worker rejected the scan.')
      return true
    } catch (dispatchError) {
      const message = dispatchError instanceof Error ? dispatchError.message : 'Could not dispatch Gmail scan.'
      await admin.from('gmail_scan_runs').update({ status: 'failed', completed_at: new Date().toISOString(), error_message: message.slice(0, 500) }).eq('id', run_id)
      return false
    }
  }))
  return NextResponse.json({ dispatched: results.filter(Boolean).length, failed: results.filter(result => !result).length })
}
