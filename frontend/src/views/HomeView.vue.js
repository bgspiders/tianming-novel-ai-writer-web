import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import { useThemeStore } from '@/stores/theme';
const router = useRouter();
const themeStore = useThemeStore();
const { t } = useI18n();
const quickActions = computed(() => [
    { label: t('home.quickActions.aiModels'), path: '/settings/ai-models', type: 'primary' },
    { label: t('home.quickActions.bookAnalyses'), path: '/design/book_analyses', type: 'default' },
    { label: t('home.quickActions.creativeMaterials'), path: '/design/creative_materials', type: 'success' },
    { label: t('home.quickActions.outlines'), path: '/generate/outlines', type: 'warning' },
    { label: t('home.quickActions.generationWorkbench'), path: '/generate', type: 'info' },
    { label: t('home.quickActions.aiAssistant'), path: '/ai-assistant', type: 'default' }
]);
const currentTheme = computed(() => t('home.preview.current', { theme: themeStore.effectiveTheme.label }));
const previewMode = computed(() => t('home.preview.mode', { mode: t(`home.preview.modeValue.${themeStore.mode}`) }));
const previewSource = computed(() => t('home.preview.source', { source: t(`home.preview.sourceValue.${themeStore.currentSource}`) }));
const previewHoliday = computed(() => t('home.preview.holiday', { holiday: themeStore.activeHoliday || t('home.preview.none') }));
const previewNext = computed(() => t('home.preview.next', { next: themeStore.nextScheduledThemeAt || t('home.preview.notScheduled') }));
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['hero-copy']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-line']} */ ;
/** @type {__VLS_StyleScopedClasses['hero']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "home" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "hero tm-panel" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "hero-copy" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "eyebrow" },
});
(__VLS_ctx.t('home.eyebrow'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({});
(__VLS_ctx.t('home.title'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
(__VLS_ctx.t('home.summary'));
const __VLS_0 = {}.ElSpace;
/** @type {[typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    wrap: true,
    size: (12),
}));
const __VLS_2 = __VLS_1({
    wrap: true,
    size: (12),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_3.slots.default;
for (const [action] of __VLS_getVForSourceType((__VLS_ctx.quickActions))) {
    const __VLS_4 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
        ...{ 'onClick': {} },
        key: (action.path),
        type: (action.type),
    }));
    const __VLS_6 = __VLS_5({
        ...{ 'onClick': {} },
        key: (action.path),
        type: (action.type),
    }, ...__VLS_functionalComponentArgsRest(__VLS_5));
    let __VLS_8;
    let __VLS_9;
    let __VLS_10;
    const __VLS_11 = {
        onClick: (...[$event]) => {
            __VLS_ctx.router.push(action.path);
        }
    };
    __VLS_7.slots.default;
    (action.label);
    var __VLS_7;
}
var __VLS_3;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "hero-preview" },
    ...{ style: ({ background: __VLS_ctx.themeStore.effectiveTheme.hero }) },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "preview-chip" },
});
(__VLS_ctx.currentTheme);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "preview-card" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "preview-line strong" },
});
(__VLS_ctx.previewMode);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "preview-line" },
});
(__VLS_ctx.previewSource);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "preview-line" },
});
(__VLS_ctx.previewHoliday);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "preview-line" },
});
(__VLS_ctx.previewNext);
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "grid" },
});
const __VLS_12 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
    shadow: "never",
    ...{ class: "panel" },
}));
const __VLS_14 = __VLS_13({
    shadow: "never",
    ...{ class: "panel" },
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
__VLS_15.slots.default;
{
    const { header: __VLS_thisSlot } = __VLS_15.slots;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "panel-title" },
    });
    (__VLS_ctx.t('home.sections.currentFocus'));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({
    ...{ class: "feature-list" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
(__VLS_ctx.t('home.focusItems.step1'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
(__VLS_ctx.t('home.focusItems.step2'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
(__VLS_ctx.t('home.focusItems.step3'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
(__VLS_ctx.t('home.focusItems.step4'));
var __VLS_15;
const __VLS_16 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
    shadow: "never",
    ...{ class: "panel" },
}));
const __VLS_18 = __VLS_17({
    shadow: "never",
    ...{ class: "panel" },
}, ...__VLS_functionalComponentArgsRest(__VLS_17));
__VLS_19.slots.default;
{
    const { header: __VLS_thisSlot } = __VLS_19.slots;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "panel-title" },
    });
    (__VLS_ctx.t('home.sections.runtime'));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({
    ...{ class: "feature-list" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
(__VLS_ctx.t('home.runtimeItems.backend', { url: 'http://localhost:38721' }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
(__VLS_ctx.t('home.runtimeItems.frontend', { url: 'http://localhost:38720' }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
(__VLS_ctx.t('home.runtimeItems.swagger', { url: 'http://localhost:38721/swagger' }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
(__VLS_ctx.t('home.runtimeItems.theme'));
var __VLS_19;
/** @type {__VLS_StyleScopedClasses['home']} */ ;
/** @type {__VLS_StyleScopedClasses['hero']} */ ;
/** @type {__VLS_StyleScopedClasses['tm-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['hero-copy']} */ ;
/** @type {__VLS_StyleScopedClasses['eyebrow']} */ ;
/** @type {__VLS_StyleScopedClasses['hero-preview']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-chip']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-card']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-line']} */ ;
/** @type {__VLS_StyleScopedClasses['strong']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-line']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-line']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-line']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-title']} */ ;
/** @type {__VLS_StyleScopedClasses['feature-list']} */ ;
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-title']} */ ;
/** @type {__VLS_StyleScopedClasses['feature-list']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            router: router,
            themeStore: themeStore,
            t: t,
            quickActions: quickActions,
            currentTheme: currentTheme,
            previewMode: previewMode,
            previewSource: previewSource,
            previewHoliday: previewHoliday,
            previewNext: previewNext,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
