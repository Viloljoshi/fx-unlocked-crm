import { NextResponse } from 'next/server'
import { createAdminClient, getAuthUser } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST /api/deals/[id]/approve — in-app approve or reject (ADMIN only)
export async function POST(request, { params }) {
  try {
    const { user, role } = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can approve or reject deals' }, { status: 403 })
    }

    const { id } = params
    const body = await request.json()
    const { action } = body // 'approve' or 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Use "approve" or "reject"' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: deal, error: dealErr } = await supabase
      .from('deals')
      .select('*, affiliate:affiliates(id, name, status)')
      .eq('id', id)
      .single()

    if (dealErr || !deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    if (deal.status !== 'PENDING' && deal.status !== 'DRAFT') {
      return NextResponse.json({ error: `Cannot ${action} a deal with status ${deal.status}` }, { status: 400 })
    }

    const newStatus = action === 'approve' ? 'ACTIVE' : 'REJECTED'
    const updates = { status: newStatus }
    if (action === 'approve') {
      updates.approved_by = user.id
      updates.approved_at = new Date().toISOString()
    }

    const { error: updateErr } = await supabase
      .from('deals')
      .update(updates)
      .eq('id', id)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    // If approving and affiliate is ONBOARDING, move to ACTIVE only if this is their first ACTIVE deal
    if (action === 'approve' && deal.affiliate?.status === 'ONBOARDING') {
      const { count } = await supabase
        .from('deals')
        .select('id', { count: 'exact', head: true })
        .eq('affiliate_id', deal.affiliate_id)
        .eq('status', 'ACTIVE')
      // count includes the deal we just activated; only upgrade affiliate on first active deal
      if (count && count <= 1) {
        await supabase
          .from('affiliates')
          .update({ status: 'ACTIVE' })
          .eq('id', deal.affiliate_id)
      }
    }

    // Invalidate any pending approval tokens
    await supabase
      .from('deal_approval_tokens')
      .update({ used: true, used_at: new Date().toISOString() })
      .eq('deal_id', id)
      .eq('used', false)

    // Version history
    const { data: lastVersion } = await supabase
      .from('deal_versions')
      .select('version_number')
      .eq('deal_id', id)
      .order('version_number', { ascending: false })
      .limit(1)
      .single()

    await supabase.from('deal_versions').insert({
      deal_id: id,
      version_number: (lastVersion?.version_number || 0) + 1,
      changes: { action: action === 'approve' ? 'APPROVED' : 'REJECTED', method: 'in_app' },
      changed_by: user.id,
    })

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'UPDATE',
      entity_type: 'DEAL',
      entity_id: id,
      changes: { status: { from: deal.status, to: newStatus }, method: 'in_app' },
    })

    // Note
    await supabase.from('deal_notes').insert({
      deal_id: id,
      content: `Deal ${action === 'approve' ? 'approved' : 'rejected'} by admin (in-app)`,
      note_type: 'APPROVAL',
      user_id: user.id,
    })

    return NextResponse.json({
      success: true,
      message: `Deal ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
    })
  } catch (err) {
    console.error('Deal approve/reject error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
