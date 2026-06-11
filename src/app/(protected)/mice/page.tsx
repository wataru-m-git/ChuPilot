'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getMice, getCages, getStrains, bulkUpdateMice, bulkUpdateMiceMarkings } from '@/lib/db'
import type { Mouse, Cage, Strain } from '@/types'
import { GenotypeBadgeList } from '@/components/GenotypeBadge'

const DEFAULT_EAR_PUNCH_SEQUENCE = [
  '(0,0)', '(0,1)', '(1,0)', '(1,1)', '(0,2)', '(2,0)', '(1,2)', '(2,1)', '(2,2)',
]

export default function MicePage() {
  const router = useRouter()
  const [mice, setMice] = useState<Mouse[]>([])
  const [cages, setCages] = useState<Cage[]>([])
  const [strains, setStrains] = useState<Strain[]>([])
  const [search, setSearch] = useState('')
  const [filterSex, setFilterSex] = useState('')
  const [filterStatus, setFilterStatus] = useState('active')
  const [filterStrain, setFilterStrain] = useState('')
  const [filterCage, setFilterCage] = useState('')
  const [sortBy, setSortBy] = useState('name')
  const [sortDesc, setSortDesc] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const lastSelectedIndexRef = useRef<number | null>(null)
  const [showBulkEdit, setShowBulkEdit] = useState(false)
  const [bulkForm, setBulkForm] = useState({
    strain: '', sex: '', cage_id: '', status: '', birth_day: '',
    mother_id: '', father_id: '',
    genotypeEdits: [] as { key: string; value: string }[],
  })
  const [bulkSaving, setBulkSaving] = useState(false)
  const [bulkError, setBulkError] = useState('')
  const [bulkMarkingMode, setBulkMarkingMode] = useState<'none' | 'fixed' | 'sequential'>('none')
  const [bulkMarkingFixed, setBulkMarkingFixed] = useState('')
  const [bulkMarkingSeq, setBulkMarkingSeq] = useState<string[]>([...DEFAULT_EAR_PUNCH_SEQUENCE])
  const [bulkMarkingSeqStart, setBulkMarkingSeqStart] = useState(0)

  const fetchMice = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getMice({ search, sex: filterSex, status: filterStatus, strain: filterStrain, cage_id: filterCage, sort_by: sortBy, sort_desc: sortDesc })
      setMice(data)
      setSelectedIds(new Set())
    } finally {
      setLoading(false)
    }
  }, [search, filterSex, filterStatus, filterStrain, filterCage, sortBy, sortDesc])

  useEffect(() => { fetchMice() }, [fetchMice])
  useEffect(() => {
    getCages().then(setCages)
    getStrains().then(setStrains)
  }, [])

  const handleSort = (col: string) => {
    if (sortBy === col) setSortDesc(!sortDesc)
    else { setSortBy(col); setSortDesc(false) }
  }

  const toggleSelect = (id: number, index: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (e.shiftKey && lastSelectedIndexRef.current !== null) {
      const start = Math.min(lastSelectedIndexRef.current, index)
      const end = Math.max(lastSelectedIndexRef.current, index)
      const rangeIds = mice.slice(start, end + 1).map((m) => m.id)
      setSelectedIds((prev) => { const next = new Set(prev); rangeIds.forEach((rid) => next.add(rid)); return next })
    } else {
      setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
      lastSelectedIndexRef.current = index
    }
  }
  const toggleSelectAll = () => {
    setSelectedIds(selectedIds.size === mice.length ? new Set() : new Set(mice.map((m) => m.id)))
    lastSelectedIndexRef.current = null
  }

  const handleBulkEdit = async () => {
    setBulkError('')
    setBulkSaving(true)
    try {
      // Validate genotype entries
      for (let i = 0; i < bulkForm.genotypeEdits.length; i++) {
        const edit = bulkForm.genotypeEdits[i]
        if (edit.key && !edit.value) {
          setBulkError(`遺伝型 ${i + 1} 行目：遺伝型名「${edit.key}」の値を選択してください`)
          setBulkSaving(false)
          return
        }
        if (!edit.key && edit.value) {
          setBulkError(`遺伝型 ${i + 1} 行目：値が選択されていますが、遺伝型名がありません`)
          setBulkSaving(false)
          return
        }
      }

      const data: Record<string, unknown> = {}
      if (bulkForm.strain !== '') data.strain = bulkForm.strain || null
      if (bulkForm.sex !== '') data.sex = bulkForm.sex || null
      if (bulkForm.cage_id !== '') data.cage_id = Number(bulkForm.cage_id) || null
      if (bulkForm.status !== '') data.status = bulkForm.status
      if (bulkForm.birth_day !== '') data.birth_day = bulkForm.birth_day || null
      if (bulkForm.mother_id !== '') data.mother_id = bulkForm.mother_id || null
      if (bulkForm.father_id !== '') data.father_id = bulkForm.father_id || null
      if (bulkForm.genotypeEdits.length > 0) {
        const genotypes: Record<string, string | null> = {}
        for (const edit of bulkForm.genotypeEdits) {
          if (edit.key && edit.value !== '') {
            genotypes[edit.key] = edit.value === 'null' ? null : edit.value
          }
        }
        if (Object.keys(genotypes).length > 0) data.genotypes = genotypes
      }

      // Fixed marking
      if (bulkMarkingMode === 'fixed') {
        data.marking = bulkMarkingFixed || null
      }

      // Check for changes
      const hasSequentialMarking = bulkMarkingMode === 'sequential'
      if (Object.keys(data).length === 0 && !hasSequentialMarking) {
        setBulkError('変更する項目を1つ以上選択してください')
        setBulkSaving(false)
        return
      }

      // Sort selected IDs by display order (for sequential marking)
      const sortedSelectedIds = mice.filter((m) => selectedIds.has(m.id)).map((m) => m.id)

      if (hasSequentialMarking) {
        // Build sequence starting from the selected start position
        const seqArr = [
          ...bulkMarkingSeq.slice(bulkMarkingSeqStart),
          ...bulkMarkingSeq.slice(0, bulkMarkingSeqStart),
        ]
        const markingUpdates = sortedSelectedIds.map((id, i) => ({
          id,
          marking: seqArr[i % seqArr.length] || null,
        }))

        // Do other bulk updates if any
        if (Object.keys(data).length > 0) {
          await bulkUpdateMice(sortedSelectedIds, data as Partial<Mouse>)
        }
        // Sequential marking updates
        await bulkUpdateMiceMarkings(markingUpdates)
      } else {
        await bulkUpdateMice(Array.from(selectedIds), data as Partial<Mouse>)
      }

      setShowBulkEdit(false)
      setBulkForm({ strain: '', sex: '', cage_id: '', status: '', birth_day: '', mother_id: '', father_id: '', genotypeEdits: [] })
      setBulkMarkingMode('none')
      setBulkMarkingFixed('')
      setBulkMarkingSeq([...DEFAULT_EAR_PUNCH_SEQUENCE])
      setBulkMarkingSeqStart(0)
      setSelectedIds(new Set())
      fetchMice()
    } catch (e: unknown) {
      setBulkError((e as Error).message || '一括編集に失敗しました')
    } finally { setBulkSaving(false) }
  }

  const SortIcon = ({ col }: { col: string }) =>
    sortBy !== col ? <span style={{ color: '#cbd5e0' }}> ↕</span> : <span style={{ color: '#4299e1' }}>{sortDesc ? ' ↓' : ' ↑'}</span>

  const allSelected = mice.length > 0 && selectedIds.size === mice.length
  const someSelected = selectedIds.size > 0 && selectedIds.size < mice.length

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.4rem', color: '#2d3748', margin: 0 }}>個体一覧</h2>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {selectedIds.size > 0 && (
            <button style={bulkEditBtnStyle} onClick={() => { setShowBulkEdit(true); setBulkError(''); setBulkForm({ strain: '', sex: '', cage_id: '', status: '', birth_day: '', mother_id: '', father_id: '', genotypeEdits: [] }); setBulkMarkingMode('none'); setBulkMarkingFixed(''); setBulkMarkingSeq([...DEFAULT_EAR_PUNCH_SEQUENCE]); setBulkMarkingSeqStart(0) }}>
              一括編集 ({selectedIds.size}件)
            </button>
          )}
          <button style={addBtnStyle} onClick={() => router.push('/mice/new')}>+ 新規登録</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <input style={searchStyle} placeholder="個体ID・系統名で検索..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select style={selectStyle} value={filterSex} onChange={(e) => setFilterSex(e.target.value)}>
          <option value="">性別: すべて</option>
          <option value="♂">♂ オス</option>
          <option value="♀">♀ メス</option>
        </select>
        <select style={selectStyle} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">状態: すべて</option>
          <option value="active">Active</option>
          <option value="disposed">処分済み</option>
        </select>
        <select style={selectStyle} value={filterStrain} onChange={(e) => setFilterStrain(e.target.value)}>
          <option value="">系統: すべて</option>
          {strains.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
        </select>
        <select style={selectStyle} value={filterCage} onChange={(e) => setFilterCage(e.target.value)}>
          <option value="">ケージ: すべて</option>
          {cages.map((c) => <option key={c.id} value={c.id}>{c.cage_id}</option>)}
        </select>
      </div>

      <div style={{ background: '#fff', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'auto' }}>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#718096' }}>読み込み中...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: '40px' }}>
                  <input type="checkbox" checked={allSelected} ref={(el) => { if (el) el.indeterminate = someSelected }} onChange={toggleSelectAll} onClick={(e) => e.stopPropagation()} />
                </th>
                {[
                  { key: 'name', label: '個体ID' }, { key: 'strain', label: '系統名' }, { key: 'sex', label: '性別' },
                  { key: 'birth_day', label: '生年月日' }, { key: 'weeks', label: '週齢' },
                  { key: null, label: '主要遺伝子型' }, { key: null, label: 'ケージ' }, { key: 'status', label: '状態' },
                ].map(({ key, label }) => (
                  <th key={label} style={{ ...thStyle, cursor: key ? 'pointer' : 'default' }} onClick={() => key && handleSort(key)}>
                    {label}{key && <SortIcon col={key} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mice.map((m, index) => {
                const isSelected = selectedIds.has(m.id)
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
                  <tr key={m.id} style={{ cursor: 'pointer', background: isSelected ? '#ebf8ff' : undefined }} onClick={() => router.push(`/mice/${m.id}`)}>
                    <td style={tdStyle} onClick={(e) => toggleSelect(m.id, index, e)}>
                      <input type="checkbox" checked={isSelected} onChange={() => {}} onClick={(e) => e.stopPropagation()} style={{ cursor: 'pointer' }} />
                    </td>
                    <td style={tdStyle}><strong>{m.name}</strong></td>
                    <td style={tdStyle}>{m.strain || '-'}</td>
                    <td style={{ ...tdStyle, fontSize: '1.1rem' }}>{m.sex || '-'}</td>
                    <td style={tdStyle}>{m.birth_day || '-'}</td>
                    <td style={tdStyle}>{m.weeks != null ? `${m.weeks}w` : '-'}</td>
                    <td style={tdStyle}><GenotypeBadgeList entries={genotypeEntries} /></td>
                    <td style={tdStyle}>{m.cage_label || '-'}</td>
                    <td style={tdStyle}>
                      <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', background: m.status === 'active' ? '#c6f6d5' : '#fed7d7', color: m.status === 'active' ? '#276749' : '#9b2c2c' }}>
                        {m.status === 'active' ? 'Active' : '処分済み'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#718096' }}>{mice.length} 件{selectedIds.size > 0 && ` / ${selectedIds.size} 件選択中`}</div>

      {showBulkEdit && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '10px', padding: '1.5rem', maxWidth: '800px', width: '95%', boxShadow: '0 8px 30px rgba(0,0,0,0.2)', maxHeight: '85vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: '0.5rem' }}>一括編集</h3>
            <p style={{ fontSize: '0.85rem', color: '#718096', marginBottom: '1rem' }}>{selectedIds.size}件の個体を一括編集します。変更する項目のみ入力してください。</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={bulkFieldStyle}><label style={bulkLabelStyle}>系統名</label>
                <select style={bulkInputStyle} value={bulkForm.strain} onChange={(e) => setBulkForm({ ...bulkForm, strain: e.target.value })}>
                  <option value="">（変更しない）</option>
                  {strains.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <div style={bulkFieldStyle}><label style={bulkLabelStyle}>性別</label>
                <select style={bulkInputStyle} value={bulkForm.sex} onChange={(e) => setBulkForm({ ...bulkForm, sex: e.target.value })}>
                  <option value="">（変更しない）</option>
                  <option value="♂">♂ オス</option>
                  <option value="♀">♀ メス</option>
                </select>
              </div>
              <div style={bulkFieldStyle}><label style={bulkLabelStyle}>生年月日</label>
                <input type="date" style={bulkInputStyle} value={bulkForm.birth_day} onChange={(e) => setBulkForm({ ...bulkForm, birth_day: e.target.value })} />
              </div>
              <div style={bulkFieldStyle}><label style={bulkLabelStyle}>ケージ</label>
                <select style={bulkInputStyle} value={bulkForm.cage_id} onChange={(e) => setBulkForm({ ...bulkForm, cage_id: e.target.value })}>
                  <option value="">（変更しない）</option>
                  <option value="0">未割当</option>
                  {cages.map((c) => <option key={c.id} value={c.id}>{c.cage_id} {c.strain ? `(${c.strain})` : ''}</option>)}
                </select>
              </div>
              <div style={bulkFieldStyle}><label style={bulkLabelStyle}>状態</label>
                <select style={bulkInputStyle} value={bulkForm.status} onChange={(e) => setBulkForm({ ...bulkForm, status: e.target.value })}>
                  <option value="">（変更しない）</option>
                  <option value="active">Active</option>
                  <option value="disposed">処分済み</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.75rem' }}>
              <div style={bulkFieldStyle}><label style={bulkLabelStyle}>母親ID</label>
                <input type="text" style={bulkInputStyle} placeholder="（変更しない）" value={bulkForm.mother_id} onChange={(e) => setBulkForm({ ...bulkForm, mother_id: e.target.value })} />
              </div>
              <div style={bulkFieldStyle}><label style={bulkLabelStyle}>父親ID</label>
                <input type="text" style={bulkInputStyle} placeholder="（変更しない）" value={bulkForm.father_id} onChange={(e) => setBulkForm({ ...bulkForm, father_id: e.target.value })} />
              </div>
            </div>
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#4a5568' }}>マーキング</label>
              </div>
              <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                {(['none', 'fixed', 'sequential'] as const).map((mode) => (
                  <label key={mode} style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', color: '#2d3748' }}>
                    <input type="radio" name="markingMode" checked={bulkMarkingMode === mode} onChange={() => setBulkMarkingMode(mode)} />
                    {mode === 'none' ? '変更しない' : mode === 'fixed' ? '一律変更' : '連番入力'}
                  </label>
                ))}
              </div>
              {bulkMarkingMode === 'fixed' && (
                <input type="text" style={bulkInputStyle} placeholder="例：(0,0) ― 空欄の場合はクリア" value={bulkMarkingFixed} onChange={(e) => setBulkMarkingFixed(e.target.value)} />
              )}
              {bulkMarkingMode === 'sequential' && (
                <div>
                  <p style={{ fontSize: '0.75rem', color: '#718096', marginTop: 0, marginBottom: '0.5rem' }}>
                    {selectedIds.size}件の個体に表示順で連番マーキングを割り当てます
                  </p>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.5rem', alignItems: 'center' }}>
                    {bulkMarkingSeq.map((entry, idx) => (
                      <input key={idx} type="text" style={{ ...bulkInputStyle, width: '68px', textAlign: 'center' }} value={entry} onChange={(e) => { const next = [...bulkMarkingSeq]; next[idx] = e.target.value; setBulkMarkingSeq(next) }} />
                    ))}
                    <button style={{ padding: '0.35rem 0.7rem', background: '#718096', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }} onClick={() => setBulkMarkingSeq([...DEFAULT_EAR_PUNCH_SEQUENCE])}>
                      リセット
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <label style={{ fontSize: '0.75rem', color: '#718096', whiteSpace: 'nowrap' }}>開始位置:</label>
                    <select style={{ ...bulkInputStyle, fontSize: '0.8rem' }} value={bulkMarkingSeqStart} onChange={(e) => setBulkMarkingSeqStart(Number(e.target.value))}>
                      {bulkMarkingSeq.map((entry, idx) => (
                        <option key={idx} value={idx}>{idx + 1}番目: {entry}</option>
                      ))}
                    </select>
                  </div>
                  {(() => {
                    const seqArr = [...bulkMarkingSeq.slice(bulkMarkingSeqStart), ...bulkMarkingSeq.slice(0, bulkMarkingSeqStart)]
                    const previewMice = mice.filter((m) => selectedIds.has(m.id)).slice(0, 5)
                    return (
                      <div style={{ background: '#f7fafc', borderRadius: '6px', padding: '0.5rem 0.75rem', fontSize: '0.75rem', color: '#4a5568' }}>
                        <span style={{ fontWeight: 600 }}>プレビュー: </span>
                        {previewMice.map((m, i) => (
                          <span key={m.id} style={{ margin: '0 0.3rem' }}>
                            {m.name}→<strong>{seqArr[i % seqArr.length]}</strong>
                          </span>
                        ))}
                        {selectedIds.size > 5 && <span style={{ color: '#a0aec0' }}>…他{selectedIds.size - 5}件</span>}
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#4a5568' }}>genotype</label>
                <button style={{ padding: '0.3rem 0.75rem', background: '#4299e1', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }} onClick={() => setBulkForm({ ...bulkForm, genotypeEdits: [...bulkForm.genotypeEdits, { key: '', value: '' }] })}>+ 追加</button>
              </div>
              {bulkForm.genotypeEdits.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {bulkForm.genotypeEdits.map((edit, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <label style={{ fontSize: '0.7rem', color: '#718096', fontWeight: 500 }}>遺伝型名</label>
                        <input type="text" style={bulkInputStyle} placeholder="例：Foxn1Cre" value={edit.key} onChange={(e) => { const newEdits = [...bulkForm.genotypeEdits]; newEdits[idx].key = e.target.value; setBulkForm({ ...bulkForm, genotypeEdits: newEdits }) }} />
                      </div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <label style={{ fontSize: '0.7rem', color: '#718096', fontWeight: 500 }}>値</label>
                        <select style={bulkInputStyle} value={edit.value} onChange={(e) => { const newEdits = [...bulkForm.genotypeEdits]; newEdits[idx].value = e.target.value; setBulkForm({ ...bulkForm, genotypeEdits: newEdits }) }}>
                          <option value="">（選択）</option>
                          <option value="homo">homo</option>
                          <option value="hetero">hetero</option>
                          <option value="null">null</option>
                        </select>
                      </div>
                      <button style={{ padding: '0.4rem 0.5rem', background: '#e53e3e', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, marginTop: '1.45rem' }} onClick={() => { const newEdits = bulkForm.genotypeEdits.filter((_, i) => i !== idx); setBulkForm({ ...bulkForm, genotypeEdits: newEdits }) }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {bulkError && <p style={{ color: '#e53e3e', fontSize: '0.85rem', marginTop: '0.75rem' }}>{bulkError}</p>}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button style={cancelBtnStyle} onClick={() => setShowBulkEdit(false)}>キャンセル</button>
              <button style={saveBtnStyle} onClick={handleBulkEdit} disabled={bulkSaving}>{bulkSaving ? '更新中...' : '一括更新'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const thStyle: React.CSSProperties = { textAlign: 'left', padding: '0.75rem 1rem', background: '#f7fafc', borderBottom: '2px solid #e2e8f0', fontSize: '0.82rem', color: '#718096', whiteSpace: 'nowrap', userSelect: 'none' }
const tdStyle: React.CSSProperties = { padding: '0.65rem 1rem', borderBottom: '1px solid #e2e8f0', fontSize: '0.88rem', color: '#2d3748' }
const searchStyle: React.CSSProperties = { padding: '0.5rem 0.75rem', border: '1px solid #cbd5e0', borderRadius: '6px', fontSize: '0.9rem', minWidth: '200px' }
const selectStyle: React.CSSProperties = { padding: '0.5rem 0.75rem', border: '1px solid #cbd5e0', borderRadius: '6px', fontSize: '0.9rem' }
const addBtnStyle: React.CSSProperties = { padding: '0.5rem 1rem', background: '#4299e1', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }
const bulkEditBtnStyle: React.CSSProperties = { padding: '0.5rem 1rem', background: '#ed8936', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }
const bulkFieldStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.25rem' }
const bulkLabelStyle: React.CSSProperties = { fontSize: '0.8rem', fontWeight: 600, color: '#4a5568' }
const bulkInputStyle: React.CSSProperties = { padding: '0.5rem 0.75rem', border: '1px solid #cbd5e0', borderRadius: '6px', fontSize: '0.88rem' }
const cancelBtnStyle: React.CSSProperties = { padding: '0.5rem 1rem', background: '#e2e8f0', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }
const saveBtnStyle: React.CSSProperties = { padding: '0.5rem 1rem', background: '#4299e1', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }
