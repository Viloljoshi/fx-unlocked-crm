import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const checks = {}

  // Check 1: Google Client ID
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID
  checks.google_client_id = clientId
    ? { status: 'ok', value: clientId.substring(0, 20) + '...' }
    : { status: 'missing', note: 'Using hardcoded fallback: 569042425490-...' }

  // Check 2: Google Client Secret
  const secret = process.env.GOOGLE_CLIENT_SECRET
  checks.google_client_secret = secret
    ? { status: 'ok', length: secret.length, prefix: secret.substring(0, 6) + '...' }
    : { status: 'MISSING - THIS IS THE PROBLEM', note: 'Set GOOGLE_CLIENT_SECRET in Vercel env vars' }

  // Check 3: Supabase URL
  checks.supabase_url = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? { status: 'ok', value: process.env.NEXT_PUBLIC_SUPABASE_URL }
    : { status: 'missing' }

  // Check 4: Supabase Service Role Key
  const srk = process.env.SUPABASE_SERVICE_ROLE_KEY
  checks.supabase_service_role_key = srk
    ? { status: 'ok', length: srk.length }
    : { status: 'missing' }

  // Check 5: DB connection + table access
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('google_calendar_tokens')
      .select('user_id')
      .limit(1)

    checks.db_google_calendar_tokens = error
      ? { status: 'error', message: error.message }
      : { status: 'ok', row_count: data?.length ?? 0 }
  } catch (e) {
    checks.db_google_calendar_tokens = { status: 'error', message: e.message }
  }

  // Check 6: Appointments table has google columns
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('appointments')
      .select('id, google_event_id, google_synced_at')
      .limit(1)

    checks.db_appointments_google_columns = error
      ? { status: 'error', message: error.message }
      : { status: 'ok' }
  } catch (e) {
    checks.db_appointments_google_columns = { status: 'error', message: e.message }
  }

  // Summary
  const allOk = Object.values(checks).every(c => c.status === 'ok')

  return NextResponse.json({
    overall: allOk ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED',
    redirect_uri: 'https://crm.fx-unlocked.com/api/auth/google/callback',
    checks,
  }, { status: allOk ? 200 : 500 })
}
