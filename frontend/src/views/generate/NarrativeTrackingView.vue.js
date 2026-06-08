import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Check, Delete, Edit, Plus, Refresh } from '@element-plus/icons-vue';
import { useWorkContextStore } from '@/stores/workContext';
import { createForeshadowing, createTimeline, deleteForeshadowing, deleteTimeline, getLongNovelCompleteness, listForeshadowings, listTimelines, rebuildTracking, updateForeshadowing, updateTimeline } from '@/api/modules/tracking';
import { listChapters } from '@/api/modules/chapters';
const router = useRouter();
const workContext = useWorkContextStore();
const loading = ref(false);
const rebuilding = ref(false);
const activeTab = ref('foreshadowings');
const keyword = ref('');
const foreshadowings = ref([]);
const timelines = ref([]);
const chapters = ref([]);
const completeness = ref(null);
const foreshadowingDialogVisible = ref(false);
const timelineDialogVisible = ref(false);
const editingForeshadowingId = ref('');
const editingTimelineId = ref('');
const selectedProjectId = computed(() => workContext.selectedProjectId);
const selectedSourceBookId = computed(() => workContext.selectedProject?.currentSourceBookId ?? null);
const foreshadowingForm = reactive({
    projectId: '',
    sourceBookId: null,
    name: '',
    tier: 'Tier-3',
    isSetup: false,
    isResolved: false,
    isOverdue: false,
    expectedSetupChapter: '',
    expectedPayoffChapter: '',
    actualSetupChapter: '',
    actualPayoffChapter: '',
    overdueSuggestion: ''
});
const timelineForm = reactive({
    projectId: '',
    sourceBookId: null,
    chapterId: '',
    timePeriod: '',
    elapsedTime: '',
    keyTimeEvent: '',
    importance: 'normal'
});
const overviewItems = computed(() => completeness.value?.items ?? []);
function statusType(status) {
    if (status === 'ready')
        return 'success';
    if (status === 'warning')
        return 'warning';
    return 'danger';
}
function resetForeshadowingForm(row) {
    editingForeshadowingId.value = row?.id ?? '';
    Object.assign(foreshadowingForm, {
        projectId: selectedProjectId.value ?? '',
        sourceBookId: selectedSourceBookId.value,
        name: row?.name ?? '',
        tier: row?.tier ?? 'Tier-3',
        isSetup: row?.isSetup ?? false,
        isResolved: row?.isResolved ?? false,
        isOverdue: row?.isOverdue ?? false,
        expectedSetupChapter: row?.expectedSetupChapter ?? '',
        expectedPayoffChapter: row?.expectedPayoffChapter ?? '',
        actualSetupChapter: row?.actualSetupChapter ?? '',
        actualPayoffChapter: row?.actualPayoffChapter ?? '',
        overdueSuggestion: row?.overdueSuggestion ?? ''
    });
}
function resetTimelineForm(row) {
    editingTimelineId.value = row?.id ?? '';
    Object.assign(timelineForm, {
        projectId: selectedProjectId.value ?? '',
        sourceBookId: selectedSourceBookId.value,
        chapterId: row?.chapterId ?? chapters.value[0]?.id ?? '',
        timePeriod: row?.timePeriod ?? '',
        elapsedTime: row?.elapsedTime ?? '',
        keyTimeEvent: row?.keyTimeEvent ?? '',
        importance: row?.importance ?? 'normal'
    });
}
async function refreshAll() {
    if (!selectedProjectId.value)
        return;
    loading.value = true;
    try {
        const params = {
            projectId: selectedProjectId.value,
            sourceBookId: selectedSourceBookId.value,
            keyword: keyword.value.trim() || null
        };
        const [foreshadowingRows, timelineRows, chapterRows, completenessResult] = await Promise.all([
            listForeshadowings(params),
            listTimelines(params),
            listChapters(selectedProjectId.value),
            getLongNovelCompleteness(selectedProjectId.value, selectedSourceBookId.value)
        ]);
        foreshadowings.value = foreshadowingRows;
        timelines.value = timelineRows;
        chapters.value = chapterRows.sort((a, b) => a.chapterNumber - b.chapterNumber);
        completeness.value = completenessResult;
    }
    catch (err) {
        ElMessage.error(err.message || '加载叙事追踪失败');
    }
    finally {
        loading.value = false;
    }
}
function openForeshadowingDialog(row) {
    if (!selectedProjectId.value) {
        ElMessage.warning('请先选择项目');
        return;
    }
    resetForeshadowingForm(row);
    foreshadowingDialogVisible.value = true;
}
function openTimelineDialog(row) {
    if (!selectedProjectId.value) {
        ElMessage.warning('请先选择项目');
        return;
    }
    resetTimelineForm(row);
    timelineDialogVisible.value = true;
}
async function saveForeshadowing() {
    if (!foreshadowingForm.name.trim()) {
        ElMessage.warning('请输入伏笔名称');
        return;
    }
    try {
        if (editingForeshadowingId.value) {
            await updateForeshadowing(editingForeshadowingId.value, foreshadowingForm);
        }
        else {
            await createForeshadowing(foreshadowingForm);
        }
        foreshadowingDialogVisible.value = false;
        ElMessage.success('伏笔已保存');
        await refreshAll();
    }
    catch (err) {
        ElMessage.error(err.message || '保存伏笔失败');
    }
}
async function saveTimeline() {
    if (!timelineForm.chapterId || !timelineForm.keyTimeEvent.trim()) {
        ElMessage.warning('请选择章节并填写关键事件');
        return;
    }
    try {
        if (editingTimelineId.value) {
            await updateTimeline(editingTimelineId.value, timelineForm);
        }
        else {
            await createTimeline(timelineForm);
        }
        timelineDialogVisible.value = false;
        ElMessage.success('时间线已保存');
        await refreshAll();
    }
    catch (err) {
        ElMessage.error(err.message || '保存时间线失败');
    }
}
async function removeForeshadowing(row) {
    await ElMessageBox.confirm(`删除伏笔「${row.name}」？`, '删除确认', { type: 'warning' });
    await deleteForeshadowing(row.id);
    ElMessage.success('伏笔已删除');
    await refreshAll();
}
async function removeTimeline(row) {
    await ElMessageBox.confirm(`删除第 ${row.chapterNumber} 章时间线？`, '删除确认', { type: 'warning' });
    await deleteTimeline(row.id);
    ElMessage.success('时间线已删除');
    await refreshAll();
}
async function quickResolve(row) {
    await updateForeshadowing(row.id, {
        ...row,
        isSetup: true,
        isResolved: true,
        isOverdue: false,
        actualPayoffChapter: row.actualPayoffChapter || row.expectedPayoffChapter
    });
    ElMessage.success('伏笔已标记回收');
    await refreshAll();
}
async function rebuildAllTracking() {
    if (!selectedProjectId.value) {
        ElMessage.warning('请先选择项目');
        return;
    }
    await ElMessageBox.confirm('会删除当前项目/书源下已有伏笔和时间线，并根据章节蓝图重新生成。确定继续？', '重新生成确认', {
        type: 'warning',
        confirmButtonText: '重新生成',
        cancelButtonText: '取消'
    });
    rebuilding.value = true;
    try {
        const result = await rebuildTracking({
            projectId: selectedProjectId.value,
            sourceBookId: selectedSourceBookId.value
        });
        ElMessage.success(`已重建：伏笔 ${result.foreshadowingCount} 条，时间线 ${result.timelineCount} 条；移除旧数据 ${result.removedForeshadowingCount + result.removedTimelineCount} 条。`);
        await refreshAll();
    }
    catch (err) {
        ElMessage.error(err.message || '重新生成伏笔和时间线失败');
    }
    finally {
        rebuilding.value = false;
    }
}
function goTo(route) {
    router.push(route);
}
watch(() => [selectedProjectId.value, selectedSourceBookId.value], refreshAll);
onMounted(refreshAll);
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['tracking-toolbar']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-toolbar']} */ ;
/** @type {__VLS_StyleScopedClasses['completeness-item']} */ ;
/** @type {__VLS_StyleScopedClasses['completeness-item']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-toolbar']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-toolbar__actions']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "tracking-page" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "tracking-toolbar" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "tracking-toolbar__actions" },
});
const __VLS_0 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ 'onKeyup': {} },
    modelValue: (__VLS_ctx.keyword),
    clearable: true,
    placeholder: "搜索伏笔或事件",
}));
const __VLS_2 = __VLS_1({
    ...{ 'onKeyup': {} },
    modelValue: (__VLS_ctx.keyword),
    clearable: true,
    placeholder: "搜索伏笔或事件",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
let __VLS_4;
let __VLS_5;
let __VLS_6;
const __VLS_7 = {
    onKeyup: (__VLS_ctx.refreshAll)
};
var __VLS_3;
const __VLS_8 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    ...{ 'onClick': {} },
    type: "warning",
    icon: (__VLS_ctx.Refresh),
    loading: (__VLS_ctx.rebuilding),
}));
const __VLS_10 = __VLS_9({
    ...{ 'onClick': {} },
    type: "warning",
    icon: (__VLS_ctx.Refresh),
    loading: (__VLS_ctx.rebuilding),
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
let __VLS_12;
let __VLS_13;
let __VLS_14;
const __VLS_15 = {
    onClick: (__VLS_ctx.rebuildAllTracking)
};
__VLS_11.slots.default;
var __VLS_11;
const __VLS_16 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
    ...{ 'onClick': {} },
    icon: (__VLS_ctx.Refresh),
    loading: (__VLS_ctx.loading),
}));
const __VLS_18 = __VLS_17({
    ...{ 'onClick': {} },
    icon: (__VLS_ctx.Refresh),
    loading: (__VLS_ctx.loading),
}, ...__VLS_functionalComponentArgsRest(__VLS_17));
let __VLS_20;
let __VLS_21;
let __VLS_22;
const __VLS_23 = {
    onClick: (__VLS_ctx.refreshAll)
};
__VLS_19.slots.default;
var __VLS_19;
if (!__VLS_ctx.selectedProjectId) {
    const __VLS_24 = {}.ElEmpty;
    /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
    // @ts-ignore
    const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
        description: "请先选择项目",
    }));
    const __VLS_26 = __VLS_25({
        description: "请先选择项目",
    }, ...__VLS_functionalComponentArgsRest(__VLS_25));
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "completeness-grid" },
    });
    for (const [item] of __VLS_getVForSourceType((__VLS_ctx.overviewItems))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.selectedProjectId))
                        return;
                    __VLS_ctx.goTo(item.route);
                } },
            key: (item.key),
            ...{ class: "completeness-item" },
            type: "button",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (item.label);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
        (item.count);
        const __VLS_28 = {}.ElTag;
        /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
        // @ts-ignore
        const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
            size: "small",
            type: (__VLS_ctx.statusType(item.status)),
        }));
        const __VLS_30 = __VLS_29({
            size: "small",
            type: (__VLS_ctx.statusType(item.status)),
        }, ...__VLS_functionalComponentArgsRest(__VLS_29));
        __VLS_31.slots.default;
        (item.status);
        var __VLS_31;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
        (item.message);
    }
    const __VLS_32 = {}.ElTabs;
    /** @type {[typeof __VLS_components.ElTabs, typeof __VLS_components.elTabs, typeof __VLS_components.ElTabs, typeof __VLS_components.elTabs, ]} */ ;
    // @ts-ignore
    const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
        modelValue: (__VLS_ctx.activeTab),
        ...{ class: "tracking-tabs" },
    }));
    const __VLS_34 = __VLS_33({
        modelValue: (__VLS_ctx.activeTab),
        ...{ class: "tracking-tabs" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_33));
    __VLS_35.slots.default;
    const __VLS_36 = {}.ElTabPane;
    /** @type {[typeof __VLS_components.ElTabPane, typeof __VLS_components.elTabPane, typeof __VLS_components.ElTabPane, typeof __VLS_components.elTabPane, ]} */ ;
    // @ts-ignore
    const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
        label: "伏笔账本",
        name: "foreshadowings",
    }));
    const __VLS_38 = __VLS_37({
        label: "伏笔账本",
        name: "foreshadowings",
    }, ...__VLS_functionalComponentArgsRest(__VLS_37));
    __VLS_39.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "table-actions" },
    });
    const __VLS_40 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
        ...{ 'onClick': {} },
        type: "primary",
        icon: (__VLS_ctx.Plus),
    }));
    const __VLS_42 = __VLS_41({
        ...{ 'onClick': {} },
        type: "primary",
        icon: (__VLS_ctx.Plus),
    }, ...__VLS_functionalComponentArgsRest(__VLS_41));
    let __VLS_44;
    let __VLS_45;
    let __VLS_46;
    const __VLS_47 = {
        onClick: (...[$event]) => {
            if (!!(!__VLS_ctx.selectedProjectId))
                return;
            __VLS_ctx.openForeshadowingDialog();
        }
    };
    __VLS_43.slots.default;
    var __VLS_43;
    const __VLS_48 = {}.ElTable;
    /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
    // @ts-ignore
    const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
        data: (__VLS_ctx.foreshadowings),
        size: "small",
    }));
    const __VLS_50 = __VLS_49({
        data: (__VLS_ctx.foreshadowings),
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_49));
    __VLS_asFunctionalDirective(__VLS_directives.vLoading)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.loading) }, null, null);
    __VLS_51.slots.default;
    const __VLS_52 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
        prop: "name",
        label: "伏笔",
        minWidth: "180",
    }));
    const __VLS_54 = __VLS_53({
        prop: "name",
        label: "伏笔",
        minWidth: "180",
    }, ...__VLS_functionalComponentArgsRest(__VLS_53));
    const __VLS_56 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
        prop: "tier",
        label: "等级",
        width: "90",
    }));
    const __VLS_58 = __VLS_57({
        prop: "tier",
        label: "等级",
        width: "90",
    }, ...__VLS_functionalComponentArgsRest(__VLS_57));
    const __VLS_60 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
        prop: "expectedSetupChapter",
        label: "预计埋设",
        width: "110",
    }));
    const __VLS_62 = __VLS_61({
        prop: "expectedSetupChapter",
        label: "预计埋设",
        width: "110",
    }, ...__VLS_functionalComponentArgsRest(__VLS_61));
    const __VLS_64 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
        prop: "expectedPayoffChapter",
        label: "预计回收",
        width: "110",
    }));
    const __VLS_66 = __VLS_65({
        prop: "expectedPayoffChapter",
        label: "预计回收",
        width: "110",
    }, ...__VLS_functionalComponentArgsRest(__VLS_65));
    const __VLS_68 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
        label: "状态",
        width: "190",
    }));
    const __VLS_70 = __VLS_69({
        label: "状态",
        width: "190",
    }, ...__VLS_functionalComponentArgsRest(__VLS_69));
    __VLS_71.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_71.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        if (row.isResolved) {
            const __VLS_72 = {}.ElTag;
            /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
            // @ts-ignore
            const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
                size: "small",
                type: "success",
            }));
            const __VLS_74 = __VLS_73({
                size: "small",
                type: "success",
            }, ...__VLS_functionalComponentArgsRest(__VLS_73));
            __VLS_75.slots.default;
            var __VLS_75;
        }
        else if (row.isOverdue) {
            const __VLS_76 = {}.ElTag;
            /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
            // @ts-ignore
            const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({
                size: "small",
                type: "danger",
            }));
            const __VLS_78 = __VLS_77({
                size: "small",
                type: "danger",
            }, ...__VLS_functionalComponentArgsRest(__VLS_77));
            __VLS_79.slots.default;
            var __VLS_79;
        }
        else if (row.isSetup) {
            const __VLS_80 = {}.ElTag;
            /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
            // @ts-ignore
            const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
                size: "small",
                type: "warning",
            }));
            const __VLS_82 = __VLS_81({
                size: "small",
                type: "warning",
            }, ...__VLS_functionalComponentArgsRest(__VLS_81));
            __VLS_83.slots.default;
            var __VLS_83;
        }
        else {
            const __VLS_84 = {}.ElTag;
            /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
            // @ts-ignore
            const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({
                size: "small",
                type: "info",
            }));
            const __VLS_86 = __VLS_85({
                size: "small",
                type: "info",
            }, ...__VLS_functionalComponentArgsRest(__VLS_85));
            __VLS_87.slots.default;
            var __VLS_87;
        }
    }
    var __VLS_71;
    const __VLS_88 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
        prop: "overdueSuggestion",
        label: "处理建议",
        minWidth: "220",
        showOverflowTooltip: true,
    }));
    const __VLS_90 = __VLS_89({
        prop: "overdueSuggestion",
        label: "处理建议",
        minWidth: "220",
        showOverflowTooltip: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_89));
    const __VLS_92 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({
        label: "操作",
        width: "210",
        fixed: "right",
    }));
    const __VLS_94 = __VLS_93({
        label: "操作",
        width: "210",
        fixed: "right",
    }, ...__VLS_functionalComponentArgsRest(__VLS_93));
    __VLS_95.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_95.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        const __VLS_96 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
            ...{ 'onClick': {} },
            size: "small",
            icon: (__VLS_ctx.Check),
            disabled: (row.isResolved),
        }));
        const __VLS_98 = __VLS_97({
            ...{ 'onClick': {} },
            size: "small",
            icon: (__VLS_ctx.Check),
            disabled: (row.isResolved),
        }, ...__VLS_functionalComponentArgsRest(__VLS_97));
        let __VLS_100;
        let __VLS_101;
        let __VLS_102;
        const __VLS_103 = {
            onClick: (...[$event]) => {
                if (!!(!__VLS_ctx.selectedProjectId))
                    return;
                __VLS_ctx.quickResolve(row);
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
            icon: (__VLS_ctx.Edit),
        }));
        const __VLS_106 = __VLS_105({
            ...{ 'onClick': {} },
            size: "small",
            icon: (__VLS_ctx.Edit),
        }, ...__VLS_functionalComponentArgsRest(__VLS_105));
        let __VLS_108;
        let __VLS_109;
        let __VLS_110;
        const __VLS_111 = {
            onClick: (...[$event]) => {
                if (!!(!__VLS_ctx.selectedProjectId))
                    return;
                __VLS_ctx.openForeshadowingDialog(row);
            }
        };
        __VLS_107.slots.default;
        var __VLS_107;
        const __VLS_112 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_113 = __VLS_asFunctionalComponent(__VLS_112, new __VLS_112({
            ...{ 'onClick': {} },
            size: "small",
            type: "danger",
            icon: (__VLS_ctx.Delete),
        }));
        const __VLS_114 = __VLS_113({
            ...{ 'onClick': {} },
            size: "small",
            type: "danger",
            icon: (__VLS_ctx.Delete),
        }, ...__VLS_functionalComponentArgsRest(__VLS_113));
        let __VLS_116;
        let __VLS_117;
        let __VLS_118;
        const __VLS_119 = {
            onClick: (...[$event]) => {
                if (!!(!__VLS_ctx.selectedProjectId))
                    return;
                __VLS_ctx.removeForeshadowing(row);
            }
        };
        __VLS_115.slots.default;
        var __VLS_115;
    }
    var __VLS_95;
    var __VLS_51;
    var __VLS_39;
    const __VLS_120 = {}.ElTabPane;
    /** @type {[typeof __VLS_components.ElTabPane, typeof __VLS_components.elTabPane, typeof __VLS_components.ElTabPane, typeof __VLS_components.elTabPane, ]} */ ;
    // @ts-ignore
    const __VLS_121 = __VLS_asFunctionalComponent(__VLS_120, new __VLS_120({
        label: "时间线",
        name: "timeline",
    }));
    const __VLS_122 = __VLS_121({
        label: "时间线",
        name: "timeline",
    }, ...__VLS_functionalComponentArgsRest(__VLS_121));
    __VLS_123.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "table-actions" },
    });
    const __VLS_124 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({
        ...{ 'onClick': {} },
        type: "primary",
        icon: (__VLS_ctx.Plus),
    }));
    const __VLS_126 = __VLS_125({
        ...{ 'onClick': {} },
        type: "primary",
        icon: (__VLS_ctx.Plus),
    }, ...__VLS_functionalComponentArgsRest(__VLS_125));
    let __VLS_128;
    let __VLS_129;
    let __VLS_130;
    const __VLS_131 = {
        onClick: (...[$event]) => {
            if (!!(!__VLS_ctx.selectedProjectId))
                return;
            __VLS_ctx.openTimelineDialog();
        }
    };
    __VLS_127.slots.default;
    var __VLS_127;
    const __VLS_132 = {}.ElTable;
    /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
    // @ts-ignore
    const __VLS_133 = __VLS_asFunctionalComponent(__VLS_132, new __VLS_132({
        data: (__VLS_ctx.timelines),
        size: "small",
    }));
    const __VLS_134 = __VLS_133({
        data: (__VLS_ctx.timelines),
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_133));
    __VLS_asFunctionalDirective(__VLS_directives.vLoading)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.loading) }, null, null);
    __VLS_135.slots.default;
    const __VLS_136 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_137 = __VLS_asFunctionalComponent(__VLS_136, new __VLS_136({
        prop: "chapterNumber",
        label: "章节",
        width: "80",
    }));
    const __VLS_138 = __VLS_137({
        prop: "chapterNumber",
        label: "章节",
        width: "80",
    }, ...__VLS_functionalComponentArgsRest(__VLS_137));
    const __VLS_140 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_141 = __VLS_asFunctionalComponent(__VLS_140, new __VLS_140({
        prop: "chapterTitle",
        label: "标题",
        minWidth: "160",
    }));
    const __VLS_142 = __VLS_141({
        prop: "chapterTitle",
        label: "标题",
        minWidth: "160",
    }, ...__VLS_functionalComponentArgsRest(__VLS_141));
    const __VLS_144 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_145 = __VLS_asFunctionalComponent(__VLS_144, new __VLS_144({
        prop: "timePeriod",
        label: "时间段",
        width: "120",
    }));
    const __VLS_146 = __VLS_145({
        prop: "timePeriod",
        label: "时间段",
        width: "120",
    }, ...__VLS_functionalComponentArgsRest(__VLS_145));
    const __VLS_148 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_149 = __VLS_asFunctionalComponent(__VLS_148, new __VLS_148({
        prop: "elapsedTime",
        label: "经过时间",
        width: "120",
    }));
    const __VLS_150 = __VLS_149({
        prop: "elapsedTime",
        label: "经过时间",
        width: "120",
    }, ...__VLS_functionalComponentArgsRest(__VLS_149));
    const __VLS_152 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_153 = __VLS_asFunctionalComponent(__VLS_152, new __VLS_152({
        prop: "keyTimeEvent",
        label: "关键事件",
        minWidth: "260",
    }));
    const __VLS_154 = __VLS_153({
        prop: "keyTimeEvent",
        label: "关键事件",
        minWidth: "260",
    }, ...__VLS_functionalComponentArgsRest(__VLS_153));
    const __VLS_156 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_157 = __VLS_asFunctionalComponent(__VLS_156, new __VLS_156({
        prop: "importance",
        label: "重要性",
        width: "90",
    }));
    const __VLS_158 = __VLS_157({
        prop: "importance",
        label: "重要性",
        width: "90",
    }, ...__VLS_functionalComponentArgsRest(__VLS_157));
    const __VLS_160 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_161 = __VLS_asFunctionalComponent(__VLS_160, new __VLS_160({
        label: "操作",
        width: "150",
        fixed: "right",
    }));
    const __VLS_162 = __VLS_161({
        label: "操作",
        width: "150",
        fixed: "right",
    }, ...__VLS_functionalComponentArgsRest(__VLS_161));
    __VLS_163.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_163.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        const __VLS_164 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_165 = __VLS_asFunctionalComponent(__VLS_164, new __VLS_164({
            ...{ 'onClick': {} },
            size: "small",
            icon: (__VLS_ctx.Edit),
        }));
        const __VLS_166 = __VLS_165({
            ...{ 'onClick': {} },
            size: "small",
            icon: (__VLS_ctx.Edit),
        }, ...__VLS_functionalComponentArgsRest(__VLS_165));
        let __VLS_168;
        let __VLS_169;
        let __VLS_170;
        const __VLS_171 = {
            onClick: (...[$event]) => {
                if (!!(!__VLS_ctx.selectedProjectId))
                    return;
                __VLS_ctx.openTimelineDialog(row);
            }
        };
        __VLS_167.slots.default;
        var __VLS_167;
        const __VLS_172 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_173 = __VLS_asFunctionalComponent(__VLS_172, new __VLS_172({
            ...{ 'onClick': {} },
            size: "small",
            type: "danger",
            icon: (__VLS_ctx.Delete),
        }));
        const __VLS_174 = __VLS_173({
            ...{ 'onClick': {} },
            size: "small",
            type: "danger",
            icon: (__VLS_ctx.Delete),
        }, ...__VLS_functionalComponentArgsRest(__VLS_173));
        let __VLS_176;
        let __VLS_177;
        let __VLS_178;
        const __VLS_179 = {
            onClick: (...[$event]) => {
                if (!!(!__VLS_ctx.selectedProjectId))
                    return;
                __VLS_ctx.removeTimeline(row);
            }
        };
        __VLS_175.slots.default;
        var __VLS_175;
    }
    var __VLS_163;
    var __VLS_135;
    var __VLS_123;
    var __VLS_35;
}
const __VLS_180 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_181 = __VLS_asFunctionalComponent(__VLS_180, new __VLS_180({
    modelValue: (__VLS_ctx.foreshadowingDialogVisible),
    title: (__VLS_ctx.editingForeshadowingId ? '编辑伏笔' : '新增伏笔'),
    width: "640px",
}));
const __VLS_182 = __VLS_181({
    modelValue: (__VLS_ctx.foreshadowingDialogVisible),
    title: (__VLS_ctx.editingForeshadowingId ? '编辑伏笔' : '新增伏笔'),
    width: "640px",
}, ...__VLS_functionalComponentArgsRest(__VLS_181));
__VLS_183.slots.default;
const __VLS_184 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_185 = __VLS_asFunctionalComponent(__VLS_184, new __VLS_184({
    labelWidth: "110px",
}));
const __VLS_186 = __VLS_185({
    labelWidth: "110px",
}, ...__VLS_functionalComponentArgsRest(__VLS_185));
__VLS_187.slots.default;
const __VLS_188 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_189 = __VLS_asFunctionalComponent(__VLS_188, new __VLS_188({
    label: "伏笔名称",
}));
const __VLS_190 = __VLS_189({
    label: "伏笔名称",
}, ...__VLS_functionalComponentArgsRest(__VLS_189));
__VLS_191.slots.default;
const __VLS_192 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_193 = __VLS_asFunctionalComponent(__VLS_192, new __VLS_192({
    modelValue: (__VLS_ctx.foreshadowingForm.name),
}));
const __VLS_194 = __VLS_193({
    modelValue: (__VLS_ctx.foreshadowingForm.name),
}, ...__VLS_functionalComponentArgsRest(__VLS_193));
var __VLS_191;
const __VLS_196 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_197 = __VLS_asFunctionalComponent(__VLS_196, new __VLS_196({
    label: "等级",
}));
const __VLS_198 = __VLS_197({
    label: "等级",
}, ...__VLS_functionalComponentArgsRest(__VLS_197));
__VLS_199.slots.default;
const __VLS_200 = {}.ElSelect;
/** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
// @ts-ignore
const __VLS_201 = __VLS_asFunctionalComponent(__VLS_200, new __VLS_200({
    modelValue: (__VLS_ctx.foreshadowingForm.tier),
}));
const __VLS_202 = __VLS_201({
    modelValue: (__VLS_ctx.foreshadowingForm.tier),
}, ...__VLS_functionalComponentArgsRest(__VLS_201));
__VLS_203.slots.default;
const __VLS_204 = {}.ElOption;
/** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
// @ts-ignore
const __VLS_205 = __VLS_asFunctionalComponent(__VLS_204, new __VLS_204({
    label: "Tier-1 主线",
    value: "Tier-1",
}));
const __VLS_206 = __VLS_205({
    label: "Tier-1 主线",
    value: "Tier-1",
}, ...__VLS_functionalComponentArgsRest(__VLS_205));
const __VLS_208 = {}.ElOption;
/** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
// @ts-ignore
const __VLS_209 = __VLS_asFunctionalComponent(__VLS_208, new __VLS_208({
    label: "Tier-2 支线",
    value: "Tier-2",
}));
const __VLS_210 = __VLS_209({
    label: "Tier-2 支线",
    value: "Tier-2",
}, ...__VLS_functionalComponentArgsRest(__VLS_209));
const __VLS_212 = {}.ElOption;
/** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
// @ts-ignore
const __VLS_213 = __VLS_asFunctionalComponent(__VLS_212, new __VLS_212({
    label: "Tier-3 普通",
    value: "Tier-3",
}));
const __VLS_214 = __VLS_213({
    label: "Tier-3 普通",
    value: "Tier-3",
}, ...__VLS_functionalComponentArgsRest(__VLS_213));
var __VLS_203;
var __VLS_199;
const __VLS_216 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_217 = __VLS_asFunctionalComponent(__VLS_216, new __VLS_216({
    label: "预计埋设",
}));
const __VLS_218 = __VLS_217({
    label: "预计埋设",
}, ...__VLS_functionalComponentArgsRest(__VLS_217));
__VLS_219.slots.default;
const __VLS_220 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_221 = __VLS_asFunctionalComponent(__VLS_220, new __VLS_220({
    modelValue: (__VLS_ctx.foreshadowingForm.expectedSetupChapter),
    placeholder: "第1章",
}));
const __VLS_222 = __VLS_221({
    modelValue: (__VLS_ctx.foreshadowingForm.expectedSetupChapter),
    placeholder: "第1章",
}, ...__VLS_functionalComponentArgsRest(__VLS_221));
var __VLS_219;
const __VLS_224 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_225 = __VLS_asFunctionalComponent(__VLS_224, new __VLS_224({
    label: "预计回收",
}));
const __VLS_226 = __VLS_225({
    label: "预计回收",
}, ...__VLS_functionalComponentArgsRest(__VLS_225));
__VLS_227.slots.default;
const __VLS_228 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_229 = __VLS_asFunctionalComponent(__VLS_228, new __VLS_228({
    modelValue: (__VLS_ctx.foreshadowingForm.expectedPayoffChapter),
    placeholder: "第12章",
}));
const __VLS_230 = __VLS_229({
    modelValue: (__VLS_ctx.foreshadowingForm.expectedPayoffChapter),
    placeholder: "第12章",
}, ...__VLS_functionalComponentArgsRest(__VLS_229));
var __VLS_227;
const __VLS_232 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_233 = __VLS_asFunctionalComponent(__VLS_232, new __VLS_232({
    label: "实际埋设",
}));
const __VLS_234 = __VLS_233({
    label: "实际埋设",
}, ...__VLS_functionalComponentArgsRest(__VLS_233));
__VLS_235.slots.default;
const __VLS_236 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_237 = __VLS_asFunctionalComponent(__VLS_236, new __VLS_236({
    modelValue: (__VLS_ctx.foreshadowingForm.actualSetupChapter),
}));
const __VLS_238 = __VLS_237({
    modelValue: (__VLS_ctx.foreshadowingForm.actualSetupChapter),
}, ...__VLS_functionalComponentArgsRest(__VLS_237));
var __VLS_235;
const __VLS_240 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_241 = __VLS_asFunctionalComponent(__VLS_240, new __VLS_240({
    label: "实际回收",
}));
const __VLS_242 = __VLS_241({
    label: "实际回收",
}, ...__VLS_functionalComponentArgsRest(__VLS_241));
__VLS_243.slots.default;
const __VLS_244 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_245 = __VLS_asFunctionalComponent(__VLS_244, new __VLS_244({
    modelValue: (__VLS_ctx.foreshadowingForm.actualPayoffChapter),
}));
const __VLS_246 = __VLS_245({
    modelValue: (__VLS_ctx.foreshadowingForm.actualPayoffChapter),
}, ...__VLS_functionalComponentArgsRest(__VLS_245));
var __VLS_243;
const __VLS_248 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_249 = __VLS_asFunctionalComponent(__VLS_248, new __VLS_248({
    label: "状态",
}));
const __VLS_250 = __VLS_249({
    label: "状态",
}, ...__VLS_functionalComponentArgsRest(__VLS_249));
__VLS_251.slots.default;
const __VLS_252 = {}.ElCheckbox;
/** @type {[typeof __VLS_components.ElCheckbox, typeof __VLS_components.elCheckbox, typeof __VLS_components.ElCheckbox, typeof __VLS_components.elCheckbox, ]} */ ;
// @ts-ignore
const __VLS_253 = __VLS_asFunctionalComponent(__VLS_252, new __VLS_252({
    modelValue: (__VLS_ctx.foreshadowingForm.isSetup),
}));
const __VLS_254 = __VLS_253({
    modelValue: (__VLS_ctx.foreshadowingForm.isSetup),
}, ...__VLS_functionalComponentArgsRest(__VLS_253));
__VLS_255.slots.default;
var __VLS_255;
const __VLS_256 = {}.ElCheckbox;
/** @type {[typeof __VLS_components.ElCheckbox, typeof __VLS_components.elCheckbox, typeof __VLS_components.ElCheckbox, typeof __VLS_components.elCheckbox, ]} */ ;
// @ts-ignore
const __VLS_257 = __VLS_asFunctionalComponent(__VLS_256, new __VLS_256({
    modelValue: (__VLS_ctx.foreshadowingForm.isResolved),
}));
const __VLS_258 = __VLS_257({
    modelValue: (__VLS_ctx.foreshadowingForm.isResolved),
}, ...__VLS_functionalComponentArgsRest(__VLS_257));
__VLS_259.slots.default;
var __VLS_259;
const __VLS_260 = {}.ElCheckbox;
/** @type {[typeof __VLS_components.ElCheckbox, typeof __VLS_components.elCheckbox, typeof __VLS_components.ElCheckbox, typeof __VLS_components.elCheckbox, ]} */ ;
// @ts-ignore
const __VLS_261 = __VLS_asFunctionalComponent(__VLS_260, new __VLS_260({
    modelValue: (__VLS_ctx.foreshadowingForm.isOverdue),
}));
const __VLS_262 = __VLS_261({
    modelValue: (__VLS_ctx.foreshadowingForm.isOverdue),
}, ...__VLS_functionalComponentArgsRest(__VLS_261));
__VLS_263.slots.default;
var __VLS_263;
var __VLS_251;
const __VLS_264 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_265 = __VLS_asFunctionalComponent(__VLS_264, new __VLS_264({
    label: "处理建议",
}));
const __VLS_266 = __VLS_265({
    label: "处理建议",
}, ...__VLS_functionalComponentArgsRest(__VLS_265));
__VLS_267.slots.default;
const __VLS_268 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_269 = __VLS_asFunctionalComponent(__VLS_268, new __VLS_268({
    modelValue: (__VLS_ctx.foreshadowingForm.overdueSuggestion),
    type: "textarea",
    rows: (3),
}));
const __VLS_270 = __VLS_269({
    modelValue: (__VLS_ctx.foreshadowingForm.overdueSuggestion),
    type: "textarea",
    rows: (3),
}, ...__VLS_functionalComponentArgsRest(__VLS_269));
var __VLS_267;
var __VLS_187;
{
    const { footer: __VLS_thisSlot } = __VLS_183.slots;
    const __VLS_272 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_273 = __VLS_asFunctionalComponent(__VLS_272, new __VLS_272({
        ...{ 'onClick': {} },
    }));
    const __VLS_274 = __VLS_273({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_273));
    let __VLS_276;
    let __VLS_277;
    let __VLS_278;
    const __VLS_279 = {
        onClick: (...[$event]) => {
            __VLS_ctx.foreshadowingDialogVisible = false;
        }
    };
    __VLS_275.slots.default;
    var __VLS_275;
    const __VLS_280 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_281 = __VLS_asFunctionalComponent(__VLS_280, new __VLS_280({
        ...{ 'onClick': {} },
        type: "primary",
    }));
    const __VLS_282 = __VLS_281({
        ...{ 'onClick': {} },
        type: "primary",
    }, ...__VLS_functionalComponentArgsRest(__VLS_281));
    let __VLS_284;
    let __VLS_285;
    let __VLS_286;
    const __VLS_287 = {
        onClick: (__VLS_ctx.saveForeshadowing)
    };
    __VLS_283.slots.default;
    var __VLS_283;
}
var __VLS_183;
const __VLS_288 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_289 = __VLS_asFunctionalComponent(__VLS_288, new __VLS_288({
    modelValue: (__VLS_ctx.timelineDialogVisible),
    title: (__VLS_ctx.editingTimelineId ? '编辑时间线' : '新增时间线'),
    width: "640px",
}));
const __VLS_290 = __VLS_289({
    modelValue: (__VLS_ctx.timelineDialogVisible),
    title: (__VLS_ctx.editingTimelineId ? '编辑时间线' : '新增时间线'),
    width: "640px",
}, ...__VLS_functionalComponentArgsRest(__VLS_289));
__VLS_291.slots.default;
const __VLS_292 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_293 = __VLS_asFunctionalComponent(__VLS_292, new __VLS_292({
    labelWidth: "110px",
}));
const __VLS_294 = __VLS_293({
    labelWidth: "110px",
}, ...__VLS_functionalComponentArgsRest(__VLS_293));
__VLS_295.slots.default;
const __VLS_296 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_297 = __VLS_asFunctionalComponent(__VLS_296, new __VLS_296({
    label: "章节",
}));
const __VLS_298 = __VLS_297({
    label: "章节",
}, ...__VLS_functionalComponentArgsRest(__VLS_297));
__VLS_299.slots.default;
const __VLS_300 = {}.ElSelect;
/** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
// @ts-ignore
const __VLS_301 = __VLS_asFunctionalComponent(__VLS_300, new __VLS_300({
    modelValue: (__VLS_ctx.timelineForm.chapterId),
    filterable: true,
}));
const __VLS_302 = __VLS_301({
    modelValue: (__VLS_ctx.timelineForm.chapterId),
    filterable: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_301));
__VLS_303.slots.default;
for (const [chapter] of __VLS_getVForSourceType((__VLS_ctx.chapters))) {
    const __VLS_304 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_305 = __VLS_asFunctionalComponent(__VLS_304, new __VLS_304({
        key: (chapter.id),
        label: (`第${chapter.chapterNumber}章 ${chapter.title}`),
        value: (chapter.id),
    }));
    const __VLS_306 = __VLS_305({
        key: (chapter.id),
        label: (`第${chapter.chapterNumber}章 ${chapter.title}`),
        value: (chapter.id),
    }, ...__VLS_functionalComponentArgsRest(__VLS_305));
}
var __VLS_303;
var __VLS_299;
const __VLS_308 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_309 = __VLS_asFunctionalComponent(__VLS_308, new __VLS_308({
    label: "时间段",
}));
const __VLS_310 = __VLS_309({
    label: "时间段",
}, ...__VLS_functionalComponentArgsRest(__VLS_309));
__VLS_311.slots.default;
const __VLS_312 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_313 = __VLS_asFunctionalComponent(__VLS_312, new __VLS_312({
    modelValue: (__VLS_ctx.timelineForm.timePeriod),
}));
const __VLS_314 = __VLS_313({
    modelValue: (__VLS_ctx.timelineForm.timePeriod),
}, ...__VLS_functionalComponentArgsRest(__VLS_313));
var __VLS_311;
const __VLS_316 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_317 = __VLS_asFunctionalComponent(__VLS_316, new __VLS_316({
    label: "经过时间",
}));
const __VLS_318 = __VLS_317({
    label: "经过时间",
}, ...__VLS_functionalComponentArgsRest(__VLS_317));
__VLS_319.slots.default;
const __VLS_320 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_321 = __VLS_asFunctionalComponent(__VLS_320, new __VLS_320({
    modelValue: (__VLS_ctx.timelineForm.elapsedTime),
}));
const __VLS_322 = __VLS_321({
    modelValue: (__VLS_ctx.timelineForm.elapsedTime),
}, ...__VLS_functionalComponentArgsRest(__VLS_321));
var __VLS_319;
const __VLS_324 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_325 = __VLS_asFunctionalComponent(__VLS_324, new __VLS_324({
    label: "关键事件",
}));
const __VLS_326 = __VLS_325({
    label: "关键事件",
}, ...__VLS_functionalComponentArgsRest(__VLS_325));
__VLS_327.slots.default;
const __VLS_328 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_329 = __VLS_asFunctionalComponent(__VLS_328, new __VLS_328({
    modelValue: (__VLS_ctx.timelineForm.keyTimeEvent),
    type: "textarea",
    rows: (3),
}));
const __VLS_330 = __VLS_329({
    modelValue: (__VLS_ctx.timelineForm.keyTimeEvent),
    type: "textarea",
    rows: (3),
}, ...__VLS_functionalComponentArgsRest(__VLS_329));
var __VLS_327;
const __VLS_332 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_333 = __VLS_asFunctionalComponent(__VLS_332, new __VLS_332({
    label: "重要性",
}));
const __VLS_334 = __VLS_333({
    label: "重要性",
}, ...__VLS_functionalComponentArgsRest(__VLS_333));
__VLS_335.slots.default;
const __VLS_336 = {}.ElSelect;
/** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
// @ts-ignore
const __VLS_337 = __VLS_asFunctionalComponent(__VLS_336, new __VLS_336({
    modelValue: (__VLS_ctx.timelineForm.importance),
}));
const __VLS_338 = __VLS_337({
    modelValue: (__VLS_ctx.timelineForm.importance),
}, ...__VLS_functionalComponentArgsRest(__VLS_337));
__VLS_339.slots.default;
const __VLS_340 = {}.ElOption;
/** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
// @ts-ignore
const __VLS_341 = __VLS_asFunctionalComponent(__VLS_340, new __VLS_340({
    label: "high",
    value: "high",
}));
const __VLS_342 = __VLS_341({
    label: "high",
    value: "high",
}, ...__VLS_functionalComponentArgsRest(__VLS_341));
const __VLS_344 = {}.ElOption;
/** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
// @ts-ignore
const __VLS_345 = __VLS_asFunctionalComponent(__VLS_344, new __VLS_344({
    label: "normal",
    value: "normal",
}));
const __VLS_346 = __VLS_345({
    label: "normal",
    value: "normal",
}, ...__VLS_functionalComponentArgsRest(__VLS_345));
const __VLS_348 = {}.ElOption;
/** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
// @ts-ignore
const __VLS_349 = __VLS_asFunctionalComponent(__VLS_348, new __VLS_348({
    label: "low",
    value: "low",
}));
const __VLS_350 = __VLS_349({
    label: "low",
    value: "low",
}, ...__VLS_functionalComponentArgsRest(__VLS_349));
var __VLS_339;
var __VLS_335;
var __VLS_295;
{
    const { footer: __VLS_thisSlot } = __VLS_291.slots;
    const __VLS_352 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_353 = __VLS_asFunctionalComponent(__VLS_352, new __VLS_352({
        ...{ 'onClick': {} },
    }));
    const __VLS_354 = __VLS_353({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_353));
    let __VLS_356;
    let __VLS_357;
    let __VLS_358;
    const __VLS_359 = {
        onClick: (...[$event]) => {
            __VLS_ctx.timelineDialogVisible = false;
        }
    };
    __VLS_355.slots.default;
    var __VLS_355;
    const __VLS_360 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_361 = __VLS_asFunctionalComponent(__VLS_360, new __VLS_360({
        ...{ 'onClick': {} },
        type: "primary",
    }));
    const __VLS_362 = __VLS_361({
        ...{ 'onClick': {} },
        type: "primary",
    }, ...__VLS_functionalComponentArgsRest(__VLS_361));
    let __VLS_364;
    let __VLS_365;
    let __VLS_366;
    const __VLS_367 = {
        onClick: (__VLS_ctx.saveTimeline)
    };
    __VLS_363.slots.default;
    var __VLS_363;
}
var __VLS_291;
/** @type {__VLS_StyleScopedClasses['tracking-page']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-toolbar']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-toolbar__actions']} */ ;
/** @type {__VLS_StyleScopedClasses['completeness-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['completeness-item']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-tabs']} */ ;
/** @type {__VLS_StyleScopedClasses['table-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['table-actions']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Check: Check,
            Delete: Delete,
            Edit: Edit,
            Plus: Plus,
            Refresh: Refresh,
            loading: loading,
            rebuilding: rebuilding,
            activeTab: activeTab,
            keyword: keyword,
            foreshadowings: foreshadowings,
            timelines: timelines,
            chapters: chapters,
            foreshadowingDialogVisible: foreshadowingDialogVisible,
            timelineDialogVisible: timelineDialogVisible,
            editingForeshadowingId: editingForeshadowingId,
            editingTimelineId: editingTimelineId,
            selectedProjectId: selectedProjectId,
            foreshadowingForm: foreshadowingForm,
            timelineForm: timelineForm,
            overviewItems: overviewItems,
            statusType: statusType,
            refreshAll: refreshAll,
            openForeshadowingDialog: openForeshadowingDialog,
            openTimelineDialog: openTimelineDialog,
            saveForeshadowing: saveForeshadowing,
            saveTimeline: saveTimeline,
            removeForeshadowing: removeForeshadowing,
            removeTimeline: removeTimeline,
            quickResolve: quickResolve,
            rebuildAllTracking: rebuildAllTracking,
            goTo: goTo,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
