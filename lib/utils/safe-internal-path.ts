/** Returns `value` if it is a same-origin path, otherwise `fallback`. Safe in browser and server code. */
export function safeInternalPath(value: string | null | undefined, fallback = '/settings'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(value)) return fallback
  try {
    const decoded = decodeURIComponent(value)
    if (decoded.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(decoded)) return fallback
    const url = new URL(value, 'https://internal.invalid')
    return url.origin === 'https://internal.invalid' ? `${url.pathname}${url.search}${url.hash}` : fallback
  } catch { return fallback }
}
