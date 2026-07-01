'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { getMouse, deleteMouse, updateMouse } from '@/lib/db'
import type { Mouse } from '@/types'
import { getGenotypeNamesFromStrain } from '@/types'
import { GenotypeBadge } from '@/components/GenotypeBadge'
import { useI18n } from '@/i18n/I18nProvider'

export default function MouseDetailPage() {
  const { t } = useI18n()
  const { id } = useParams()
  const router = useRouter()
  const [mouse, setMouse] = useState<Mouse | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [disposing, setDisposing] = useState(false)
  const [disposeNote, setDisposeNote] = useState('')

  useEffect(() => {
    getMouse(Number(id))
      .then(setMouse)
      .finally(() => setLoading(false))
  }, [id])

  const handleDelete = async () => {
    await deleteMouse(Number(id))
    router.push('/mice')
  }

  const handleDispose = async () => {
    if (!mouse) return
    const today = new Date().toISOString().split('T')[0]
    // The disposal note is stored data, not UI text. Keep a canonical, locale-independent
    // format ("YYYY-MM-DD処分 <memo>") so the disposed-list parser and the Excel-import
    // "処分" detector recognize it regardless of the current UI language.
    await updateMouse(Number(id), {
      status: 'disposed',
      notes: disposeNote ? `${today}処分 ${disposeNote}` : `${today}処分`,
    })
    router.push('/mice')
  }

  if (loading) return <div style={{ padding: '2rem' }}>{t('common.loading')}</div>
  if (!mouse) return <div style={{ padding: '2rem' }}>{t('miceDetail.notFound')}</div>

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>{mouse.name}</h2>
          <span style={{
            padding: '2px 8px',
            borderRadius: '12px',
            fontSize: '0.8rem',
            background: mouse.status === 'active' ? '#c6f6d5' : '#fed7d7',
            color: mouse.status === 'active' ? '#276749' : '#9b2c2c',
          }}>
            {mouse.status === 'active' ? 'Active' : t('miceDetail.disposed')}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button style={styles.editBtn} onClick={() => router.push(`/mice/${id}/edit`)}>{t('common.edit')}</button>
          {mouse.status === 'active' && (
            <button style={styles.disposeBtn} onClick={() => setDisposing(true)}>{t('miceDetail.registerDispose')}</button>
          )}
          <button style={styles.deleteBtn} onClick={() => setConfirmDelete(true)}>{t('common.delete')}</button>
        </div>
      </div>

      {/* Info sections */}
      <div style={styles.sections}>
        <InfoSection title={t('miceDetail.basicInfo')}>
          <InfoRow label={t('miceDetail.strainName')} value={mouse.strain} />
          <InfoRow label={t('miceDetail.sex')} value={mouse.sex} />
          <InfoRow label={t('miceDetail.dateOfBirth')} value={mouse.birth_day} />
          <InfoRow label={t('miceDetail.weeks')} value={mouse.weeks != null ? `${mouse.weeks}w` : null} />
          <InfoRow label={t('miceDetail.coatColor')} value={mouse.color} />
          <InfoRow label={t('miceDetail.marking')} value={mouse.marking} />
          <InfoRow label={t('miceDetail.cage')} value={mouse.cage_label} />
        </InfoSection>

        <InfoSection title={t('miceDetail.parentInfo')}>
          <InfoRow label={t('miceDetail.motherId')} value={mouse.mother_id} />
          <InfoRow label={t('miceDetail.fatherId')} value={mouse.father_id} />
        </InfoSection>

        <InfoSection title={t('miceDetail.genotype')}>
          {getGenotypeNamesFromStrain(mouse.strain).length > 0 && mouse.genotypes && Object.keys(mouse.genotypes).length > 0 ? (
            <>
              {getGenotypeNamesFromStrain(mouse.strain).map((name) => (
                <div key={name}>
                  <div style={{ fontSize: '0.75rem', color: '#718096', fontWeight: 600 }}>{name}</div>
                  <div style={{ fontSize: '0.9rem', marginTop: '0.2rem' }}>
                    {mouse.genotypes[name] ? <GenotypeBadge value={mouse.genotypes[name]} /> : <span style={{ color: '#a0aec0' }}>-</span>}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <span style={{ color: '#a0aec0' }}>-</span>
          )}
          <div>
            <div style={{ fontSize: '0.75rem', color: '#718096', fontWeight: 600 }}>{t('miceDetail.typingDate')}</div>
            <div style={{ fontSize: '0.9rem', color: '#2d3748', marginTop: '0.2rem' }}>{mouse.typing_date || '-'}</div>
          </div>
        </InfoSection>

        <InfoSection title={t('miceDetail.notes')}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#4a5568', whiteSpace: 'pre-wrap' }}>
            {mouse.notes || t('miceDetail.none')}
          </p>
        </InfoSection>
      </div>

      {/* Dispose modal */}
      {disposing && (
        <Modal title={t('miceDetail.registerDispose')} onClose={() => setDisposing(false)}>
          <p style={{ marginBottom: '0.75rem' }}>{t('miceDetail.disposePrompt')}</p>
          <textarea
            style={{ width: '100%', minHeight: '80px', padding: '0.5rem', border: '1px solid #cbd5e0', borderRadius: '6px', boxSizing: 'border-box' }}
            placeholder={t('miceDetail.disposePlaceholder')}
            value={disposeNote}
            onChange={(e) => setDisposeNote(e.target.value)}
          />
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button style={styles.cancelBtn} onClick={() => setDisposing(false)}>{t('common.cancel')}</button>
            <button style={styles.disposeBtn} onClick={handleDispose}>{t('miceDetail.registerDispose')}</button>
          </div>
        </Modal>
      )}

      {/* Delete confirm modal */}
      {confirmDelete && (
        <Modal title={t('miceDetail.deleteConfirm')} onClose={() => setConfirmDelete(false)}>
          <p>{t('miceDetail.deleteConfirmMessage', { name: mouse.name })}</p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button style={styles.cancelBtn} onClick={() => setConfirmDelete(false)}>{t('common.cancel')}</button>
            <button style={styles.deleteBtn} onClick={handleDelete}>{t('miceDetail.deleteAction')}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: '8px', padding: '1.2rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
      <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#4a5568', marginBottom: '0.75rem', paddingBottom: '0.4rem', borderBottom: '1px solid #e2e8f0' }}>
        {title}
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem' }}>
        {children}
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div style={{ fontSize: '0.75rem', color: '#718096', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: '0.9rem', color: '#2d3748' }}>{value || '-'}</div>
    </div>
  )
}

function Modal({ title, children, onClose: _onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: '10px', padding: '1.5rem', maxWidth: '400px', width: '90%' }}>
        <h3 style={{ marginBottom: '1rem' }}>{title}</h3>
        {children}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '1.5rem', maxWidth: '900px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' },
  title: { fontSize: '1.6rem', color: '#2d3748', margin: '0 0 0.3rem 0' },
  sections: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  editBtn: { padding: '0.5rem 1rem', background: '#4299e1', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
  disposeBtn: { padding: '0.5rem 1rem', background: '#ed8936', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
  deleteBtn: { padding: '0.5rem 1rem', background: '#e53e3e', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
  cancelBtn: { padding: '0.5rem 1rem', background: '#e2e8f0', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
}
