import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useI18n } from '@/composables/useI18n';
import { getGenerationFlowStatus, getPromptRunSnapshot, listPromptRunSnapshots, packageGenerationContext } from '@/api/modules/generation';
import { useWorkContextStore } from '@/stores/workContext';
const workContext = useWorkContextStore();
const router = useRouter();
const { t } = useI18n();
const packaging = ref(false);
const loadingStatus = ref(false);
const loadingSnapshots = ref(false);
const packageResult = ref(null);
const flowStatus = ref(null);
const promptSnapshots = ref([]);
const snapshotDrawer = ref(false);
const selectedSnapshot = ref(null);
const fallbackCards = [
    {
        key: 'novel_seed',
        title: 'AI 开书',
        path: '/generate/novel-seed',
        icon: '1',
        desc: '从描述或分步工作流生成整书故事、元信息、分卷、章节卡和基础设定。'
    },
    {
        key: 'knowledge_base',
        title: '五件套绑定',
        path: '/generate/tianming-protocol',
        icon: '2',
        desc: '绑定世界基石、世界观规则、角色档案、档案事件、文风样本，运行缺失检测。'
    },
    {
        key: 'outline',
        title: '大纲/规划',
        path: '/generate/planning?module=outlines',
        icon: '3',
        desc: '维护整书大纲、分卷目标、阶段推进和长期结构。'
    },
    {
        key: 'chapter_plans',
        title: '章节计划',
        path: '/generate/planning?module=chapter_plans',
        icon: '4',
        desc: '确认章节标题、简介、核心事件、实体准入、冲突值和宏观阶段。'
    },
    {
        key: 'chapter_blueprints',
        title: '章节蓝图',
        path: '/generate/planning?module=chapter_blueprints',
        icon: '5',
        desc: '把章节拆成场景卡，确认场景顺序、信息增量、POV、钩子和伏笔职责。'
    },
    {
        key: 'tracking',
        title: '叙事追踪',
        path: '/generate/tracking',
        icon: '6',
        desc: '维护伏笔账本和时间线，控制长篇连续生成的因果、回收和时间推进。'
    },
    {
        key: 'preflight',
        title: '生成预检',
        path: '/generate/chapters',
        icon: '7',
        desc: '在章节生成页执行预检，确认项目、分卷、章节计划和蓝图可用。'
    },
    {
        key: 'draft',
        title: '场景/正文',
        path: '/generate/chapters',
        icon: '8',
        desc: '按场景生成正文，合成章节，或启用后台批量自动生成。'
    },
    {
        key: 'validation',
        title: '体检',
        path: '/validate',
        icon: '9',
        desc: '校验事实、角色、地点、伏笔、章节连续性和生成质量。'
    },
    {
        key: 'archive',
        title: '存档/打包',
        path: '/generate',
        icon: '10',
        desc: '打包当前上下文快照，保留 manifest、模块 hash 和后续生成依据。'
    }
];
const cards = computed(() => {
    const steps = flowStatus.value?.steps ?? [];
    return fallbackCards.map((card) => {
        const step = steps.find((item) => item.key === card.key);
        return {
            ...card,
            ready: step?.status === 'ready',
            count: step?.count ?? 0,
            message: step?.message ?? card.desc,
            lastUpdatedAt: step?.lastUpdatedAt ?? null,
            path: normalizeStepPath(step?.path || card.path)
        };
    });
});
function normalizeStepPath(path) {
    if (path === '/generate/outlines')
        return '/generate/planning?module=outlines';
    if (path === '/generate/volume_designs')
        return '/generate/planning?module=volume_designs';
    if (path === '/generate/chapter_plans')
        return '/generate/planning?module=chapter_plans';
    if (path === '/generate/chapter_blueprints')
        return '/generate/planning?module=chapter_blueprints';
    if (path === '/generate/gate')
        return '/generate/tracking';
    return path;
}
const nextSuggestion = computed(() => workContext.selectedProjectId
    ? flowStatus.value?.nextSuggestion || '正在读取当前项目的生成流程状态。'
    : '先选择或创建项目，再查看生成流程状态。');
const nextAction = computed(() => {
    if (!workContext.selectedProjectId)
        return null;
    const suggestionText = normalizeActionText(nextSuggestion.value);
    const suggestedCard = cards.value.find((card) => {
        if (!card.path)
            return false;
        const candidates = [
            card.key,
            card.key.replace(/_/g, ''),
            card.title,
            card.message,
            card.desc
        ].map(normalizeActionText);
        return candidates.some((candidate) => candidate && suggestionText.includes(candidate));
    });
    const readyCards = cards.value.filter((card) => card.ready && card.path);
    return suggestedCard ?? readyCards[0] ?? null;
});
function normalizeActionText(value) {
    return value
        .replace(/^待完成[:：]\s*/, '')
        .replace(/[\s_/:：，。,.、/()（）-]+/g, '')
        .toLowerCase();
}
async function continueNextAction() {
    if (!nextAction.value)
        return;
    await router.push(nextAction.value.path);
}
async function refreshFlow() {
    if (!workContext.selectedProjectId) {
        flowStatus.value = null;
        promptSnapshots.value = [];
        return;
    }
    loadingStatus.value = true;
    loadingSnapshots.value = true;
    try {
        const [status, snapshots] = await Promise.all([
            getGenerationFlowStatus(workContext.selectedProjectId),
            listPromptRunSnapshots({ projectId: workContext.selectedProjectId, take: 12 })
        ]);
        flowStatus.value = status;
        promptSnapshots.value = snapshots;
    }
    catch (err) {
        ElMessage.error(err.message || '加载生成流程状态失败。');
    }
    finally {
        loadingStatus.value = false;
        loadingSnapshots.value = false;
    }
}
async function runPackaging() {
    if (!workContext.selectedProjectId) {
        ElMessage.warning(t('generationWorkbench.messages.selectProjectFirst'));
        return;
    }
    packaging.value = true;
    try {
        packageResult.value = await packageGenerationContext(workContext.selectedProjectId, workContext.selectedProject?.currentSourceBookId ?? null);
        ElMessage.success(t('generationWorkbench.messages.packageSuccess', {
            version: packageResult.value.version,
            files: packageResult.value.fileCount
        }));
        await refreshFlow();
    }
    catch (err) {
        ElMessage.error(err.message || t('generationWorkbench.messages.packageFailed'));
    }
    finally {
        packaging.value = false;
    }
}
async function openSnapshot(item) {
    selectedSnapshot.value = item;
    snapshotDrawer.value = true;
    try {
        selectedSnapshot.value = await getPromptRunSnapshot(item.id);
    }
    catch (err) {
        ElMessage.error(err.message || '加载 Prompt 快照详情失败。');
    }
}
function formatTime(value) {
    return value ? new Date(value).toLocaleString() : '暂无';
}
onMounted(() => {
    void refreshFlow();
});
watch(() => workContext.selectedProjectId, () => {
    packageResult.value = null;
    void refreshFlow();
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['context-row']} */ ;
/** @type {__VLS_StyleScopedClasses['next-action']} */ ;
/** @type {__VLS_StyleScopedClasses['flow-head']} */ ;
/** @type {__VLS_StyleScopedClasses['flow-head']} */ ;
/** @type {__VLS_StyleScopedClasses['module-card']} */ ;
/** @type {__VLS_StyleScopedClasses['module-card']} */ ;
/** @type {__VLS_StyleScopedClasses['module-card']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['module-card']} */ ;
/** @type {__VLS_StyleScopedClasses['module-card']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled']} */ ;
/** @type {__VLS_StyleScopedClasses['card-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['card-title']} */ ;
/** @type {__VLS_StyleScopedClasses['snapshot-item']} */ ;
/** @type {__VLS_StyleScopedClasses['snapshot-item']} */ ;
/** @type {__VLS_StyleScopedClasses['snapshot-item']} */ ;
/** @type {__VLS_StyleScopedClasses['snapshot-item']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['snapshot-detail']} */ ;
/** @type {__VLS_StyleScopedClasses['snapshot-detail']} */ ;
/** @type {__VLS_StyleScopedClasses['hero']} */ ;
/** @type {__VLS_StyleScopedClasses['card-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['package-head']} */ ;
/** @type {__VLS_StyleScopedClasses['next-action']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-grid']} */ ;
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
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "flow-panel" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "next-action" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "next-label" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
(__VLS_ctx.nextSuggestion);
const __VLS_4 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
    ...{ 'onClick': {} },
    type: "primary",
    disabled: (!__VLS_ctx.nextAction),
}));
const __VLS_6 = __VLS_5({
    ...{ 'onClick': {} },
    type: "primary",
    disabled: (!__VLS_ctx.nextAction),
}, ...__VLS_functionalComponentArgsRest(__VLS_5));
let __VLS_8;
let __VLS_9;
let __VLS_10;
const __VLS_11 = {
    onClick: (__VLS_ctx.continueNextAction)
};
__VLS_7.slots.default;
var __VLS_7;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flow-head" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
const __VLS_12 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
    ...{ 'onClick': {} },
    loading: (__VLS_ctx.loadingStatus || __VLS_ctx.loadingSnapshots),
}));
const __VLS_14 = __VLS_13({
    ...{ 'onClick': {} },
    loading: (__VLS_ctx.loadingStatus || __VLS_ctx.loadingSnapshots),
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
let __VLS_16;
let __VLS_17;
let __VLS_18;
const __VLS_19 = {
    onClick: (__VLS_ctx.refreshFlow)
};
__VLS_15.slots.default;
var __VLS_15;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "card-grid" },
});
__VLS_asFunctionalDirective(__VLS_directives.vLoading)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.loadingStatus) }, null, null);
for (const [card] of __VLS_getVForSourceType((__VLS_ctx.cards))) {
    const __VLS_20 = ((card.ready && card.path ? 'router-link' : 'div'));
    // @ts-ignore
    const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
        key: (card.title),
        to: (card.ready && card.path ? card.path : undefined),
        ...{ class: "module-card" },
        ...{ class: ({ disabled: !card.ready, active: __VLS_ctx.nextAction?.key === card.key }) },
    }));
    const __VLS_22 = __VLS_21({
        key: (card.title),
        to: (card.ready && card.path ? card.path : undefined),
        ...{ class: "module-card" },
        ...{ class: ({ disabled: !card.ready, active: __VLS_ctx.nextAction?.key === card.key }) },
    }, ...__VLS_functionalComponentArgsRest(__VLS_21));
    __VLS_23.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "card-icon" },
    });
    (card.icon);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "card-title" },
    });
    (card.title);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.em, __VLS_intrinsicElements.em)({});
    (card.count);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "card-desc" },
    });
    (card.message);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "card-time" },
    });
    (__VLS_ctx.formatTime(card.lastUpdatedAt));
    const __VLS_24 = {}.ElTag;
    /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
    // @ts-ignore
    const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
        size: "small",
        type: (card.ready ? 'success' : 'warning'),
    }));
    const __VLS_26 = __VLS_25({
        size: "small",
        type: (card.ready ? 'success' : 'warning'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_25));
    __VLS_27.slots.default;
    (card.ready ? __VLS_ctx.t('generationWorkbench.cardStatus.ready') : __VLS_ctx.t('generationWorkbench.cardStatus.pending'));
    var __VLS_27;
    var __VLS_23;
}
const __VLS_28 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
    shadow: "never",
    ...{ class: "package-panel" },
}));
const __VLS_30 = __VLS_29({
    shadow: "never",
    ...{ class: "package-panel" },
}, ...__VLS_functionalComponentArgsRest(__VLS_29));
__VLS_31.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "package-head" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "package-title" },
});
(__VLS_ctx.t('generationWorkbench.cards.package.title'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "package-desc" },
});
(__VLS_ctx.t('generationWorkbench.cards.package.desc'));
const __VLS_32 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
    ...{ 'onClick': {} },
    type: "primary",
    loading: (__VLS_ctx.packaging),
}));
const __VLS_34 = __VLS_33({
    ...{ 'onClick': {} },
    type: "primary",
    loading: (__VLS_ctx.packaging),
}, ...__VLS_functionalComponentArgsRest(__VLS_33));
let __VLS_36;
let __VLS_37;
let __VLS_38;
const __VLS_39 = {
    onClick: (__VLS_ctx.runPackaging)
};
__VLS_35.slots.default;
(__VLS_ctx.t('generationWorkbench.actions.packageNow'));
var __VLS_35;
if (!__VLS_ctx.packageResult) {
    const __VLS_40 = {}.ElEmpty;
    /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
    // @ts-ignore
    const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
        description: (__VLS_ctx.t('generationWorkbench.empty.package')),
        imageSize: (72),
    }));
    const __VLS_42 = __VLS_41({
        description: (__VLS_ctx.t('generationWorkbench.empty.package')),
        imageSize: (72),
    }, ...__VLS_functionalComponentArgsRest(__VLS_41));
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "package-meta" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    (__VLS_ctx.t('generationWorkbench.labels.packageVersion', { value: __VLS_ctx.packageResult.version }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    (__VLS_ctx.t('generationWorkbench.labels.packageFiles', { value: __VLS_ctx.packageResult.fileCount }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    (__VLS_ctx.t('generationWorkbench.labels.packageModules', { value: __VLS_ctx.packageResult.enabledModuleCount }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    (__VLS_ctx.t('generationWorkbench.labels.packageTime', { value: new Date(__VLS_ctx.packageResult.publishedAt).toLocaleString() }));
}
var __VLS_31;
const __VLS_44 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
    shadow: "never",
    ...{ class: "snapshot-panel" },
}));
const __VLS_46 = __VLS_45({
    shadow: "never",
    ...{ class: "snapshot-panel" },
}, ...__VLS_functionalComponentArgsRest(__VLS_45));
__VLS_47.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "package-head" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "package-title" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "package-desc" },
});
const __VLS_48 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
    ...{ 'onClick': {} },
    loading: (__VLS_ctx.loadingSnapshots),
}));
const __VLS_50 = __VLS_49({
    ...{ 'onClick': {} },
    loading: (__VLS_ctx.loadingSnapshots),
}, ...__VLS_functionalComponentArgsRest(__VLS_49));
let __VLS_52;
let __VLS_53;
let __VLS_54;
const __VLS_55 = {
    onClick: (__VLS_ctx.refreshFlow)
};
__VLS_51.slots.default;
var __VLS_51;
if (!__VLS_ctx.loadingSnapshots && __VLS_ctx.promptSnapshots.length === 0) {
    const __VLS_56 = {}.ElEmpty;
    /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
    // @ts-ignore
    const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
        description: "暂无 Prompt 运行快照。",
        imageSize: (72),
    }));
    const __VLS_58 = __VLS_57({
        description: "暂无 Prompt 运行快照。",
        imageSize: (72),
    }, ...__VLS_functionalComponentArgsRest(__VLS_57));
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "snapshot-list" },
    });
    __VLS_asFunctionalDirective(__VLS_directives.vLoading)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.loadingSnapshots) }, null, null);
    for (const [item] of __VLS_getVForSourceType((__VLS_ctx.promptSnapshots))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.loadingSnapshots && __VLS_ctx.promptSnapshots.length === 0))
                        return;
                    __VLS_ctx.openSnapshot(item);
                } },
            key: (item.id),
            type: "button",
            ...{ class: "snapshot-item" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
        (item.source);
        if (item.stepKey) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            (item.stepKey);
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (item.model || '未记录模型');
        (item.success ? '成功' : '失败');
        (__VLS_ctx.formatTime(item.createdAt));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
        (item.outputSummary || item.error || '暂无输出摘要');
    }
}
var __VLS_47;
const __VLS_60 = {}.ElDrawer;
/** @type {[typeof __VLS_components.ElDrawer, typeof __VLS_components.elDrawer, typeof __VLS_components.ElDrawer, typeof __VLS_components.elDrawer, ]} */ ;
// @ts-ignore
const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
    modelValue: (__VLS_ctx.snapshotDrawer),
    title: "Prompt 运行快照",
    size: "52%",
}));
const __VLS_62 = __VLS_61({
    modelValue: (__VLS_ctx.snapshotDrawer),
    title: "Prompt 运行快照",
    size: "52%",
}, ...__VLS_functionalComponentArgsRest(__VLS_61));
__VLS_63.slots.default;
if (__VLS_ctx.selectedSnapshot) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "snapshot-detail" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "detail-grid" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.selectedSnapshot.source);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.selectedSnapshot.model || '未记录');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.selectedSnapshot.success ? '成功' : '失败');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.selectedSnapshot.elapsedMs);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.selectedSnapshot.contextHash || '无');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.formatTime(__VLS_ctx.selectedSnapshot.createdAt));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.pre, __VLS_intrinsicElements.pre)({});
    (__VLS_ctx.selectedSnapshot.contextSummary || '暂无');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.pre, __VLS_intrinsicElements.pre)({});
    (__VLS_ctx.selectedSnapshot.promptSummary || '暂无');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.pre, __VLS_intrinsicElements.pre)({});
    (__VLS_ctx.selectedSnapshot.outputSummary || '暂无');
    if (__VLS_ctx.selectedSnapshot.error) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
    }
    if (__VLS_ctx.selectedSnapshot.error) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.pre, __VLS_intrinsicElements.pre)({});
        (__VLS_ctx.selectedSnapshot.error);
    }
}
var __VLS_63;
/** @type {__VLS_StyleScopedClasses['generation-workbench']} */ ;
/** @type {__VLS_StyleScopedClasses['hero']} */ ;
/** @type {__VLS_StyleScopedClasses['eyebrow']} */ ;
/** @type {__VLS_StyleScopedClasses['subtitle']} */ ;
/** @type {__VLS_StyleScopedClasses['context-card']} */ ;
/** @type {__VLS_StyleScopedClasses['context-row']} */ ;
/** @type {__VLS_StyleScopedClasses['context-row']} */ ;
/** @type {__VLS_StyleScopedClasses['flow-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['next-action']} */ ;
/** @type {__VLS_StyleScopedClasses['next-label']} */ ;
/** @type {__VLS_StyleScopedClasses['flow-head']} */ ;
/** @type {__VLS_StyleScopedClasses['card-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['module-card']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['card-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['card-title']} */ ;
/** @type {__VLS_StyleScopedClasses['card-desc']} */ ;
/** @type {__VLS_StyleScopedClasses['card-time']} */ ;
/** @type {__VLS_StyleScopedClasses['package-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['package-head']} */ ;
/** @type {__VLS_StyleScopedClasses['package-title']} */ ;
/** @type {__VLS_StyleScopedClasses['package-desc']} */ ;
/** @type {__VLS_StyleScopedClasses['package-meta']} */ ;
/** @type {__VLS_StyleScopedClasses['snapshot-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['package-head']} */ ;
/** @type {__VLS_StyleScopedClasses['package-title']} */ ;
/** @type {__VLS_StyleScopedClasses['package-desc']} */ ;
/** @type {__VLS_StyleScopedClasses['snapshot-list']} */ ;
/** @type {__VLS_StyleScopedClasses['snapshot-item']} */ ;
/** @type {__VLS_StyleScopedClasses['snapshot-detail']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-grid']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            workContext: workContext,
            t: t,
            packaging: packaging,
            loadingStatus: loadingStatus,
            loadingSnapshots: loadingSnapshots,
            packageResult: packageResult,
            promptSnapshots: promptSnapshots,
            snapshotDrawer: snapshotDrawer,
            selectedSnapshot: selectedSnapshot,
            cards: cards,
            nextSuggestion: nextSuggestion,
            nextAction: nextAction,
            continueNextAction: continueNextAction,
            refreshFlow: refreshFlow,
            runPackaging: runPackaging,
            openSnapshot: openSnapshot,
            formatTime: formatTime,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
