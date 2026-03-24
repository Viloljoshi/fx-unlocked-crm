import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendPasswordResetEmail } from '@/lib/resend'

export async function POST(request) {
  try {
    const { email } = await request.json()
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

    const supabase = createAdminClient()

    // Generate recovery link server-side (does NOT send Supabase's default email)
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_BASE_URL}/auth/callback?type=recovery`,
      },
    })

    // Always return 200 — never reveal whether email exists (prevents enumeration)
    if (!error && data?.properties?.action_link) {
      // Fetch first name from profiles for personalisation
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name')
        .eq('email', email)
        .single()

      await sendPasswordResetEmail({
        to: email,
        firstName: profile?.first_name || null,
        resetUrl: data.properties.action_link,
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Forgot password error:', err)
    // Still return success to prevent enumeration
    return NextResponse.json({ success: true })
  }
}
