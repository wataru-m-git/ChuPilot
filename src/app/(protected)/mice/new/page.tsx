'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getCages, getStrains, bulkCreateMice } from '@/lib/db'
import type { Cage, Strain } from '@/types'
import { GENOTYPE_OPTIONS, getGenotypeNamesFromStrain } from '@/types'

const DEFAULT_EAR_PUNCH_SEQUENCE = [
  '(0,0)', '(0,1)', '(1,0)', '(1,1)', '(0,2)', '(2,0)', '(1,2)', '(2,1)', '(2,2)',
]

interface MouseRow {
  name: string
  sex: string
  birth_day: string
  color: string
  marking: string
  cage_id: string
  mother_id: string
  father_id: string
  genotypes: Record<string, string | null>
  typing_date: string
  notes: string
}

const emptyRow = (): MouseRow => ({
  name: '',
  sex: '',
  birth_day: '',
  color: '',
  marking: '',
  cage_id: '',
  mother_id: '',
  father_id: '',
  genotypes: {},
  typing_date: '',
  notes: '',
})

type Step = 1 | 2

export default function MouseBulkRegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)

  // Step 1 state
  const [count, setCount] = useState(1)
  const [selectedStrain, setSelectedStrain] = useState('')
  const [strains, setStrains] = useState<Strain[]>([])
  const [cages, setCages] = useState<Cage[]>([])

  // Step 2 state
  const [rows, setRows] = useState<MouseRow[]>([])
  const [sharedBirthDay, setSharedBirthDay] = useState('')
  const [sharedCageId, setSharedCageId] = useState('')
  const [sharedSex, setSharedSex] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showGenotypes, setShowGenotypes] = useState(false)

  // Auto-fill options
  const [autoFillName, setAutoFillName] = useState(false)
  const [autoFillMarking, setAutoFillMarking] = useState(false)
  const [earPunchSequence, setEarPunchSequence] = useState<string[]>([...DEFAULT_EAR_PUNCH_SEQUENCE])

  useEffect(() => {
    getStrains().then(setStrains)
    getCages().then(setCages)
  }, [])

  const handleStep1Next = () => {
    if (count < 1 || count > 50) {
      setError('匹数は1〜50の範囲で入力してください')
      return
    }
    setError('')
    const newRows = Array.from({ length: count }, () => emptyRow())
    setRows(newRows)
    setStep(2)
  }

  const updateRow = (idx: number, key: keyof MouseRow, val: string) => {
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, [key]: val } : r))
  }

  // Extract prefix and trailing number from a name string
  const parseNameForAutoFill = (val: string) => val.trim().match(/^(.*?)(\d+)$/)

  // Handle row 0 name change with auto-fill
  const handleRow0NameChange = (val: string) => {
    if (autoFillName) {
      const match = parseNameForAutoFill(val)
      if (match) {
        const prefix = match[1]
        const numStr = match[2]
        const baseNum = parseInt(numStr)
        const padLen = numStr.length
        setRows((prev) =>
          prev.map((r, i) => ({
            ...r,
            name: i === 0 ? val : `${prefix}${String(baseNum + i).padStart(padLen, '0')}`,
          }))
        )
        return
      }
    }
    updateRow(0, 'name', val)
  }

  // Toggle name auto-fill — apply immediately if row 0 is valid
  const toggleAutoFillName = (enabled: boolean) => {
    setAutoFillName(enabled)
    if (enabled) {
      const firstName = rows[0]?.name.trim() ?? ''
      const match = parseNameForAutoFill(firstName)
      if (match) {
        const prefix = match[1]
        const numStr = match[2]
        const baseNum = parseInt(numStr)
        const padLen = numStr.length
        setRows((prev) =>
          prev.map((r, i) => ({
            ...r,
            name: i === 0 ? firstName : `${prefix}${String(baseNum + i).padStart(padLen, '0')}`,
          }))
        )
      }
    }
  }

  // Apply ear punch sequence to all rows
  const applyMarkingAutoFill = (seq: string[]) => {
    if (seq.length === 0) return
    setRows((prev) => prev.map((r, i) => ({ ...r, marking: seq[i % seq.length] })))
  }

  // Toggle marking auto-fill
  const toggleAutoFillMarking = (enabled: boolean) => {
    setAutoFillMarking(enabled)
    if (enabled) {
      applyMarkingAutoFill(earPunchSequence)
    }
  }

  // Update a single entry in the ear punch sequence
  const updateEarPunchEntry = (idx: number, val: string) => {
    const next = [...earPunchSequence]
    next[idx] = val
    setEarPunchSequence(next)
    if (autoFillMarking) {
      if (next.length === 0) return
      setRows((prev) => prev.map((r, i) => ({ ...r, marking: next[i % next.length] })))
    }
  }

  // Apply shared values to all rows
  const applyShared = () => {
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        ...(sharedBirthDay ? { birth_day: sharedBirthDay } : {}),
        ...(sharedCageId ? { cage_id: sharedCageId } : {}),
        ...(sharedSex ? { sex: sharedSex } : {}),
      }))
    )
  }

  const handleSubmit = async () => {
    setError('')

    for (let i = 0; i < rows.length; i++) {
      if (!rows[i].name.trim()) {
        setError(`${i + 1}行目の個体IDを入力してください`)
        return
      }
    }

    const names = rows.map((r) => r.name.trim())
    const uniqueNames = new Set(names)
    if (uniqueNames.size !== names.length) {
      setError('個体ID内に重複があります')
      return
    }

    setSaving(true)
    try {
      const payload = rows.map((r) => {
        const item: Record<string, unknown> = {
          name: r.name.trim(),
          strain: selectedStrain || null,
          status: 'active',
        }
        if (r.sex) item.sex = r.sex
        if (r.birth_day) item.birth_day = r.birth_day
        if (r.color) item.color = r.color
        if (r.marking) item.marking = r.marking
        if (r.cage_id) item.cage_id = Number(r.cage_id)
        if (r.mother_id) item.mother_id = r.mother_id
        if (r.father_id) item.father_id = r.father_id
        if (r.typing_date) item.typing_date = r.typing_date
        if (r.notes) item.notes = r.notes
        if (r.genotypes && Object.keys(r.genotypes).length > 0) item.genotypes = r.genotypes
        return item
      })
      await bulkCreateMice(payload as Parameters<typeof bulkCreateMice>[0])
      router.push('/mice')
    } catch (e: unknown) {
      setError((e as Error).message || '登録に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  if (step === 1) {
    return (
      <div style={styles.container}>
        <h2 style={styles.title}>個体一括登録</h2>
        <div style={styles.step1Card}>
          <h3 style={styles.step1Title}>Step 1 : 匹数と系統の選択</h3>
          <div style={styles.step1Grid}>
            <div style={styles.step1Field}>
              <label style={styles.label}>登録匹数 *</label>
              <input
                type="number"
                style={styles.input}
                value={count}
                min={1}
                max={50}
                onChange={(e) => setCount(Number(e.target.value))}
              />
            </div>
            <div style={styles.step1Field}>
              <label style={styles.label}>系統名</label>
              <select style={styles.input} value={selectedStrain} onChange={(e) => setSelectedStrain(e.target.value)}>
                <option value="">（なし）</option>
                {strains.map((s) => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
          {error && <p style={styles.errText}>{error}</p>}
          <div style={styles.step1Actions}>
            <button style={styles.cancelBtn} onClick={() => router.push('/mice')}>キャンセル</button>
            <button style={styles.nextBtn} onClick={handleStep1Next}>次へ →</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>個体一括登録</h2>
          <p style={styles.subtitle}>
            系統: <strong>{selectedStrain || '（なし）'}</strong> / {rows.length}匹
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button style={styles.cancelBtn} onClick={() => setStep(1)}>← 戻る</button>
        </div>
      </div>

      {/* Shared values quick-fill */}
      <div style={styles.sharedPanel}>
        <span style={styles.sharedTitle}>一括入力</span>
        <select style={styles.sharedInput} value={sharedSex} onChange={(e) => setSharedSex(e.target.value)}>
          <option value="">性別...</option>
          <option value="♂">♂ オス</option>
          <option value="♀">♀ メス</option>
        </select>
        <input type="date" style={styles.sharedInput} value={sharedBirthDay}
          onChange={(e) => setSharedBirthDay(e.target.value)} placeholder="生年月日..." />
        <select style={styles.sharedInput} value={sharedCageId} onChange={(e) => setSharedCageId(e.target.value)}>
          <option value="">ケージ...</option>
          {cages.map((c) => (
            <option key={c.id} value={c.id}>{c.cage_id} {c.strain ? `(${c.strain})` : ''}</option>
          ))}
        </select>
        <button style={styles.applyBtn} onClick={applyShared}>全行に適用</button>
        <button
          style={{ ...styles.applyBtn, background: showGenotypes ? '#553c9a' : '#805ad5' }}
          onClick={() => setShowGenotypes(!showGenotypes)}
        >
          {showGenotypes ? '遺伝子型を隠す' : '遺伝子型を表示'}
        </button>
      </div>

      {/* Auto-fill options */}
      <div style={styles.autoFillPanel}>
        <span style={styles.sharedTitle}>自動入力</span>
        <label style={styles.toggleLabel}>
          <input
            type="checkbox"
            checked={autoFillName}
            onChange={(e) => toggleAutoFillName(e.target.checked)}
          />
          <span>個体番号を連番入力</span>
          <span style={styles.toggleHint}>（最上段に数字を含む番号を入力すると以降を自動連番）</span>
        </label>
        <label style={styles.toggleLabel}>
          <input
            type="checkbox"
            checked={autoFillMarking}
            onChange={(e) => toggleAutoFillMarking(e.target.checked)}
          />
          <span>耳パンチを自動入力</span>
          <span style={styles.toggleHint}>（下の順番に従って自動入力）</span>
        </label>
      </div>

      {/* Table */}
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>#</th>
              <th style={styles.th}>個体ID *</th>
              <th style={styles.th}>性別</th>
              <th style={styles.th}>生年月日</th>
              <th style={styles.th}>毛色</th>
              <th style={styles.th}>マーキング</th>
              <th style={styles.th}>ケージ</th>
              <th style={styles.th}>母親ID</th>
              <th style={styles.th}>父親ID</th>
              {showGenotypes && getGenotypeNamesFromStrain(selectedStrain).map((name) => (
                <th key={name} style={styles.th}>{name}</th>
              ))}
              {showGenotypes && <th style={styles.th}>判定日</th>}
              <th style={styles.th}>備考</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx}>
                <td style={styles.td}>{idx + 1}</td>
                <td style={styles.td}>
                  <input
                    style={styles.cellInput}
                    value={row.name}
                    onChange={(e) =>
                      idx === 0 ? handleRow0NameChange(e.target.value) : updateRow(idx, 'name', e.target.value)
                    }
                    placeholder="例: WM_001"
                  />
                </td>
                <td style={styles.td}>
                  <select style={styles.cellInput} value={row.sex}
                    onChange={(e) => updateRow(idx, 'sex', e.target.value)}>
                    <option value="">-</option>
                    <option value="♂">♂</option>
                    <option value="♀">♀</option>
                  </select>
                </td>
                <td style={styles.td}>
                  <input type="date" style={styles.cellInput} value={row.birth_day}
                    onChange={(e) => updateRow(idx, 'birth_day', e.target.value)} />
                </td>
                <td style={styles.td}>
                  <input style={styles.cellInput} value={row.color}
                    onChange={(e) => updateRow(idx, 'color', e.target.value)} placeholder="BL" />
                </td>
                <td style={styles.td}>
                  <input style={styles.cellInput} value={row.marking}
                    onChange={(e) => updateRow(idx, 'marking', e.target.value)} placeholder="(0,0)" />
                </td>
                <td style={styles.td}>
                  <select style={styles.cellInput} value={row.cage_id}
                    onChange={(e) => updateRow(idx, 'cage_id', e.target.value)}>
                    <option value="">未割当</option>
                    {cages.map((c) => (
                      <option key={c.id} value={c.id}>{c.cage_id}</option>
                    ))}
                  </select>
                </td>
                <td style={styles.td}>
                  <input style={styles.cellInput} value={row.mother_id}
                    onChange={(e) => updateRow(idx, 'mother_id', e.target.value)} placeholder="母親ID" />
                </td>
                <td style={styles.td}>
                  <input style={styles.cellInput} value={row.father_id}
                    onChange={(e) => updateRow(idx, 'father_id', e.target.value)} placeholder="父親ID" />
                </td>
                {showGenotypes && getGenotypeNamesFromStrain(selectedStrain).map((name) => (
                  <td key={name} style={styles.td}>
                    <select
                      style={styles.cellInput}
                      value={row.genotypes[name] ?? ''}
                      onChange={(e) => {
                        const val = e.target.value || null
                        setRows((prev) => prev.map((r, i) =>
                          i === idx ? { ...r, genotypes: { ...r.genotypes, [name]: val } } : r
                        ))
                      }}
                    >
                      <option value="">-</option>
                      {GENOTYPE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </td>
                ))}
                {showGenotypes && (
                  <td style={styles.td}>
                    <input type="date" style={styles.cellInput} value={row.typing_date}
                      onChange={(e) => updateRow(idx, 'typing_date', e.target.value)} />
                  </td>
                )}
                <td style={styles.td}>
                  <input style={styles.cellInput} value={row.notes}
                    onChange={(e) => updateRow(idx, 'notes', e.target.value)} placeholder="備考" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && <p style={styles.errText}>{error}</p>}
      <div style={styles.actions}>
        <span style={{ fontSize: '0.85rem', color: '#718096' }}>{rows.length}匹を登録します</span>
        <button style={styles.cancelBtn} onClick={() => router.push('/mice')}>キャンセル</button>
        <button style={styles.submitBtn} onClick={handleSubmit} disabled={saving}>
          {saving ? '登録中...' : `${rows.length}匹を一括登録`}
        </button>
      </div>

      {/* Ear punch sequence editor */}
      <div style={styles.seqPanel}>
        <div style={styles.seqHeader}>
          <span style={styles.sharedTitle}>耳パンチ自動入力の順番</span>
          <span style={styles.toggleHint}>（編集可能・{rows.length}匹以上の場合は先頭から繰り返し）</span>
          <button
            style={styles.resetBtn}
            onClick={() => {
              setEarPunchSequence([...DEFAULT_EAR_PUNCH_SEQUENCE])
              if (autoFillMarking) applyMarkingAutoFill([...DEFAULT_EAR_PUNCH_SEQUENCE])
            }}
          >
            リセット
          </button>
        </div>
        <div style={styles.seqList}>
          {earPunchSequence.map((entry, idx) => (
            <div key={idx} style={styles.seqItem}>
              <span style={styles.seqNum}>{idx + 1}</span>
              <input
                style={styles.seqInput}
                value={entry}
                onChange={(e) => updateEarPunchEntry(idx, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '1.5rem' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' },
  title: { fontSize: '1.4rem', color: '#2d3748', margin: 0 },
  subtitle: { fontSize: '0.9rem', color: '#718096', marginTop: '0.25rem' },
  step1Card: { background: '#fff', borderRadius: '8px', padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', maxWidth: '480px' },
  step1Title: { fontSize: '1rem', fontWeight: 700, color: '#4a5568', marginBottom: '1.25rem' },
  step1Grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' },
  step1Field: { display: 'flex', flexDirection: 'column', gap: '0.3rem' },
  step1Actions: { display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' },
  label: { fontSize: '0.82rem', fontWeight: 600, color: '#4a5568' },
  input: { padding: '0.5rem 0.75rem', border: '1px solid #cbd5e0', borderRadius: '6px', fontSize: '0.88rem' },
  sharedPanel: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', background: '#fff', borderRadius: '8px', padding: '0.75rem 1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '0.5rem' },
  autoFillPanel: { display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', background: '#faf5ff', borderRadius: '8px', padding: '0.75rem 1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1rem', border: '1px solid #e9d8fd' },
  sharedTitle: { fontSize: '0.82rem', fontWeight: 700, color: '#4a5568', marginRight: '0.25rem' },
  toggleLabel: { display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: '#2d3748', cursor: 'pointer' },
  toggleHint: { fontSize: '0.75rem', color: '#a0aec0' },
  sharedInput: { padding: '0.4rem 0.6rem', border: '1px solid #cbd5e0', borderRadius: '6px', fontSize: '0.85rem' },
  applyBtn: { padding: '0.4rem 0.8rem', background: '#805ad5', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 },
  tableWrapper: { background: '#fff', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'auto', marginBottom: '1rem' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '0.6rem 0.5rem', background: '#f7fafc', borderBottom: '2px solid #e2e8f0', fontSize: '0.78rem', color: '#718096', whiteSpace: 'nowrap' },
  td: { padding: '0.3rem 0.5rem', borderBottom: '1px solid #e2e8f0', fontSize: '0.85rem', color: '#2d3748' },
  cellInput: { padding: '0.35rem 0.5rem', border: '1px solid #cbd5e0', borderRadius: '4px', fontSize: '0.82rem', width: '100%', minWidth: '80px', boxSizing: 'border-box' },
  actions: { display: 'flex', gap: '1rem', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '1.5rem' },
  cancelBtn: { padding: '0.5rem 1rem', background: '#e2e8f0', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
  nextBtn: { padding: '0.5rem 1.5rem', background: '#4299e1', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
  submitBtn: { padding: '0.5rem 1.5rem', background: '#48bb78', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
  errText: { color: '#e53e3e', fontSize: '0.85rem', marginBottom: '0.5rem' },
  seqPanel: { background: '#fff', borderRadius: '8px', padding: '1rem 1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '2rem' },
  seqHeader: { display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' },
  resetBtn: { padding: '0.25rem 0.6rem', background: '#e2e8f0', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, marginLeft: 'auto' },
  seqList: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem' },
  seqItem: { display: 'flex', alignItems: 'center', gap: '0.25rem' },
  seqNum: { fontSize: '0.72rem', color: '#a0aec0', minWidth: '14px', textAlign: 'right' },
  seqInput: { padding: '0.3rem 0.4rem', border: '1px solid #cbd5e0', borderRadius: '4px', fontSize: '0.82rem', width: '70px' },
}
