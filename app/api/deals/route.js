import { NextResponse } from 'next/server'
import { createAdminClient, getAuthUser } from '@/lib/supabase/server'

// GET /api/deals — list deals with optional filters
export async function GET(request) {
  try {
    const { user, role } = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const dealType = searchParams.get('deal_type')
    const affiliateId = searchParams.get('affiliate_id')

    const supabase = createAdminClient()

    let query = supabase
      .from('deals')
      .select(`
        *,
        affiliate:affiliates(id, name, email, status),
        broker:brokers(id, name),
        creator:profiles!deals_created_by_fkey(id, first_name, last_name, email),
        deal_levels(*)
      `)
      .order('created_at', { ascending: false })

    // STAFF can only see their own deals
    if (role === 'STAFF') {
      query = query.eq('created_by', user.id)
    }

    if (status) query = query.eq('status', status)
    if (dealType) query = query.eq('deal_type', dealType)
    if (affiliateId) query = query.eq('affiliate_id', affiliateId)

    const { data, error } = await query

    if (error) {
      console.error('Error fetching deals:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ deals: data })
  } catch (err) {
    console.error('Deals GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/deals — create a new deal
export async function POST(request) {
  try {
    const { user, role } = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!['ADMIN', 'STAFF'].includes(role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { affiliate_id, broker_id, deal_type, deal_terms, deal_details, levels, status } = body

    if (!affiliate_id || !deal_type) {
      return NextResponse.json({ error: 'affiliate_id and deal_type are required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Create the deal
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .insert({
        affiliate_id,
        broker_id: broker_id || null,
        deal_type,
        deal_terms: deal_terms || null,
        deal_details: deal_details || {},
        status: status || 'DRAFT',
        created_by: user.id,
      })
      .select()
      .single()

    if (dealError) {
      console.error('Error creating deal:', dealError)
      return NextResponse.json({ error: dealError.message }, { status: 500 })
    }

    // Insert rebate levels if provided
    if (levels && levels.length > 0) {
      const levelRows = levels.map((l) => ({
        deal_id: deal.id,
        level_number: l.level_number,
        label: l.label,
        affiliate_id: l.affiliate_id || null,
        rebate_forex: l.rebate_forex || 0,
        rebate_gold: l.rebate_gold || 0,
        rebate_crypto: l.rebate_crypto || 0,
        rebate_custom: l.rebate_custom || 0,
      }))

      const { error: levelsError } = await supabase.from('deal_levels').insert(levelRows)

      if (levelsError) {
        console.error('Error creating deal levels:', levelsError)
        // Deal created but levels failed — still return deal with warning
        return NextResponse.json({
          deal,
          warning: 'Deal created but rebate levels failed: ' + levelsError.message,
        })
      }
    }

    // Create initial version
    await supabase.from('deal_versions').insert({
      deal_id: deal.id,
      version_number: 1,
      changes: { action: 'CREATED', snapshot: { deal_type, deal_terms, deal_details, levels } },
      changed_by: user.id,
    })

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'CREATE',
      entity_type: 'DEAL',
      entity_id: deal.id,
      changes: { deal_type, affiliate_id, broker_id, status: deal.status },
    })

    // Fetch complete deal with relations
    const { data: completeDeal } = await supabase
      .from('deals')
      .select(`
        *,
        affiliate:affiliates(id, name, email),
        broker:brokers(id, name),
        deal_levels(*)
      `)
      .eq('id', deal.id)
      .single()

    return NextResponse.json({ deal: completeDeal }, { status: 201 })
  } catch (err) {
    console.error('Deals POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
