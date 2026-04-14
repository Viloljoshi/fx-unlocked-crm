import Link from 'next/link'

export const metadata = {
  title: 'FX Unlocked CRM — Forex Affiliate Management',
  description: 'FX Unlocked CRM helps forex brokers manage affiliates, track commissions, schedule appointments, and grow their IB network.',
}

export default function Home() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', minHeight: '100vh', background: '#0f172a', color: '#f8fafc' }}>
      {/* Header */}
      <header style={{ padding: '24px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1e293b' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/logo.png" alt="FX Unlocked" style={{ height: '36px', objectFit: 'contain' }} />
          <span style={{ fontWeight: 700, fontSize: '18px', color: '#f8fafc' }}>FX Unlocked CRM</span>
        </div>
        <Link
          href="/login"
          style={{
            background: '#3b82f6',
            color: '#fff',
            padding: '8px 20px',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: '14px',
          }}
        >
          Sign In
        </Link>
      </header>

      {/* Hero */}
      <section style={{ maxWidth: '800px', margin: '0 auto', padding: '80px 48px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '48px', fontWeight: 800, lineHeight: 1.2, marginBottom: '24px', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Forex Affiliate CRM
        </h1>
        <p style={{ fontSize: '20px', color: '#94a3b8', lineHeight: 1.7, marginBottom: '40px' }}>
          FX Unlocked CRM is a private platform for the FX Unlocked team to manage affiliate relationships,
          track broker commissions, schedule appointments, and monitor performance — all in one place.
        </p>
        <Link
          href="/login"
          style={{
            display: 'inline-block',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            color: '#fff',
            padding: '14px 36px',
            borderRadius: '10px',
            textDecoration: 'none',
            fontWeight: 700,
            fontSize: '16px',
          }}
        >
          Access CRM →
        </Link>
      </section>

      {/* Features */}
      <section style={{ maxWidth: '900px', margin: '0 auto', padding: '0 48px 80px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
        {[
          { icon: '👥', title: 'Affiliate Management', desc: 'Track and manage your IB and affiliate network with full contact history.' },
          { icon: '📅', title: 'Appointments', desc: 'Schedule calls and meetings with Google Calendar sync built in.' },
          { icon: '💰', title: 'Revenue Tracking', desc: 'Monitor broker commissions and affiliate performance in real time.' },
        ].map((f) => (
          <div key={f.title} style={{ background: '#1e293b', borderRadius: '12px', padding: '28px', border: '1px solid #334155' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>{f.icon}</div>
            <h3 style={{ fontWeight: 700, marginBottom: '8px', fontSize: '16px' }}>{f.title}</h3>
            <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: 1.6 }}>{f.desc}</p>
          </div>
        ))}
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #1e293b', padding: '24px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '14px' }}>
        <span>© {new Date().getFullYear()} FX Unlocked. All rights reserved.</span>
        <div style={{ display: 'flex', gap: '24px' }}>
          <Link href="/privacy" style={{ color: '#64748b', textDecoration: 'none' }}>Privacy Policy</Link>
          <Link href="/terms" style={{ color: '#64748b', textDecoration: 'none' }}>Terms of Service</Link>
        </div>
      </footer>
    </main>
  )
}
