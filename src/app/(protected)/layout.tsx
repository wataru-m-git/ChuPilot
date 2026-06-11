import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import Layout from '@/components/Layout'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  const displayName = session.user?.name ?? session.user?.email ?? ''
  return <Layout userEmail={displayName}>{children}</Layout>
}
