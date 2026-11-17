import 'server-only'
import { createHash, timingSafeEqual } from 'node:crypto'
import { gmailWorkerOrigin } from './config'

/**
 * Shared secret between the scheduler, the background function and the worker
 * routes. Set GMAIL_WORKER_SECRET (32+ random bytes) so the database
 * service-role key never travels over HTTP; the service key is only a
 * fallback for deployments that have not configured the dedicated secret yet.
 * netlify/functions/*.mjs must resolve the secret the same way.
 */
function workerSecret(): string | null {
  return process.env.GMAIL_WORKER_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || null
}

const digest = (value: string) => createHash('sha256').update(value).digest()

export function workerAuthorized(request: Request): boolean {
  const expected = workerSecret()
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (!expected || !supplied) return false
  // Hashing first gives equal-length buffers, so the comparison leaks nothing about length.
  return timingSafeEqual(digest(expected), digest(supplied))
}

/** Hand a queued scan run to the Netlify background function. */
export async function dispatchScanWorker(runId: string): Promise<void> {
  const secret = workerSecret()
  if (!secret) throw new Error('Gmail worker secret is not configured.')
  const endpoint = new URL('/.netlify/functions/gmail-scan-worker-background', gmailWorkerOrigin())
  const response = await fetch(endpoint, {
    method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(8000),
    // Never follow a redirect: it would forward the bearer secret elsewhere.
    redirect: 'manual',
    headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ runId }),
  })
  if (!response.ok) throw new Error('Background worker rejected the scan.')
}
