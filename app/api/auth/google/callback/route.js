import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const BASE = 'https://crm.fx-unlocked.com'
const REDIRECT_URI = 'https://crm.fx-unlocked.com/api/auth/google/callback'

function getClientId() {
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '569042425490-s7bcicle416chlr3bnbm2me3huv1u4p9.apps.googleusercontent.com'
}

function getClientSecret() {
  return process.env.GOOGLE_CLIENT_SECRET
}

export async function GET(request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${BASE}/dashboard/appointments?google=error&reason=${error}`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${BASE}/dashboard/appointments?google=error&reason=missing_params`)
  }

  // Decode state
  let userId
  try {
    const parsed = JSON.parse(Buffer.from(decodeURIComponent(state), 'base64').toString())
    userId = parsed.userId
  } catch {
    return NextResponse.redirect(`${BASE}/dashboard/appointments?google=error&reason=invalid_state`)
  }

  if (!userId) {
    return NextResponse.redirect(`${BASE}/dashboard/appointments?google=error&reason=no_user_id`)
  }

  // Exchange code for tokens using direct fetch (no googleapis dependency)
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  })

  const tokenData = await tokenRes.json()

  if (!tokenRes.ok || tokenData.error) {
    const detail = tokenData.error_description || tokenData.error || 'token_exchange_failed'
    return NextResponse.redirect(
      `${BASE}/dashboard/appointments?google=error&reason=token_error&detail=${encodeURIComponent(detail)}`
    )
  }

  // Save tokens to Supabase
  const supabase = createAdminClient()
  const { error: dbError } = await supabase
    .from('google_calendar_tokens')
    .upsert({
      user_id: userId,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || '',
      token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  if (dbError) {
    return NextResponse.redirect(
      `${BASE}/dashboard/appointments?google=error&reason=db_error&detail=${encodeURIComponent(dbError.message)}`
    )
  }

  return NextResponse.redirect(`${BASE}/dashboard/appointments?google=connected`)
}
