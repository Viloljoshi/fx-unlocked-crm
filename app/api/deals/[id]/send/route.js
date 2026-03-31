import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createAdminClient, getAuthUser } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/resend'
import { dealApprovalEmailHtml } from '@/lib/email/templates/deal-approval'

export const dynamic = 'force-dynamic'

// POST /api/deals/[id]/send — send deal for approval
export async function POST(request, { params }) {
  try {
    const { user, role } = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!['ADMIN', 'STAFF'].includes(role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { id } = params
    const supabase = createAdminClient()

    // Fetch deal with relations
    const { data: deal, error: dealErr } = await supabase
      .from('deals')
      .select(`
        *,
        affiliate:affiliates(id, name, email, status, manager_id),
        broker:brokers(id, name),
        deal_levels(*)
      `)
      .eq('id', id)
      .single()

    if (dealErr || !deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    if (!['DRAFT', 'PENDING'].includes(deal.status)) {
      return NextResponse.json({ error: 'Only draft or pending deals can be sent for approval' }, { status: 400 })
    }

    // Determine recipient: manager → admin fallback → current user fallback
    let recipientEmail = null
    let recipientName = null

    if (deal.affiliate?.manager_id) {
      const { data: manager } = await supabase
        .from('profiles')
        .select('email, first_name, last_name')
        .eq('id', deal.affiliate.manager_id)
        .single()

      if (manager?.email) {
        recipientEmail = manager.email
        recipientName = `${manager.first_name || ''} ${manager.last_name || ''}`.trim()
      }
    }

    // Fallback: current logged-in user's email (they're requesting approval)
    if (!recipientEmail) {
      recipientEmail = user.email
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', user.id)
        .single()
      if (profile) recipientName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
    }

    if (!recipientEmail) {
      return NextResponse.json({ error: 'No recipient email found' }, { status: 400 })
    }

    // Generate secure token
    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000)

    // Invalidate existing unused tokens
    await supabase
      .from('deal_approval_tokens')
      .update({ used: true, used_at: new Date().toISOString() })
      .eq('deal_id', id)
      .eq('used', false)

    // Create new token
    const { error: tokenErr } = await supabase.from('deal_approval_tokens').insert({
      deal_id: id,
      token,
      expires_at: expiresAt.toISOString(),
    })

    if (tokenErr) {
      console.error('Error creating approval token:', tokenErr)
      return NextResponse.json({ error: 'Failed to create approval token' }, { status: 500 })
    }

    // Build URLs (trim trailing slash to prevent double-slash)
    const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '')
    const approveUrl = `${baseUrl}/deals/approve?token=${token}`
    const rejectUrl = `${baseUrl}/deals/approve?token=${token}&action=reject`

    // Build email HTML
    const html = dealApprovalEmailHtml({
      deal,
      affiliate: deal.affiliate,
      broker: deal.broker,
      levels: deal.deal_levels,
      approveUrl,
      rejectUrl,
    })

    // Send email
    try {
      await sendEmail({
        to: recipientEmail,
        subject: `Deal Approval Required — ${deal.affiliate?.name || 'Unknown Affiliate'}`,
        html,
      })
    } catch (emailErr) {
      console.error('Email send failed to:', recipientEmail, emailErr)
      return NextResponse.json({
        error: `Email failed to ${recipientEmail}: ${emailErr.message}`,
      }, { status: 500 })
    }

    // Update deal status to PENDING
    const { error: statusErr } = await supabase
      .from('deals')
      .update({ status: 'PENDING', sent_at: new Date().toISOString() })
      .eq('id', id)

    if (statusErr) {
      console.error('Failed to update deal status:', statusErr)
      // Email was sent but status update failed — still inform user
      return NextResponse.json({
        success: true,
        warning: 'Email sent but deal status update failed. Please refresh.',
        message: `Approval email sent to ${recipientEmail}`,
      })
    }

    // Version + audit (non-critical, don't fail the request)
    try {
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
        changes: { action: 'SENT_FOR_APPROVAL', sent_to: recipientEmail },
        changed_by: user.id,
      })

      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'UPDATE',
        entity_type: 'DEAL',
        entity_id: id,
        changes: { status: { from: 'DRAFT', to: 'PENDING' }, sent_to: recipientEmail },
      })

      await supabase.from('deal_notes').insert({
        deal_id: id,
        content: `Deal sent for approval to ${recipientName || recipientEmail}`,
        note_type: 'APPROVAL',
        user_id: user.id,
      })
    } catch (auditErr) {
      console.error('Audit logging failed (non-critical):', auditErr)
    }

    return NextResponse.json({
      success: true,
      message: `Approval email sent to ${recipientEmail}`,
    })
  } catch (err) {
    console.error('Deal send error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
