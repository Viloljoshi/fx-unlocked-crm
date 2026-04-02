import { NextResponse } from 'next/server'
import { createAdminClient, getAuthUser } from '@/lib/supabase/server'
import { sendInviteEmail } from '@/lib/email/resend'

export async function POST(request) {
  try {
    const { user, role: callerRole } = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (callerRole !== 'ADMIN') return NextResponse.json({ error: 'Forbidden — only admins can create users' }, { status: 403 })

    const { email, role = 'STAFF', firstName = '', lastName = '' } = await request.json()
    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

    const supabase = createAdminClient()

    // generateLink creates the user + returns the invite URL without sending Supabase's default email
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'invite',
      email,
      options: {
        data: { role, first_name: firstName, last_name: lastName },
        redirectTo: `${process.env.NEXT_PUBLIC_BASE_URL}/auth/callback?next=/set-password`,
      },
    })

    if (error) {
      if (error.message?.includes('already been registered')) {
        return NextResponse.json({ error: 'A user with this email already exists' }, { status: 400 })
      }
      throw error
    }

    // Upsert profile record so user appears in the list immediately
    if (data?.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        role,
        first_name: firstName,
        last_name: lastName,
        email,
        is_active: true,
      }, { onConflict: 'id' })
    }

    // Send branded invite email via Resend
    await sendInviteEmail({
      to: email,
      firstName,
      lastName,
      role,
      inviteUrl: data.properties.action_link,
    })

    return NextResponse.json({
      success: true,
      message: `Invite sent to ${email}. They'll receive a branded email with a secure link to set their password.`,
    })
  } catch (err) {
    console.error('Create user error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
