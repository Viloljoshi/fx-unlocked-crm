import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendPasswordResetEmail } from '@/lib/email/resend'

export async function POST(request) {
  try {
    const { email } = await request.json()
    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

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
