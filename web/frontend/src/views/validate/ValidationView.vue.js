import { computed, onMounted, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { useWorkContextStore } from '@/stores/workContext';
import { getFactSnapshot, listValidationReports, listValidationSummaries, runValidation, updateValidationReportChapterStatus } from '@/api/modules/validation';
const workContext = useWorkContextStore();
const loading = ref(false);
const running = ref(false);
const summaries = ref([]);
const reports = ref([]);
const facts = ref(null);
const updatingReportId = ref('');
const selectedVolumeNumber = computed(() => workContext.selectedVolume?.volumeNumber ?? null);
const targetLabel = computed(() => {
    if (!workContext.selectedProject)
        return '未选择项目';
    if (!workContext.selectedVolume)
        return workContext.selectedProject.name;
    return `${workContext.selectedProject.name} / 第 ${workContext.selectedVolume.volumeNumber} 卷`;
});
function resultType(result) {
    if (result === 'passed')
        return 'success';
    if (result === 'failed')
        return 'danger';
    return 'warning';
}
function statusType(status) {
    if (status === 'validated')
        return 'success';
    if (status === 'needs_fix')
        return 'danger';
    if (status === 'drafted')
        return 'warning';
    return 'info';
}
function formatTime(value) {
    return value ? new Date(value).toLocaleString() : '-';
}
function parseJsonText(value) {
    if (!value)
        return '';
    try {
        return JSON.stringify(JSON.parse(value), null, 2);
    }
    catch {
        return value;
    }
}
const factOverviewCards = computed(() => {
    const overview = facts.value?.overview;
    if (!overview)
        return [];
    return [
        { label: '章节范围', value: overview.chapterCount, hint: '当前快照覆盖章节' },
        { label: '角色状态', value: overview.characterStateCount, hint: `${overview.characterStatePointCount} 条状态点` },
        { label: '角色设定', value: overview.characterDescriptionCount, hint: 'Design CharacterRule' },
        { label: '冲突进度', value: overview.conflictProgressCount, hint: `${overview.conflictProgressPointCount} 条推进点` },
        { label: '势力状态', value: overview.factionStateCount, hint: `${overview.factionStatePointCount} 条状态点` },
        { label: '地点状态', value: overview.locationStateCount, hint: `${overview.locationStatePointCount} 条状态点` },
        { label: '地点设定', value: overview.locationDescriptionCount, hint: 'Design LocationRule' },
        { label: '世界约束', value: overview.worldRuleConstraintCount, hint: '硬规则/特殊法则' },
        { label: '角色位置', value: overview.characterLocationCount, hint: `${overview.characterMovementCount} 条移动` },
        { label: '物品状态', value: overview.itemStateCount, hint: `${overview.itemStatePointCount} 条状态点` },
        { label: '伏笔', value: overview.foreshadowingCount, hint: `未回收 ${overview.unresolvedForeshadowingCount} · 逾期 ${overview.overdueForeshadowingCount}` },
        { label: '情节点', value: overview.plotPointCount, hint: `${overview.timelineCount} 条时间线` },
        { label: '卷归档', value: overview.volumeArchiveCount, hint: 'VolumeFactArchive' }
    ];
});
async function refresh() {
    if (!workContext.selectedProjectId) {
        summaries.value = [];
        reports.value = [];
        facts.value = null;
        return;
    }
    loading.value = true;
    try {
        const volumeNumber = selectedVolumeNumber.value;
        const [summaryRows, reportRows, factSnapshot] = await Promise.all([
            listValidationSummaries(workContext.selectedProjectId, volumeNumber),
            listValidationReports(workContext.selectedProjectId, volumeNumber, null, 100),
            getFactSnapshot(workContext.selectedProjectId, volumeNumber)
        ]);
        summaries.value = summaryRows;
        reports.value = reportRows;
        facts.value = factSnapshot;
    }
    catch (err) {
        ElMessage.error(err.message || '加载校验数据失败');
    }
    finally {
        loading.value = false;
    }
}
async function runCurrentValidation() {
    if (!workContext.selectedProjectId) {
        ElMessage.warning('请先选择项目');
        return;
    }
    running.value = true;
    try {
        await runValidation({
            projectId: workContext.selectedProjectId,
            volumeNumber: selectedVolumeNumber.value
        });
        ElMessage.success('校验完成');
        await refresh();
    }
    catch (err) {
        ElMessage.error(err.message || '校验失败');
    }
    finally {
        running.value = false;
    }
}
async function markChapterStatus(report, status) {
    updatingReportId.value = report.id;
    try {
        await updateValidationReportChapterStatus(report.id, status, status === 'needs_fix' ? '校验报告标记待修复' : '校验报告标记已验证');
        ElMessage.success(status === 'needs_fix' ? '已标记待修复' : '已标记已验证');
        await refresh();
    }
    catch (err) {
        ElMessage.error(err.message || '更新章节状态失败');
    }
    finally {
        updatingReportId.value = '';
    }
}
watch(() => [workContext.selectedProjectId, workContext.selectedVolumeId], refresh);
onMounted(refresh);
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['fact-metric']} */ ;
/** @type {__VLS_StyleScopedClasses['fact-metric']} */ ;
/** @type {__VLS_StyleScopedClasses['fact-metric']} */ ;
/** @type {__VLS_StyleScopedClasses['section-summary']} */ ;
/** @type {__VLS_StyleScopedClasses['summary-card']} */ ;
/** @type {__VLS_StyleScopedClasses['hero']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "validation-page" },
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
    ...{ class: "action-card" },
}));
const __VLS_2 = __VLS_1({
    shadow: "never",
    ...{ class: "action-card" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_3.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "context-label" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
(__VLS_ctx.targetLabel);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "actions" },
});
const __VLS_4 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
    ...{ 'onClick': {} },
    loading: (__VLS_ctx.loading),
}));
const __VLS_6 = __VLS_5({
    ...{ 'onClick': {} },
    loading: (__VLS_ctx.loading),
}, ...__VLS_functionalComponentArgsRest(__VLS_5));
let __VLS_8;
let __VLS_9;
let __VLS_10;
const __VLS_11 = {
    onClick: (__VLS_ctx.refresh)
};
__VLS_7.slots.default;
var __VLS_7;
const __VLS_12 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
    ...{ 'onClick': {} },
    type: "primary",
    loading: (__VLS_ctx.running),
}));
const __VLS_14 = __VLS_13({
    ...{ 'onClick': {} },
    type: "primary",
    loading: (__VLS_ctx.running),
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
let __VLS_16;
let __VLS_17;
let __VLS_18;
const __VLS_19 = {
    onClick: (__VLS_ctx.runCurrentValidation)
};
__VLS_15.slots.default;
var __VLS_15;
var __VLS_3;
const __VLS_20 = {}.ElRow;
/** @type {[typeof __VLS_components.ElRow, typeof __VLS_components.elRow, typeof __VLS_components.ElRow, typeof __VLS_components.elRow, ]} */ ;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
    gutter: (16),
}));
const __VLS_22 = __VLS_21({
    gutter: (16),
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
__VLS_23.slots.default;
const __VLS_24 = {}.ElCol;
/** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
    span: (8),
}));
const __VLS_26 = __VLS_25({
    span: (8),
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
__VLS_27.slots.default;
const __VLS_28 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
    shadow: "never",
    ...{ class: "panel" },
}));
const __VLS_30 = __VLS_29({
    shadow: "never",
    ...{ class: "panel" },
}, ...__VLS_functionalComponentArgsRest(__VLS_29));
__VLS_31.slots.default;
{
    const { header: __VLS_thisSlot } = __VLS_31.slots;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "panel-title" },
    });
}
if (__VLS_ctx.summaries.length === 0) {
    const __VLS_32 = {}.ElEmpty;
    /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
    // @ts-ignore
    const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
        description: "暂无汇总",
    }));
    const __VLS_34 = __VLS_33({
        description: "暂无汇总",
    }, ...__VLS_functionalComponentArgsRest(__VLS_33));
}
for (const [summary] of __VLS_getVForSourceType((__VLS_ctx.summaries))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        key: (summary.id),
        ...{ class: "summary-card" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "summary-head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (summary.targetVolumeNumber === 0 ? '全书' : `第 ${summary.targetVolumeNumber} 卷`);
    const __VLS_36 = {}.ElTag;
    /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
    // @ts-ignore
    const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
        type: (__VLS_ctx.resultType(summary.overallResult)),
    }));
    const __VLS_38 = __VLS_37({
        type: (__VLS_ctx.resultType(summary.overallResult)),
    }, ...__VLS_functionalComponentArgsRest(__VLS_37));
    __VLS_39.slots.default;
    (summary.overallResult);
    var __VLS_39;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "meta" },
    });
    (__VLS_ctx.formatTime(summary.lastValidatedAt));
    const __VLS_40 = {}.ElCollapse;
    /** @type {[typeof __VLS_components.ElCollapse, typeof __VLS_components.elCollapse, typeof __VLS_components.ElCollapse, typeof __VLS_components.elCollapse, ]} */ ;
    // @ts-ignore
    const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({}));
    const __VLS_42 = __VLS_41({}, ...__VLS_functionalComponentArgsRest(__VLS_41));
    __VLS_43.slots.default;
    const __VLS_44 = {}.ElCollapseItem;
    /** @type {[typeof __VLS_components.ElCollapseItem, typeof __VLS_components.elCollapseItem, typeof __VLS_components.ElCollapseItem, typeof __VLS_components.elCollapseItem, ]} */ ;
    // @ts-ignore
    const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
        title: "ModuleResults",
        name: (`${summary.id}-modules`),
    }));
    const __VLS_46 = __VLS_45({
        title: "ModuleResults",
        name: (`${summary.id}-modules`),
    }, ...__VLS_functionalComponentArgsRest(__VLS_45));
    __VLS_47.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.pre, __VLS_intrinsicElements.pre)({});
    (__VLS_ctx.parseJsonText(summary.moduleResults));
    var __VLS_47;
    const __VLS_48 = {}.ElCollapseItem;
    /** @type {[typeof __VLS_components.ElCollapseItem, typeof __VLS_components.elCollapseItem, typeof __VLS_components.ElCollapseItem, typeof __VLS_components.elCollapseItem, ]} */ ;
    // @ts-ignore
    const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
        title: "ProblemItems",
        name: (`${summary.id}-problems`),
    }));
    const __VLS_50 = __VLS_49({
        title: "ProblemItems",
        name: (`${summary.id}-problems`),
    }, ...__VLS_functionalComponentArgsRest(__VLS_49));
    __VLS_51.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.pre, __VLS_intrinsicElements.pre)({});
    (__VLS_ctx.parseJsonText(summary.problemItems));
    var __VLS_51;
    var __VLS_43;
}
var __VLS_31;
var __VLS_27;
const __VLS_52 = {}.ElCol;
/** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
// @ts-ignore
const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
    span: (16),
}));
const __VLS_54 = __VLS_53({
    span: (16),
}, ...__VLS_functionalComponentArgsRest(__VLS_53));
__VLS_55.slots.default;
const __VLS_56 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
    shadow: "never",
    ...{ class: "panel" },
}));
const __VLS_58 = __VLS_57({
    shadow: "never",
    ...{ class: "panel" },
}, ...__VLS_functionalComponentArgsRest(__VLS_57));
__VLS_59.slots.default;
{
    const { header: __VLS_thisSlot } = __VLS_59.slots;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "panel-title" },
    });
}
const __VLS_60 = {}.ElTable;
/** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
// @ts-ignore
const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
    data: (__VLS_ctx.reports),
    rowKey: "id",
    border: true,
}));
const __VLS_62 = __VLS_61({
    data: (__VLS_ctx.reports),
    rowKey: "id",
    border: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_61));
__VLS_asFunctionalDirective(__VLS_directives.vLoading)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.loading) }, null, null);
__VLS_63.slots.default;
const __VLS_64 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
    label: "章节",
    minWidth: "180",
}));
const __VLS_66 = __VLS_65({
    label: "章节",
    minWidth: "180",
}, ...__VLS_functionalComponentArgsRest(__VLS_65));
__VLS_67.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_67.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    (row.chapterNumber || '-');
    (row.chapterTitle || row.chapterId);
}
var __VLS_67;
const __VLS_68 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
    prop: "summary",
    label: "摘要",
    minWidth: "180",
}));
const __VLS_70 = __VLS_69({
    prop: "summary",
    label: "摘要",
    minWidth: "180",
}, ...__VLS_functionalComponentArgsRest(__VLS_69));
const __VLS_72 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
    label: "结果",
    width: "110",
}));
const __VLS_74 = __VLS_73({
    label: "结果",
    width: "110",
}, ...__VLS_functionalComponentArgsRest(__VLS_73));
__VLS_75.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_75.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    const __VLS_76 = {}.ElTag;
    /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
    // @ts-ignore
    const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({
        type: (__VLS_ctx.resultType(row.result)),
    }));
    const __VLS_78 = __VLS_77({
        type: (__VLS_ctx.resultType(row.result)),
    }, ...__VLS_functionalComponentArgsRest(__VLS_77));
    __VLS_79.slots.default;
    (row.result);
    var __VLS_79;
}
var __VLS_75;
const __VLS_80 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
    label: "章节状态",
    width: "120",
}));
const __VLS_82 = __VLS_81({
    label: "章节状态",
    width: "120",
}, ...__VLS_functionalComponentArgsRest(__VLS_81));
__VLS_83.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_83.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    const __VLS_84 = {}.ElTag;
    /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
    // @ts-ignore
    const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({
        type: (__VLS_ctx.statusType(row.chapterStatus)),
    }));
    const __VLS_86 = __VLS_85({
        type: (__VLS_ctx.statusType(row.chapterStatus)),
    }, ...__VLS_functionalComponentArgsRest(__VLS_85));
    __VLS_87.slots.default;
    (row.chapterStatus || '-');
    var __VLS_87;
}
var __VLS_83;
const __VLS_88 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
    label: "时间",
    width: "180",
}));
const __VLS_90 = __VLS_89({
    label: "时间",
    width: "180",
}, ...__VLS_functionalComponentArgsRest(__VLS_89));
__VLS_91.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_91.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    (__VLS_ctx.formatTime(row.validatedAt));
}
var __VLS_91;
const __VLS_92 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({
    label: "修复闭环",
    width: "210",
    fixed: "right",
}));
const __VLS_94 = __VLS_93({
    label: "修复闭环",
    width: "210",
    fixed: "right",
}, ...__VLS_functionalComponentArgsRest(__VLS_93));
__VLS_95.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_95.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "fix-actions" },
    });
    const __VLS_96 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
        ...{ 'onClick': {} },
        size: "small",
        type: "danger",
        plain: true,
        loading: (__VLS_ctx.updatingReportId === row.id),
        disabled: (row.chapterStatus === 'needs_fix'),
    }));
    const __VLS_98 = __VLS_97({
        ...{ 'onClick': {} },
        size: "small",
        type: "danger",
        plain: true,
        loading: (__VLS_ctx.updatingReportId === row.id),
        disabled: (row.chapterStatus === 'needs_fix'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_97));
    let __VLS_100;
    let __VLS_101;
    let __VLS_102;
    const __VLS_103 = {
        onClick: (...[$event]) => {
            __VLS_ctx.markChapterStatus(row, 'needs_fix');
        }
    };
    __VLS_99.slots.default;
    var __VLS_99;
    const __VLS_104 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_105 = __VLS_asFunctionalComponent(__VLS_104, new __VLS_104({
        ...{ 'onClick': {} },
        size: "small",
        type: "success",
        plain: true,
        loading: (__VLS_ctx.updatingReportId === row.id),
        disabled: (row.chapterStatus === 'validated'),
    }));
    const __VLS_106 = __VLS_105({
        ...{ 'onClick': {} },
        size: "small",
        type: "success",
        plain: true,
        loading: (__VLS_ctx.updatingReportId === row.id),
        disabled: (row.chapterStatus === 'validated'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_105));
    let __VLS_108;
    let __VLS_109;
    let __VLS_110;
    const __VLS_111 = {
        onClick: (...[$event]) => {
            __VLS_ctx.markChapterStatus(row, 'validated');
        }
    };
    __VLS_107.slots.default;
    var __VLS_107;
}
var __VLS_95;
const __VLS_112 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_113 = __VLS_asFunctionalComponent(__VLS_112, new __VLS_112({
    type: "expand",
}));
const __VLS_114 = __VLS_113({
    type: "expand",
}, ...__VLS_functionalComponentArgsRest(__VLS_113));
__VLS_115.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_115.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    const __VLS_116 = {}.ElTable;
    /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
    // @ts-ignore
    const __VLS_117 = __VLS_asFunctionalComponent(__VLS_116, new __VLS_116({
        data: (row.items),
        size: "small",
        border: true,
    }));
    const __VLS_118 = __VLS_117({
        data: (row.items),
        size: "small",
        border: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_117));
    __VLS_119.slots.default;
    const __VLS_120 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_121 = __VLS_asFunctionalComponent(__VLS_120, new __VLS_120({
        prop: "name",
        label: "检查项",
        width: "130",
    }));
    const __VLS_122 = __VLS_121({
        prop: "name",
        label: "检查项",
        width: "130",
    }, ...__VLS_functionalComponentArgsRest(__VLS_121));
    const __VLS_124 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({
        prop: "details",
        label: "详情",
        minWidth: "220",
    }));
    const __VLS_126 = __VLS_125({
        prop: "details",
        label: "详情",
        minWidth: "220",
    }, ...__VLS_functionalComponentArgsRest(__VLS_125));
    const __VLS_128 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_129 = __VLS_asFunctionalComponent(__VLS_128, new __VLS_128({
        prop: "suggestion",
        label: "建议",
        minWidth: "220",
    }));
    const __VLS_130 = __VLS_129({
        prop: "suggestion",
        label: "建议",
        minWidth: "220",
    }, ...__VLS_functionalComponentArgsRest(__VLS_129));
    const __VLS_132 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_133 = __VLS_asFunctionalComponent(__VLS_132, new __VLS_132({
        label: "结果",
        width: "100",
    }));
    const __VLS_134 = __VLS_133({
        label: "结果",
        width: "100",
    }, ...__VLS_functionalComponentArgsRest(__VLS_133));
    __VLS_135.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_135.slots;
        const { row: item } = __VLS_getSlotParam(__VLS_thisSlot);
        const __VLS_136 = {}.ElTag;
        /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
        // @ts-ignore
        const __VLS_137 = __VLS_asFunctionalComponent(__VLS_136, new __VLS_136({
            type: (__VLS_ctx.resultType(item.result)),
        }));
        const __VLS_138 = __VLS_137({
            type: (__VLS_ctx.resultType(item.result)),
        }, ...__VLS_functionalComponentArgsRest(__VLS_137));
        __VLS_139.slots.default;
        (item.result);
        var __VLS_139;
    }
    var __VLS_135;
    var __VLS_119;
}
var __VLS_115;
var __VLS_63;
var __VLS_59;
var __VLS_55;
var __VLS_23;
const __VLS_140 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_141 = __VLS_asFunctionalComponent(__VLS_140, new __VLS_140({
    shadow: "never",
    ...{ class: "panel" },
}));
const __VLS_142 = __VLS_141({
    shadow: "never",
    ...{ class: "panel" },
}, ...__VLS_functionalComponentArgsRest(__VLS_141));
__VLS_143.slots.default;
{
    const { header: __VLS_thisSlot } = __VLS_143.slots;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "panel-title" },
    });
}
if (!__VLS_ctx.facts) {
    const __VLS_144 = {}.ElEmpty;
    /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
    // @ts-ignore
    const __VLS_145 = __VLS_asFunctionalComponent(__VLS_144, new __VLS_144({
        description: "暂无事实快照",
    }));
    const __VLS_146 = __VLS_145({
        description: "暂无事实快照",
    }, ...__VLS_functionalComponentArgsRest(__VLS_145));
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "fact-overview" },
    });
    for (const [card] of __VLS_getVForSourceType((__VLS_ctx.factOverviewCards))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            key: (card.label),
            ...{ class: "fact-metric" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (card.label);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
        (card.value);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
        (card.hint);
    }
}
var __VLS_143;
const __VLS_148 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_149 = __VLS_asFunctionalComponent(__VLS_148, new __VLS_148({
    shadow: "never",
    ...{ class: "panel" },
}));
const __VLS_150 = __VLS_149({
    shadow: "never",
    ...{ class: "panel" },
}, ...__VLS_functionalComponentArgsRest(__VLS_149));
__VLS_151.slots.default;
{
    const { header: __VLS_thisSlot } = __VLS_151.slots;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "panel-title" },
    });
}
if (!__VLS_ctx.facts || __VLS_ctx.facts.sections.length === 0) {
    const __VLS_152 = {}.ElEmpty;
    /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
    // @ts-ignore
    const __VLS_153 = __VLS_asFunctionalComponent(__VLS_152, new __VLS_152({
        description: "暂无摘要",
    }));
    const __VLS_154 = __VLS_153({
        description: "暂无摘要",
    }, ...__VLS_functionalComponentArgsRest(__VLS_153));
}
else {
    const __VLS_156 = {}.ElCollapse;
    /** @type {[typeof __VLS_components.ElCollapse, typeof __VLS_components.elCollapse, typeof __VLS_components.ElCollapse, typeof __VLS_components.elCollapse, ]} */ ;
    // @ts-ignore
    const __VLS_157 = __VLS_asFunctionalComponent(__VLS_156, new __VLS_156({}));
    const __VLS_158 = __VLS_157({}, ...__VLS_functionalComponentArgsRest(__VLS_157));
    __VLS_159.slots.default;
    for (const [section] of __VLS_getVForSourceType((__VLS_ctx.facts.sections))) {
        const __VLS_160 = {}.ElCollapseItem;
        /** @type {[typeof __VLS_components.ElCollapseItem, typeof __VLS_components.elCollapseItem, typeof __VLS_components.ElCollapseItem, typeof __VLS_components.elCollapseItem, ]} */ ;
        // @ts-ignore
        const __VLS_161 = __VLS_asFunctionalComponent(__VLS_160, new __VLS_160({
            key: (section.key),
            title: (`${section.title} · ${section.totalCount}`),
            name: (section.key),
        }));
        const __VLS_162 = __VLS_161({
            key: (section.key),
            title: (`${section.title} · ${section.totalCount}`),
            name: (section.key),
        }, ...__VLS_functionalComponentArgsRest(__VLS_161));
        __VLS_163.slots.default;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "section-summary" },
        });
        (section.summary);
        const __VLS_164 = {}.ElTable;
        /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
        // @ts-ignore
        const __VLS_165 = __VLS_asFunctionalComponent(__VLS_164, new __VLS_164({
            data: (section.items),
            size: "small",
            border: true,
        }));
        const __VLS_166 = __VLS_165({
            data: (section.items),
            size: "small",
            border: true,
        }, ...__VLS_functionalComponentArgsRest(__VLS_165));
        __VLS_167.slots.default;
        const __VLS_168 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_169 = __VLS_asFunctionalComponent(__VLS_168, new __VLS_168({
            prop: "name",
            label: "名称",
            minWidth: "150",
        }));
        const __VLS_170 = __VLS_169({
            prop: "name",
            label: "名称",
            minWidth: "150",
        }, ...__VLS_functionalComponentArgsRest(__VLS_169));
        const __VLS_172 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_173 = __VLS_asFunctionalComponent(__VLS_172, new __VLS_172({
            prop: "status",
            label: "状态",
            width: "130",
        }));
        const __VLS_174 = __VLS_173({
            prop: "status",
            label: "状态",
            width: "130",
        }, ...__VLS_functionalComponentArgsRest(__VLS_173));
        const __VLS_176 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_177 = __VLS_asFunctionalComponent(__VLS_176, new __VLS_176({
            label: "章节",
            width: "100",
        }));
        const __VLS_178 = __VLS_177({
            label: "章节",
            width: "100",
        }, ...__VLS_functionalComponentArgsRest(__VLS_177));
        __VLS_179.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_179.slots;
            const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
            (row.chapterNumber ? `第 ${row.chapterNumber} 章` : '-');
        }
        var __VLS_179;
        const __VLS_180 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_181 = __VLS_asFunctionalComponent(__VLS_180, new __VLS_180({
            prop: "detail",
            label: "摘要",
            minWidth: "240",
        }));
        const __VLS_182 = __VLS_181({
            prop: "detail",
            label: "摘要",
            minWidth: "240",
        }, ...__VLS_functionalComponentArgsRest(__VLS_181));
        const __VLS_184 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_185 = __VLS_asFunctionalComponent(__VLS_184, new __VLS_184({
            prop: "importance",
            label: "等级",
            width: "110",
        }));
        const __VLS_186 = __VLS_185({
            prop: "importance",
            label: "等级",
            width: "110",
        }, ...__VLS_functionalComponentArgsRest(__VLS_185));
        var __VLS_167;
        var __VLS_163;
    }
    var __VLS_159;
}
var __VLS_151;
const __VLS_188 = {}.ElRow;
/** @type {[typeof __VLS_components.ElRow, typeof __VLS_components.elRow, typeof __VLS_components.ElRow, typeof __VLS_components.elRow, ]} */ ;
// @ts-ignore
const __VLS_189 = __VLS_asFunctionalComponent(__VLS_188, new __VLS_188({
    gutter: (16),
}));
const __VLS_190 = __VLS_189({
    gutter: (16),
}, ...__VLS_functionalComponentArgsRest(__VLS_189));
__VLS_191.slots.default;
const __VLS_192 = {}.ElCol;
/** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
// @ts-ignore
const __VLS_193 = __VLS_asFunctionalComponent(__VLS_192, new __VLS_192({
    span: (14),
}));
const __VLS_194 = __VLS_193({
    span: (14),
}, ...__VLS_functionalComponentArgsRest(__VLS_193));
__VLS_195.slots.default;
const __VLS_196 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_197 = __VLS_asFunctionalComponent(__VLS_196, new __VLS_196({
    shadow: "never",
    ...{ class: "panel" },
}));
const __VLS_198 = __VLS_197({
    shadow: "never",
    ...{ class: "panel" },
}, ...__VLS_functionalComponentArgsRest(__VLS_197));
__VLS_199.slots.default;
{
    const { header: __VLS_thisSlot } = __VLS_199.slots;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "panel-title" },
    });
}
const __VLS_200 = {}.ElTable;
/** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
// @ts-ignore
const __VLS_201 = __VLS_asFunctionalComponent(__VLS_200, new __VLS_200({
    data: (__VLS_ctx.facts?.timelines ?? []),
    rowKey: "id",
    border: true,
}));
const __VLS_202 = __VLS_201({
    data: (__VLS_ctx.facts?.timelines ?? []),
    rowKey: "id",
    border: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_201));
__VLS_203.slots.default;
const __VLS_204 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_205 = __VLS_asFunctionalComponent(__VLS_204, new __VLS_204({
    label: "章节",
    width: "150",
}));
const __VLS_206 = __VLS_205({
    label: "章节",
    width: "150",
}, ...__VLS_functionalComponentArgsRest(__VLS_205));
__VLS_207.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_207.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    (row.chapterNumber);
}
var __VLS_207;
const __VLS_208 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_209 = __VLS_asFunctionalComponent(__VLS_208, new __VLS_208({
    prop: "timePeriod",
    label: "时间段",
    width: "160",
}));
const __VLS_210 = __VLS_209({
    prop: "timePeriod",
    label: "时间段",
    width: "160",
}, ...__VLS_functionalComponentArgsRest(__VLS_209));
const __VLS_212 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_213 = __VLS_asFunctionalComponent(__VLS_212, new __VLS_212({
    prop: "elapsedTime",
    label: "经过时间",
    width: "150",
}));
const __VLS_214 = __VLS_213({
    prop: "elapsedTime",
    label: "经过时间",
    width: "150",
}, ...__VLS_functionalComponentArgsRest(__VLS_213));
const __VLS_216 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_217 = __VLS_asFunctionalComponent(__VLS_216, new __VLS_216({
    prop: "keyTimeEvent",
    label: "关键事件",
    minWidth: "240",
}));
const __VLS_218 = __VLS_217({
    prop: "keyTimeEvent",
    label: "关键事件",
    minWidth: "240",
}, ...__VLS_functionalComponentArgsRest(__VLS_217));
const __VLS_220 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_221 = __VLS_asFunctionalComponent(__VLS_220, new __VLS_220({
    prop: "importance",
    label: "重要性",
    width: "110",
}));
const __VLS_222 = __VLS_221({
    prop: "importance",
    label: "重要性",
    width: "110",
}, ...__VLS_functionalComponentArgsRest(__VLS_221));
var __VLS_203;
var __VLS_199;
var __VLS_195;
const __VLS_224 = {}.ElCol;
/** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
// @ts-ignore
const __VLS_225 = __VLS_asFunctionalComponent(__VLS_224, new __VLS_224({
    span: (10),
}));
const __VLS_226 = __VLS_225({
    span: (10),
}, ...__VLS_functionalComponentArgsRest(__VLS_225));
__VLS_227.slots.default;
const __VLS_228 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_229 = __VLS_asFunctionalComponent(__VLS_228, new __VLS_228({
    shadow: "never",
    ...{ class: "panel" },
}));
const __VLS_230 = __VLS_229({
    shadow: "never",
    ...{ class: "panel" },
}, ...__VLS_functionalComponentArgsRest(__VLS_229));
__VLS_231.slots.default;
{
    const { header: __VLS_thisSlot } = __VLS_231.slots;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "panel-title" },
    });
}
if (!__VLS_ctx.facts || __VLS_ctx.facts.volumeArchives.length === 0) {
    const __VLS_232 = {}.ElEmpty;
    /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
    // @ts-ignore
    const __VLS_233 = __VLS_asFunctionalComponent(__VLS_232, new __VLS_232({
        description: "暂无归档",
    }));
    const __VLS_234 = __VLS_233({
        description: "暂无归档",
    }, ...__VLS_functionalComponentArgsRest(__VLS_233));
}
else {
    const __VLS_236 = {}.ElCollapse;
    /** @type {[typeof __VLS_components.ElCollapse, typeof __VLS_components.elCollapse, typeof __VLS_components.ElCollapse, typeof __VLS_components.elCollapse, ]} */ ;
    // @ts-ignore
    const __VLS_237 = __VLS_asFunctionalComponent(__VLS_236, new __VLS_236({}));
    const __VLS_238 = __VLS_237({}, ...__VLS_functionalComponentArgsRest(__VLS_237));
    __VLS_239.slots.default;
    for (const [archive] of __VLS_getVForSourceType((__VLS_ctx.facts.volumeArchives))) {
        const __VLS_240 = {}.ElCollapseItem;
        /** @type {[typeof __VLS_components.ElCollapseItem, typeof __VLS_components.elCollapseItem, typeof __VLS_components.ElCollapseItem, typeof __VLS_components.elCollapseItem, ]} */ ;
        // @ts-ignore
        const __VLS_241 = __VLS_asFunctionalComponent(__VLS_240, new __VLS_240({
            key: (archive.id),
            title: (`第 ${archive.volumeNumber} 卷 · ${__VLS_ctx.formatTime(archive.archivedAt)}`),
            name: (archive.id),
        }));
        const __VLS_242 = __VLS_241({
            key: (archive.id),
            title: (`第 ${archive.volumeNumber} 卷 · ${__VLS_ctx.formatTime(archive.archivedAt)}`),
            name: (archive.id),
        }, ...__VLS_functionalComponentArgsRest(__VLS_241));
        __VLS_243.slots.default;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "meta" },
        });
        (archive.lastChapterId || '-');
        __VLS_asFunctionalElement(__VLS_intrinsicElements.pre, __VLS_intrinsicElements.pre)({});
        (__VLS_ctx.parseJsonText(archive.snapshotPayload));
        var __VLS_243;
    }
    var __VLS_239;
}
var __VLS_231;
var __VLS_227;
var __VLS_191;
/** @type {__VLS_StyleScopedClasses['validation-page']} */ ;
/** @type {__VLS_StyleScopedClasses['hero']} */ ;
/** @type {__VLS_StyleScopedClasses['eyebrow']} */ ;
/** @type {__VLS_StyleScopedClasses['subtitle']} */ ;
/** @type {__VLS_StyleScopedClasses['action-card']} */ ;
/** @type {__VLS_StyleScopedClasses['context-label']} */ ;
/** @type {__VLS_StyleScopedClasses['actions']} */ ;
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-title']} */ ;
/** @type {__VLS_StyleScopedClasses['summary-card']} */ ;
/** @type {__VLS_StyleScopedClasses['summary-head']} */ ;
/** @type {__VLS_StyleScopedClasses['meta']} */ ;
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-title']} */ ;
/** @type {__VLS_StyleScopedClasses['fix-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-title']} */ ;
/** @type {__VLS_StyleScopedClasses['fact-overview']} */ ;
/** @type {__VLS_StyleScopedClasses['fact-metric']} */ ;
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-title']} */ ;
/** @type {__VLS_StyleScopedClasses['section-summary']} */ ;
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-title']} */ ;
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-title']} */ ;
/** @type {__VLS_StyleScopedClasses['meta']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            loading: loading,
            running: running,
            summaries: summaries,
            reports: reports,
            facts: facts,
            updatingReportId: updatingReportId,
            targetLabel: targetLabel,
            resultType: resultType,
            statusType: statusType,
            formatTime: formatTime,
            parseJsonText: parseJsonText,
            factOverviewCards: factOverviewCards,
            refresh: refresh,
            runCurrentValidation: runCurrentValidation,
            markChapterStatus: markChapterStatus,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
