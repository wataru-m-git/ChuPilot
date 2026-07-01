// Supported UI languages and defaults for the i18n layer.
export type Locale = 'ja' | 'en'

export const LOCALES: Locale[] = ['ja', 'en']
export const DEFAULT_LOCALE: Locale = 'ja'

// localStorage key used to persist the user's language choice.
export const LOCALE_STORAGE_KEY = 'chupilot.locale'

export const LOCALE_LABELS: Record<Locale, string> = {
  ja: '日本語',
  en: 'English',
}
