import { NextResponse } from 'next/server'
import { createAdminClient, getAuthUser } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST /api/deals/[id]/versions/[versionId]/restore
export async function POST(request, { params }) {
  try {
    const { user, role } = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!['ADMIN', 'STAFF'].includes(role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { id, versionId } = params
    const supabase = createAdminClient()

    // Get the version to restore
    const { data: version, error } = await supabase
      .from('deal_versions')
      .select('*')
      .eq('id', versionId)
      .eq('deal_id', id)
      .single()

    if (error || !version) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 })
    }

    const changes = version.changes || {}

    // Build update payload from the version's "from" values (restore = revert to old state)
    // If version has snapshot (created version), use that
    const updates = {}
    if (changes.snapshot) {
      if (changes.snapshot.deal_type) updates.deal_type = changes.snapshot.deal_type
      if (changes.snapshot.deal_terms !== undefined) updates.deal_terms = changes.snapshot.deal_terms
      if (changes.snapshot.deal_details !== undefined) updates.deal_details = changes.snapshot.deal_details
    } else {
      // Use "from" values in the diff
      for (const [key, val] of Object.entries(changes)) {
        if (key === 'action' || key === 'snapshot' || key === 'levels') continue
        if (val?.from !== undefined) {
          updates[key] = val.from
        }
      }
    }

    // Apply updates if any
    if (Object.keys(updates).length > 0) {
      const { error: updateErr } = await supabase
        .from('deals')
        .update(updates)
        .eq('id', id)

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 })
      }
    }

    // Restore levels if captured
    if (changes.levels?.from) {
      await supabase.from('deal_levels').delete().eq('deal_id', id)
      const levelsToRestore = Array.isArray(changes.levels.from) ? changes.levels.from : []
      if (levelsToRestore.length > 0) {
        const rows = levelsToRestore.map((l) => ({
          deal_id: id,
          level_number: l.level_number,
          label: l.label,
          affiliate_id: l.affiliate_id || null,
          rebate_forex: l.rebate_forex || 0,
          rebate_gold: l.rebate_gold || 0,
          rebate_crypto: l.rebate_crypto || 0,
          rebate_custom: l.rebate_custom || 0,
        }))
        await supabase.from('deal_levels').insert(rows)
      }
    }

    // Create a new version entry for the restore action
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
      changes: { action: 'RESTORED', restored_from: `v${version.version_number}`, updates },
      changed_by: user.id,
    })

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'UPDATE',
      entity_type: 'DEAL',
      entity_id: id,
      changes: { action: 'RESTORED', restored_from_version: version.version_number },
    })

    return NextResponse.json({ success: true, message: `Restored to v${version.version_number}` })
  } catch (err) {
    console.error('Restore version error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
