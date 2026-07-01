'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getMice } from '@/lib/db'
import type { Mouse } from '@/types'
import { GenotypeBadgeList } from '@/components/GenotypeBadge'
import { useI18n } from '@/i18n/I18nProvider'

export default function DisposedMicePage() {
  const { t } = useI18n()
  const router = useRouter()
  const [mice, setMice] = useState<Mouse[]>([])
  const [loading, setLoading] = useState(false)
  const [sortBy, setSortBy] = useState('name')
  const [sortDesc, setSortDesc] = useState(false)

  const fetchMice = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getMice({ status: 'disposed', sort_by: sortBy, sort_desc: sortDesc })
      setMice(data)
    } finally {
      setLoading(false)
    }
  }, [sortBy, sortDesc])

  useEffect(() => {
    fetchMice()
  }, [fetchMice])

  const handleSort = (col: string) => {
    if (sortBy === col) setSortDesc(!sortDesc)
    else {
      setSortBy(col)
      setSortDesc(false)
    }
  }

  const parseDisposeNote = (notes: string | null): { date: string; reason: string } => {
    if (!notes) return { date: t('miceDisposed.unknown'), reason: '' }
    const match = notes.match(/^(\d{4}-\d{2}-\d{2})処分\s*(.*)$/)
    if (match) {
      return { date: match[1], reason: match[2] || '-' }
    }
    return { date: t('miceDisposed.unknown'), reason: notes }
  }

  const SortIcon = ({ col }: { col: string }) =>
    sortBy !== col ? <span style={{ color: '#cbd5e0' }}> ↕</span> : <span style={{ color: '#4299e1' }}>{sortDesc ? ' ↓' : ' ↑'}</span>

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.4rem', color: '#2d3748', margin: 0 }}>{t('miceDisposed.title')}</h2>
      </div>

      <div style={{ background: '#fff', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'auto' }}>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#718096' }}>{t('common.loading')}</div>
        ) : mice.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#718096' }}>{t('miceDisposed.empty')}</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {[
                  { key: 'name', label: t('miceDisposed.colId') },
                  { key: 'strain', label: t('miceDisposed.colStrain') },
                  { key: 'sex', label: t('miceDisposed.colSex') },
                  { key: 'birth_day', label: t('miceDisposed.colBirthDate') },
                  { key: null, label: t('miceDisposed.colGenotype') },
                  { key: null, label: t('miceDisposed.colDisposalDate') },
                  { key: null, label: t('miceDisposed.colDisposalReason') },
                ].map(({ key, label }) => (
                  <th key={label} style={{ ...thStyle, cursor: key ? 'pointer' : 'default' }} onClick={() => key && handleSort(key)}>
                    {label}{key && <SortIcon col={key} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mice.map((m) => {
                const { date: disposeDate, reason: disposeReason } = parseDisposeNote(m.notes)
                const genotypeEntries = m.genotypes && Object.keys(m.genotypes).length > 0
                  ? Object.entries(m.genotypes).map(([k, v]) => ({ key: k, value: v }))
                  : []
                return (
                  <tr key={m.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/mice/${m.id}`)}>
                    <td style={tdStyle}><strong>{m.name}</strong></td>
                    <td style={tdStyle}>{m.strain || '-'}</td>
                    <td style={{ ...tdStyle, fontSize: '1.1rem' }}>{m.sex || '-'}</td>
                    <td style={tdStyle}>{m.birth_day || '-'}</td>
                    <td style={tdStyle}><GenotypeBadgeList entries={genotypeEntries} /></td>
                    <td style={tdStyle}>{disposeDate}</td>
                    <td style={tdStyle}>{disposeReason}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#718096' }}>{t('miceDisposed.count', { n: mice.length })}</div>
    </div>
  )
}

const thStyle: React.CSSProperties = { textAlign: 'left', padding: '0.75rem 1rem', background: '#f7fafc', borderBottom: '2px solid #e2e8f0', fontSize: '0.82rem', color: '#718096', whiteSpace: 'nowrap', userSelect: 'none' }
const tdStyle: React.CSSProperties = { padding: '0.65rem 1rem', borderBottom: '1px solid #e2e8f0', fontSize: '0.88rem', color: '#2d3748' }
