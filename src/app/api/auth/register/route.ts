import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  const allowSelfRegistration = process.env.ALLOW_SELF_REGISTRATION === 'true'

  if (!allowSelfRegistration) {
    // When self-registration is disabled, an authenticated session is required (admin-invited registration)
    const session = await auth()
    if (!session) {
      return NextResponse.json(
        { error: 'Only administrators can register users. Please log in first.' },
        { status: 403 },
      )
    }
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  // Validate input types
  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const bodyObj = body as Record<string, unknown>
  const email = bodyObj.email
  const password = bodyObj.password
  const full_name = bodyObj.full_name

  // Type checks
  if (typeof email !== 'string' || typeof password !== 'string') {
    return NextResponse.json(
      { error: 'Email and password are required.' },
      { status: 400 },
    )
  }

  if (full_name !== undefined && typeof full_name !== 'string') {
    return NextResponse.json(
      { error: 'full_name must be a string.' },
      { status: 400 },
    )
  }

  // Length validation
  if (email.length === 0 || password.length === 0) {
    return NextResponse.json(
      { error: 'Email and password are required.' },
      { status: 400 },
    )
  }

  if (email.length > 254) {
    return NextResponse.json(
      { error: 'Email is too long. Please use 254 characters or fewer.' },
      { status: 400 },
    )
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: 'Password must be at least 8 characters.' },
      { status: 400 },
    )
  }

  if (password.length > 128) {
    return NextResponse.json(
      { error: 'Password is too long. Please use 128 characters or fewer.' },
      { status: 400 },
    )
  }

  if (full_name && full_name.length > 100) {
    return NextResponse.json(
      { error: 'Name is too long. Please use 100 characters or fewer.' },
      { status: 400 },
    )
  }

  // Email format validation (RFC 5322 simplified)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return NextResponse.json(
      { error: 'Email format is invalid.' },
      { status: 400 },
    )
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json(
      { error: 'This email is already registered.' },
      { status: 409 },
    )
  }

  const hashedPassword = await bcrypt.hash(password, 12)

  const user = await prisma.user.create({
    data: {
      email,
      password:  hashedPassword,
      full_name: full_name ?? null,
      name:      full_name ?? null,
    },
  })

  return NextResponse.json(
    { id: user.id, email: user.email },
    { status: 201 },
  )
}
