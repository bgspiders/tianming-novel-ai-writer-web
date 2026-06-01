import { createTranslator, type Locale, type TranslationParams } from './core'
import { DEFAULT_LOCALE, FALLBACK_LOCALE, messages } from './messages'

export type { Locale } from './core'
export { DEFAULT_LOCALE, FALLBACK_LOCALE, SUPPORTED_LOCALES } from './messages'

export function translate(key: string, locale: Locale = DEFAULT_LOCALE, params?: TranslationParams) {
  return createTranslator(messages, locale, FALLBACK_LOCALE)(key, params)
}

export function buildDocumentTitle(titleKey: string | undefined, locale: Locale) {
  const appTitle = translate('app.title', locale)
  const routeTitle = titleKey ? translate(titleKey, locale) : ''

  if (!routeTitle || routeTitle === titleKey) return appTitle
  return `${routeTitle} | ${appTitle}`
}

export function syncDocumentLanguage(locale: Locale) {
  if (typeof document === 'undefined') return
  document.documentElement.lang = locale
}
