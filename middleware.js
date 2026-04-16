import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function middleware(request) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: getUser() must be called on every request so Supabase can
  // refresh the session token and write the updated cookie to the response.
  // Do NOT add early returns before this call or session refresh breaks.
  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Domain restriction: only @fx-unlocked.com + joshivilol1011@gmail.com can access the CRM
  const ALLOWED_DOMAINS = ['fx-unlocked.com']
  const ALLOWED_EMAILS = ['joshivilol1011@gmail.com']

  if (user && pathname.startsWith('/dashboard')) {
    const email = user.email?.toLowerCase() || ''
    const domain = email.split('@')[1] || ''
    const isAllowed = ALLOWED_DOMAINS.includes(domain) || ALLOWED_EMAILS.includes(email)
    if (!isAllowed) {
      // Sign them out and redirect to login with an error
      await supabase.auth.signOut()
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('error', 'unauthorized_domain')
      return NextResponse.redirect(url)
    }
  }

  // Public pages — allow without auth
  const publicPaths = ['/', '/privacy', '/terms']
  if (!user && publicPaths.includes(pathname)) {
    return supabaseResponse
  }

  // Not logged in → send to login
  if (!user && pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user) {
    // Already logged in → skip login/auth pages
    if (pathname === '/login' || pathname === '/reset-password') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    // MFA check — only for dashboard routes to avoid extra auth calls on every page
    if (pathname.startsWith('/dashboard')) {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (aal?.nextLevel === 'aal2' && aal?.currentLevel !== 'aal2') {
        const url = request.nextUrl.clone()
        url.pathname = '/verify-mfa'
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/|auth/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
