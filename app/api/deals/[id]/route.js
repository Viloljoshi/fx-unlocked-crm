import { NextResponse } from 'next/server'
import { createAdminClient, getAuthUser } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/deals/[id] — get single deal with all relations
export async function GET(request, { params }) {
  try {
    const { user } = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = params
    const supabase = createAdminClient()

    // Fetch deal + relations separately to avoid FK name issues
    const { data: deal, error } = await supabase
      .from('deals')
      .select(`
        *,
        affiliate:affiliates(id, name, email, status, phone, country),
        broker:brokers(id, name),
        deal_levels(*)
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching deal:', error)
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    // Fetch creator profile
    if (deal.created_by) {
      const { data: creator } = await supabase.from('profiles').select('id, first_name, last_name, email').eq('id', deal.created_by).single()
      deal.creator = creator
    }

    // Fetch approver profile
    if (deal.approved_by) {
      const { data: approver } = await supabase.from('profiles').select('id, first_name, last_name, email').eq('id', deal.approved_by).single()
      deal.approver = approver
    }

    // Fetch notes with user info
    const { data: notes } = await supabase.from('deal_notes').select('*').eq('deal_id', id).order('created_at', { ascending: false })
    if (notes) {
      for (const note of notes) {
        if (note.user_id) {
          const { data: noteUser } = await supabase.from('profiles').select('id, first_name, last_name').eq('id', note.user_id).single()
          note.user = noteUser
        }
      }
    }
    deal.deal_notes = notes || []

    // Fetch versions with changer info
    const { data: versions } = await supabase.from('deal_versions').select('*').eq('deal_id', id).order('version_number', { ascending: false })
    if (versions) {
      for (const ver of versions) {
        if (ver.changed_by) {
          const { data: changer } = await supabase.from('profiles').select('id, first_name, last_name').eq('id', ver.changed_by).single()
          ver.changer = changer
        }
      }
    }
    deal.deal_versions = versions || []

    // Sort levels
    if (deal.deal_levels) {
      deal.deal_levels.sort((a, b) => a.level_number - b.level_number)
    }

    return NextResponse.json({ deal })
  } catch (err) {
    console.error('Deal GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/deals/[id] — update deal
export async function PUT(request, { params }) {
  try {
    const { user, role } = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = params
    const body = await request.json()
    const { affiliate_id, broker_id, deal_type, deal_terms, deal_details, levels, status } = body

    const supabase = createAdminClient()

    // Fetch existing deal for version diff
    const { data: existing, error: fetchErr } = await supabase
      .from('deals')
      .select('*, deal_levels(*)')
      .eq('id', id)
      .single()

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    // Only draft/pending deals can be edited — approved/rejected deals are locked
    if (!['DRAFT', 'PENDING'].includes(existing.status)) {
      return NextResponse.json({ error: 'Only draft or pending deals can be edited' }, { status: 400 })
    }

    // Build update object with only provided fields
    const updates = {}
    if (affiliate_id !== undefined) updates.affiliate_id = affiliate_id
    if (broker_id !== undefined) updates.broker_id = broker_id
    if (deal_type !== undefined) updates.deal_type = deal_type
    if (deal_terms !== undefined) updates.deal_terms = deal_terms
    if (deal_details !== undefined) updates.deal_details = deal_details
    if (status !== undefined) updates.status = status

    // Build diff for version history
    const changes = {}
    for (const key of Object.keys(updates)) {
      if (JSON.stringify(existing[key]) !== JSON.stringify(updates[key])) {
        changes[key] = { from: existing[key], to: updates[key] }
      }
    }

    // Update deal
    const { data: updated, error: updateErr } = await supabase
      .from('deals')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (updateErr) {
      console.error('Error updating deal:', updateErr)
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    // Replace levels if provided
    if (levels !== undefined) {
      // Delete existing levels
      await supabase.from('deal_levels').delete().eq('deal_id', id)

      // Insert new levels
      if (levels.length > 0) {
        const levelRows = levels.map((l) => ({
          deal_id: id,
          level_number: l.level_number,
          label: l.label,
          affiliate_id: l.affiliate_id || null,
          rebate_forex: l.rebate_forex || 0,
          rebate_gold: l.rebate_gold || 0,
          rebate_crypto: l.rebate_crypto || 0,
          rebate_custom: l.rebate_custom || 0,
        }))
        await supabase.from('deal_levels').insert(levelRows)
      }
      changes.levels = { from: existing.deal_levels, to: levels }
    }

    // Record version if anything changed
    if (Object.keys(changes).length > 0) {
      const { data: lastVersion } = await supabase
        .from('deal_versions')
        .select('version_number')
        .eq('deal_id', id)
        .order('version_number', { ascending: false })
        .limit(1)
        .single()

      await supabase.from('deal_versions').insert({
        deal_id: id,
        version_number: (lastVersion?.version_number || 0) + 1,
        changes,
        changed_by: user.id,
      })

      // Audit log
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'UPDATE',
        entity_type: 'DEAL',
        entity_id: id,
        changes,
      })
    }

    // Return updated deal with relations
    const { data: completeDeal } = await supabase
      .from('deals')
      .select(`
        *,
        affiliate:affiliates(id, name, email),
        broker:brokers(id, name),
        deal_levels(*)
      `)
      .eq('id', id)
      .single()

    return NextResponse.json({ deal: completeDeal })
  } catch (err) {
    console.error('Deal PUT error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/deals/[id] — delete a deal (ADMIN only)
export async function DELETE(request, { params }) {
  try {
    const { user, role } = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can delete deals' }, { status: 403 })
    }

    const { id } = params
    const supabase = createAdminClient()

    const { data: deal, error: fetchErr } = await supabase
      .from('deals')
      .select('id, status, affiliate_id')
      .eq('id', id)
      .single()

    if (fetchErr || !deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    // CASCADE deletes levels, notes, versions, tokens
    const { error: delErr } = await supabase.from('deals').delete().eq('id', id)

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 })
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'DELETE',
      entity_type: 'DEAL',
      entity_id: id,
      changes: { status: deal.status, affiliate_id: deal.affiliate_id },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Deal DELETE error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
