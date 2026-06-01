import { useLocaleStore } from '@/stores/locale'
import { translate, type Locale } from '@/i18n'
import type { TranslationParams } from '@/i18n/core'

export function useI18n() {
  const localeStore = useLocaleStore()

  function t(key: string, params?: TranslationParams) {
    return translate(key, localeStore.locale, params)
  }

  function setLocale(locale: Locale) {
    localeStore.setLocale(locale)
  }

  return {
    localeStore,
    t,
    setLocale
  }
}
