'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getMice } from '@/lib/db'
import type { Mouse } from '@/types'
import { GenotypeBadgeList } from '@/components/GenotypeBadge'
import { GENOTYPE_FIELDS } from '@/types'

export default function DisposedMicePage() {
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
    if (!notes) return { date: '不明', reason: '' }
    const match = notes.match(/^(\d{4}-\d{2}-\d{2})処分\s*(.*)$/)
    if (match) {
      return { date: match[1], reason: match[2] || '-' }
    }
    return { date: '不明', reason: notes }
  }

  const SortIcon = ({ col }: { col: string }) =>
    sortBy !== col ? <span style={{ color: '#cbd5e0' }}> ↕</span> : <span style={{ color: '#4299e1' }}>{sortDesc ? ' ↓' : ' ↑'}</span>

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.4rem', color: '#2d3748', margin: 0 }}>処分済み個体</h2>
      </div>

      <div style={{ background: '#fff', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'auto' }}>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#718096' }}>読み込み中...</div>
        ) : mice.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#718096' }}>処分済み個体はありません</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {[
                  { key: 'name', label: '個体ID' },
                  { key: 'strain', label: '系統名' },
                  { key: 'sex', label: '性別' },
                  { key: 'birth_day', label: '生年月日' },
                  { key: null, label: '遺伝子型' },
                  { key: null, label: '処分日' },
                  { key: null, label: '処分理由' },
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
                  : (() => {
                      const fields = [
                        { key: 'genotype_Ehf_cKO', label: 'Ehf_cKO' }, { key: 'genotype_CMV_Ehf_flox', label: 'CMV_Ehf_flox' },
                        { key: 'genotype_CMV_Elf3_flox', label: 'CMV_Elf3#8_flox' }, { key: 'genotype_Ascl1CreERT2', label: 'Ascl1CreERT2' },
                        { key: 'genotype_Foxn1Cre', label: 'Foxn1Cre' }, { key: 'genotype_Fabp4Cre_RFP', label: 'Fabp4Cre<RFP>' },
                        { key: 'genotype_Elf3Flox', label: 'Elf3Flox' },
                      ] as const
                      return fields.filter((f) => m[f.key as keyof Mouse]).map((f) => ({ key: f.label, value: m[f.key as keyof Mouse] as string }))
                    })()
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
      <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#718096' }}>{mice.length} 件</div>
    </div>
  )
}

const thStyle: React.CSSProperties = { textAlign: 'left', padding: '0.75rem 1rem', background: '#f7fafc', borderBottom: '2px solid #e2e8f0', fontSize: '0.82rem', color: '#718096', whiteSpace: 'nowrap', userSelect: 'none' }
const tdStyle: React.CSSProperties = { padding: '0.65rem 1rem', borderBottom: '1px solid #e2e8f0', fontSize: '0.88rem', color: '#2d3748' }
