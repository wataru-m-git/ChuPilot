import type { Metadata } from 'next'
import { I18nProvider } from '@/i18n/I18nProvider'

export const metadata: Metadata = {
  title: 'Mouse Colony Management',
  description: 'Mouse Colony Management System',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body style={{ margin: 0, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: '#f7fafc' }}>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  )
}
