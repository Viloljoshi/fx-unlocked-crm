import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/resend'
import {
  taskAssignedTemplate,
  taskCompletedTemplate,
} from '@/lib/email/templates/task-notifications'

// POST /api/tasks/notify
// type: "assigned" | "completed"
export async function POST(request) {
  try {
    const { user, role } = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { type } = body

    if (type === 'assigned') {
      const { assigneeEmail, assigneeName, assignerName, title, priority, deadline, description } = body
      if (!assigneeEmail || !title) {
        return NextResponse.json({ error: 'assigneeEmail and title are required' }, { status: 400 })
      }

      await sendEmail({
        to: assigneeEmail,
        subject: `New task assigned: ${title}`,
        html: taskAssignedTemplate({
          assigneeName: assigneeName || 'there',
          assignerName: assignerName || 'Someone',
          title,
          priority: priority || 'MEDIUM',
          deadline: deadline || null,
          description: description || null,
        }),
      })
    } else if (type === 'completed') {
      const { assignerEmail, assignerName, completedByName, title, priority } = body
      if (!assignerEmail || !title) {
        return NextResponse.json({ error: 'assignerEmail and title are required' }, { status: 400 })
      }

      await sendEmail({
        to: assignerEmail,
        subject: `Task completed: ${title}`,
        html: taskCompletedTemplate({
          assignerName: assignerName || 'there',
          completedByName: completedByName || 'Someone',
          title,
          priority: priority || 'MEDIUM',
        }),
      })
    } else {
      return NextResponse.json({ error: 'Invalid type. Use "assigned" or "completed"' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Task notify error:', err)
    // Non-fatal — don't block task operations if email fails
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
