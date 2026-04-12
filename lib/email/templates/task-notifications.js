// FX Unlocked — Task Notification Email Templates
// Uses shared branded layout from ../templates.js

import { layout, btn, divider } from '../templates'

const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'https://crm.fx-unlocked.com'

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
