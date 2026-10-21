export function contentSecurityPolicy(nonce: string, supabaseUrl: string, development = false) {
  const origin = new URL(supabaseUrl).origin
  const socketOrigin = origin.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:')
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${origin}`,
    "font-src 'self'",
    `connect-src 'self' ${origin} ${socketOrigin}${development ? ' ws://localhost:* ws://127.0.0.1:*' : ''}`,
    "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'", "frame-src 'none'",
    ...(!development ? ['upgrade-insecure-requests'] : []),
  ].join('; ')
}
