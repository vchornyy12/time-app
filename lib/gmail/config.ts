import 'server-only'

export const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly'
export const GMAIL_OAUTH_COOKIE = process.env.NODE_ENV === 'production' ? '__Host-gmail-oauth' : 'gmail-oauth'

// Accept only a bare https origin (or http://localhost for development), so a
// mistyped value can never send credentials to an arbitrary URL.
function trustedOrigin(configured: string): string {
  const url = new URL(configured)
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash
    || (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === 'localhost'))) {
    throw new Error('Invalid Gmail application origin.')
  }
  return url.origin
}

// Hosting adapters can expose an immutable deploy URL in the request. Use the
// registered public origin consistently for consent, token exchange and redirects.
export function gmailOrigin(requestOrigin: string): string {
  const configured = process.env.GMAIL_APP_ORIGIN
  return configured ? trustedOrigin(configured) : requestOrigin
}

/** Origin that hosts the background scan worker. Never derived from request input. */
export function gmailWorkerOrigin(): string {
  const configured = process.env.APP_ORIGIN || process.env.GMAIL_APP_ORIGIN
  if (!configured) throw new Error('Gmail worker origin is not configured.')
  return trustedOrigin(configured)
}

export function gmailAvailable(): boolean {
  return process.env.GMAIL_INBOX_ENABLED === 'true'
    && !!process.env.GMAIL_CLIENT_ID && !!process.env.GMAIL_CLIENT_SECRET
}
