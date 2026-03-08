import { NextResponse } from 'next/server'
import { createAdminClient, getAuthUser } from '@/lib/supabase/server'

export async function DELETE(request) {
  try {
    // Admin only
    const { user: caller, role } = await getAuthUser()
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })

    const { userId } = await request.json()
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    if (userId === caller.id) return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 })

    const supabase = createAdminClient()

    // Unassign their affiliates (set manager_id to null)
    await supabase.from('affiliates').update({ manager_id: null }).eq('manager_id', userId)

    // Nullify their commission references
    await supabase.from('commissions').update({ staff_member_id: null }).eq('staff_member_id', userId)

    // Delete from Supabase Auth — profiles row cascades automatically
    const { error } = await supabase.auth.admin.deleteUser(userId)
    if (error) throw error

    return NextResponse.json({ success: true, message: 'User deleted successfully' })
  } catch (err) {
    console.error('Delete user error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
