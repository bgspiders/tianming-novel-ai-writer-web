import { useLocaleStore } from '@/stores/locale';
import { translate } from '@/i18n';
export function useI18n() {
    const localeStore = useLocaleStore();
    function t(key, params) {
        return translate(key, localeStore.locale, params);
    }
    function setLocale(locale) {
        localeStore.setLocale(locale);
    }
    return {
        localeStore,
        t,
        setLocale
    };
}
