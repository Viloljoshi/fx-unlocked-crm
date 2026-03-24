import { NextResponse } from 'next/server'
import { createAdminClient, getAuthUser } from '@/lib/supabase/server'

export async function POST(request) {
  try {
    // Auth guard — admin only
    const { user, role: callerRole } = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (callerRole !== 'ADMIN') return NextResponse.json({ error: 'Forbidden — only admins can create users' }, { status: 403 })

    const { email, role = 'STAFF', firstName = '', lastName = '', password = '' } = await request.json()
    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Step 1: Send invite email via Supabase (creates the auth record + sends a welcome/invite email)
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: { role, first_name: firstName, last_name: lastName },
      redirectTo: `${process.env.NEXT_PUBLIC_BASE_URL}/auth/callback?next=/dashboard`,
    })

    if (error) {
      if (error.message?.includes('already been registered')) {
        return NextResponse.json({ error: 'A user with this email already exists' }, { status: 400 })
      }
      throw error
    }

    // Step 2: Immediately set the admin-provided password + confirm the email
    // so the user can log in right away without waiting for the invite link
    if (data?.user) {
      const { error: pwError } = await supabase.auth.admin.updateUserById(data.user.id, {
        password,
        email_confirm: true, // mark confirmed so direct login works immediately
      })
      if (pwError) {
        // Non-fatal — invite was still sent, user can still set password via link
        console.error('Password set error (non-fatal):', pwError.message)
      }
    }

    // Step 3: Upsert profile record
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

    return NextResponse.json({
      success: true,
      message: `User created. An invite email has been sent to ${email}. They can also log in now with the password you set.`,
    })
  } catch (err) {
    console.error('Create user error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
