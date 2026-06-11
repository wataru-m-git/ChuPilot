'use client'
import { useEffect, useState } from 'react'
import { getDashboardSummary } from '@/lib/db'

type Summary = Awaited<ReturnType<typeof getDashboardSummary>>

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null)

  useEffect(() => { getDashboardSummary().then(setSummary) }, [])

  if (!summary) return <div style={{ padding: '2rem', color: '#718096' }}>読み込み中...</div>

  return (
    <div style={{ padding: '1.5rem' }}>
      <h2 style={{ fontSize: '1.4rem', marginBottom: '1.5rem', color: '#2d3748' }}>ダッシュボード</h2>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
        <StatCard label="総個体数（active）" value={summary.totalActive} color="#4299e1" />
        <StatCard label="ケージ数" value={summary.totalCages} color="#48bb78" />
        <StatCard label="オス" value={summary.maleCount} color="#667eea" />
        <StatCard label="メス" value={summary.femaleCount} color="#ed64a6" />
      </div>
      <div style={{ background: '#fff', borderRadius: '8px', padding: '1.2rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: '#4a5568' }}>系統別個体数</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>系統名</th>
              <th style={thStyle}>個体数</th>
            </tr>
          </thead>
          <tbody>
            {summary.byStrain.map((row) => (
              <tr key={row.strain}>
                <td style={tdStyle}>{row.strain}</td>
                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{row.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: '8px', padding: '1.2rem 1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', minWidth: '160px', flex: '1', borderTop: `4px solid ${color}` }}>
      <div style={{ fontSize: '2rem', fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: '0.85rem', color: '#718096', marginTop: '0.2rem' }}>{label}</div>
    </div>
  )
}

const thStyle: React.CSSProperties = { textAlign: 'left', padding: '0.5rem 0.75rem', background: '#f7fafc', borderBottom: '2px solid #e2e8f0', fontSize: '0.85rem', color: '#718096' }
const tdStyle: React.CSSProperties = { padding: '0.5rem 0.75rem', borderBottom: '1px solid #e2e8f0', fontSize: '0.9rem' }
