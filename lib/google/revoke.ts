import 'server-only'

export async function revokeGoogleToken(token: string): Promise<void> {
  const response = await fetch('https://oauth2.googleapis.com/revoke', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token }), signal: AbortSignal.timeout(15000),
  })
  if (response.ok) return
  const error = await response.json().catch(() => null)
  if (response.status === 400 && error?.error === 'invalid_token') return
  throw new Error('Could not revoke Google access. Please retry.')
}
