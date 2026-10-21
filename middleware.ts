import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { contentSecurityPolicy } from '@/lib/security/csp'

export async function middleware(request: NextRequest) {
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
  const csp = contentSecurityPolicy(nonce, process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NODE_ENV !== 'production')
  const requestHeaders = new Headers(request.headers)
  // Replace caller-supplied values. Next uses the request CSP to nonce its scripts.
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)
  const response = await updateSession(request, requestHeaders)
  response.headers.set('Content-Security-Policy', csp)
  response.headers.set('Cache-Control', 'private, no-store')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
