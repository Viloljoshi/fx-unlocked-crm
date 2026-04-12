import { NextResponse } from 'next/server'
import { createAdminClient, getAuthUser } from '@/lib/supabase/server'

// GET /api/tasks/staff
// Returns active staff with emails (merged from auth.users + profiles)
// Accessible by any authenticated user (needed for task assignment emails)
export async function GET() {
  try {
    const { user } = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createAdminClient()

    const [{ data: profiles }, { data: authData }] = await Promise.all([
      supabase.from('profiles').select('id,first_name,last_name,is_active').eq('is_active', true).order('first_name'),
      supabase.auth.admin.listUsers({ perPage: 1000 }),
    ])

    const emailMap = {}
    ;(authData?.users || []).forEach(u => { emailMap[u.id] = u.email })

    const staff = (profiles || []).map(p => ({
      ...p,
      email: emailMap[p.id] || null,
    }))

    return NextResponse.json({ staff })
  } catch (err) {
    console.error('Tasks staff error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
