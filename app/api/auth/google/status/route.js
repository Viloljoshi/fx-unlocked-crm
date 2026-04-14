import { NextResponse } from 'next/server'
import { getAuthUser, createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const { user } = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const { data: token } = await supabase
      .from('google_calendar_tokens')
      .select('connected_at, calendar_id')
      .eq('user_id', user.id)
      .single()

    return NextResponse.json({
      connected: !!token,
      connectedAt: token?.connected_at || null,
      calendarId: token?.calendar_id || null,
    })
  } catch (error) {
    console.error('[GoogleStatus] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
