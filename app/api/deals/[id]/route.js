import { NextResponse } from 'next/server'
import { createAdminClient, getAuthUser } from '@/lib/supabase/server'

// GET /api/deals/[id] — get single deal with all relations
export async function GET(request, { params }) {
  try {
    const { user } = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const supabase = createAdminClient()

    const { data: deal, error } = await supabase
      .from('deals')
      .select(`
        *,
        affiliate:affiliates(id, name, email, status, phone, country),
        broker:brokers(id, name),
        creator:profiles!deals_created_by_fkey(id, first_name, last_name, email),
        approver:profiles!deals_approved_by_fkey(id, first_name, last_name, email),
        deal_levels(*),
        deal_notes(*, user:profiles(id, first_name, last_name)),
        deal_versions(*, changer:profiles!deal_versions_changed_by_fkey(id, first_name, last_name))
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching deal:', error)
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    // Sort nested data
    if (deal.deal_levels) {
      deal.deal_levels.sort((a, b) => a.level_number - b.level_number)
    }
    if (deal.deal_notes) {
      deal.deal_notes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    }
    if (deal.deal_versions) {
      deal.deal_versions.sort((a, b) => b.version_number - a.version_number)
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

    const { id } = await params
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

    // Only draft/pending deals can be edited (unless admin)
    if (!['DRAFT', 'PENDING'].includes(existing.status) && role !== 'ADMIN') {
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
