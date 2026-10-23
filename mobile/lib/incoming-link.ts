/** Bound untrusted links before URL/query parsing; only PKCE callbacks are accepted. */
export function magicLinkCode(url: string): string | null {
  if (url.length > 2048) return null
  try {
    decodeURIComponent(url) // Reject malformed percent encoding before the router sees it.
    const parsed = new URL(url)
    if (parsed.protocol !== 'timeapp:' || parsed.hostname !== 'auth' ||
        (parsed.pathname !== '' && parsed.pathname !== '/') || parsed.username ||
        parsed.password || parsed.port || parsed.hash || parsed.searchParams.getAll('code').length !== 1) return null
    return parsed.searchParams.get('code') || null
  } catch { return null }
}

// Credentials stay in Linking's auth handler, never in navigation state/history.
export function incomingRoute(path: string): string {
  return magicLinkCode(path) ? '/auth' : '/'
}
