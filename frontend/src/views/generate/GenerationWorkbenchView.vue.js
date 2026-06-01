import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useWorkContextStore } from '@/stores/workContext';
const workContext = useWorkContextStore();
const { t } = useI18n();
const cards = computed(() => [
    {
        title: t('generationWorkbench.cards.outlines.title'),
        path: '/generate/outlines',
        icon: 'O',
        desc: t('generationWorkbench.cards.outlines.desc'),
        ready: true
    },
    {
        title: t('generationWorkbench.cards.volumes.title'),
        path: '/generate/volume_designs',
        icon: 'V',
        desc: t('generationWorkbench.cards.volumes.desc'),
        ready: true
    },
    {
        title: t('generationWorkbench.cards.chapterPlans.title'),
        path: '/generate/chapter_plans',
        icon: 'P',
        desc: t('generationWorkbench.cards.chapterPlans.desc'),
        ready: true
    },
    {
        title: t('generationWorkbench.cards.blueprints.title'),
        path: '/generate/chapter_blueprints',
        icon: 'B',
        desc: t('generationWorkbench.cards.blueprints.desc'),
        ready: true
    },
    {
        title: t('generationWorkbench.cards.package.title'),
        path: '',
        icon: '包',
        desc: t('generationWorkbench.cards.package.desc'),
        ready: false
    },
    {
        title: t('generationWorkbench.cards.preview.title'),
        path: '',
        icon: '阅',
        desc: t('generationWorkbench.cards.preview.desc'),
        ready: false
    },
    {
        title: t('generationWorkbench.cards.draftChapters.title'),
        path: '/generate/chapters',
        icon: '写',
        desc: t('generationWorkbench.cards.draftChapters.desc'),
        ready: true
    },
    {
        title: t('generationWorkbench.cards.gate.title'),
        path: '/generate/gate',
        icon: 'G',
        desc: t('generationWorkbench.cards.gate.desc'),
        ready: true
    }
]);
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['context-row']} */ ;
/** @type {__VLS_StyleScopedClasses['module-card']} */ ;
/** @type {__VLS_StyleScopedClasses['module-card']} */ ;
/** @type {__VLS_StyleScopedClasses['module-card']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled']} */ ;
/** @type {__VLS_StyleScopedClasses['hero']} */ ;
/** @type {__VLS_StyleScopedClasses['card-grid']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "generation-workbench" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "hero" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "eyebrow" },
});
(__VLS_ctx.t('generationWorkbench.eyebrow'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({});
(__VLS_ctx.t('generationWorkbench.title'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "subtitle" },
});
(__VLS_ctx.t('generationWorkbench.subtitle'));
const __VLS_0 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    shadow: "never",
    ...{ class: "context-card" },
}));
const __VLS_2 = __VLS_1({
    shadow: "never",
    ...{ class: "context-card" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_3.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "context-row" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.t('generationWorkbench.context.project'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
(__VLS_ctx.workContext.selectedProject?.name ?? __VLS_ctx.t('generationWorkbench.context.notSelected'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "context-row" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.t('generationWorkbench.context.volume'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
(__VLS_ctx.workContext.selectedVolume
    ? __VLS_ctx.t('generationWorkbench.context.volumeLabel', {
        number: __VLS_ctx.workContext.selectedVolume.volumeNumber,
        title: __VLS_ctx.workContext.selectedVolume.title
    })
    : __VLS_ctx.t('generationWorkbench.context.notSelected'));
var __VLS_3;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "card-grid" },
});
for (const [card] of __VLS_getVForSourceType((__VLS_ctx.cards))) {
    const __VLS_4 = ((card.ready && card.path ? 'router-link' : 'div'));
    // @ts-ignore
    const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
        key: (card.title),
        to: (card.ready && card.path ? card.path : undefined),
        ...{ class: "module-card" },
        ...{ class: ({ disabled: !card.ready }) },
    }));
    const __VLS_6 = __VLS_5({
        key: (card.title),
        to: (card.ready && card.path ? card.path : undefined),
        ...{ class: "module-card" },
        ...{ class: ({ disabled: !card.ready }) },
    }, ...__VLS_functionalComponentArgsRest(__VLS_5));
    __VLS_7.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "card-icon" },
    });
    (card.icon);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "card-title" },
    });
    (card.title);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "card-desc" },
    });
    (card.desc);
    const __VLS_8 = {}.ElTag;
    /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
        size: "small",
        type: (card.ready ? 'success' : 'warning'),
    }));
    const __VLS_10 = __VLS_9({
        size: "small",
        type: (card.ready ? 'success' : 'warning'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_9));
    __VLS_11.slots.default;
    (card.ready ? __VLS_ctx.t('generationWorkbench.cardStatus.ready') : __VLS_ctx.t('generationWorkbench.cardStatus.pending'));
    var __VLS_11;
    var __VLS_7;
}
/** @type {__VLS_StyleScopedClasses['generation-workbench']} */ ;
/** @type {__VLS_StyleScopedClasses['hero']} */ ;
/** @type {__VLS_StyleScopedClasses['eyebrow']} */ ;
/** @type {__VLS_StyleScopedClasses['subtitle']} */ ;
/** @type {__VLS_StyleScopedClasses['context-card']} */ ;
/** @type {__VLS_StyleScopedClasses['context-row']} */ ;
/** @type {__VLS_StyleScopedClasses['context-row']} */ ;
/** @type {__VLS_StyleScopedClasses['card-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['module-card']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled']} */ ;
/** @type {__VLS_StyleScopedClasses['card-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['card-title']} */ ;
/** @type {__VLS_StyleScopedClasses['card-desc']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            workContext: workContext,
            t: t,
            cards: cards,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
