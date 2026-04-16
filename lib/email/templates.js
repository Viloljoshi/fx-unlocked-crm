// FX Unlocked — Branded Email Templates
// All templates return an HTML string ready to send via Resend

export const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'https://crm.fx-unlocked.com'

export const layout = (content) => `
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

export const btn = (href, text) => `
  <a href="${href}" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:10px;margin:8px 0;">
    ${text}
  </a>
`

export const divider = () => `<hr style="border:none;border-top:1px solid #f3f4f6;margin:28px 0;" />`

export const note = (text) => `
  <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;text-align:center;">${text}</p>
`

// ── Invite / Onboarding ─────────────────────────────────────────────────────
export function inviteTemplate({ firstName, role, inviteUrl }) {
  const name = firstName ? `Hi ${firstName},` : 'Hi there,'
  const roleLabel = role === 'ADMIN' ? 'Administrator' : role === 'VIEWER' ? 'Viewer' : 'Staff Member'
  return layout(`
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">You&rsquo;ve been invited 🎉</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">${name}</p>
    <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
      You&rsquo;ve been added to <strong>FX Unlocked CRM</strong> as a <strong>${roleLabel}</strong>.
      Click the button below to set your password and access your account.
    </p>
    <div style="text-align:center;margin:32px 0;">
      ${btn(inviteUrl, 'Set Your Password &rarr;')}
    </div>
    ${divider()}
    <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">
      If the button doesn&rsquo;t work, copy and paste this link into your browser:<br />
      <a href="${inviteUrl}" style="color:#4f46e5;word-break:break-all;">${inviteUrl}</a>
    </p>
    ${note('This invite link expires in 24 hours. If it expires, contact your administrator.')}
  `)
}

// ── Password Reset ──────────────────────────────────────────────────────────
export function passwordResetTemplate({ firstName, resetUrl }) {
  const name = firstName ? `Hi ${firstName},` : 'Hi there,'
  return layout(`
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Reset your password</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">${name}</p>
    <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
      We received a request to reset the password for your FX Unlocked CRM account.
      Click the button below to choose a new password.
    </p>
    <div style="text-align:center;margin:32px 0;">
      ${btn(resetUrl, 'Reset My Password &rarr;')}
    </div>
    ${divider()}
    <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">
      If you didn&rsquo;t request a password reset, you can safely ignore this email — your password will not be changed.<br /><br />
      If the button doesn&rsquo;t work, copy and paste this link:<br />
      <a href="${resetUrl}" style="color:#4f46e5;word-break:break-all;">${resetUrl}</a>
    </p>
    ${note('This reset link expires in 1 hour for your security.')}
  `)
}

// REMOVED: All external affiliate email templates have been permanently deleted.
// (affiliateApprovedTemplate, affiliateOnboardingTemplate, affiliateInactiveTemplate)
// Affiliates/partners/leads must NEVER receive emails from this CRM.
// Only internal staff email templates (invite, password reset) are permitted.
