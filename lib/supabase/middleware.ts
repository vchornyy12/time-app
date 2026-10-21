import { stripProviderCredentials } from './strip-provider-credentials'
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest, requestHeaders = new Headers(request.headers)) {
  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          requestHeaders.set('cookie', request.headers.get('cookie') ?? '')
          supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user: verifiedUser },
  } = await supabase.auth.getUser()

  let user = verifiedUser
  if (user) {
    try { await stripProviderCredentials(supabase) } catch {
      await supabase.auth.signOut({ scope: 'local' })
      user = null
    }
  }
  const redirectWithCookies = (url: URL) => {
    const response = NextResponse.redirect(url)
    for (const cookie of supabaseResponse.cookies.getAll()) response.cookies.set(cookie)
    return response
  }

  const pathname = request.nextUrl.pathname
  const isPublicRoute = new Set([
    '/', '/login', '/register', '/reset-password', '/update-password',
    '/auth/callback', '/privacy', '/terms',
  ]).has(pathname)

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    return redirectWithCookies(url)
  }

  if (user && (pathname === '/login' || pathname === '/register')) {
    const url = request.nextUrl.clone()
    url.pathname = '/inbox'
    return redirectWithCookies(url)
  }

  return supabaseResponse
}
