'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name: fullName }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '登録に失敗しました')
      } else {
        router.push('/login')
      }
    } catch {
      setError('通信エラーが発生しました')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7fafc' }}>
      <div style={{ background: '#fff', borderRadius: '10px', padding: '2rem', width: '100%', maxWidth: '400px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <h1 style={{ fontSize: '1.5rem', color: '#2d3748', marginBottom: '1.5rem', textAlign: 'center' }}>新規ユーザー登録</h1>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>氏名</label>
            <input style={inputStyle} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="山田 太郎" />
          </div>
          <div>
            <label style={labelStyle}>メールアドレス *</label>
            <input style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <div>
            <label style={labelStyle}>パスワード *</label>
            <input style={inputStyle} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </div>
          {error && <p style={{ color: '#e53e3e', fontSize: '0.85rem' }}>{error}</p>}
          <button type="submit" disabled={loading} style={btnStyle}>
            {loading ? '登録中...' : '登録'}
          </button>
        </form>
        <p style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.85rem', color: '#718096' }}>
          すでにアカウントがある場合は <Link href="/login" style={{ color: '#4299e1' }}>ログイン</Link>
        </p>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#4a5568', marginBottom: '0.3rem' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '0.6rem 0.75rem', border: '1px solid #cbd5e0', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box' }
const btnStyle: React.CSSProperties = { padding: '0.7rem', background: '#4299e1', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem' }
