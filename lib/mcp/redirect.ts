/** Only send the browser to an https client callback, or to a loopback one (desktop CLI clients). */
export function safeClientRedirect(value: string): string | null {
  try {
    const url = new URL(value)
    if (url.protocol === 'https:') return url.toString()
    if (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return url.toString()
  } catch { /* fall through */ }
  return null
}
