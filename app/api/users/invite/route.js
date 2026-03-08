import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request) {
  try {
    const { email, role = 'STAFF', firstName = '', lastName = '' } = await request.json()
    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

    const supabase = createAdminClient()

    // Use inviteUserByEmail - sends a proper invite email via Supabase
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: { role, first_name: firstName, last_name: lastName },
      redirectTo: `${process.env.NEXT_PUBLIC_BASE_URL}/auth/callback?next=/dashboard`,
    })

    if (error) {
      // If user already exists, try to re-invite or just update
      if (error.message?.includes('already been registered')) {
        return NextResponse.json({ error: 'User with this email already exists' }, { status: 400 })
      }
      throw error
    }

    // Create/update profile with role AND email
    if (data?.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        role,
        first_name: firstName,
        last_name: lastName,
        email: email, // store email in profile for easy display
        is_active: true,
      }, { onConflict: 'id' })
    }

    return NextResponse.json({
      success: true,
      message: `Invitation email sent to ${email}. They will receive a link to set their password.`,
    })
  } catch (err) {
    console.error('Invite error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
