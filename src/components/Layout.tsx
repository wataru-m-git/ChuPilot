'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { signOut } from 'next-auth/react'

export default function Layout({ children, userEmail }: { children: React.ReactNode; userEmail?: string }) {
  const pathname = usePathname()

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/login' })
  }

  const navItems = [
    { href: '/dashboard', label: 'ダッシュボード', icon: '📊' },
    { href: '/mice', label: '個体一覧', icon: '🐁' },
    { href: '/mice/disposed', label: '処分済み個体', icon: '🗑️' },
    { href: '/mice/import', label: 'Excelインポート', icon: '📥' },
    { href: '/cages', label: 'ケージビュー', icon: '🏠' },
    { href: '/strains', label: '系統登録', icon: '🧬' },
  ]

  const isNavItemActive = (href: string) => {
    if (href === '/mice' && pathname === '/mice') return true
    if (href !== '/mice' && pathname.startsWith(href)) return true
    return false
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={styles.sidebar}>
        <div style={styles.brand}>🐭 Colony</div>
        <nav style={styles.nav}>
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} style={{
              ...styles.navItem,
              background: isNavItemActive(item.href) ? '#553c9a' : 'transparent',
            }}>
              <span style={styles.navIcon}>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div style={styles.userSection}>
          <div style={styles.userEmail}>{userEmail || ''}</div>
          <button style={styles.logoutBtn} onClick={handleLogout}>ログアウト</button>
        </div>
      </aside>
      <main style={styles.main}>{children}</main>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: { width: '220px', background: '#2d3748', color: '#fff', display: 'flex', flexDirection: 'column', padding: '1rem 0', flexShrink: 0, position: 'sticky', top: 0, height: '100vh' },
  brand: { fontSize: '1.2rem', fontWeight: 700, padding: '0 1rem 1.5rem', borderBottom: '1px solid #4a5568' },
  nav: { flex: 1, padding: '1rem 0', display: 'flex', flexDirection: 'column', gap: '0.25rem' },
  navItem: { display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 1rem', borderRadius: '6px', margin: '0 0.5rem', color: '#e2e8f0', textDecoration: 'none', fontSize: '0.9rem', transition: 'background 0.15s' },
  navIcon: { fontSize: '1rem' },
  userSection: { padding: '1rem', borderTop: '1px solid #4a5568', display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  userEmail: { fontSize: '0.75rem', color: '#a0aec0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  logoutBtn: { padding: '0.4rem 0.75rem', background: '#4a5568', color: '#e2e8f0', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.82rem' },
  main: { flex: 1, overflow: 'auto' },
}
