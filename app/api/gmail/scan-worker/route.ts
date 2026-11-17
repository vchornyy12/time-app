import { NextResponse } from 'next/server'
import { analyzeGmailBatch } from '@/lib/gmail/analyzer'
import { saveScanCursor } from '@/lib/gmail/messages'
import { workerAuthorized } from '@/lib/gmail/worker'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

const BATCH = 5
const UUID = /^[0-9a-f-]{36}$/i

export async function POST(request: Request) {
  if (!workerAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: { runId?: unknown; workerToken?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }
  if (typeof body.runId !== 'string' || !UUID.test(body.runId)
    || typeof body.workerToken !== 'string' || !UUID.test(body.workerToken)) {
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
    // New mail is listed once, by the first batch of a run; later batches only
    // drain the queue. A run interrupted before any progress lists again.
    const batch = await analyzeGmailBatch(run.user_id, BATCH, { discover: run.processed_count === 0 })
    const { data: updated, error } = await admin.rpc('advance_gmail_scan_run', {
      p_run_id: body.runId, p_worker_token: body.workerToken,
      p_processed: batch.analyzed, p_suggestions: batch.suggestions, p_done: batch.analyzed < BATCH,
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
