import { NextResponse } from 'next/server'
import { getAuthUser, createAdminClient } from '@/lib/supabase/server'
import { getCalendarClient, refreshTokenIfNeeded, buildCalendarEvent } from '@/lib/google/calendar'

export async function POST(request) {
  try {
    const { user } = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { appointmentId, action } = body // action: 'create' | 'update' | 'delete'

    if (!appointmentId || !action) {
      return NextResponse.json({ error: 'appointmentId and action required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Get user's Google tokens
    const { data: tokens, error: tokenError } = await supabase
      .from('google_calendar_tokens')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (tokenError || !tokens) {
      return NextResponse.json({ error: 'Google Calendar not connected', needsConnect: true }, { status: 400 })
    }

    // Refresh token if expired
    const freshTokens = await refreshTokenIfNeeded(tokens, supabase, user.id)

    // Get appointment data
    const { data: appointment, error: apptError } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .single()

    if (apptError || !appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    // Get affiliate name for event description
    const { data: affiliate } = await supabase
      .from('affiliates')
      .select('name')
      .eq('id', appointment.affiliate_id)
      .single()

    const calendar = getCalendarClient(freshTokens)
    const calendarId = freshTokens.calendar_id || 'primary'

    if (action === 'delete') {
      // Delete Google Calendar event
      if (appointment.google_event_id) {
        try {
          await calendar.events.delete({
            calendarId,
            eventId: appointment.google_event_id,
          })
        } catch (err) {
          // Event may already be deleted — ignore 404/410
          if (err.code !== 404 && err.code !== 410) {
            console.error('[CalSync] Delete error:', err.message)
          }
        }

        await supabase
          .from('appointments')
          .update({ google_event_id: null, google_synced_at: null })
          .eq('id', appointmentId)
      }

      return NextResponse.json({ success: true, action: 'deleted' })
    }

    const eventData = buildCalendarEvent({
      title: appointment.title,
      scheduledAt: appointment.scheduled_at,
      notes: appointment.notes,
      affiliateName: affiliate?.name,
      appointmentType: appointment.appointment_type,
    })

    if (action === 'update' && appointment.google_event_id) {
      // Update existing event
      const { data: event } = await calendar.events.update({
        calendarId,
        eventId: appointment.google_event_id,
        requestBody: eventData,
      })

      await supabase
        .from('appointments')
        .update({ google_synced_at: new Date().toISOString() })
        .eq('id', appointmentId)

      return NextResponse.json({ success: true, action: 'updated', eventId: event.id })
    }

    // Create new event
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
      .eq('id', appointmentId)

    return NextResponse.json({ success: true, action: 'created', eventId: event.id })
  } catch (error) {
    console.error('[CalSync] Error:', error)

    // If token is revoked/invalid, clear it
    if (error.message?.includes('invalid_grant') || error.code === 401) {
      return NextResponse.json({ error: 'Google Calendar token expired. Please reconnect.', needsConnect: true }, { status: 401 })
    }

    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
