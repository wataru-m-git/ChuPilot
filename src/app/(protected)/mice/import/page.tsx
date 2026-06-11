'use client'
import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Workbook } from 'exceljs'
import { bulkCreateMice } from '@/lib/db'

// ─── Column header → DB field mapping ───────────────────────────────────────
const HEADER_TO_FIELD: Record<string, string> = {
  name: 'name',
  Strain: 'strain',
  Mother: 'mother_id',
  Father: 'father_id',
  'Birth day': 'birth_day',
  sex: 'sex',
  color: 'color',
  marking: 'marking',
  'typing date': 'typing_date',
  Ehf_cKO: 'genotype_Ehf_cKO',
  CMV_Ehf_flox: 'genotype_CMV_Ehf_flox',
  'CMV_Elf3#8_flox': 'genotype_CMV_Elf3_flox',
  Ascl1CreERT2: 'genotype_Ascl1CreERT2',
  Foxn1Cre: 'genotype_Foxn1Cre',
  'Fabp4Cre<RFP>': 'genotype_Fabp4Cre_RFP',
  Elf3Flox: 'genotype_Elf3Flox',
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface ParsedRow {
  name: string
  strain: string | null
  mother_id: string | null
  father_id: string | null
  birth_day: string | null
  sex: string | null
  color: string | null
  marking: string | null
  typing_date: string | null
  genotype_Ehf_cKO: string | null
  genotype_CMV_Ehf_flox: string | null
  genotype_CMV_Elf3_flox: string | null
  genotype_Ascl1CreERT2: string | null
  genotype_Foxn1Cre: string | null
  genotype_Fabp4Cre_RFP: string | null
  genotype_Elf3Flox: string | null
  notes: string | null
  status: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatDate(val: unknown): string | null {
  if (val == null) return null
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null
    const y = val.getFullYear()
    const m = String(val.getMonth() + 1).padStart(2, '0')
    const d = String(val.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  if (typeof val === 'string') {
    const cleaned = val.replace(/年/g, '-').replace(/月/g, '-').replace(/日/g, '').trim()
    const d = new Date(cleaned)
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0]
    }
  }
  return null
}

function parseSheet(worksheet: any): { rows: ParsedRow[]; skipped: number } {
  const raw: unknown[][] = []
  worksheet.eachRow((row: any) => {
    raw.push(row.values.slice(1)) // slice(1) because exceljs uses 1-based indexing
  })

  // Find header row: look for a row that contains 'name' as a cell
  let headerRowIdx = -1
  const colMap: Record<string, number> = {}

  for (let i = 0; i < Math.min(10, raw.length); i++) {
    const row = raw[i] as unknown[]
    const hasName = row.some((c) => typeof c === 'string' && c.trim() === 'name')
    if (hasName) {
      headerRowIdx = i
      row.forEach((c, j) => {
        if (typeof c === 'string') {
          const field = HEADER_TO_FIELD[c.trim()]
          if (field) colMap[field] = j
        }
      })
      break
    }
  }

  if (headerRowIdx === -1 || !('name' in colMap)) {
    return { rows: [], skipped: 0 }
  }

  // Notes column: the first non-mapped column after Elf3Flox, or fixed offset
  const knownIndices = Object.values(colMap)
  const maxKnown = Math.max(...knownIndices)
  const notesColIdx = maxKnown + 1

  const rows: ParsedRow[] = []
  let skipped = 0
  let lastStrain: string | null = null

  const getStr = (row: unknown[], field: string): string | null => {
    const idx = colMap[field]
    if (idx === undefined) return null
    const v = row[idx]
    if (v == null) return null
    if (v instanceof Date) return formatDate(v)
    const s = String(v).trim()
    return s || null
  }

  for (let i = headerRowIdx + 1; i < raw.length; i++) {
    const row = raw[i] as unknown[]

    const nameRaw = row[colMap['name']]
    const name = typeof nameRaw === 'string' ? nameRaw.trim() : null
    if (!name || name.startsWith('=')) { skipped++; continue }

    const strainRaw = getStr(row, 'strain')
    const strain = strainRaw || lastStrain
    if (strainRaw) lastStrain = strainRaw

    const notesVal = row[notesColIdx]
    const notesStr = notesVal != null ? String(notesVal).trim() || null : null
    const status = notesStr?.includes('処分') ? 'disposed' : 'active'

    rows.push({
      name,
      strain,
      mother_id: getStr(row, 'mother_id'),
      father_id: getStr(row, 'father_id'),
      birth_day: formatDate(colMap['birth_day'] !== undefined ? row[colMap['birth_day']] : null),
      sex: getStr(row, 'sex'),
      color: getStr(row, 'color'),
      marking: getStr(row, 'marking'),
      typing_date: formatDate(colMap['typing_date'] !== undefined ? row[colMap['typing_date']] : null),
      genotype_Ehf_cKO: getStr(row, 'genotype_Ehf_cKO'),
      genotype_CMV_Ehf_flox: getStr(row, 'genotype_CMV_Ehf_flox'),
      genotype_CMV_Elf3_flox: getStr(row, 'genotype_CMV_Elf3_flox'),
      genotype_Ascl1CreERT2: getStr(row, 'genotype_Ascl1CreERT2'),
      genotype_Foxn1Cre: getStr(row, 'genotype_Foxn1Cre'),
      genotype_Fabp4Cre_RFP: getStr(row, 'genotype_Fabp4Cre_RFP'),
      genotype_Elf3Flox: getStr(row, 'genotype_Elf3Flox'),
      notes: notesStr,
      status,
    })
  }

  return { rows, skipped }
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function ImportPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [workbook, setWorkbook] = useState<Workbook | null>(null)
  const [sheetNames, setSheetNames] = useState<string[]>([])
  const [selectedSheet, setSelectedSheet] = useState('')
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [skippedCount, setSkippedCount] = useState(0)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ success: number; errors: string[] } | null>(null)
  const [parseError, setParseError] = useState('')
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload')

  const loadFile = useCallback((file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setParseError('Excelファイル (.xlsx / .xls) を選択してください')
      return
    }
    setParseError('')
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target!.result as ArrayBuffer
        const wb = new Workbook()
        await wb.xlsx.load(arrayBuffer)
        setWorkbook(wb)
        setSheetNames(wb.worksheets.map((ws) => ws.name))

        // Auto-select sheet that has 'name' column
        let best = wb.worksheets[0]?.name || ''
        outer: for (const ws of wb.worksheets) {
          const firstRows: unknown[][] = []
          ws.eachRow((row: any, rowNumber: number) => {
            if (rowNumber <= 10) firstRows.push(row.values.slice(1))
          })
          for (const row of firstRows) {
            if ((row as unknown[]).some((c) => typeof c === 'string' && c.trim() === 'name')) {
              best = ws.name
              break outer
            }
          }
        }
        setSelectedSheet(best)

        const { rows, skipped } = parseSheet(wb.getWorksheet(best))
        setParsedRows(rows)
        setSkippedCount(skipped)
        setStep('preview')
      } catch (err) {
        setParseError('ファイルの読み込みに失敗しました: ' + (err as Error).message)
      }
    }
    reader.readAsArrayBuffer(file)
  }, [])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) loadFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) loadFile(file)
  }

  const handleSheetChange = (sName: string) => {
    if (!workbook) return
    setSelectedSheet(sName)
    const { rows, skipped } = parseSheet(workbook.getWorksheet(sName))
    setParsedRows(rows)
    setSkippedCount(skipped)
  }

  const handleImport = async () => {
    setImporting(true)
    const errors: string[] = []
    let success = 0
    const BATCH = 100

    for (let i = 0; i < parsedRows.length; i += BATCH) {
      const batch = parsedRows.slice(i, i + BATCH)
      const result = await bulkCreateMice(batch)
      success += result.success.length
      for (const e of result.errors) {
        const row = batch[e.index]
        errors.push(`${row?.name ?? `行${i + e.index + 1}`}: ${e.error}`)
      }
    }

    setImportResult({ success, errors })
    setImporting(false)
    setStep('done')
  }

  const activeCount = parsedRows.filter((r) => r.status === 'active').length
  const disposedCount = parsedRows.filter((r) => r.status === 'disposed').length

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button onClick={() => router.back()} style={styles.backBtn}>← 戻る</button>
        <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>Excelインポート</h1>
      </div>

      {/* ── Step 1: Upload ── */}
      {step === 'upload' && (
        <div>
          <p style={{ color: '#4a5568', marginBottom: '1.5rem' }}>
            個体リストのExcelファイル(.xlsx)をアップロードしてください。<br />
            列ヘッダー（name, Strain, Birth day など）を自動検出してインポートします。
          </p>
          <div
            style={{
              ...styles.dropZone,
              background: isDragging ? '#ebf4ff' : '#f7fafc',
              borderColor: isDragging ? '#4299e1' : '#cbd5e0',
            }}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📂</div>
            <div style={{ fontWeight: 600, color: '#2d3748' }}>クリックまたはドラッグ＆ドロップ</div>
            <div style={{ fontSize: '0.85rem', color: '#718096', marginTop: '0.25rem' }}>.xlsx / .xls</div>
          </div>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleFileInput} />
          {parseError && <div style={styles.errorBox}>{parseError}</div>}
        </div>
      )}

      {/* ── Step 2: Preview ── */}
      {step === 'preview' && (
        <div>
          {/* Sheet selector */}
          {sheetNames.length > 1 && (
            <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <label style={{ fontWeight: 600 }}>シート:</label>
              <select value={selectedSheet} onChange={(e) => handleSheetChange(e.target.value)} style={styles.select}>
                {sheetNames.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          {/* Summary */}
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <StatCard label="取り込み対象" value={parsedRows.length} color="#4299e1" />
            <StatCard label="アクティブ" value={activeCount} color="#48bb78" />
            <StatCard label="処分済み" value={disposedCount} color="#fc8181" />
            <StatCard label="スキップ(空行)" value={skippedCount} color="#a0aec0" />
          </div>

          {parsedRows.length === 0 ? (
            <div style={styles.errorBox}>
              対応する列ヘッダーが見つかりませんでした。シートを変えるか、ファイル形式を確認してください。
            </div>
          ) : (
            <>
              {/* Preview table */}
              <div style={{ overflowX: 'auto', marginBottom: '1.5rem', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <table style={styles.table}>
                  <thead>
                    <tr style={{ background: '#f7fafc' }}>
                      {['個体ID', '系統', '性別', '誕生日', 'ステータス', '遺伝子型(Ehf_cKO)', 'ノート'].map((h) => (
                        <th key={h} style={styles.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.slice(0, 200).map((row, i) => (
                      <tr key={i} style={{ background: row.status === 'disposed' ? '#fff5f5' : i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                        <td style={styles.td}>{row.name}</td>
                        <td style={styles.td}>{row.strain ?? '-'}</td>
                        <td style={styles.td}>{row.sex ?? '-'}</td>
                        <td style={styles.td}>{row.birth_day ?? '-'}</td>
                        <td style={styles.td}>
                          <span style={{ ...styles.badge, background: row.status === 'disposed' ? '#fed7d7' : '#c6f6d5', color: row.status === 'disposed' ? '#c53030' : '#276749' }}>
                            {row.status === 'disposed' ? '処分済み' : 'アクティブ'}
                          </span>
                        </td>
                        <td style={styles.td}>{row.genotype_Ehf_cKO ?? '-'}</td>
                        <td style={{ ...styles.td, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.notes ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedRows.length > 200 && (
                  <div style={{ padding: '0.5rem 1rem', background: '#f7fafc', color: '#718096', fontSize: '0.85rem', borderTop: '1px solid #e2e8f0' }}>
                    ※ 先頭200件を表示中（全{parsedRows.length}件）
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button onClick={() => { setStep('upload'); setWorkbook(null) }} style={styles.cancelBtn}>
                  ← ファイルを選び直す
                </button>
                <button onClick={handleImport} disabled={importing} style={{ ...styles.importBtn, opacity: importing ? 0.6 : 1 }}>
                  {importing ? 'インポート中...' : `${parsedRows.length}件をインポート`}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Step 3: Done ── */}
      {step === 'done' && importResult && (
        <div>
          <div style={{ ...styles.resultCard, borderColor: importResult.errors.length === 0 ? '#48bb78' : '#fc8181' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
              {importResult.errors.length === 0 ? '✅' : '⚠️'}
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>
              {importResult.success}件のインポートが完了しました
            </div>
            {importResult.errors.length > 0 && (
              <div style={{ marginTop: '0.5rem', color: '#c53030', fontSize: '0.9rem' }}>
                {importResult.errors.length}件のエラーがありました
              </div>
            )}
          </div>

          {importResult.errors.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>エラー一覧（重複IDなど）:</div>
              <div style={{ ...styles.errorBox, maxHeight: '200px', overflowY: 'auto' }}>
                {importResult.errors.map((e, i) => <div key={i} style={{ marginBottom: '0.25rem' }}>{e}</div>)}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
            <button onClick={() => { setStep('upload'); setWorkbook(null); setImportResult(null) }} style={styles.cancelBtn}>
              別のファイルをインポート
            </button>
            <button onClick={() => router.push('/mice')} style={styles.importBtn}>
              個体一覧へ →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-component ────────────────────────────────────────────────────────────
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: '#fff', border: `2px solid ${color}`, borderRadius: '8px', padding: '0.75rem 1.25rem', minWidth: '120px', textAlign: 'center' }}>
      <div style={{ fontSize: '1.6rem', fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: '0.8rem', color: '#718096', marginTop: '0.1rem' }}>{label}</div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  backBtn: { padding: '0.4rem 0.8rem', background: '#edf2f7', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem', color: '#4a5568' },
  dropZone: { border: '2px dashed', borderRadius: '12px', padding: '3rem 2rem', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s' },
  select: { padding: '0.4rem 0.6rem', border: '1px solid #cbd5e0', borderRadius: '6px', fontSize: '0.9rem' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' },
  th: { padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, color: '#4a5568', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' },
  td: { padding: '0.5rem 0.75rem', borderBottom: '1px solid #e2e8f0', color: '#2d3748' },
  badge: { display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600 },
  errorBox: { background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: '6px', padding: '0.75rem 1rem', color: '#c53030', fontSize: '0.875rem', marginTop: '1rem' },
  cancelBtn: { padding: '0.6rem 1.2rem', background: '#edf2f7', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', color: '#4a5568' },
  importBtn: { padding: '0.6rem 1.5rem', background: '#553c9a', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', color: '#fff', fontWeight: 600 },
  resultCard: { background: '#fff', border: '2px solid', borderRadius: '12px', padding: '1.5rem 2rem', textAlign: 'center' },
}
