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

  const pathname = request.nextUrl.pathname
  const isDashboard = pathname.startsWith('/dashboard')
  const isAuthPage = pathname === '/login' || pathname === '/set-password' || pathname === '/reset-password'
  const isMfaPage = pathname.startsWith('/verify-mfa') || pathname.startsWith('/setup-mfa')

  // Skip middleware logic for pages that don't need auth checks
  if (!isDashboard && !isAuthPage && !isMfaPage) {
    return supabaseResponse
  }

  // getUser() validates the session server-side (secure)
  const { data: { user } } = await supabase.auth.getUser()

  // Not logged in — redirect to login
  if (!user && isDashboard) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user) {
    // Already logged in — don't show login/set-password
    if (isAuthPage) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    // Only check MFA level when accessing the dashboard (not on every route)
    if (isDashboard || isMfaPage) {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

      // MFA enrolled but not verified this session → force verify
      if (
        aal?.nextLevel === 'aal2' &&
        aal?.currentLevel !== 'aal2' &&
        !isMfaPage
      ) {
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
