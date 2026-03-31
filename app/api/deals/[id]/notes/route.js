import { NextResponse } from 'next/server'
import { createAdminClient, getAuthUser } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST /api/deals/[id]/notes — add note to deal
export async function POST(request, { params }) {
  try {
    const { user, role } = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!['ADMIN', 'STAFF'].includes(role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { content, note_type } = body

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Note content is required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Verify deal exists
    const { data: deal, error: dealErr } = await supabase
      .from('deals')
      .select('id')
      .eq('id', id)
      .single()

    if (dealErr || !deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    const { data: note, error: noteErr } = await supabase
      .from('deal_notes')
      .insert({
        deal_id: id,
        content: content.trim(),
        note_type: note_type || 'GENERAL',
        user_id: user.id,
      })
      .select('*, user:profiles(id, first_name, last_name)')
      .single()

    if (noteErr) {
      console.error('Error creating deal note:', noteErr)
      return NextResponse.json({ error: noteErr.message }, { status: 500 })
    }

    return NextResponse.json({ note }, { status: 201 })
  } catch (err) {
    console.error('Deal notes POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
