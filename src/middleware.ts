import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login', '/register']

export default auth(function middleware(req) {
  const { pathname } = req.nextUrl

  // Always let Auth.js handler routes pass through
  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  const isLoggedIn = !!req.auth
  const isPublic   = PUBLIC_PATHS.includes(pathname)

  // Not authenticated and not a public route → redirect to /login
  if (!isLoggedIn && !isPublic) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Authenticated and on /login or /register → redirect to /dashboard
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
