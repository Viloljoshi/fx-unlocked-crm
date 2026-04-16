import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendPasswordResetEmail } from '@/lib/email/resend'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const { email } = await request.json()
    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

    // SECURITY: Only allow password resets for internal CRM users
    const ALLOWED_DOMAINS = ['fx-unlocked.com']
    const ALLOWED_EMAILS = ['joshivilol1011@gmail.com']
    const normalised = email.toLowerCase().trim()
    const domain = normalised.split('@')[1] || ''
    const isAllowed = ALLOWED_DOMAINS.includes(domain) || ALLOWED_EMAILS.includes(normalised)

    if (!isAllowed) {
      // Return success to prevent email enumeration, but do NOT send anything
      console.warn('[ForgotPassword] Blocked reset attempt for external email:', normalised)
      return NextResponse.json({ success: true })
    }

    const supabase = createAdminClient()

    // Look up first name for personalised email — non-fatal if not found
    let firstName = ''
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name')
        .eq('email', email)
        .single()
      firstName = profile?.first_name || ''
    } catch {}

    // Generate a password recovery link without sending Supabase's default email
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_BASE_URL}/reset-password`,
      },
    })

    // Always return success — never reveal whether an email is registered (prevents enumeration)
    if (error) {
      console.error('Password reset link error:', error.message)
      return NextResponse.json({ success: true })
    }

    await sendPasswordResetEmail({
      to: email,
      firstName,
      resetUrl: data.properties.action_link,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Forgot password error:', err)
    // Still return success — never expose internals to unauthenticated callers
    return NextResponse.json({ success: true })
  }
}
