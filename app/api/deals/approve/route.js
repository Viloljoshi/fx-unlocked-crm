import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/deals/approve?token=xxx — public approval endpoint (no auth required)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Missing approval token', code: 'MISSING_TOKEN' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'

    // Atomic claim: update token WHERE used=false — prevents race conditions
    const { data: claimed, error: claimErr } = await supabase
      .from('deal_approval_tokens')
      .update({
        used: true,
        used_at: new Date().toISOString(),
        used_by_ip: ip,
      })
      .eq('token', token)
      .eq('used', false)
      .select('*')

    // If no rows updated, token is invalid, expired, or already used
    if (claimErr || !claimed || claimed.length === 0) {
      // Check why it failed
      const { data: existing } = await supabase
        .from('deal_approval_tokens')
        .select('used, expires_at')
        .eq('token', token)
        .single()

      if (!existing) {
        return NextResponse.json({ error: 'Invalid token', code: 'INVALID_TOKEN' }, { status: 404 })
      }
      if (existing.used) {
        return NextResponse.json({ error: 'This link has already been used', code: 'ALREADY_USED' }, { status: 409 })
      }
      if (new Date(existing.expires_at) < new Date()) {
        return NextResponse.json({ error: 'This link has expired', code: 'TOKEN_EXPIRED' }, { status: 410 })
      }
      return NextResponse.json({ error: 'Failed to process token', code: 'CLAIM_FAILED' }, { status: 500 })
    }

    const tokenRecord = claimed[0]

    // Check expiry (token was claimed but might be expired)
    if (new Date(tokenRecord.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This link has expired', code: 'TOKEN_EXPIRED' }, { status: 410 })
    }

    // Check deal is still in a valid state for approval
    const { data: deal, error: dealErr } = await supabase
      .from('deals')
      .select('*, affiliate:affiliates(id, name, status)')
      .eq('id', tokenRecord.deal_id)
      .single()

    if (dealErr || !deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    if (deal.status === 'ACTIVE') {
      return NextResponse.json({ error: 'This deal is already active', code: 'ALREADY_USED' }, { status: 409 })
    }
    if (deal.status === 'REJECTED') {
      return NextResponse.json({ error: 'This deal has been rejected', code: 'ALREADY_USED' }, { status: 409 })
    }

    // Update deal to ACTIVE
    await supabase
      .from('deals')
      .update({ status: 'ACTIVE', approved_at: new Date().toISOString() })
      .eq('id', tokenRecord.deal_id)

    // Move affiliate from ONBOARDING to ACTIVE only if this is their first ACTIVE deal
    if (deal.affiliate?.status === 'ONBOARDING') {
      const { count } = await supabase
        .from('deals')
        .select('id', { count: 'exact', head: true })
        .eq('affiliate_id', deal.affiliate_id)
        .eq('status', 'ACTIVE')
      // count includes the deal we just activated above
      if (count && count <= 1) {
        await supabase.from('affiliates').update({ status: 'ACTIVE' }).eq('id', deal.affiliate_id)
      }
    }

    // Version + audit + note (non-critical)
    try {
      const { data: lastVer } = await supabase
        .from('deal_versions')
        .select('version_number')
        .eq('deal_id', tokenRecord.deal_id)
        .order('version_number', { ascending: false })
        .limit(1)
        .single()

      await supabase.from('deal_versions').insert({
        deal_id: tokenRecord.deal_id,
        version_number: (lastVer?.version_number || 0) + 1,
        changes: { action: 'APPROVED', method: 'email_link', ip },
        changed_by: deal.created_by,
      })

      await supabase.from('audit_logs').insert({
        user_id: deal.created_by,
        action: 'UPDATE',
        entity_type: 'DEAL',
        entity_id: tokenRecord.deal_id,
        changes: { status: { from: deal.status, to: 'ACTIVE' }, method: 'email_link' },
      })

      await supabase.from('deal_notes').insert({
        deal_id: tokenRecord.deal_id,
        content: `Deal approved via email link (IP: ${ip})`,
        note_type: 'APPROVAL',
        user_id: deal.created_by,
      })
    } catch (auditErr) {
      console.error('Audit logging failed (non-critical):', auditErr)
    }

    return NextResponse.json({
      success: true,
      message: 'Deal approved successfully',
      deal_id: tokenRecord.deal_id,
      affiliate_name: deal.affiliate?.name,
    })
  } catch (err) {
    console.error('Deal approve error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
