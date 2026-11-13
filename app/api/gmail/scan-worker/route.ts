import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { analyzeGmailBatch } from '@/lib/gmail/analyzer'
import { saveScanCursor } from '@/lib/gmail/messages'
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
  let body: { runId?: unknown; workerToken?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }
  if (typeof body.runId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.runId)
    || typeof body.workerToken !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.workerToken)) {
    return NextResponse.json({ error: 'Invalid scan run' }, { status: 400 })
  }
  const admin = createAdminClient()
  const { data: run, error: claimError } = await admin.rpc('claim_gmail_scan_run', {
    p_run_id: body.runId, p_worker_token: body.workerToken,
  })
  if (claimError) return NextResponse.json({ error: 'Could not claim scan run' }, { status: 500 })
  if (!run) {
    const { data: current } = await admin.from('gmail_scan_runs').select('status,processed_count,batch_size,suggestion_count,error_message').eq('id', body.runId).maybeSingle()
    return NextResponse.json(current?.status === 'running' || current?.status === 'queued'
      ? { ...current, status: 'busy' }
      : current ?? { status: 'missing' })
  }

  try {
    const batch = await analyzeGmailBatch(run.user_id, 5)
    const done = batch.analyzed === 0 || batch.analyzed < 5
    const { data: updated, error } = await admin.rpc('advance_gmail_scan_run', {
      p_run_id: body.runId, p_worker_token: body.workerToken,
      p_processed: batch.analyzed, p_suggestions: batch.suggestions, p_done: done,
    })
    if (error || !updated) throw new Error('Could not save scan progress.')
    if (updated.status === 'completed') await saveScanCursor(run.user_id, run.created_at)
    return NextResponse.json(updated)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gmail scan failed.'
    await admin.rpc('fail_gmail_scan_run', { p_run_id: body.runId, p_worker_token: body.workerToken, p_error: message })
    return NextResponse.json({ status: 'failed', error: message }, { status: 200 })
  }
}
