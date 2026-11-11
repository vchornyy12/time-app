// A hosting adapter may expose its immutable deployment URL in Request.url.
// Only trust an explicitly configured origin, never caller-supplied host headers.
export function authOrigin(requestOrigin: string): string {
  const configured = process.env.APP_ORIGIN
  if (!configured) return requestOrigin
  const url = new URL(configured)
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash
    || (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === 'localhost'))) {
    throw new Error('Invalid application origin.')
  }
  return url.origin
}
