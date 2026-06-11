'use client'
import { useEffect, useState } from 'react'
import { getStrains, createStrain, updateStrain, deleteStrain, bulkCreateStrains } from '@/lib/db'
import type { Strain } from '@/types'

export default function StrainsPage() {
  const [strains, setStrains] = useState<Strain[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingStrain, setEditingStrain] = useState<{ id?: number; name: string; description: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [bulkText, setBulkText] = useState('')
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkError, setBulkError] = useState('')
  const [bulkSaving, setBulkSaving] = useState(false)

  const fetchStrains = async () => {
    setLoading(true)
    try {
      const data = await getStrains()
      setStrains(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStrains()
  }, [])

  const openNew = () => {
    setEditingStrain({ name: '', description: '' })
    setError('')
    setShowModal(true)
  }

  const openEdit = (s: Strain) => {
    setEditingStrain({ id: s.id, name: s.name, description: s.description || '' })
    setError('')
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!editingStrain) return
    if (!editingStrain.name.trim()) {
      setError('系統名を入力してください')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload = {
        name: editingStrain.name.trim(),
        description: editingStrain.description.trim() || null,
      }
      if (editingStrain.id) {
        await updateStrain(editingStrain.id, payload)
      } else {
        await createStrain(payload)
      }
      setShowModal(false)
      fetchStrains()
    } catch (e: unknown) {
      setError((e as Error).message || '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (s: Strain) => {
    if (!confirm(`「${s.name}」を削除しますか？`)) return
    try {
      await deleteStrain(s.id)
      fetchStrains()
    } catch (e: unknown) {
      alert((e as Error).message || '削除に失敗しました')
    }
  }

  const handleBulkRegister = async () => {
    setBulkError('')
    const lines = bulkText.split('\n').map((l) => l.trim()).filter(Boolean)
    if (lines.length === 0) {
      setBulkError('系統名を1行1つで入力してください')
      return
    }
    setBulkSaving(true)
    try {
      const { created, skipped } = await bulkCreateStrains(lines)
      if (created.length === 0) {
        setBulkError('入力された系統名はすべて既に登録されています')
        setBulkSaving(false)
        return
      }
      setBulkText('')
      setBulkMode(false)
      fetchStrains()
      if (skipped.length > 0) {
        setBulkError(`${skipped.length}件はスキップ（重複）: ${skipped.join(', ')}`)
      }
    } catch (e: unknown) {
      setBulkError((e as Error).message || '一括登録に失敗しました')
    } finally {
      setBulkSaving(false)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>系統登録</h2>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button style={styles.bulkBtn} onClick={() => { setBulkMode(!bulkMode); setBulkError('') }}>
            {bulkMode ? '× 一括登録を閉じる' : '一括登録'}
          </button>
          <button style={styles.addBtn} onClick={openNew}>+ 新規系統</button>
        </div>
      </div>

      {/* Bulk register panel */}
      {bulkMode && (
        <div style={styles.bulkPanel}>
          <h3 style={styles.bulkTitle}>一括登録（1行1系統）</h3>
          <textarea
            style={styles.bulkTextarea}
            placeholder={'例:\nFoxn1Cre\nEhf_cKO\nAscl1CreERT2'}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={8}
          />
          {bulkError && <p style={styles.errText}>{bulkError}</p>}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
            <button style={styles.cancelBtn} onClick={() => { setBulkMode(false); setBulkText(''); setBulkError('') }}>
              キャンセル
            </button>
            <button style={styles.saveBtn} onClick={handleBulkRegister} disabled={bulkSaving}>
              {bulkSaving ? '登録中...' : '一括登録'}
            </button>
          </div>
        </div>
      )}

      {/* Strain list */}
      {loading ? (
        <div style={styles.loading}>読み込み中...</div>
      ) : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>系統名</th>
                <th style={styles.th}>説明</th>
                <th style={styles.th}>登録日</th>
                <th style={{ ...styles.th, width: '120px' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {strains.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: '#a0aec0' }}>
                    系統が登録されていません
                  </td>
                </tr>
              ) : (
                strains.map((s) => (
                  <tr key={s.id} style={styles.row}>
                    <td style={{ ...styles.td, fontWeight: 600 }}>{s.name}</td>
                    <td style={styles.td}>{s.description || '-'}</td>
                    <td style={styles.td}>
                      {s.created_at ? new Date(s.created_at).toLocaleDateString('ja-JP') : '-'}
                    </td>
                    <td style={styles.td}>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button style={styles.editBtn} onClick={() => openEdit(s)}>編集</button>
                        <button style={styles.deleteBtn} onClick={() => handleDelete(s)}>削除</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div style={styles.count}>{strains.length} 件</div>
        </div>
      )}

      {/* Edit / New modal */}
      {showModal && editingStrain && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3 style={{ marginBottom: '1rem' }}>
              {editingStrain.id ? '系統編集' : '新規系統登録'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={styles.formLabel}>系統名 *</label>
                <input
                  style={styles.formInput}
                  value={editingStrain.name}
                  onChange={(e) => setEditingStrain({ ...editingStrain, name: e.target.value })}
                  placeholder="例: Foxn1Cre"
                  autoFocus
                />
              </div>
              <div>
                <label style={styles.formLabel}>説明</label>
                <input
                  style={styles.formInput}
                  value={editingStrain.description}
                  onChange={(e) => setEditingStrain({ ...editingStrain, description: e.target.value })}
                  placeholder="任意のメモ"
                />
              </div>
            </div>
            {error && <p style={styles.errText}>{error}</p>}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button style={styles.cancelBtn} onClick={() => setShowModal(false)}>キャンセル</button>
              <button style={styles.saveBtn} onClick={handleSave} disabled={saving}>
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '1.5rem' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' },
  title: { fontSize: '1.4rem', color: '#2d3748', margin: 0 },
  addBtn: { padding: '0.5rem 1rem', background: '#4299e1', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
  bulkBtn: { padding: '0.5rem 1rem', background: '#805ad5', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
  bulkPanel: { background: '#fff', borderRadius: '8px', padding: '1.2rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '1.5rem' },
  bulkTitle: { fontSize: '0.95rem', fontWeight: 700, color: '#4a5568', marginBottom: '0.75rem' },
  bulkTextarea: { width: '100%', padding: '0.75rem', border: '1px solid #cbd5e0', borderRadius: '6px', fontSize: '0.9rem', fontFamily: 'monospace', boxSizing: 'border-box', resize: 'vertical' },
  loading: { padding: '2rem', textAlign: 'center', color: '#718096' },
  tableWrapper: { background: '#fff', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '0.75rem 1rem', background: '#f7fafc', borderBottom: '2px solid #e2e8f0', fontSize: '0.82rem', color: '#718096', whiteSpace: 'nowrap' },
  row: { transition: 'background 0.1s' },
  td: { padding: '0.65rem 1rem', borderBottom: '1px solid #e2e8f0', fontSize: '0.88rem', color: '#2d3748' },
  count: { padding: '0.5rem 1rem', fontSize: '0.85rem', color: '#718096' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#fff', borderRadius: '10px', padding: '1.5rem', maxWidth: '420px', width: '90%', boxShadow: '0 8px 30px rgba(0,0,0,0.2)' },
  formLabel: { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#4a5568', marginBottom: '0.25rem' },
  formInput: { width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #cbd5e0', borderRadius: '6px', fontSize: '0.88rem', boxSizing: 'border-box' },
  errText: { color: '#e53e3e', fontSize: '0.85rem', marginTop: '0.5rem' },
  cancelBtn: { padding: '0.5rem 1rem', background: '#e2e8f0', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
  saveBtn: { padding: '0.5rem 1rem', background: '#4299e1', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
  editBtn: { padding: '0.25rem 0.6rem', background: '#ebf8ff', color: '#2b6cb0', border: '1px solid #bee3f8', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' },
  deleteBtn: { padding: '0.25rem 0.6rem', background: '#fff5f5', color: '#c53030', border: '1px solid #feb2b2', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' },
}
