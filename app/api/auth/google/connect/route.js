import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/supabase/server'
import { getAuthUrl } from '@/lib/google/calendar'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { user } = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const state = Buffer.from(JSON.stringify({ userId: user.id })).toString('base64')
    const url = getAuthUrl(state)

    return NextResponse.json({ url })
  } catch (error) {
    console.error('[GoogleConnect] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
