export type Locale = 'zh-CN' | 'en'

type TranslationPrimitive = string
interface TranslationBranch {
  [key: string]: TranslationNode
}

type TranslationNode = TranslationPrimitive | TranslationBranch

export type TranslationDictionary = Record<Locale, Record<string, TranslationNode>>
export type TranslationParams = Record<string, string | number | boolean | null | undefined>

function resolvePath(node: TranslationNode | undefined, parts: string[]): string | undefined {
  let current: TranslationNode | undefined = node

  for (const part of parts) {
    if (!current || typeof current === 'string') return undefined
    current = current[part]
  }

  return typeof current === 'string' ? current : undefined
}

function interpolate(template: string, params: TranslationParams = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, token: string) => {
    const value = params[token]
    return value == null ? `{${token}}` : String(value)
  })
}

export function createTranslator(
  messages: TranslationDictionary,
  locale: Locale,
  fallbackLocale: Locale = 'en'
) {
  return (key: string, params?: TranslationParams): string => {
    const parts = key.split('.')
    const localized = resolvePath(messages[locale], parts)
    const fallback = locale === fallbackLocale ? undefined : resolvePath(messages[fallbackLocale], parts)
    const template = localized ?? fallback

    if (!template) return key
    return interpolate(template, params)
  }
}
