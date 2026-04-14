import Link from 'next/link'

export const metadata = {
  title: 'Terms of Service — FX Unlocked CRM',
  description: 'Terms of service for FX Unlocked CRM.',
}

export default function TermsOfService() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', minHeight: '100vh', background: '#0f172a', color: '#f8fafc' }}>
      <header style={{ padding: '24px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1e293b' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', color: '#f8fafc' }}>
          <img src="/logo.png" alt="FX Unlocked" style={{ height: '36px', objectFit: 'contain' }} />
          <span style={{ fontWeight: 700, fontSize: '18px' }}>FX Unlocked CRM</span>
        </Link>
      </header>

      <article style={{ maxWidth: '720px', margin: '0 auto', padding: '60px 48px' }}>
        <h1 style={{ fontSize: '36px', fontWeight: 800, marginBottom: '8px' }}>Terms of Service</h1>
        <p style={{ color: '#64748b', marginBottom: '40px' }}>Last updated: April 2026</p>

        {[
          {
            title: '1. Acceptance',
            body: 'By accessing FX Unlocked CRM, you agree to these Terms of Service. Access is restricted to authorised FX Unlocked personnel only.',
          },
          {
            title: '2. Permitted Use',
            body: 'The App is provided exclusively for internal business use by FX Unlocked staff to manage affiliate and broker relationships. Unauthorised access or sharing of credentials is strictly prohibited.',
          },
          {
            title: '3. Google Calendar Integration',
            body: 'When you connect Google Calendar, you authorise the App to create and manage calendar events on your behalf using the calendar.events scope. You may disconnect at any time from the Appointments page.',
          },
          {
            title: '4. Confidentiality',
            body: 'All data within the CRM is confidential business information. Users must not disclose, export, or share CRM data outside of authorised business purposes.',
          },
          {
            title: '5. Availability',
            body: 'We aim to maintain high availability but do not guarantee uninterrupted access. Scheduled maintenance or unforeseen outages may occasionally affect availability.',
          },
          {
            title: '6. Contact',
            body: 'For questions regarding these terms, contact: joshivilol1011@gmail.com',
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
