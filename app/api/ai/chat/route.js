import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createAdminClient } from '@/lib/supabase/server'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

async function fetchContext(message) {
  const supabase = createAdminClient()
  const context = {}

  const [affiliatesRes, brokersRes, commissionsRes, appointmentsRes] = await Promise.all([
    supabase.from('affiliates').select('id, name, email, deal_type, status, broker_id, manager_id, country, source, renewal_date, created_at').order('created_at', { ascending: false }).limit(50),
    supabase.from('brokers').select('id, name, is_active, deal_types, account_manager, contact_email').order('created_at', { ascending: false }),
    supabase.from('commissions').select('id, month, year, deal_type, revenue_amount, status, affiliate_id, broker_id, paid_date').order('created_at', { ascending: false }).limit(200),
    supabase.from('appointments').select('id, title, affiliate_id, scheduled_at, appointment_type, status').order('scheduled_at', { ascending: false }).limit(30),
  ])

  const allAffiliates = affiliatesRes.data || []
  const allBrokers = brokersRes.data || []
  const allCommissions = commissionsRes.data || []
  const allAppointments = appointmentsRes.data || []

  context.totalAffiliates = allAffiliates.length
  context.activeAffiliates = allAffiliates.filter(a => a.status === 'ACTIVE').length
  context.leadAffiliates = allAffiliates.filter(a => a.status === 'LEAD').length
  context.onboardingAffiliates = allAffiliates.filter(a => a.status === 'ONBOARDING').length
  context.totalBrokers = allBrokers.length
  context.activeBrokers = allBrokers.filter(b => b.is_active).length

  context.totalRevenue = allCommissions.reduce((sum, c) => sum + Number(c.revenue_amount || 0), 0)
  context.pendingRevenue = allCommissions.filter(c => c.status === 'PENDING' || c.status === 'AWAITED').reduce((sum, c) => sum + Number(c.revenue_amount || 0), 0)
  context.paidRevenue = allCommissions.filter(c => c.status === 'PAID').reduce((sum, c) => sum + Number(c.revenue_amount || 0), 0)
  context.cancelledRevenue = allCommissions.filter(c => c.status === 'CANCELLED').reduce((sum, c) => sum + Number(c.revenue_amount || 0), 0)
  context.totalCommissions = allCommissions.length

  // Always include core data for accurate answers
  context.affiliates = allAffiliates
  context.brokers = allBrokers
  context.commissions = allCommissions

  const msg = message.toLowerCase()
  if (msg.includes('staff') || msg.includes('performance') || msg.includes('team') || msg.includes('manager') || msg.includes('employee')) {
    const staffRes = await supabase.from('profiles').select('id, first_name, last_name, role')
    context.staff = staffRes.data
  }
  if (msg.includes('appointment') || msg.includes('meeting') || msg.includes('call') || msg.includes('schedule')) {
    context.appointments = allAppointments
  }
  if (msg.includes('note') || msg.includes('notes')) {
    const notesRes = await supabase.from('affiliate_notes').select('id, affiliate_id, note_type, content, created_at').order('created_at', { ascending: false }).limit(30)
    context.notes = notesRes.data
  }

  return context
}

export async function POST(request) {
  try {
    const { message, history = [] } = await request.json()
    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const context = await fetchContext(message)

    const systemPrompt = `You are a sharp, data-driven CRM analyst for **FX Unlocked** — a forex affiliate management platform.

## Your Role
- You are the internal data expert. Staff and admins ask you about affiliates, brokers, revenue, commissions, appointments, and team performance.
- You have access to LIVE CRM data below. Always base your answers on this data — never guess or hallucinate numbers.

## Response Rules
1. **Be concise.** Get straight to the answer. No filler. Lead with the key number or insight.
2. **Always verify data before answering.** Cross-reference affiliate names, broker names, IDs, and amounts against the data provided. If you cannot find a match, say so clearly — never fabricate.
3. **Use tables** for any comparison of 3+ items. Use **bold** for key numbers. Use bullet points for lists.
4. **Ask a clarifying question** if the query is ambiguous — e.g. "Which affiliate are you referring to?" or "Do you mean revenue for all time or a specific period?" Keep it to one smart question maximum.
5. **Proactively highlight insights** — trends, anomalies, at-risk affiliates, top performers, overdue renewals.
6. **Currency**: Always format as USD ($X,XXX).
7. **Dates**: Use human-readable format (e.g. "Mar 15, 2026").

## Current CRM Snapshot
| Metric | Value |
|--------|-------|
| Total Affiliates | ${context.totalAffiliates} (${context.activeAffiliates} active, ${context.leadAffiliates} leads, ${context.onboardingAffiliates} onboarding) |
| Total Brokers | ${context.totalBrokers} (${context.activeBrokers} active) |
| Total Revenue | $${context.totalRevenue.toLocaleString()} |
| Paid Revenue | $${context.paidRevenue.toLocaleString()} |
| Pending / Awaited | $${context.pendingRevenue.toLocaleString()} |
| Cancelled | $${context.cancelledRevenue.toLocaleString()} |
| Commission Records | ${context.totalCommissions} |

## Live Data
${context.affiliates ? `### Affiliates (${context.affiliates.length})\n${JSON.stringify(context.affiliates, null, 1)}` : ''}
${context.brokers ? `### Brokers (${context.brokers.length})\n${JSON.stringify(context.brokers, null, 1)}` : ''}
${context.commissions ? `### Commissions (${context.commissions.length} records)\n${JSON.stringify(context.commissions, null, 1)}` : ''}
${context.staff ? `### Staff\n${JSON.stringify(context.staff, null, 1)}` : ''}
${context.appointments ? `### Appointments\n${JSON.stringify(context.appointments, null, 1)}` : ''}
${context.notes ? `### Recent Notes\n${JSON.stringify(context.notes, null, 1)}` : ''}`

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message }
    ]

    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      stream: true,
      temperature: 0.3,
      max_tokens: 3000,
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content || ''
            if (text) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
            }
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
