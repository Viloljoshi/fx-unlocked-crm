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

// ── Affiliate Approved (ACTIVE) ─────────────────────────────────────────────
export function affiliateApprovedTemplate({ name, brokers }) {
  const brokerLine = brokers ? `<p style="margin:0 0 8px;font-size:14px;color:#6b7280;">Assigned broker(s): <strong>${brokers}</strong></p>` : ''
  return layout(`
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;background:#f0fdf4;border-radius:50%;padding:16px;margin-bottom:12px;">
        <span style="font-size:32px;">✅</span>
      </div>
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">You&rsquo;re approved!</h2>
    </div>
    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
      Hi <strong>${name}</strong>,<br /><br />
      Great news — your affiliate account with <strong>FX Unlocked</strong> has been approved and is now <strong style="color:#16a34a;">Active</strong>.
    </p>
    ${brokerLine}
    <p style="margin:16px 0;font-size:15px;color:#374151;line-height:1.6;">
      You can now log in to your account to view your dashboard, track performance, and manage your referrals.
    </p>
    <div style="text-align:center;margin:32px 0;">
      ${btn(`${BASE}/login`, 'Log In to Your Account &rarr;')}
    </div>
    ${divider()}
    <p style="margin:0;font-size:13px;color:#6b7280;">If you have any questions, reach out to your account manager at FX Unlocked.</p>
  `)
}

// ── Affiliate Onboarding Started ─────────────────────────────────────────────
export function affiliateOnboardingTemplate({ name }) {
  return layout(`
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;background:#eff6ff;border-radius:50%;padding:16px;margin-bottom:12px;">
        <span style="font-size:32px;">🚀</span>
      </div>
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Welcome aboard!</h2>
    </div>
    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
      Hi <strong>${name}</strong>,<br /><br />
      Your affiliate application with <strong>FX Unlocked</strong> has been received and your onboarding process has officially started.
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
      Our team will review your details and be in touch shortly. In the meantime, if you have any questions don&rsquo;t hesitate to reach out to your account manager.
    </p>
    <div style="background:#f8faff;border:1px solid #e0e7ff;border-radius:10px;padding:20px;margin:24px 0;">
      <p style="margin:0;font-size:13px;color:#4f46e5;font-weight:600;">What happens next?</p>
      <ul style="margin:8px 0 0;padding-left:18px;font-size:13px;color:#6b7280;line-height:1.8;">
        <li>Our team reviews your profile (usually within 24-48 hours)</li>
        <li>You&rsquo;ll receive a confirmation email once approved</li>
        <li>Your dashboard access will be activated</li>
      </ul>
    </div>
    ${divider()}
    <p style="margin:0;font-size:13px;color:#6b7280;">Questions? Contact your FX Unlocked account manager.</p>
  `)
}

// ── Affiliate Deactivated ────────────────────────────────────────────────────
export function affiliateInactiveTemplate({ name }) {
  return layout(`
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Account status update</h2>
    <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
      Hi <strong>${name}</strong>,<br /><br />
      We wanted to let you know that your affiliate account with <strong>FX Unlocked</strong> has been set to <strong style="color:#dc2626;">Inactive</strong>.
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
      If you believe this is a mistake or would like to discuss reactivation, please get in touch with your account manager directly.
    </p>
    ${divider()}
    <p style="margin:0;font-size:13px;color:#6b7280;">FX Unlocked — CRM &amp; Operations Platform</p>
  `)
}
