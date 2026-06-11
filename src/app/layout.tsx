import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'マウスコロニー管理',
  description: 'Mouse Colony Management System',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body style={{ margin: 0, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: '#f7fafc' }}>
        {children}
      </body>
    </html>
  )
}
