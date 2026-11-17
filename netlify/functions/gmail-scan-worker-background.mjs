import { createHash, timingSafeEqual } from 'node:crypto'

export const config = { background: true }

export default async function handler(request) {
  // Keep in sync with lib/gmail/worker.ts: prefer the dedicated worker secret
  // so the database service-role key is not used as an HTTP bearer token.
  const secret = process.env.GMAIL_WORKER_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  const origin = process.env.APP_ORIGIN || process.env.GMAIL_APP_ORIGIN || process.env.URL
  if (!secret || !origin) throw new Error('Gmail worker environment is incomplete.')
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  const digest = value => createHash('sha256').update(value).digest()
  if (!supplied || !timingSafeEqual(digest(secret), digest(supplied))) {
    return new Response(null, { status: 401 })
  }

  const { runId } = await request.json()
  if (typeof runId !== 'string' || !/^[0-9a-f-]{36}$/i.test(runId)) throw new Error('Invalid Gmail scan run.')
  const endpoint = new URL('/api/gmail/scan-worker', origin)
  const workerToken = crypto.randomUUID()

  for (let batch = 0; batch < 101; batch++) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId, workerToken }),
      signal: AbortSignal.timeout(60000),
      redirect: 'manual',
    })
    if (!response.ok) throw new Error(`Gmail scan worker request failed (${response.status}).`)
    const result = await response.json()
    if (['completed', 'failed', 'missing', 'busy'].includes(result.status)) return new Response(null, { status: 202 })
    if (result.status !== 'running') throw new Error('Gmail scan returned an unexpected status.')
  }
  throw new Error('Gmail scan exceeded its bounded worker batch count.')
}
