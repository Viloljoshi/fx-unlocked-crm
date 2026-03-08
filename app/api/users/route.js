import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// GET - list all users with emails from auth.users merged with profiles
export async function GET() {
  try {
    const supabase = createAdminClient()

    // Get all profiles
    const { data: profiles, error: profError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (profError) throw profError

    // Get auth users to get their emails
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers({
      perPage: 1000,
    })

    if (authError) throw authError

    // Merge: add email from auth.users to each profile
    const authMap = {}
    ;(authData?.users || []).forEach(u => { authMap[u.id] = u.email })

    const merged = (profiles || []).map(p => ({
      ...p,
      email: authMap[p.id] || null,
    }))

    return NextResponse.json({ users: merged })
  } catch (err) {
    console.error('List users error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
