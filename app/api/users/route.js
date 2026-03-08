import { NextResponse } from 'next/server'
import { createAdminClient, getAuthUser } from '@/lib/supabase/server'

// GET - list all users with emails from auth.users merged with profiles
export async function GET() {
  try {
    // Auth guard — admin only
    const { user, role } = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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
