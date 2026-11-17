export const config = { schedule: '*/15 * * * *' }

export default async function handler() {
  // Keep in sync with lib/gmail/worker.ts.
  const secret = process.env.GMAIL_WORKER_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  const origin = process.env.APP_ORIGIN || process.env.GMAIL_APP_ORIGIN || process.env.URL
  if (!secret || !origin) throw new Error('Gmail scheduler environment is incomplete.')
  const response = await fetch(new URL('/api/gmail/scheduler', origin), {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(25000),
    redirect: 'manual',
  })
  if (!response.ok) throw new Error(`Gmail scheduler request failed (${response.status}).`)
  return new Response(null, { status: 202 })
}
