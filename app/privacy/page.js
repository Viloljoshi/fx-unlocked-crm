import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy — FX Unlocked CRM',
  description: 'Privacy policy for FX Unlocked CRM.',
}

export default function PrivacyPolicy() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', minHeight: '100vh', background: '#0f172a', color: '#f8fafc' }}>
      <header style={{ padding: '24px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1e293b' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', color: '#f8fafc' }}>
          <img src="/logo.png" alt="FX Unlocked" style={{ height: '36px', objectFit: 'contain' }} />
          <span style={{ fontWeight: 700, fontSize: '18px' }}>FX Unlocked CRM</span>
        </Link>
      </header>

      <article style={{ maxWidth: '720px', margin: '0 auto', padding: '60px 48px' }}>
        <h1 style={{ fontSize: '36px', fontWeight: 800, marginBottom: '8px' }}>Privacy Policy</h1>
        <p style={{ color: '#64748b', marginBottom: '40px' }}>Last updated: April 2026</p>

        {[
          {
            title: '1. Overview',
            body: 'FX Unlocked CRM ("the App") is a private, internal customer relationship management platform operated by FX Unlocked. This policy explains how we collect, use, and protect data when authorised users access the App.',
          },
          {
            title: '2. Data We Collect',
            body: 'We collect information you provide when using the App, including affiliate contact details, broker records, appointment data, revenue figures, and notes. We also collect authentication data via Supabase and, when you choose to connect it, Google Calendar OAuth tokens (access token and refresh token) solely to sync appointments to your Google Calendar.',
          },
          {
            title: '3. How We Use Your Data',
            body: 'Data is used exclusively to operate the CRM — managing affiliate relationships, scheduling appointments, tracking commissions, and generating performance reports. We do not sell, share, or transfer your data to third parties except where required to operate the service (e.g., Supabase for database hosting, Google APIs for calendar integration, Resend for transactional email).',
          },
          {
            title: '4. Google API Scopes',
            body: 'When you connect Google Calendar, the App requests the "calendar.events" scope. This allows the App to create, update, and delete calendar events on your behalf. We do not access any other Google data. Google OAuth tokens are stored securely in our database and are never shared with third parties.',
          },
          {
            title: '5. Data Retention',
            body: 'Your data is retained for as long as your account is active. You may request deletion of your data at any time by contacting the system administrator. Google Calendar tokens are deleted immediately when you disconnect your Google account from the App.',
          },
          {
            title: '6. Security',
            body: 'All data is encrypted in transit (HTTPS/TLS). Database access is protected by row-level security policies. Authentication is handled by Supabase Auth with optional multi-factor authentication.',
          },
          {
            title: '7. Contact',
            body: 'For any privacy-related questions, contact the FX Unlocked team at: joshivilol1011@gmail.com',
          },
        ].map((section) => (
          <section key={section.title} style={{ marginBottom: '36px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px', color: '#e2e8f0' }}>{section.title}</h2>
            <p style={{ color: '#94a3b8', lineHeight: 1.8 }}>{section.body}</p>
          </section>
        ))}

        <div style={{ marginTop: '48px', paddingTop: '24px', borderTop: '1px solid #1e293b' }}>
          <Link href="/" style={{ color: '#3b82f6', textDecoration: 'none' }}>← Back to Home</Link>
        </div>
      </article>

      <footer style={{ borderTop: '1px solid #1e293b', padding: '24px 48px', color: '#64748b', fontSize: '14px', textAlign: 'center' }}>
        © {new Date().getFullYear()} FX Unlocked. All rights reserved.
      </footer>
    </main>
  )
}
