import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login', '/register']

export default auth(function middleware(req) {
  const { pathname } = req.nextUrl

  // Auth.js のハンドラルートは常に通過させる
  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  const isLoggedIn = !!req.auth
  const isPublic   = PUBLIC_PATHS.includes(pathname)

  // 未認証かつ非公開ルート → /login へリダイレクト
  if (!isLoggedIn && !isPublic) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 認証済みで /login or /register → /dashboard へリダイレクト
  if (isLoggedIn && isPublic) {
    const url = req.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
