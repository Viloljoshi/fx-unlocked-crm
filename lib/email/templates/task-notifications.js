// FX Unlocked — Task Notification Email Templates

const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'https://crm.fx-unlocked.com'

const layout = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>FX Unlocked CRM</title>
</head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;" cellpadding="0" cellspacing="0">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#3730a3 0%,#4f46e5 50%,#7c3aed 100%);border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
            <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">
              ◈ <span style="font-weight:900;">FX</span><span style="font-weight:400;">Unlocked</span>
            </p>
            <p style="margin:6px 0 0;font-size:12px;color:rgba(255,255,255,0.65);letter-spacing:0.5px;text-transform:uppercase;">CRM &amp; Operations Platform</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#ffffff;border-radius:0 0 16px 16px;padding:40px;border:1px solid #e5e7eb;border-top:none;">
            ${content}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:24px 0 0;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">© 2026 FX Unlocked. All rights reserved.</p>
            <p style="margin:4px 0 0;font-size:11px;color:#d1d5db;">This email was sent from a no-reply address. Do not reply to this email.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
`

const btn = (href, text) => `
  <a href="${href}" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:10px;margin:8px 0;">
    ${text}
  </a>
`

const divider = () => `<hr style="border:none;border-top:1px solid #f3f4f6;margin:28px 0;" />`

const priorityColors = {
  URGENT: { bg: '#fef2f2', text: '#dc2626', label: 'Urgent' },
  HIGH: { bg: '#fff7ed', text: '#ea580c', label: 'High' },
  MEDIUM: { bg: '#fefce8', text: '#ca8a04', label: 'Medium' },
  LOW: { bg: '#f8fafc', text: '#64748b', label: 'Low' },
}

function taskDetailRow(label, value) {
  if (!value) return ''
  return `
    <tr>
      <td style="padding:8px 12px;font-size:13px;color:#9ca3af;font-weight:500;white-space:nowrap;vertical-align:top;">${label}</td>
      <td style="padding:8px 12px;font-size:13px;color:#374151;">${value}</td>
    </tr>
  `
}

// ── Task Assigned Email ──────────────────────────────────────────────────────
export function taskAssignedTemplate({ assigneeName, assignerName, title, priority, deadline, description }) {
  const p = priorityColors[priority] || priorityColors.MEDIUM
  const deadlineText = deadline
    ? new Date(deadline + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  return layout(`
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;background:#eff6ff;border-radius:50%;padding:16px;margin-bottom:12px;">
        <span style="font-size:32px;">📋</span>
      </div>
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">New Task Assigned</h2>
    </div>
    <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
      Hi <strong>${assigneeName}</strong>,<br /><br />
      <strong>${assignerName}</strong> has assigned you a new task in FX Unlocked CRM.
    </p>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:4px 0;margin:24px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${taskDetailRow('Task', `<strong>${title}</strong>`)}
        ${taskDetailRow('Priority', `<span style="display:inline-block;background:${p.bg};color:${p.text};font-size:12px;font-weight:600;padding:3px 10px;border-radius:6px;">${p.label}</span>`)}
        ${deadlineText ? taskDetailRow('Deadline', deadlineText) : ''}
        ${description ? taskDetailRow('Details', description) : ''}
      </table>
    </div>

    <div style="text-align:center;margin:32px 0;">
      ${btn(`${BASE}/dashboard/tasks`, 'View Tasks &rarr;')}
    </div>
    ${divider()}
    <p style="margin:0;font-size:13px;color:#6b7280;">Log in to the CRM to update progress or add notes to this task.</p>
  `)
}

// ── Task Completed Email ─────────────────────────────────────────────────────
export function taskCompletedTemplate({ assignerName, completedByName, title, priority }) {
  const p = priorityColors[priority] || priorityColors.MEDIUM

  return layout(`
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;background:#f0fdf4;border-radius:50%;padding:16px;margin-bottom:12px;">
        <span style="font-size:32px;">✅</span>
      </div>
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Task Completed</h2>
    </div>
    <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
      Hi <strong>${assignerName}</strong>,<br /><br />
      <strong>${completedByName}</strong> has marked a task as <strong style="color:#16a34a;">Done</strong>.
    </p>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:20px;margin:24px 0;text-align:center;">
      <p style="margin:0 0 8px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Completed Task</p>
      <p style="margin:0;font-size:17px;font-weight:700;color:#111827;">${title}</p>
      <div style="margin-top:10px;">
        <span style="display:inline-block;background:${p.bg};color:${p.text};font-size:12px;font-weight:600;padding:3px 10px;border-radius:6px;">${p.label}</span>
      </div>
    </div>

    <div style="text-align:center;margin:32px 0;">
      ${btn(`${BASE}/dashboard/tasks`, 'View Tasks &rarr;')}
    </div>
    ${divider()}
    <p style="margin:0;font-size:13px;color:#6b7280;">Log in to the CRM to review the completed task or assign new work.</p>
  `)
}
