import { NextResponse } from 'next/server'
import { gmailAvailable } from '@/lib/gmail/config'
import { dispatchScanWorker, workerAuthorized } from '@/lib/gmail/worker'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (!workerAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!gmailAvailable()) return NextResponse.json({ dispatched: 0, failed: 0, skipped: 'Gmail is disabled on this deployment.' })
  const admin = createAdminClient()
  const { data: runIds, error } = await admin.rpc('enqueue_due_gmail_scan_runs', { p_limit: 10 })
  if (error) return NextResponse.json({ error: 'Could not enqueue due Gmail scans.' }, { status: 500 })
  const results = await Promise.all((runIds ?? []).map(async ({ run_id }: { run_id: string }) => {
    try {
      await dispatchScanWorker(run_id)
      return true
    } catch (dispatchError) {
      const message = dispatchError instanceof Error ? dispatchError.message : 'Could not dispatch Gmail scan.'
      await admin.from('gmail_scan_runs').update({ status: 'failed', completed_at: new Date().toISOString(), error_message: message.slice(0, 500) })
        .eq('id', run_id).eq('status', 'queued')
      return false
    }
  }))
  return NextResponse.json({ dispatched: results.filter(Boolean).length, failed: results.filter(result => !result).length })
}
