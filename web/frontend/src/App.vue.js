import { computed, watchEffect } from 'vue';
import { ElConfigProvider } from 'element-plus';
import en from 'element-plus/es/locale/lang/en';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import { RouterView } from 'vue-router';
import { useRoute } from 'vue-router';
import { buildDocumentTitle, syncDocumentLanguage } from '@/i18n';
import { useLocaleStore } from '@/stores/locale';
const route = useRoute();
const localeStore = useLocaleStore();
const elementLocale = computed(() => (localeStore.locale === 'zh-CN' ? zhCn : en));
watchEffect(() => {
    syncDocumentLanguage(localeStore.locale);
    document.title = buildDocumentTitle(route.meta?.titleKey, localeStore.locale);
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
const __VLS_0 = {}.ElConfigProvider;
/** @type {[typeof __VLS_components.ElConfigProvider, typeof __VLS_components.elConfigProvider, typeof __VLS_components.ElConfigProvider, typeof __VLS_components.elConfigProvider, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    locale: (__VLS_ctx.elementLocale),
}));
const __VLS_2 = __VLS_1({
    locale: (__VLS_ctx.elementLocale),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
var __VLS_4 = {};
__VLS_3.slots.default;
const __VLS_5 = {}.RouterView;
/** @type {[typeof __VLS_components.RouterView, ]} */ ;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent(__VLS_5, new __VLS_5({}));
const __VLS_7 = __VLS_6({}, ...__VLS_functionalComponentArgsRest(__VLS_6));
var __VLS_3;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            ElConfigProvider: ElConfigProvider,
            RouterView: RouterView,
            elementLocale: elementLocale,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
