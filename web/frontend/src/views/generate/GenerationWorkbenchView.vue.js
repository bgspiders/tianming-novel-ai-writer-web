import { computed } from 'vue';
import { useWorkContextStore } from '@/stores/workContext';
const workContext = useWorkContextStore();
const cards = computed(() => [
    {
        title: '大纲',
        path: '/generate/outlines',
        icon: '🧭',
        desc: '全书定位、主题内核、结构规划',
        ready: true
    },
    {
        title: '分卷',
        path: '/generate/volume_designs',
        icon: '📚',
        desc: '卷主题、阶段目标、章节分配',
        ready: true
    },
    {
        title: '章节规划',
        path: '/generate/chapter_plans',
        icon: '📝',
        desc: '章节目标、冲突转折、交付物',
        ready: true
    },
    {
        title: '章节蓝图',
        path: '/generate/chapter_blueprints',
        icon: '🎬',
        desc: '场景节奏、POV、要素清单',
        ready: true
    },
    {
        title: '章节生成',
        path: '/generate/chapters',
        icon: '✍️',
        desc: '流式生成正文并服务端保存草稿',
        ready: true
    },
    {
        title: '生成门禁',
        path: '/generate/gate',
        icon: '🚦',
        desc: '生成记录、失败阶段、门禁接入状态',
        ready: true
    }
]);
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['context-row']} */ ;
/** @type {__VLS_StyleScopedClasses['module-card']} */ ;
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
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "subtitle" },
});
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
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
(__VLS_ctx.workContext.selectedProject?.name ?? '未选择');
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "context-row" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
(__VLS_ctx.workContext.selectedVolume ? `第 ${__VLS_ctx.workContext.selectedVolume.volumeNumber} 卷 · ${__VLS_ctx.workContext.selectedVolume.title}` : '未选择');
var __VLS_3;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "card-grid" },
});
for (const [card] of __VLS_getVForSourceType((__VLS_ctx.cards))) {
    const __VLS_4 = {}.RouterLink;
    /** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ ;
    // @ts-ignore
    const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
        key: (card.path),
        to: (card.path),
        ...{ class: "module-card" },
    }));
    const __VLS_6 = __VLS_5({
        key: (card.path),
        to: (card.path),
        ...{ class: "module-card" },
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
    (card.ready ? '已接入' : '待接入');
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
/** @type {__VLS_StyleScopedClasses['card-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['card-title']} */ ;
/** @type {__VLS_StyleScopedClasses['card-desc']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            workContext: workContext,
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
