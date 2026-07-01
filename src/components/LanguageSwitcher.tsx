'use client'
import { useI18n } from '@/i18n/I18nProvider'
import { LOCALES, LOCALE_LABELS } from '@/i18n/config'

// Compact JA / EN toggle used in the sidebar.
export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n()
  return (
    <div style={styles.wrap}>
      {LOCALES.map((l) => (
        <button
          key={l}
          onClick={() => setLocale(l)}
          aria-pressed={locale === l}
          style={{
            ...styles.btn,
            background: locale === l ? '#553c9a' : 'transparent',
            color: locale === l ? '#fff' : '#a0aec0',
          }}
        >
          {LOCALE_LABELS[l]}
        </button>
      ))}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', gap: '0.25rem' },
  btn: {
    flex: 1,
    padding: '0.35rem 0.5rem',
    border: '1px solid #4a5568',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.75rem',
  },
}
