import { Resend } from 'resend'
import {
  inviteTemplate,
  passwordResetTemplate,
  affiliateApprovedTemplate,
  affiliateOnboardingTemplate,
  affiliateInactiveTemplate,
} from './templates'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM_EMAIL || 'noreply@mail.fx-unlocked.com'

export async function sendEmail({ to, subject, html }) {
  return send({ to, subject, html })
}

async function send({ to, subject, html }) {
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  })
  if (error) {
    console.error('Resend error:', error)
    throw new Error(`Email send failed: ${error.message}`)
  }
  return data
}

// User invited by admin — sends set-password link to new user's email
export async function sendInviteEmail({ to, firstName, lastName, role, inviteUrl }) {
  return send({
    to,
    subject: `You've been invited to FX Unlocked CRM`,
    html: inviteTemplate({ firstName, lastName, role, inviteUrl }),
  })
}

// Forgot password / admin-triggered password reset — sends reset link to user's email
export async function sendPasswordResetEmail({ to, firstName, resetUrl }) {
  return send({
    to,
    subject: `Reset your FX Unlocked CRM password`,
    html: passwordResetTemplate({ firstName, resetUrl }),
  })
}

// Affiliate status → ACTIVE — sends approval confirmation to affiliate's email
export async function sendAffiliateApprovedEmail({ to, name, brokers }) {
  return send({
    to,
    subject: `Your FX Unlocked affiliate account is approved ✅`,
    html: affiliateApprovedTemplate({ name, brokers }),
  })
}

// Affiliate status → ONBOARDING — sends welcome email to affiliate's email
export async function sendAffiliateOnboardingEmail({ to, name }) {
  return send({
    to,
    subject: `Welcome to FX Unlocked — onboarding started 🚀`,
    html: affiliateOnboardingTemplate({ name }),
  })
}

// Affiliate status → INACTIVE — sends status update to affiliate's email
export async function sendAffiliateInactiveEmail({ to, name }) {
  return send({
    to,
    subject: `FX Unlocked — account status update`,
    html: affiliateInactiveTemplate({ name }),
  })
}
