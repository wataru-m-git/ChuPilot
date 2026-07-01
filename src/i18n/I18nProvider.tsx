'use client'
/**
 * Lightweight i18n layer: a React context that holds the current locale,
 * persists the choice to localStorage, and exposes a `t()` translation
 * function backed by the dictionaries in ./dictionaries.
 *
 * No external dependency — designed for this app's all-client UI.
 */
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { dictionaries } from './dictionaries'
import { Locale, DEFAULT_LOCALE, LOCALE_STORAGE_KEY } from './config'

type TranslateVars = Record<string, string | number>

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, vars?: TranslateVars) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

// Resolve a dot-notation key ("mice.list.title") against a nested dictionary.
function resolve(dict: unknown, key: string): string | undefined {
  const value = key.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part]
    }
    return undefined
  }, dict)
  return typeof value === 'string' ? value : undefined
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)

  // Restore the saved locale after mount (avoids SSR/hydration mismatch).
  useEffect(() => {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (saved === 'ja' || saved === 'en') {
      setLocaleState(saved)
      document.documentElement.lang = saved
    }
  }, [])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    localStorage.setItem(LOCALE_STORAGE_KEY, next)
    document.documentElement.lang = next
  }, [])

  const t = useCallback(
    (key: string, vars?: TranslateVars) => {
      // Current locale → default locale → the raw key (so nothing renders blank).
      let text = resolve(dictionaries[locale], key) ?? resolve(dictionaries[DEFAULT_LOCALE], key) ?? key
      if (vars) {
        for (const [name, value] of Object.entries(vars)) {
          text = text.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value))
        }
      }
      return text
    },
    [locale],
  )

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within an I18nProvider')
  return ctx
}
