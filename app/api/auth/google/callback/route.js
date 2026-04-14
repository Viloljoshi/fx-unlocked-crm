import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const BASE = 'https://crm.fx-unlocked.com'
const REDIRECT_URI = 'https://crm.fx-unlocked.com/api/auth/google/callback'
const CLIENT_ID = '569042425490-s7bcicle416chlr3bnbm2me3huv1u4p9.apps.googleusercontent.com'

function redirect(params) {
  const qs = new URLSearchParams(params).toString()
  return NextResponse.redirect(`${BASE}/dashboard/appointments?${qs}`)
}

export async function GET(request) {
  // Step 1: Parse URL params
  let code, state, error
  try {
    const url = new URL(request.url)
    code = url.searchParams.get('code')
    state = url.searchParams.get('state')
    error = url.searchParams.get('error')
  } catch (e) {
    return redirect({ google: 'error', step: 'parse_url', detail: e.message })
  }

  if (error) {
    return redirect({ google: 'error', step: 'google_denied', detail: error })
  }

  if (!code || !state) {
    return redirect({ google: 'error', step: 'missing_params', detail: `code=${!!code},state=${!!state}` })
  }

  // Step 2: Decode state to get userId
  let userId
  try {
    const decoded = Buffer.from(decodeURIComponent(state), 'base64').toString()
    const parsed = JSON.parse(decoded)
    userId = parsed.userId
  } catch (e) {
    return redirect({ google: 'error', step: 'decode_state', detail: e.message })
  }

  if (!userId) {
    return redirect({ google: 'error', step: 'no_user_id', detail: 'userId was empty after decoding state' })
  }

  // Step 3: Check that client secret exists
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientSecret) {
    return redirect({ google: 'error', step: 'missing_secret', detail: 'GOOGLE_CLIENT_SECRET env var not set' })
  }

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || CLIENT_ID

  // Step 4: Exchange authorization code for tokens
  let tokenData
  try {
    const body = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    })

    console.log('[GoogleCallback] Token exchange request:', {
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      code_length: code.length,
      grant_type: 'authorization_code',
    })

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })

    tokenData = await tokenRes.json()

    console.log('[GoogleCallback] Token response status:', tokenRes.status)
    console.log('[GoogleCallback] Token response keys:', Object.keys(tokenData))

    if (!tokenRes.ok || tokenData.error) {
      return redirect({
        google: 'error',
        step: 'token_exchange',
        detail: tokenData.error_description || tokenData.error || `HTTP ${tokenRes.status}`,
      })
    }
  } catch (e) {
    return redirect({ google: 'error', step: 'token_fetch', detail: e.message })
  }

  // Step 5: Validate token data
  if (!tokenData.access_token) {
    return redirect({ google: 'error', step: 'no_access_token', detail: JSON.stringify(Object.keys(tokenData)) })
  }

  // Step 6: Save tokens to Supabase
  try {
    const supabase = createAdminClient()

    const { error: dbError } = await supabase
      .from('google_calendar_tokens')
      .upsert({
        user_id: userId,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || '',
        token_expires_at: new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString(),
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    if (dbError) {
      return redirect({ google: 'error', step: 'db_upsert', detail: dbError.message })
    }
  } catch (e) {
    return redirect({ google: 'error', step: 'db_connect', detail: e.message })
  }

  console.log('[GoogleCallback] Successfully connected Google Calendar for user:', userId)

  return redirect({ google: 'connected' })
}
