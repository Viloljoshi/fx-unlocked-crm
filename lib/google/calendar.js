import { google } from 'googleapis'

const SCOPES = ['https://www.googleapis.com/auth/calendar.events']
const REDIRECT_URI = 'https://crm.fx-unlocked.com/api/auth/google/callback'
const CLIENT_ID = '569042425490-s7bcicle416chlr3bnbm2me3huv1u4p9.apps.googleusercontent.com'

function getClientId() {
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || CLIENT_ID
}

function getClientSecret() {
  // SECURITY: Never use NEXT_PUBLIC_ prefix for secrets — it exposes them to the browser
  return (
    process.env.GOOGLE_CLIENT_SECRET ||
    process.env.GOOGLE_OAUTH_CLIENT_SECRET ||
    process.env.GOOGLE_API_SECRET
  )
}

export function getOAuth2Client() {
  return new google.auth.OAuth2(getClientId(), getClientSecret(), REDIRECT_URI)
}

// Build auth URL manually to guarantee all params are present
export function getAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

export function getCalendarClient(tokens) {
  const oauth2Client = getOAuth2Client()
  oauth2Client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: new Date(tokens.token_expires_at).getTime(),
  })
  return google.calendar({ version: 'v3', auth: oauth2Client })
}

export async function refreshTokenIfNeeded(tokens, supabaseAdmin, userId) {
  const expiresAt = new Date(tokens.token_expires_at)
  const now = new Date()

  // Refresh if expiring in next 5 minutes
  if (expiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
    return tokens
  }

  const oauth2Client = getOAuth2Client()
  oauth2Client.setCredentials({
    refresh_token: tokens.refresh_token,
  })

  const { credentials } = await oauth2Client.refreshAccessToken()

  const updatedTokens = {
    ...tokens,
    access_token: credentials.access_token,
    token_expires_at: new Date(credentials.expiry_date).toISOString(),
    updated_at: new Date().toISOString(),
  }

  await supabaseAdmin
    .from('google_calendar_tokens')
    .update({
      access_token: updatedTokens.access_token,
      token_expires_at: updatedTokens.token_expires_at,
      updated_at: updatedTokens.updated_at,
    })
    .eq('user_id', userId)

  return updatedTokens
}

export function buildCalendarEvent({ title, scheduledAt, notes, affiliateName, appointmentType }) {
  const start = new Date(scheduledAt)
  const end = new Date(start.getTime() + 30 * 60 * 1000) // 30 min default

  if (appointmentType === 'MEETING') {
    end.setTime(start.getTime() + 60 * 60 * 1000) // 1 hour for meetings
  }

  const description = [
    affiliateName ? `Affiliate: ${affiliateName}` : '',
    notes || '',
    '',
    '— Created from FX Unlocked CRM',
  ].filter(Boolean).join('\n')

  return {
    summary: title,
    description,
    start: { dateTime: start.toISOString(), timeZone: 'UTC' },
    end: { dateTime: end.toISOString(), timeZone: 'UTC' },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 15 },
        { method: 'email', minutes: 30 },
      ],
    },
  }
}
