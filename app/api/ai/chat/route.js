import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createAdminClient, getAuthUser } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const fmt = (n) => `$${Number(n||0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`

async function fetchContext(message) {
  const supabase = createAdminClient()

  // Fetch ALL core data — no artificial limits
  const [affiliatesRes, brokersRes, commissionsRes, appointmentsRes, kpisRes, staffKpisRes, profilesRes, dealsRes] = await Promise.all([
    supabase.from('affiliates').select('id, name, email, deal_type, status, manager_id, master_ib_id, country, source, renewal_date, deal_details, created_at').order('created_at', { ascending: false }),
    supabase.from('brokers').select('id, name, is_active, deal_types, account_manager, contact_email').order('name'),
    supabase.from('commissions').select('id, month, year, deal_type, revenue_amount, status, affiliate_id, broker_id, deal_id, paid_date').order('year', { ascending: false }).order('month', { ascending: false }),
    supabase.from('appointments').select('id, title, affiliate_id, scheduled_at, appointment_type, status, notes').order('scheduled_at', { ascending: false }).limit(50),
    supabase.from('company_kpis').select('id, year, month, target_revenue, target_affiliates, target_commissions').order('year', { ascending: false }).order('month', { ascending: true }),
    supabase.from('staff_kpis').select('id, staff_member_id, year, quarter, month, target_revenue, actual_revenue, target_affiliates, actual_affiliates').order('year', { ascending: false }),
    supabase.from('profiles').select('id, first_name, last_name, role, email'),
    supabase.from('deals').select('id, affiliate_id, broker_id, deal_type, status, deal_notes, created_at').order('created_at', { ascending: false }),
  ])

  const affiliates    = affiliatesRes.data   || []
  const brokers       = brokersRes.data       || []
  const commissions   = commissionsRes.data   || []
  const appointments  = appointmentsRes.data  || []
  const kpis          = kpisRes.data          || []
  const staffKpis     = staffKpisRes.data     || []
  const profiles      = profilesRes.data      || []
  const deals         = dealsRes.data         || []

  // ── Lookup maps ──────────────────────────────────────────────────────────────
  const affiliateMap  = Object.fromEntries(affiliates.map(a => [a.id, a.name]))
  const brokerMap     = Object.fromEntries(brokers.map(b => [b.id, b.name]))
  const profileMap    = Object.fromEntries(profiles.map(p => [p.id, `${p.first_name} ${p.last_name}`.trim()]))

  // ── Top-level counts ─────────────────────────────────────────────────────────
  const context = {
    totalAffiliates:      affiliates.length,
    activeAffiliates:     affiliates.filter(a => a.status === 'ACTIVE').length,
    leadAffiliates:       affiliates.filter(a => a.status === 'LEAD').length,
    onboardingAffiliates: affiliates.filter(a => a.status === 'ONBOARDING').length,
    inactiveAffiliates:   affiliates.filter(a => a.status === 'INACTIVE').length,
    totalBrokers:         brokers.length,
    activeBrokers:        brokers.filter(b => b.is_active).length,
    totalRevenue:         commissions.reduce((s, c) => s + Number(c.revenue_amount || 0), 0),
    paidRevenue:          commissions.filter(c => c.status === 'PAID').reduce((s, c) => s + Number(c.revenue_amount || 0), 0),
    pendingRevenue:       commissions.filter(c => c.status === 'PENDING' || c.status === 'AWAITED').reduce((s, c) => s + Number(c.revenue_amount || 0), 0),
    cancelledRevenue:     commissions.filter(c => c.status === 'CANCELLED').reduce((s, c) => s + Number(c.revenue_amount || 0), 0),
    totalCommissions:     commissions.length,
  }

  // ── Revenue by month/year (pre-computed) ─────────────────────────────────────
  const revByMonthYear = {}
  commissions.forEach(c => {
    const yr = Number(c.year)
    const mo = Number(c.month)
    const key = `${yr}-${mo}`
    if (!revByMonthYear[key]) revByMonthYear[key] = { year: yr, month: mo, monthName: MONTH_NAMES[mo-1], total: 0, paid: 0, pending: 0, awaited: 0, cancelled: 0, count: 0 }
    const amt = Number(c.revenue_amount || 0)
    revByMonthYear[key].total += amt
    revByMonthYear[key].count += 1
    if (c.status === 'PAID')      revByMonthYear[key].paid      += amt
    if (c.status === 'PENDING')   revByMonthYear[key].pending   += amt
    if (c.status === 'AWAITED')   revByMonthYear[key].awaited   += amt
    if (c.status === 'CANCELLED') revByMonthYear[key].cancelled += amt
  })
  context.revenueByMonthYear = Object.values(revByMonthYear).sort((a,b) => a.year !== b.year ? b.year - a.year : a.month - b.month)

  // ── Revenue by year (pre-computed) ───────────────────────────────────────────
  const revByYear = {}
  commissions.forEach(c => {
    const yr = Number(c.year)
    if (!revByYear[yr]) revByYear[yr] = { year: yr, total: 0, paid: 0, pending: 0 }
    const amt = Number(c.revenue_amount || 0)
    revByYear[yr].total += amt
    if (c.status === 'PAID')    revByYear[yr].paid    += amt
    if (c.status === 'PENDING' || c.status === 'AWAITED') revByYear[yr].pending += amt
  })
  context.revenueByYear = Object.values(revByYear).sort((a,b) => b.year - a.year)

  // ── Revenue by affiliate (named, pre-computed) ────────────────────────────────
  const revByAff = {}
  commissions.forEach(c => {
    const name = affiliateMap[c.affiliate_id] || c.affiliate_id
    if (!revByAff[name]) revByAff[name] = { affiliate: name, total: 0, paid: 0, pending: 0, count: 0 }
    const amt = Number(c.revenue_amount || 0)
    revByAff[name].total   += amt
    revByAff[name].count   += 1
    if (c.status === 'PAID') revByAff[name].paid += amt
    if (c.status === 'PENDING' || c.status === 'AWAITED') revByAff[name].pending += amt
  })
  context.revenueByAffiliate = Object.values(revByAff).sort((a,b) => b.total - a.total)

  // ── Revenue by broker (named, pre-computed) ───────────────────────────────────
  const revByBrk = {}
  commissions.forEach(c => {
    if (!c.broker_id) return
    const name = brokerMap[c.broker_id] || c.broker_id
    if (!revByBrk[name]) revByBrk[name] = { broker: name, total: 0, count: 0 }
    revByBrk[name].total += Number(c.revenue_amount || 0)
    revByBrk[name].count += 1
  })
  context.revenueByBroker = Object.values(revByBrk).sort((a,b) => b.total - a.total)

  // ── Revenue by deal type (pre-computed) ──────────────────────────────────────
  const revByDeal = {}
  commissions.forEach(c => {
    if (!revByDeal[c.deal_type]) revByDeal[c.deal_type] = { dealType: c.deal_type, total: 0, count: 0 }
    revByDeal[c.deal_type].total += Number(c.revenue_amount || 0)
    revByDeal[c.deal_type].count += 1
  })
  context.revenueByDealType = Object.values(revByDeal).sort((a,b) => b.total - a.total)

  // ── Deals summary (multi-deal per partner) ──────────────────────────────────
  const dealMap = Object.fromEntries(deals.map(d => [d.id, d]))
  context.totalDeals = deals.length
  context.activeDeals = deals.filter(d => d.status === 'ACTIVE').length
  context.dealsSummary = deals.map(d => {
    const affName = affiliateMap[d.affiliate_id] || d.affiliate_id
    const brkName = d.broker_id ? (brokerMap[d.broker_id] || d.broker_id) : 'No Broker'
    const dealComms = commissions.filter(c => c.deal_id === d.id)
    const dealRevenue = dealComms.reduce((s, c) => s + Number(c.revenue_amount || 0), 0)
    const dealPaid = dealComms.filter(c => c.status === 'PAID').reduce((s, c) => s + Number(c.revenue_amount || 0), 0)
    return {
      dealId: d.id,
      affiliate: affName,
      broker: brkName,
      dealType: d.deal_type,
      status: d.status,
      revenue: dealRevenue,
      paidRevenue: dealPaid,
      commissionCount: dealComms.length,
      label: `${affName} - ${d.deal_type} - ${brkName}`,
    }
  }).sort((a, b) => b.revenue - a.revenue)

  // ── Revenue by deal (affiliate + broker + type breakdown) ───────────────────
  // This enables questions like "Show me Lewis Page's revenue by deal"
  const revBySpecificDeal = {}
  commissions.forEach(c => {
    if (!c.deal_id) return
    const d = dealMap[c.deal_id]
    if (!d) return
    const affName = affiliateMap[c.affiliate_id] || c.affiliate_id
    const brkName = c.broker_id ? (brokerMap[c.broker_id] || c.broker_id) : 'No Broker'
    const label = `${affName} - ${c.deal_type} - ${brkName}`
    if (!revBySpecificDeal[label]) revBySpecificDeal[label] = { label, affiliate: affName, broker: brkName, dealType: c.deal_type, total: 0, paid: 0, pending: 0, count: 0 }
    const amt = Number(c.revenue_amount || 0)
    revBySpecificDeal[label].total += amt
    revBySpecificDeal[label].count += 1
    if (c.status === 'PAID') revBySpecificDeal[label].paid += amt
    if (c.status === 'PENDING' || c.status === 'AWAITED') revBySpecificDeal[label].pending += amt
  })
  context.revenueBySpecificDeal = Object.values(revBySpecificDeal).sort((a,b) => b.total - a.total)

  // ── Company KPIs actuals vs targets (fully resolved, per month) ───────────────
  context.companyKpiTargets = kpis.map(k => {
    const actualRevenue = commissions
      .filter(c => Number(c.year) === k.year && Number(c.month) === k.month)
      .reduce((s, c) => s + Number(c.revenue_amount || 0), 0)
    const target = Number(k.target_revenue || 0)
    const progress = target > 0 ? Math.round((actualRevenue / target) * 100) : null
    const variance = actualRevenue - target
    return {
      year: k.year,
      month: k.month,
      monthName: MONTH_NAMES[k.month - 1],
      revenueTarget: target,
      actualRevenue,
      progressPct: progress,
      variance,
      varianceFormatted: variance >= 0 ? `+${fmt(variance)}` : fmt(variance),
      targetAffiliates: k.target_affiliates,
      targetCommissions: k.target_commissions,
    }
  })

  // ── Annual KPI summary ────────────────────────────────────────────────────────
  const annualByYear = {}
  context.companyKpiTargets.forEach(k => {
    if (!annualByYear[k.year]) annualByYear[k.year] = { year: k.year, annualTarget: 0, annualActual: 0, months: [] }
    annualByYear[k.year].annualTarget += k.revenueTarget
    annualByYear[k.year].annualActual += k.actualRevenue
    annualByYear[k.year].months.push(k)
  })
  context.annualKpiSummary = Object.values(annualByYear).sort((a,b) => b.year - a.year).map(y => ({
    ...y,
    progressPct: y.annualTarget > 0 ? Math.round((y.annualActual / y.annualTarget) * 100) : null,
    variance: y.annualActual - y.annualTarget,
  }))

  // ── Staff KPIs (named) ────────────────────────────────────────────────────────
  context.staffKpis = staffKpis.map(k => ({
    ...k,
    staffName: profileMap[k.staff_member_id] || k.staff_member_id,
  }))

  // ── Affiliates with manager names + master IB + deal details ──────────────────
  context.affiliates = affiliates.map(a => ({
    ...a,
    managerName:  a.manager_id   ? (profileMap[a.manager_id]    || a.manager_id)   : null,
    brokerName:   a.broker_id    ? (brokerMap[a.broker_id]      || a.broker_id)    : null,
    masterIBName: a.master_ib_id ? (affiliateMap[a.master_ib_id] || a.master_ib_id) : null,
    dealDetails:  a.deal_details?.deal || null,
  }))

  // ── Brokers ───────────────────────────────────────────────────────────────────
  context.brokers = brokers

  // ── Commissions (with resolved names) ────────────────────────────────────────
  context.commissions = commissions.map(c => ({
    ...c,
    affiliateName: affiliateMap[c.affiliate_id] || c.affiliate_id,
    brokerName:    c.broker_id ? (brokerMap[c.broker_id] || c.broker_id) : null,
  }))

  // ── Appointments (with resolved names) ───────────────────────────────────────
  context.appointments = appointments.map(a => ({
    ...a,
    affiliateName: affiliateMap[a.affiliate_id] || a.affiliate_id,
  }))

  // ── Staff profiles ────────────────────────────────────────────────────────────
  context.staff = profiles

  // ── Conditional: notes (only if asked) ───────────────────────────────────────
  const msg = message.toLowerCase()
  if (msg.includes('note') || msg.includes('notes')) {
    const notesRes = await supabase.from('affiliate_notes').select('id, affiliate_id, note_type, content, created_at').order('created_at', { ascending: false }).limit(50)
    context.notes = (notesRes.data || []).map(n => ({
      ...n,
      affiliateName: affiliateMap[n.affiliate_id] || n.affiliate_id,
    }))
  }

  return context
}

export async function POST(request) {
  try {
    const { user } = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Verify user has a valid role in the system (prevents unauthorized access)
    const adminClient = createAdminClient()
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single()
    if (profileError || !profile || !['ADMIN', 'STAFF', 'VIEWER'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden — no valid CRM role' }, { status: 403 })
    }

    const body = await request.json()
    const message = typeof body?.message === 'string' ? body.message.trim() : ''
    const history = Array.isArray(body?.history) ? body.history : []
    if (!message) return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    if (message.length > 2000) return NextResponse.json({ error: 'Message too long' }, { status: 400 })

    const context = await fetchContext(message)

    // ── Build KPI snapshot lines ──────────────────────────────────────────────
    const kpiLines = context.annualKpiSummary?.length
      ? context.annualKpiSummary.map(t => `| ${t.year} Annual Revenue Target | ${fmt(t.annualTarget)} | Actual: ${fmt(t.annualActual)} | Progress: ${t.progressPct != null ? t.progressPct + '%' : 'N/A'} | Variance: ${t.variance >= 0 ? '+' : ''}${fmt(t.variance)} |`).join('\n')
      : '| Company KPI Targets | None set yet |'

    const systemPrompt = `You are a sharp, data-driven CRM analyst for **FX Unlocked** — a forex affiliate management platform.

## Your Role
You are the internal data expert. Staff and admins ask you about affiliates, brokers, revenue, commissions, appointments, staff KPIs, and company targets.
You have access to LIVE, pre-computed CRM data below. **Always base answers on this data — never guess or hallucinate numbers.**

## Response Rules
1. **Be concise.** Lead with the key number or insight. No filler.
2. **Always verify.** Cross-reference names, IDs, amounts against the data. If you cannot find a match, say so clearly.
3. **Use tables** for comparisons of 3+ items. Use **bold** for key numbers.
4. **Ask one clarifying question** if the query is genuinely ambiguous.
5. **Proactively highlight** trends, anomalies, at-risk affiliates, top performers, overdue renewals.
6. **Currency**: Always format as USD ($X,XXX). **Months**: Use names not numbers (e.g. "Jan 2026" not "1/2026").
7. **KPI context**: When asked about targets/actuals, use the pre-computed \`companyKpiTargets\` and \`annualKpiSummary\` — do not recompute from raw commissions.

## Current CRM Snapshot
| Metric | Value |
|--------|-------|
| Total Affiliates | ${context.totalAffiliates} (${context.activeAffiliates} active, ${context.leadAffiliates} leads, ${context.onboardingAffiliates} onboarding, ${context.inactiveAffiliates} inactive) |
| Total Brokers | ${context.totalBrokers} (${context.activeBrokers} active) |
| Total Deals | ${context.totalDeals} (${context.activeDeals} active) |
| Total Revenue (all time) | ${fmt(context.totalRevenue)} |
| Paid Revenue | ${fmt(context.paidRevenue)} |
| Pending / Awaited | ${fmt(context.pendingRevenue)} |
| Cancelled | ${fmt(context.cancelledRevenue)} |
| Commission Records | ${context.totalCommissions} |
${kpiLines}

## Pre-Computed Analytics (use these for accurate answers)

### Revenue by Year
${JSON.stringify(context.revenueByYear, null, 1)}

### Revenue by Month/Year
${JSON.stringify(context.revenueByMonthYear, null, 1)}

### Revenue by Affiliate (ranked)
${JSON.stringify(context.revenueByAffiliate, null, 1)}

### Revenue by Broker (ranked)
${JSON.stringify(context.revenueByBroker, null, 1)}

### Revenue by Deal Type
${JSON.stringify(context.revenueByDealType, null, 1)}

### Revenue by Specific Deal (affiliate + broker + type breakdown)
${JSON.stringify(context.revenueBySpecificDeal, null, 1)}

### Deals Summary (all deals per partner — each partner can have multiple deals with different brokers)
${JSON.stringify(context.dealsSummary, null, 1)}

### Company KPI Targets vs Actuals (per month)
${JSON.stringify(context.companyKpiTargets, null, 1)}

### Annual KPI Summary
${JSON.stringify(context.annualKpiSummary, null, 1)}

### Staff KPI Targets
${context.staffKpis?.length ? JSON.stringify(context.staffKpis, null, 1) : 'No staff KPIs set yet.'}

## Raw Data (for detailed lookups)

### Affiliates (${context.affiliates?.length})
${JSON.stringify(context.affiliates, null, 1)}

### Brokers (${context.brokers?.length})
${JSON.stringify(context.brokers, null, 1)}

### Commissions (${context.commissions?.length} records — includes affiliate & broker names)
${JSON.stringify(context.commissions, null, 1)}

### Staff / Profiles
${JSON.stringify(context.staff, null, 1)}

### Appointments (${context.appointments?.length})
${JSON.stringify(context.appointments, null, 1)}
${context.notes ? `\n### Affiliate Notes\n${JSON.stringify(context.notes, null, 1)}` : ''}`

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message }
    ]

    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      stream: true,
      temperature: 0.2,
      max_tokens: 4000,
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content || ''
            if (text) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (err) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err.message })}\n\n`))
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
