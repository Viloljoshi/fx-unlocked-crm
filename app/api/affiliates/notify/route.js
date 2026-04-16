import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// DISABLED: Affiliate notifications are strictly internal.
// External contacts (affiliates/partners) must NEVER receive emails from the CRM.
// This route is intentionally gutted to prevent any accidental external email sends.
export async function POST() {
  return NextResponse.json({
    success: true,
    message: 'External affiliate notifications are disabled. Emails are internal only.',
  })
}
