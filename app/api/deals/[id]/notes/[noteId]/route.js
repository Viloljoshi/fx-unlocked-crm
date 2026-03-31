import { NextResponse } from 'next/server'
import { createAdminClient, getAuthUser } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// PUT /api/deals/[id]/notes/[noteId] — edit a note
export async function PUT(request, { params }) {
  try {
    const { user, role } = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!['ADMIN', 'STAFF'].includes(role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { id, noteId } = params
    const body = await request.json()
    const { content, note_type } = body

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Note content is required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Verify note exists and belongs to deal
    const { data: existing, error: fetchErr } = await supabase
      .from('deal_notes')
      .select('id, user_id')
      .eq('id', noteId)
      .eq('deal_id', id)
      .single()

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    // Only the author or ADMIN can edit
    if (existing.user_id !== user.id && role !== 'ADMIN') {
      return NextResponse.json({ error: 'You can only edit your own notes' }, { status: 403 })
    }

    const updates = { content: content.trim() }
    if (note_type) updates.note_type = note_type

    const { data: note, error: updateErr } = await supabase
      .from('deal_notes')
      .update(updates)
      .eq('id', noteId)
      .select('*, user:profiles(id, first_name, last_name)')
      .single()

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ note })
  } catch (err) {
    console.error('Note PUT error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/deals/[id]/notes/[noteId] — delete a note
export async function DELETE(request, { params }) {
  try {
    const { user, role } = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!['ADMIN', 'STAFF'].includes(role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { id, noteId } = params
    const supabase = createAdminClient()

    // Verify note exists and belongs to deal
    const { data: existing, error: fetchErr } = await supabase
      .from('deal_notes')
      .select('id, user_id')
      .eq('id', noteId)
      .eq('deal_id', id)
      .single()

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    // Only the author or ADMIN can delete
    if (existing.user_id !== user.id && role !== 'ADMIN') {
      return NextResponse.json({ error: 'You can only delete your own notes' }, { status: 403 })
    }

    const { error: delErr } = await supabase
      .from('deal_notes')
      .delete()
      .eq('id', noteId)

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Note DELETE error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
