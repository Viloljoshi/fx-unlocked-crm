import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getAuthUser, createAdminClient } from '@/lib/supabase/server'
import { getCalendarClient, refreshTokenIfNeeded, buildCalendarEvent } from '@/lib/google/calendar'

export const dynamic = 'force-dynamic'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const SYSTEM_PROMPT = `You are a smart assistant that analyzes CRM notes to detect if they mention a follow-up action, meeting, or call that should be scheduled.

Analyze the note and determine:
1. Does it mention a follow-up, meeting, call, or scheduled event?
2. If yes, extract: title, date/time, and type (CALL, MEETING, or FOLLOW_UP)

Rules:
- Only detect ACTIONABLE follow-ups — ignore past events or general notes
- If no specific date is mentioned, use reasonable defaults (e.g., "next week" = next Monday 10am, "tomorrow" = tomorrow 10am)
- Today's date is: {{TODAY}}
- Times should be in ISO 8601 format
- If no follow-up is detected, return detected: false

Respond ONLY with valid JSON, no markdown:
{
  "detected": true/false,
  "title": "string or null",
  "scheduled_at": "ISO 8601 datetime or null",
  "appointment_type": "CALL|MEETING|FOLLOW_UP or null",
  "confidence": 0.0-1.0
}`

export async function POST(request) {
  try {
    const { user } = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { noteContent, affiliateId, affiliateName, autoSync } = body

    if (!noteContent || !affiliateId) {
      return NextResponse.json({ error: 'noteContent and affiliateId required' }, { status: 400 })
    }

    const today = new Date().toISOString().split('T')[0]
    const prompt = SYSTEM_PROMPT.replace('{{TODAY}}', today)

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: `Affiliate: ${affiliateName || 'Unknown'}\nNote: ${noteContent}` },
      ],
      temperature: 0.1,
      max_tokens: 300,
    })

    const raw = completion.choices[0]?.message?.content?.trim() || '{}'
    let result

    try {
      // Strip markdown code block if present
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      result = JSON.parse(cleaned)
    } catch {
      console.error('[AIDetect] Failed to parse AI response:', raw)
      return NextResponse.json({ detected: false, raw })
    }

    if (!result.detected || result.confidence < 0.6) {
      return NextResponse.json({ detected: false, result })
    }

    // If autoSync is true and follow-up detected, create the appointment + calendar event
    if (autoSync) {
      const supabase = createAdminClient()

      // Create the appointment in DB
      const { data: appointment, error: apptError } = await supabase
        .from('appointments')
        .insert({
          affiliate_id: affiliateId,
          user_id: user.id,
          title: result.title || `Follow-up: ${affiliateName || 'Affiliate'}`,
          appointment_type: result.appointment_type || 'FOLLOW_UP',
          scheduled_at: result.scheduled_at,
          notes: `Auto-detected from note: "${noteContent.slice(0, 200)}"`,
          status: 'SCHEDULED',
        })
        .select()
        .single()

      if (apptError) {
        console.error('[AIDetect] Failed to create appointment:', apptError)
        return NextResponse.json({ detected: true, result, appointmentCreated: false, error: apptError.message })
      }

      // Try to sync to Google Calendar if connected
      let googleSynced = false
      const { data: tokens } = await supabase
        .from('google_calendar_tokens')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (tokens) {
        try {
          const freshTokens = await refreshTokenIfNeeded(tokens, supabase, user.id)
          const calendar = getCalendarClient(freshTokens)
          const calendarId = freshTokens.calendar_id || 'primary'

          const eventData = buildCalendarEvent({
            title: appointment.title,
            scheduledAt: appointment.scheduled_at,
            notes: appointment.notes,
            affiliateName,
            appointmentType: appointment.appointment_type,
          })

          const { data: event } = await calendar.events.insert({
            calendarId,
            requestBody: eventData,
          })

          await supabase
            .from('appointments')
            .update({
              google_event_id: event.id,
              google_synced_at: new Date().toISOString(),
            })
            .eq('id', appointment.id)

          googleSynced = true
        } catch (calError) {
          console.error('[AIDetect] Calendar sync failed:', calError.message)
        }
      }

      return NextResponse.json({
        detected: true,
        result,
        appointmentCreated: true,
        appointmentId: appointment.id,
        googleSynced,
      })
    }

    // Just return the detection result without auto-creating
    return NextResponse.json({ detected: true, result })
  } catch (error) {
    console.error('[AIDetect] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
