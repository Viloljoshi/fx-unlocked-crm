import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/deals/approve?token=xxx — public approval endpoint (no auth required)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Missing approval token' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Find token
    const { data: tokenRecord, error: tokenErr } = await supabase
      .from('deal_approval_tokens')
      .select('*')
      .eq('token', token)
      .single()

    if (tokenErr || !tokenRecord) {
      return NextResponse.json({
        error: 'Invalid approval token',
        code: 'INVALID_TOKEN',
      }, { status: 404 })
    }

    // Check if already used
    if (tokenRecord.used) {
      return NextResponse.json({
        error: 'This deal has already been approved',
        code: 'ALREADY_APPROVED',
        approved_at: tokenRecord.used_at,
      }, { status: 409 })
    }

    // Check expiry
    if (new Date(tokenRecord.expires_at) < new Date()) {
      return NextResponse.json({
        error: 'This approval link has expired',
        code: 'TOKEN_EXPIRED',
      }, { status: 410 })
    }

    // Get client IP
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'

    // Mark token as used
    await supabase
      .from('deal_approval_tokens')
      .update({
        used: true,
        used_at: new Date().toISOString(),
        used_by_ip: ip,
      })
      .eq('id', tokenRecord.id)

    // Update deal status to ACTIVE
    const { data: deal, error: dealErr } = await supabase
      .from('deals')
      .update({
        status: 'ACTIVE',
        approved_at: new Date().toISOString(),
      })
      .eq('id', tokenRecord.deal_id)
      .select('*, affiliate:affiliates(id, name, status)')
      .single()

    if (dealErr) {
      console.error('Error approving deal:', dealErr)
      return NextResponse.json({ error: 'Failed to approve deal' }, { status: 500 })
    }

    // If affiliate is in ONBOARDING status, move to ACTIVE
    if (deal.affiliate?.status === 'ONBOARDING') {
      await supabase
        .from('affiliates')
        .update({ status: 'ACTIVE' })
        .eq('id', deal.affiliate_id)
    }

    // Record version
    const { data: lastVersion } = await supabase
      .from('deal_versions')
      .select('version_number')
      .eq('deal_id', tokenRecord.deal_id)
      .order('version_number', { ascending: false })
      .limit(1)
      .single()

    await supabase.from('deal_versions').insert({
      deal_id: tokenRecord.deal_id,
      version_number: (lastVersion?.version_number || 0) + 1,
      changes: { action: 'APPROVED', approved_via: 'email_link', ip },
      changed_by: deal.approved_by || deal.created_by,
    })

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: deal.created_by,
      action: 'UPDATE',
      entity_type: 'DEAL',
      entity_id: tokenRecord.deal_id,
      changes: { status: { from: 'PENDING', to: 'ACTIVE' }, approved_via: 'email_link' },
    })

    // Add approval note
    await supabase.from('deal_notes').insert({
      deal_id: tokenRecord.deal_id,
      content: `Deal approved via email link (IP: ${ip})`,
      note_type: 'APPROVAL',
      user_id: deal.created_by,
    })

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
