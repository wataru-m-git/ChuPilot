import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  const allowSelfRegistration = process.env.ALLOW_SELF_REGISTRATION === 'true'

  if (!allowSelfRegistration) {
    // セルフ登録無効時は認証済みセッションが必要（管理者による招待登録）
    const session = await auth()
    if (!session) {
      return NextResponse.json(
        { error: 'ユーザー登録は管理者のみ実行できます。ログイン後に操作してください。' },
        { status: 403 },
      )
    }
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'リクエストボディが不正です。' }, { status: 400 })
  }

  // Validate input types
  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'リクエストボディが不正です。' }, { status: 400 })
  }

  const bodyObj = body as Record<string, unknown>
  const email = bodyObj.email
  const password = bodyObj.password
  const full_name = bodyObj.full_name

  // Type checks
  if (typeof email !== 'string' || typeof password !== 'string') {
    return NextResponse.json(
      { error: 'email と password は必須です。' },
      { status: 400 },
    )
  }

  if (full_name !== undefined && typeof full_name !== 'string') {
    return NextResponse.json(
      { error: 'full_name は文字列である必要があります。' },
      { status: 400 },
    )
  }

  // Length validation
  if (email.length === 0 || password.length === 0) {
    return NextResponse.json(
      { error: 'email と password は必須です。' },
      { status: 400 },
    )
  }

  if (email.length > 254) {
    return NextResponse.json(
      { error: 'メールアドレスが長すぎます。254文字以下にしてください。' },
      { status: 400 },
    )
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: 'パスワードは8文字以上で入力してください。' },
      { status: 400 },
    )
  }

  if (password.length > 128) {
    return NextResponse.json(
      { error: 'パスワードが長すぎます。128文字以下にしてください。' },
      { status: 400 },
    )
  }

  if (full_name && full_name.length > 100) {
    return NextResponse.json(
      { error: '名前が長すぎます。100文字以下にしてください。' },
      { status: 400 },
    )
  }

  // Email format validation (RFC 5322 simplified)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return NextResponse.json(
      { error: 'メールアドレスの形式が正しくありません。' },
      { status: 400 },
    )
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json(
      { error: 'このメールアドレスは既に登録されています。' },
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
