import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendEmail({ to, subject, html }) {
  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  })

  if (error) {
    console.error('Resend email error:', error)
    throw new Error(`Failed to send email: ${error.message}`)
  }

  return data
}
