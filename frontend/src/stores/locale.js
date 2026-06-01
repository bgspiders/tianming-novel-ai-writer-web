import { computed, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n';
const STORAGE_KEY = 'tm.locale.v1';
function normalizeLocale(value) {
    return SUPPORTED_LOCALES.includes(value) ? value : DEFAULT_LOCALE;
}
export const useLocaleStore = defineStore('locale', () => {
    const locale = ref(DEFAULT_LOCALE);
    function init() {
        if (typeof localStorage === 'undefined')
            return;
        locale.value = normalizeLocale(localStorage.getItem(STORAGE_KEY));
    }
    function setLocale(next) {
        locale.value = normalizeLocale(next);
    }
    const isChinese = computed(() => locale.value === 'zh-CN');
    watch(locale, (value) => {
        if (typeof localStorage === 'undefined')
            return;
        localStorage.setItem(STORAGE_KEY, value);
    });
    return {
        locale,
        isChinese,
        init,
        setLocale
    };
});
