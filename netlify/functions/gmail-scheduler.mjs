export const config = { schedule: '*/15 * * * *' }

export default async function handler() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const origin = process.env.APP_ORIGIN || process.env.GMAIL_APP_ORIGIN || process.env.URL
  if (!serviceKey || !origin) throw new Error('Gmail scheduler environment is incomplete.')
  const response = await fetch(new URL('/api/gmail/scheduler', origin), {
    method: 'POST',
    headers: { Authorization: `Bearer ${serviceKey}` },
    signal: AbortSignal.timeout(25000),
  })
  if (!response.ok) throw new Error(`Gmail scheduler request failed (${response.status}).`)
  return new Response(null, { status: 202 })
}
