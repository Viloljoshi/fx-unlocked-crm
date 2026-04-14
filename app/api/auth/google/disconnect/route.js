import { NextResponse } from 'next/server'
import { getAuthUser, createAdminClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const { user } = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const { error } = await supabase
      .from('google_calendar_tokens')
      .delete()
      .eq('user_id', user.id)

    if (error) {
      console.error('[GoogleDisconnect] DB error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[GoogleDisconnect] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
