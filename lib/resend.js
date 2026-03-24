const RESEND_API_URL = 'https://api.resend.com/emails'
const FROM_ADDRESS = 'FX Unlocked CRM <onboarding@resend.dev>'

function buildEmailHtml({ firstName, bodyHtml, ctaText, ctaUrl }) {
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>FX Unlocked CRM</title>
</head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f4f8;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;margin:0 auto;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#22d3ee,#3b82f6,#8b5cf6);border-radius:16px 16px 0 0;padding:28px 32px;">
              <p style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">FX Unlocked CRM</p>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Affiliate &amp; IB Management Platform</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 0 0;padding:32px 32px 28px;">
              <p style="margin:0 0 16px;color:#1e293b;font-size:16px;font-weight:600;">${greeting}</p>
              <p style="margin:0 0 28px;color:#475569;font-size:15px;line-height:1.6;">${bodyHtml}</p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-radius:10px;background:linear-gradient(135deg,#22d3ee,#3b82f6,#8b5cf6);">
                    <a href="${ctaUrl}"
                       style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:10px;letter-spacing:0.1px;">
                      ${ctaText}
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:24px 0 0;color:#94a3b8;font-size:12px;line-height:1.5;">
                This link expires in 24 hours. If you didn't expect this, you can safely ignore it.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;text-align:center;">
              <p style="margin:0;color:#94a3b8;font-size:12px;">© 2026 FX Unlocked. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

async function sendEmail({ to, subject, html }) {
  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [to],
      subject,
      html,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    return { success: false, error: `Resend API error ${res.status}: ${body}` }
  }

  return { success: true }
}

export async function sendInviteEmail({ to, firstName, lastName, role, inviteUrl }) {
  const displayRole = role ? role.charAt(0) + role.slice(1).toLowerCase() : 'team member'
  const bodyHtml = `You've been added as a <strong>${displayRole}</strong> on FX Unlocked CRM — your complete affiliate &amp; IB management platform. Click below to set your password and get started.`

  const html = buildEmailHtml({
    firstName,
    bodyHtml,
    ctaText: 'Set Your Password →',
    ctaUrl: inviteUrl,
  })

  return sendEmail({
    to,
    subject: "You've been invited to FX Unlocked CRM",
    html,
  })
}

export async function sendPasswordResetEmail({ to, firstName, resetUrl }) {
  const bodyHtml = `We received a request to reset your FX Unlocked CRM password. Click the button below to choose a new password.`

  const html = buildEmailHtml({
    firstName,
    bodyHtml,
    ctaText: 'Reset My Password →',
    ctaUrl: resetUrl,
  })

  return sendEmail({
    to,
    subject: 'Reset your FX Unlocked CRM password',
    html,
  })
}
