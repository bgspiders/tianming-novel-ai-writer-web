import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowRight } from '@element-plus/icons-vue';
const route = useRoute();
const router = useRouter();
const planningModules = [
    {
        key: 'outlines',
        label: '大纲',
        icon: '纲',
        path: '/generate/outlines',
        title: '整书大纲与主线结构',
        description: '先确认作品的主干冲突、阶段目标、关键转折和长期伏笔，给后续分卷与章节拆解一个稳定骨架。',
        focus: ['主线目标与终局方向', '阶段推进节奏', '关键人物和伏笔落点']
    },
    {
        key: 'volume_designs',
        label: '卷设计',
        icon: '卷',
        path: '/generate/volume_designs',
        title: '分卷目标与阶段边界',
        description: '把整书大纲拆成可执行的卷级任务，明确每卷主题、起止状态、高潮节点和与章节计划的衔接。',
        focus: ['分卷主题和目标', '卷内冲突曲线', '卷尾状态变化']
    },
    {
        key: 'chapter_plans',
        label: '章节计划',
        icon: '章',
        path: '/generate/chapter_plans',
        title: '章节标题、简介与事件安排',
        description: '在章节粒度锁定标题、简介、核心事件、出场实体和推进职责，减少正文生成时的漂移。',
        focus: ['章节标题和简介', '核心事件与冲突值', '角色地点等实体准入']
    },
    {
        key: 'chapter_blueprints',
        label: '章节蓝图',
        icon: '图',
        path: '/generate/chapter_blueprints',
        title: '场景卡与正文生成蓝图',
        description: '把章节计划进一步拆成场景顺序、POV、信息增量、钩子和伏笔职责，作为正文生成的直接依据。',
        focus: ['场景顺序和 POV', '信息增量与钩子', '伏笔埋设和回收职责']
    }
];
const moduleKeys = new Set(planningModules.map((item) => item.key));
function normalizeModule(value) {
    const raw = Array.isArray(value) ? value[0] : value;
    return typeof raw === 'string' && moduleKeys.has(raw) ? raw : 'outlines';
}
const activeModule = ref(normalizeModule(route.query.module));
const activeModuleMeta = computed(() => planningModules.find((item) => item.key === activeModule.value) ?? planningModules[0]);
watch(() => route.query.module, (module) => {
    const nextModule = normalizeModule(module);
    if (nextModule !== activeModule.value)
        activeModule.value = nextModule;
});
watch(activeModule, (module) => {
    if (normalizeModule(route.query.module) === module)
        return;
    const query = { ...route.query, module };
    void router.replace({ query });
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['subtitle']} */ ;
/** @type {__VLS_StyleScopedClasses['module-mark']} */ ;
/** @type {__VLS_StyleScopedClasses['current-module']} */ ;
/** @type {__VLS_StyleScopedClasses['module-mark']} */ ;
/** @type {__VLS_StyleScopedClasses['current-module']} */ ;
/** @type {__VLS_StyleScopedClasses['tab-label']} */ ;
/** @type {__VLS_StyleScopedClasses['module-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['module-copy']} */ ;
/** @type {__VLS_StyleScopedClasses['focus-item']} */ ;
/** @type {__VLS_StyleScopedClasses['module-entry']} */ ;
/** @type {__VLS_StyleScopedClasses['quick-card']} */ ;
/** @type {__VLS_StyleScopedClasses['quick-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['quick-card']} */ ;
/** @type {__VLS_StyleScopedClasses['quick-card']} */ ;
/** @type {__VLS_StyleScopedClasses['planning-hero']} */ ;
/** @type {__VLS_StyleScopedClasses['module-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['current-module']} */ ;
/** @type {__VLS_StyleScopedClasses['quick-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['planning-hero']} */ ;
/** @type {__VLS_StyleScopedClasses['quick-grid']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "planning-workspace" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "planning-hero" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "eyebrow" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "subtitle" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
(__VLS_ctx.activeModuleMeta.label);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "current-module" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "module-mark" },
});
(__VLS_ctx.activeModuleMeta.icon);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
(__VLS_ctx.activeModuleMeta.title);
const __VLS_0 = {}.ElTabs;
/** @type {[typeof __VLS_components.ElTabs, typeof __VLS_components.elTabs, typeof __VLS_components.ElTabs, typeof __VLS_components.elTabs, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    modelValue: (__VLS_ctx.activeModule),
    type: "border-card",
    ...{ class: "planning-tabs" },
}));
const __VLS_2 = __VLS_1({
    modelValue: (__VLS_ctx.activeModule),
    type: "border-card",
    ...{ class: "planning-tabs" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_3.slots.default;
for (const [module] of __VLS_getVForSourceType((__VLS_ctx.planningModules))) {
    const __VLS_4 = {}.ElTabPane;
    /** @type {[typeof __VLS_components.ElTabPane, typeof __VLS_components.elTabPane, typeof __VLS_components.ElTabPane, typeof __VLS_components.elTabPane, ]} */ ;
    // @ts-ignore
    const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
        key: (module.key),
        name: (module.key),
    }));
    const __VLS_6 = __VLS_5({
        key: (module.key),
        name: (module.key),
    }, ...__VLS_functionalComponentArgsRest(__VLS_5));
    __VLS_7.slots.default;
    {
        const { label: __VLS_thisSlot } = __VLS_7.slots;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "tab-label" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (module.icon);
        (module.label);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "module-panel" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "module-copy" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "module-icon" },
    });
    (module.icon);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
    (module.title);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    (module.description);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "focus-list" },
    });
    for (const [item] of __VLS_getVForSourceType((module.focus))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            key: (item),
            ...{ class: "focus-item" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (item);
    }
    const __VLS_8 = {}.RouterLink;
    /** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ ;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
        to: (module.path),
        ...{ class: "module-entry" },
    }));
    const __VLS_10 = __VLS_9({
        to: (module.path),
        ...{ class: "module-entry" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_9));
    __VLS_11.slots.default;
    (module.label);
    const __VLS_12 = {}.ElIcon;
    /** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
    // @ts-ignore
    const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({}));
    const __VLS_14 = __VLS_13({}, ...__VLS_functionalComponentArgsRest(__VLS_13));
    __VLS_15.slots.default;
    const __VLS_16 = {}.ArrowRight;
    /** @type {[typeof __VLS_components.ArrowRight, ]} */ ;
    // @ts-ignore
    const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({}));
    const __VLS_18 = __VLS_17({}, ...__VLS_functionalComponentArgsRest(__VLS_17));
    var __VLS_15;
    var __VLS_11;
    var __VLS_7;
}
var __VLS_3;
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "quick-grid" },
    'aria-label': "规划模块快捷入口",
});
for (const [module] of __VLS_getVForSourceType((__VLS_ctx.planningModules))) {
    const __VLS_20 = {}.RouterLink;
    /** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ ;
    // @ts-ignore
    const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
        key: (module.key),
        to: (module.path),
        ...{ class: "quick-card" },
        ...{ class: ({ active: __VLS_ctx.activeModule === module.key }) },
    }));
    const __VLS_22 = __VLS_21({
        key: (module.key),
        to: (module.path),
        ...{ class: "quick-card" },
        ...{ class: ({ active: __VLS_ctx.activeModule === module.key }) },
    }, ...__VLS_functionalComponentArgsRest(__VLS_21));
    __VLS_23.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "quick-icon" },
    });
    (module.icon);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (module.label);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
    (module.title);
    var __VLS_23;
}
/** @type {__VLS_StyleScopedClasses['planning-workspace']} */ ;
/** @type {__VLS_StyleScopedClasses['planning-hero']} */ ;
/** @type {__VLS_StyleScopedClasses['eyebrow']} */ ;
/** @type {__VLS_StyleScopedClasses['subtitle']} */ ;
/** @type {__VLS_StyleScopedClasses['current-module']} */ ;
/** @type {__VLS_StyleScopedClasses['module-mark']} */ ;
/** @type {__VLS_StyleScopedClasses['planning-tabs']} */ ;
/** @type {__VLS_StyleScopedClasses['tab-label']} */ ;
/** @type {__VLS_StyleScopedClasses['module-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['module-copy']} */ ;
/** @type {__VLS_StyleScopedClasses['module-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['focus-list']} */ ;
/** @type {__VLS_StyleScopedClasses['focus-item']} */ ;
/** @type {__VLS_StyleScopedClasses['module-entry']} */ ;
/** @type {__VLS_StyleScopedClasses['quick-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['quick-card']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['quick-icon']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            ArrowRight: ArrowRight,
            planningModules: planningModules,
            activeModule: activeModule,
            activeModuleMeta: activeModuleMeta,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
