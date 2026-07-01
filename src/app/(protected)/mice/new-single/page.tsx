'use client'
import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createMouse, getCages, getStrains } from '@/lib/db'
import type { Cage, Strain } from '@/types'
import { GENOTYPE_OPTIONS, getGenotypeNamesFromStrain } from '@/types'
import { useI18n } from '@/i18n/I18nProvider'

const EMPTY_FORM = {
  name: '',
  strain: '',
  mother_id: '',
  father_id: '',
  birth_day: '',
  sex: '',
  color: '',
  marking: '',
  cage_id: '',
  genotypes: {} as Record<string, string | null>,
  typing_date: '',
  status: 'active',
  notes: '',
}

export default function MouseNewSinglePage() {
  const { t } = useI18n()
  const router = useRouter()
  const [form, setForm] = useState(EMPTY_FORM)
  const [cages, setCages] = useState<Cage[]>([])
  const [strains, setStrains] = useState<Strain[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getCages().then(setCages)
    getStrains().then(setStrains)
  }, [])

  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }))

  const setGenotype = (name: string, val: string | null) =>
    setForm((f) => ({ ...f, genotypes: { ...f.genotypes, [name]: val || null } }))

  const handleStrainChange = (newStrain: string) => {
    const newNames = getGenotypeNamesFromStrain(newStrain)
    const preserved: Record<string, string | null> = {}
    for (const name of newNames) {
      preserved[name] = form.genotypes[name] ?? null
    }
    setForm((f) => ({ ...f, strain: newStrain, genotypes: preserved }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        strain: form.strain || null,
        mother_id: form.mother_id || null,
        father_id: form.father_id || null,
        birth_day: form.birth_day || null,
        sex: form.sex || null,
        color: form.color || null,
        marking: form.marking || null,
        cage_id: form.cage_id ? Number(form.cage_id) : null,
        genotypes: form.genotypes,
        typing_date: form.typing_date || null,
        status: form.status,
        notes: form.notes || null,
      }
      await createMouse(payload as Parameters<typeof createMouse>[0])
      router.push('/mice')
    } catch (err: unknown) {
      setError((err as Error).message || t('miceNewSingle.errorGeneric'))
    } finally {
      setLoading(false)
    }
  }

  const calcWeeks = () => {
    if (!form.birth_day) return '-'
    const days = (Date.now() - new Date(form.birth_day).getTime()) / 86400000
    return `${(days / 7).toFixed(1)}w`
  }

  const genotypeNames = getGenotypeNamesFromStrain(form.strain)

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>{t('miceNewSingle.title')}</h2>
      <form onSubmit={handleSubmit} style={styles.form}>
        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>{t('miceNewSingle.basicInfo')}</h3>
          <div style={styles.grid}>
            <Field label={t('miceNewSingle.idLabel')} required>
              <input style={styles.input} value={form.name} onChange={(e) => set('name', e.target.value)}
                placeholder={t('miceNewSingle.idPlaceholder')} required />
            </Field>
            <Field label={t('miceNewSingle.strainLabel')}>
              <select style={styles.input} value={form.strain} onChange={(e) => handleStrainChange(e.target.value)}>
                <option value="">{t('miceNewSingle.selectPrompt')}</option>
                {strains.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </Field>
            <Field label={t('miceNewSingle.sexLabel')}>
              <select style={styles.input} value={form.sex} onChange={(e) => set('sex', e.target.value)}>
                <option value="">{t('miceNewSingle.select')}</option>
                <option value="♂">{t('miceNewSingle.male')}</option>
                <option value="♀">{t('miceNewSingle.female')}</option>
              </select>
            </Field>
            <Field label={t('miceNewSingle.birthDayLabel')}>
              <input type="date" style={styles.input} value={form.birth_day} onChange={(e) => set('birth_day', e.target.value)} />
            </Field>
            <Field label={t('miceNewSingle.weeksLabel')}>
              <input style={{ ...styles.input, background: '#f7fafc', color: '#718096' }} value={calcWeeks()} readOnly />
            </Field>
            <Field label={t('miceNewSingle.colorLabel')}>
              <input style={styles.input} value={form.color} onChange={(e) => set('color', e.target.value)} placeholder="BL, etc." />
            </Field>
            <Field label={t('miceNewSingle.markingLabel')}>
              <input style={styles.input} value={form.marking} onChange={(e) => set('marking', e.target.value)} placeholder="(0,0)" />
            </Field>
            <Field label={t('miceNewSingle.cageLabel')}>
              <select style={styles.input} value={form.cage_id} onChange={(e) => set('cage_id', e.target.value)}>
                <option value="">{t('miceNewSingle.unassigned')}</option>
                {cages.map((c) => <option key={c.id} value={c.id}>{c.cage_id} {c.strain ? `(${c.strain})` : ''}</option>)}
              </select>
            </Field>
            <Field label={t('miceNewSingle.statusLabel')}>
              <select style={styles.input} value={form.status} onChange={(e) => set('status', e.target.value)}>
                <option value="active">{t('miceNewSingle.statusActive')}</option>
                <option value="disposed">{t('miceNewSingle.statusDisposed')}</option>
              </select>
            </Field>
          </div>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>{t('miceNewSingle.parentInfo')}</h3>
          <div style={styles.grid}>
            <Field label={t('miceNewSingle.motherIdLabel')}>
              <input style={styles.input} value={form.mother_id} onChange={(e) => set('mother_id', e.target.value)} placeholder="KH588(0,0)" />
            </Field>
            <Field label={t('miceNewSingle.fatherIdLabel')}>
              <input style={styles.input} value={form.father_id} onChange={(e) => set('father_id', e.target.value)} placeholder="KH894(2,2)" />
            </Field>
          </div>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>{t('miceNewSingle.genotype')}</h3>
          {form.strain ? (
            genotypeNames.length > 0 ? (
              <>
                <p style={{ fontSize: '0.8rem', color: '#718096', marginBottom: '0.75rem' }}>
                  {t('miceNewSingle.genotypeFieldsFor')} <strong>{form.strain}</strong> {t('miceNewSingle.genotypeFieldsSuffix')}
                </p>
                <div style={styles.grid}>
                  {genotypeNames.map((name) => (
                    <Field key={name} label={name}>
                      <select
                        style={styles.input}
                        value={form.genotypes[name] ?? ''}
                        onChange={(e) => setGenotype(name, e.target.value)}
                      >
                        <option value="">{t('miceNewSingle.genotypeUnset')}</option>
                        {GENOTYPE_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </Field>
                  ))}
                  <Field label={t('miceNewSingle.typingDateLabel')}>
                    <input type="date" style={styles.input} value={form.typing_date} onChange={(e) => set('typing_date', e.target.value)} />
                  </Field>
                </div>
              </>
            ) : (
              <p style={{ fontSize: '0.85rem', color: '#a0aec0' }}>
                {t('miceNewSingle.genotypeHelp')}<br />
                {t('miceNewSingle.genotypeExampleLabel')} <code>EhfcKO;Foxn1Cre;Elf3Flox</code>
              </p>
            )
          ) : (
            <p style={{ fontSize: '0.85rem', color: '#a0aec0' }}>{t('miceNewSingle.genotypeSelectStrain')}</p>
          )}
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>{t('miceNewSingle.notes')}</h3>
          <textarea style={{ ...styles.input, minHeight: '80px', resize: 'vertical' }}
            value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </section>

        {error && <p style={styles.error}>{error}</p>}
        <div style={styles.actions}>
          <button type="button" style={styles.cancelBtn} onClick={() => router.back()}>{t('common.cancel')}</button>
          <button type="submit" style={styles.submitBtn} disabled={loading}>
            {loading ? t('miceNewSingle.saving') : t('miceNewSingle.registerButton')}
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#4a5568' }}>
        {label}{required && <span style={{ color: '#e53e3e' }}> *</span>}
      </label>
      {children}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '1.5rem', maxWidth: '900px' },
  title: { fontSize: '1.4rem', color: '#2d3748', marginBottom: '1.5rem' },
  form: { display: 'flex', flexDirection: 'column', gap: '1.5rem' },
  section: { background: '#fff', borderRadius: '8px', padding: '1.2rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },
  sectionTitle: { fontSize: '0.95rem', fontWeight: 700, color: '#4a5568', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid #e2e8f0' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' },
  input: { padding: '0.5rem 0.75rem', border: '1px solid #cbd5e0', borderRadius: '6px', fontSize: '0.88rem', width: '100%', boxSizing: 'border-box' },
  actions: { display: 'flex', gap: '1rem', justifyContent: 'flex-end' },
  cancelBtn: { padding: '0.6rem 1.5rem', background: '#e2e8f0', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
  submitBtn: { padding: '0.6rem 1.5rem', background: '#4299e1', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
  error: { color: '#e53e3e', fontSize: '0.85rem' },
}
