import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getOAuth2Client } from '@/lib/google/calendar'

const BASE = 'https://crm.fx-unlocked.com'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      console.error('[GoogleCallback] OAuth error:', error)
      return NextResponse.redirect(`${BASE}/dashboard/appointments?google=error&reason=${error}`)
    }

    if (!code || !state) {
      return NextResponse.redirect(`${BASE}/dashboard/appointments?google=error&reason=missing_params`)
    }

    // Decode state to get userId
    const { userId } = JSON.parse(Buffer.from(state, 'base64').toString())
    if (!userId) {
      return NextResponse.redirect(`${BASE}/dashboard/appointments?google=error&reason=invalid_state`)
    }

    // Exchange code for tokens
    const oauth2Client = getOAuth2Client()
    const { tokens } = await oauth2Client.getToken(code)

    if (!tokens.refresh_token) {
      console.error('[GoogleCallback] No refresh token received — user may have already authorized')
    }

    const supabase = createAdminClient()

    // Upsert token record
    const { error: dbError } = await supabase
      .from('google_calendar_tokens')
      .upsert({
        user_id: userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || '',
        token_expires_at: new Date(tokens.expiry_date).toISOString(),
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    if (dbError) {
      console.error('[GoogleCallback] DB error:', dbError)
      return NextResponse.redirect(`${BASE}/dashboard/appointments?google=error&reason=db_error`)
    }

    console.log('[GoogleCallback] Successfully connected for user:', userId)

    return NextResponse.redirect(`${BASE}/dashboard/appointments?google=connected`)
  } catch (error) {
    console.error('[GoogleCallback] Error:', error)
    return NextResponse.redirect(`${BASE}/dashboard/appointments?google=error&reason=server_error`)
  }
}
