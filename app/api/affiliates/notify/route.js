import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/supabase/server'
import {
  sendAffiliateApprovedEmail,
  sendAffiliateOnboardingEmail,
  sendAffiliateInactiveEmail,
} from '@/lib/email/resend'

export const dynamic = 'force-dynamic'

// Called after an affiliate's status is changed in the CRM
// Sends a branded email to the affiliate's own email address
export async function POST(request) {
  try {
    const { user, role } = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!['ADMIN', 'STAFF'].includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { email, name, status, brokers } = await request.json()
    if (!email || !status) return NextResponse.json({ error: 'email and status are required' }, { status: 400 })

    if (status === 'ACTIVE') {
      await sendAffiliateApprovedEmail({ to: email, name, brokers })
    } else if (status === 'ONBOARDING') {
      await sendAffiliateOnboardingEmail({ to: email, name })
    } else if (status === 'INACTIVE') {
      await sendAffiliateInactiveEmail({ to: email, name })
    }
    // LEAD status — no email sent

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Affiliate notify error:', err)
    // Non-fatal — don't fail the save operation if email fails
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
