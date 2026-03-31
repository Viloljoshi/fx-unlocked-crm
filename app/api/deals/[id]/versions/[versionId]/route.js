import { NextResponse } from 'next/server'
import { createAdminClient, getAuthUser } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// DELETE /api/deals/[id]/versions/[versionId]
export async function DELETE(request, { params }) {
  try {
    const { user, role } = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can delete version history' }, { status: 403 })
    }

    const { id, versionId } = params
    const supabase = createAdminClient()

    // Verify version belongs to deal
    const { data: version, error } = await supabase
      .from('deal_versions')
      .select('id, deal_id, version_number')
      .eq('id', versionId)
      .eq('deal_id', id)
      .single()

    if (error || !version) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 })
    }

    // Don't allow deleting the latest version
    const { data: latest } = await supabase
      .from('deal_versions')
      .select('id')
      .eq('deal_id', id)
      .order('version_number', { ascending: false })
      .limit(1)
      .single()

    if (latest && latest.id === versionId) {
      return NextResponse.json({ error: 'Cannot delete the latest version' }, { status: 400 })
    }

    const { error: delErr } = await supabase
      .from('deal_versions')
      .delete()
      .eq('id', versionId)

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Delete version error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
