import './globals.css'
import { Providers } from './providers'

export const metadata = {
  title: 'FX Unlocked CRM',
  description: 'Forex Affiliate CRM - Manage affiliates, brokers, and commissions',
  verification: {
    google: 'twiJNgVN2katfBptDevx9LJc30Q9TRFZ_Lan6OX7euc',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
