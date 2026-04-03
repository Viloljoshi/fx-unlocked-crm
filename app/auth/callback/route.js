import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
            } catch {}
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Password recovery → set-password page
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/reset-password`)
      }

      // --- Google OAuth domain restriction ---
      // Only @fx-unlocked.com emails OR admins can sign in via Google
      const { data: { user } } = await supabase.auth.getUser()
      const email = user?.email ?? ''
      const isCompanyEmail = email.endsWith('@fx-unlocked.com')

      if (!isCompanyEmail) {
        // Check if this user is an admin in our DB
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        const isAdmin = profile?.role === 'ADMIN'

        if (!isAdmin) {
          // Not company email, not admin → sign out and block
          await supabase.auth.signOut()
          return NextResponse.redirect(`${origin}/login?error=unauthorized_domain`)
        }
      }
      // ----------------------------------------

      // Check MFA status post-login
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

      // Has MFA enrolled but not verified this session → verify first
      if (aal?.nextLevel === 'aal2' && aal?.currentLevel !== 'aal2') {
        return NextResponse.redirect(`${origin}/verify-mfa`)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
