import { NextResponse } from 'next/server'
import { createAdminClient, getAuthUser } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/resend'
import {
  taskAssignedTemplate,
  taskCompletedTemplate,
} from '@/lib/email/templates/task-notifications'

export const dynamic = 'force-dynamic'

// Helper: get email from auth.users + name from profiles
async function getUserInfo(supabase, userId) {
  if (!userId) return null
  const [{ data: profile }, { data: authData }] = await Promise.all([
    supabase.from('profiles').select('id,first_name,last_name').eq('id', userId).single(),
    supabase.auth.admin.getUserById(userId),
  ])
  const email = authData?.user?.email || null
  const name = profile
    ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || email || 'Someone'
    : email || 'Someone'
  return { email, name }
}

// POST /api/tasks/notify
// Client sends IDs + task details; server resolves emails via admin client
export async function POST(request) {
  try {
    const { user, role, profile } = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createAdminClient()
    const body = await request.json()
    const { type } = body

    // Current user's display name (the person triggering the action)
    const currentUserName = profile
      ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || user.email
      : user.email

    if (type === 'assigned') {
      const { ownerId, title, priority, deadline, description } = body
      if (!ownerId || !title) {
        return NextResponse.json({ error: 'ownerId and title are required' }, { status: 400 })
      }

      const assignee = await getUserInfo(supabase, ownerId)
      if (!assignee?.email) {
        console.error('[TaskNotify] No email found for owner:', ownerId)
        return NextResponse.json({ success: false, error: 'No email found for assignee' }, { status: 400 })
      }

      console.log('[TaskNotify] Sending assignment email to:', assignee.email)
      await sendEmail({
        to: assignee.email,
        subject: `New task assigned: ${title}`,
        html: taskAssignedTemplate({
          assigneeName: assignee.name,
          assignerName: currentUserName,
          title,
          priority: priority || 'MEDIUM',
          deadline: deadline || null,
          description: description || null,
        }),
      })
      console.log('[TaskNotify] Assignment email sent successfully')

    } else if (type === 'completed') {
      const { createdBy, title, priority } = body
      if (!createdBy || !title) {
        return NextResponse.json({ error: 'createdBy and title are required' }, { status: 400 })
      }

      const creator = await getUserInfo(supabase, createdBy)
      if (!creator?.email) {
        console.error('[TaskNotify] No email found for creator:', createdBy)
        return NextResponse.json({ success: false, error: 'No email found for creator' }, { status: 400 })
      }

      console.log('[TaskNotify] Sending completion email to:', creator.email)
      await sendEmail({
        to: creator.email,
        subject: `Task completed: ${title}`,
        html: taskCompletedTemplate({
          assignerName: creator.name,
          completedByName: currentUserName,
          title,
          priority: priority || 'MEDIUM',
        }),
      })
      console.log('[TaskNotify] Completion email sent successfully')

    } else {
      return NextResponse.json({ error: 'Invalid type. Use "assigned" or "completed"' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[TaskNotify] Error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
