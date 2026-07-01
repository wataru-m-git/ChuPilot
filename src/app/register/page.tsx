'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useI18n } from '@/i18n/I18nProvider'

export default function RegisterPage() {
  const { t } = useI18n()
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
        setError(data.error || t('register.registerFailed'))
      } else {
        router.push('/login')
      }
    } catch {
      setError(t('register.networkError'))
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7fafc' }}>
      <div style={{ background: '#fff', borderRadius: '10px', padding: '2rem', width: '100%', maxWidth: '400px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <h1 style={{ fontSize: '1.5rem', color: '#2d3748', marginBottom: '1.5rem', textAlign: 'center' }}>{t('register.title')}</h1>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>{t('register.fullName')}</label>
            <input style={inputStyle} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t('register.fullNamePlaceholder')} />
          </div>
          <div>
            <label style={labelStyle}>{t('register.email')}</label>
            <input style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <div>
            <label style={labelStyle}>{t('register.password')}</label>
            <input style={inputStyle} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </div>
          {error && <p style={{ color: '#e53e3e', fontSize: '0.85rem' }}>{error}</p>}
          <button type="submit" disabled={loading} style={btnStyle}>
            {loading ? t('register.registering') : t('register.register')}
          </button>
        </form>
        <p style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.85rem', color: '#718096' }}>
          {t('register.haveAccount')} <Link href="/login" style={{ color: '#4299e1' }}>{t('register.logIn')}</Link>
        </p>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#4a5568', marginBottom: '0.3rem' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '0.6rem 0.75rem', border: '1px solid #cbd5e0', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box' }
const btnStyle: React.CSSProperties = { padding: '0.7rem', background: '#4299e1', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem' }
