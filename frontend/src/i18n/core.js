function resolvePath(node, parts) {
    let current = node;
    for (const part of parts) {
        if (!current || typeof current === 'string')
            return undefined;
        current = current[part];
    }
    return typeof current === 'string' ? current : undefined;
}
function interpolate(template, params = {}) {
    return template.replace(/\{(\w+)\}/g, (_, token) => {
        const value = params[token];
        return value == null ? `{${token}}` : String(value);
    });
}
export function createTranslator(messages, locale, fallbackLocale = 'en') {
    return (key, params) => {
        const parts = key.split('.');
        const localized = resolvePath(messages[locale], parts);
        const fallback = locale === fallbackLocale ? undefined : resolvePath(messages[fallbackLocale], parts);
        const template = localized ?? fallback;
        if (!template)
            return key;
        return interpolate(template, params);
    };
}
