import { createTranslator } from './core';
import { DEFAULT_LOCALE, FALLBACK_LOCALE, messages } from './messages';
export { DEFAULT_LOCALE, FALLBACK_LOCALE, SUPPORTED_LOCALES } from './messages';
export function translate(key, locale = DEFAULT_LOCALE, params) {
    return createTranslator(messages, locale, FALLBACK_LOCALE)(key, params);
}
export function buildDocumentTitle(titleKey, locale) {
    const appTitle = translate('app.title', locale);
    const routeTitle = titleKey ? translate(titleKey, locale) : '';
    if (!routeTitle || routeTitle === titleKey)
        return appTitle;
    return `${routeTitle} | ${appTitle}`;
}
export function syncDocumentLanguage(locale) {
    if (typeof document === 'undefined')
        return;
    document.documentElement.lang = locale;
}
