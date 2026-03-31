import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/deals/reject?token=xxx — public rejection endpoint (no auth required)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Find token
    const { data: tokenRecord, error: tokenErr } = await supabase
      .from('deal_approval_tokens')
      .select('*')
      .eq('token', token)
      .single()

    if (tokenErr || !tokenRecord) {
      return NextResponse.json({ error: 'Invalid token', code: 'INVALID_TOKEN' }, { status: 404 })
    }

    if (tokenRecord.used) {
      return NextResponse.json({ error: 'This link has already been used', code: 'ALREADY_USED' }, { status: 409 })
    }

    if (new Date(tokenRecord.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This link has expired', code: 'TOKEN_EXPIRED' }, { status: 410 })
    }

    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'

    // Mark token as used
    await supabase
      .from('deal_approval_tokens')
      .update({ used: true, used_at: new Date().toISOString(), used_by_ip: ip })
      .eq('id', tokenRecord.id)

    // Update deal status to REJECTED
    const { data: deal, error: dealErr } = await supabase
      .from('deals')
      .update({ status: 'REJECTED' })
      .eq('id', tokenRecord.deal_id)
      .select('*, affiliate:affiliates(id, name)')
      .single()

    if (dealErr) {
      return NextResponse.json({ error: 'Failed to reject deal' }, { status: 500 })
    }

    // Version history
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
      changes: { action: 'REJECTED', rejected_via: 'email_link', ip },
      changed_by: deal.created_by,
    })

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: deal.created_by,
      action: 'UPDATE',
      entity_type: 'DEAL',
      entity_id: tokenRecord.deal_id,
      changes: { status: { from: 'PENDING', to: 'REJECTED' }, rejected_via: 'email_link' },
    })

    // Add rejection note
    await supabase.from('deal_notes').insert({
      deal_id: tokenRecord.deal_id,
      content: `Deal rejected via email link (IP: ${ip})`,
      note_type: 'APPROVAL',
      user_id: deal.created_by,
    })

    return NextResponse.json({
      success: true,
      message: 'Deal has been rejected',
      deal_id: tokenRecord.deal_id,
      affiliate_name: deal.affiliate?.name,
    })
  } catch (err) {
    console.error('Deal reject error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
