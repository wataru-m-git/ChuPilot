'use client'
import { useEffect, useState } from 'react'
import { getStrains, createStrain, updateStrain, deleteStrain, bulkCreateStrains } from '@/lib/db'
import type { Strain } from '@/types'
import { useI18n } from '@/i18n/I18nProvider'

export default function StrainsPage() {
  const { t } = useI18n()
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
      setError(t('strains.errNameRequired'))
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
      setError((e as Error).message || t('strains.errSaveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (s: Strain) => {
    if (!confirm(t('strains.confirmDelete', { name: s.name }))) return
    try {
      await deleteStrain(s.id)
      fetchStrains()
    } catch (e: unknown) {
      alert((e as Error).message || t('strains.errDeleteFailed'))
    }
  }

  const handleBulkRegister = async () => {
    setBulkError('')
    const lines = bulkText.split('\n').map((l) => l.trim()).filter(Boolean)
    if (lines.length === 0) {
      setBulkError(t('strains.bulkErrEmpty'))
      return
    }
    setBulkSaving(true)
    try {
      const { created, skipped } = await bulkCreateStrains(lines)
      if (created.length === 0) {
        setBulkError(t('strains.bulkErrAllExist'))
        setBulkSaving(false)
        return
      }
      setBulkText('')
      setBulkMode(false)
      fetchStrains()
      if (skipped.length > 0) {
        setBulkError(t('strains.bulkSkipped', { count: skipped.length, names: skipped.join(', ') }))
      }
    } catch (e: unknown) {
      setBulkError((e as Error).message || t('strains.bulkErrFailed'))
    } finally {
      setBulkSaving(false)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>{t('strains.title')}</h2>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button style={styles.bulkBtn} onClick={() => { setBulkMode(!bulkMode); setBulkError('') }}>
            {bulkMode ? t('strains.closeBulk') : t('strains.bulkRegister')}
          </button>
          <button style={styles.addBtn} onClick={openNew}>{t('strains.newStrain')}</button>
        </div>
      </div>

      {/* Bulk register panel */}
      {bulkMode && (
        <div style={styles.bulkPanel}>
          <h3 style={styles.bulkTitle}>{t('strains.bulkPanelTitle')}</h3>
          <textarea
            style={styles.bulkTextarea}
            placeholder={t('strains.bulkPlaceholder')}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={8}
          />
          {bulkError && <p style={styles.errText}>{bulkError}</p>}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
            <button style={styles.cancelBtn} onClick={() => { setBulkMode(false); setBulkText(''); setBulkError('') }}>
              {t('common.cancel')}
            </button>
            <button style={styles.saveBtn} onClick={handleBulkRegister} disabled={bulkSaving}>
              {bulkSaving ? t('strains.registering') : t('strains.bulkRegister')}
            </button>
          </div>
        </div>
      )}

      {/* Strain list */}
      {loading ? (
        <div style={styles.loading}>{t('common.loading')}</div>
      ) : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>{t('strains.colName')}</th>
                <th style={styles.th}>{t('strains.colDescription')}</th>
                <th style={styles.th}>{t('strains.colRegisteredDate')}</th>
                <th style={{ ...styles.th, width: '120px' }}>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {strains.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: '#a0aec0' }}>
                    {t('strains.empty')}
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
                        <button style={styles.editBtn} onClick={() => openEdit(s)}>{t('common.edit')}</button>
                        <button style={styles.deleteBtn} onClick={() => handleDelete(s)}>{t('common.delete')}</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div style={styles.count}>{t('strains.count', { n: strains.length })}</div>
        </div>
      )}

      {/* Edit / New modal */}
      {showModal && editingStrain && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3 style={{ marginBottom: '1rem' }}>
              {editingStrain.id ? t('strains.editTitle') : t('strains.newTitle')}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={styles.formLabel}>{t('strains.formNameLabel')}</label>
                <input
                  style={styles.formInput}
                  value={editingStrain.name}
                  onChange={(e) => setEditingStrain({ ...editingStrain, name: e.target.value })}
                  placeholder={t('strains.formNamePlaceholder')}
                  autoFocus
                />
              </div>
              <div>
                <label style={styles.formLabel}>{t('strains.colDescription')}</label>
                <input
                  style={styles.formInput}
                  value={editingStrain.description}
                  onChange={(e) => setEditingStrain({ ...editingStrain, description: e.target.value })}
                  placeholder={t('strains.formDescPlaceholder')}
                />
              </div>
            </div>
            {error && <p style={styles.errText}>{error}</p>}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button style={styles.cancelBtn} onClick={() => setShowModal(false)}>{t('common.cancel')}</button>
              <button style={styles.saveBtn} onClick={handleSave} disabled={saving}>
                {saving ? t('strains.saving') : t('common.save')}
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
