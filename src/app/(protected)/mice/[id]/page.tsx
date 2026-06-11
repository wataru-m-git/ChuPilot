'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { getMouse, deleteMouse, updateMouse } from '@/lib/db'
import type { Mouse } from '@/types'
import { GENOTYPE_FIELDS, getGenotypeNamesFromStrain } from '@/types'
import { GenotypeBadge } from '@/components/GenotypeBadge'

export default function MouseDetailPage() {
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
    await updateMouse(Number(id), {
      status: 'disposed',
      notes: disposeNote ? `${today}処分 ${disposeNote}` : `${today}処分`,
    })
    router.push('/mice')
  }

  if (loading) return <div style={{ padding: '2rem' }}>読み込み中...</div>
  if (!mouse) return <div style={{ padding: '2rem' }}>個体が見つかりません</div>

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
            {mouse.status === 'active' ? 'Active' : '処分済み'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button style={styles.editBtn} onClick={() => router.push(`/mice/${id}/edit`)}>編集</button>
          {mouse.status === 'active' && (
            <button style={styles.disposeBtn} onClick={() => setDisposing(true)}>処分登録</button>
          )}
          <button style={styles.deleteBtn} onClick={() => setConfirmDelete(true)}>削除</button>
        </div>
      </div>

      {/* Info sections */}
      <div style={styles.sections}>
        <InfoSection title="基本情報">
          <InfoRow label="系統名" value={mouse.strain} />
          <InfoRow label="性別" value={mouse.sex} />
          <InfoRow label="生年月日" value={mouse.birth_day} />
          <InfoRow label="週齢" value={mouse.weeks != null ? `${mouse.weeks}w` : null} />
          <InfoRow label="毛色" value={mouse.color} />
          <InfoRow label="マーキング" value={mouse.marking} />
          <InfoRow label="ケージ" value={mouse.cage_label} />
        </InfoSection>

        <InfoSection title="親情報">
          <InfoRow label="母親ID" value={mouse.mother_id} />
          <InfoRow label="父親ID" value={mouse.father_id} />
        </InfoSection>

        <InfoSection title="遺伝子型">
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
            <>
              {GENOTYPE_FIELDS.map(f => {
                const value = mouse[f.key] as string | null
                return (
                  <div key={f.key}>
                    <div style={{ fontSize: '0.75rem', color: '#718096', fontWeight: 600 }}>{f.displayLabel}</div>
                    <div style={{ fontSize: '0.9rem', marginTop: '0.2rem' }}>
                      {value ? <GenotypeBadge value={value} /> : <span style={{ color: '#a0aec0' }}>-</span>}
                    </div>
                  </div>
                )
              })}
            </>
          )}
          <div>
            <div style={{ fontSize: '0.75rem', color: '#718096', fontWeight: 600 }}>判定日</div>
            <div style={{ fontSize: '0.9rem', color: '#2d3748', marginTop: '0.2rem' }}>{mouse.typing_date || '-'}</div>
          </div>
        </InfoSection>

        <InfoSection title="備考">
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#4a5568', whiteSpace: 'pre-wrap' }}>
            {mouse.notes || 'なし'}
          </p>
        </InfoSection>
      </div>

      {/* Dispose modal */}
      {disposing && (
        <Modal title="処分登録" onClose={() => setDisposing(false)}>
          <p style={{ marginBottom: '0.75rem' }}>処分理由・メモを入力してください。</p>
          <textarea
            style={{ width: '100%', minHeight: '80px', padding: '0.5rem', border: '1px solid #cbd5e0', borderRadius: '6px', boxSizing: 'border-box' }}
            placeholder="例：実験終了、解剖"
            value={disposeNote}
            onChange={(e) => setDisposeNote(e.target.value)}
          />
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button style={styles.cancelBtn} onClick={() => setDisposing(false)}>キャンセル</button>
            <button style={styles.disposeBtn} onClick={handleDispose}>処分登録</button>
          </div>
        </Modal>
      )}

      {/* Delete confirm modal */}
      {confirmDelete && (
        <Modal title="削除確認" onClose={() => setConfirmDelete(false)}>
          <p>{mouse.name} を完全に削除しますか？この操作は元に戻せません。</p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button style={styles.cancelBtn} onClick={() => setConfirmDelete(false)}>キャンセル</button>
            <button style={styles.deleteBtn} onClick={handleDelete}>削除する</button>
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
