import { computed, onMounted, ref, watch } from 'vue';
import { Refresh } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { useWorkContextStore } from '@/stores/workContext';
import { getGenerationStatistics, listGenerationRecords } from '@/api/modules/generation';
const workContext = useWorkContextStore();
const loading = ref(false);
const records = ref([]);
const stats = ref(null);
const canLoad = computed(() => !!workContext.selectedProjectId);
const passRate = computed(() => {
    if (!stats.value?.totalGenerations)
        return '0%';
    return `${Math.round((stats.value.firstPassCount / stats.value.totalGenerations) * 100)}%`;
});
function parseJson(text, fallback) {
    try {
        return JSON.parse(text);
    }
    catch {
        return fallback;
    }
}
function parseJsonText(text) {
    try {
        return JSON.stringify(JSON.parse(text), null, 2);
    }
    catch {
        return text;
    }
}
function stages(row) {
    return parseJson(row.failureStages, []);
}
function attempts(row) {
    return parseJson(row.attempts, []);
}
function gateTagType(attempt) {
    return attempt.gate?.success ? 'success' : 'danger';
}
async function refresh() {
    if (!canLoad.value) {
        records.value = [];
        stats.value = null;
        return;
    }
    loading.value = true;
    try {
        const [nextStats, nextRecords] = await Promise.all([
            getGenerationStatistics(workContext.selectedProjectId),
            listGenerationRecords(workContext.selectedProjectId, null, 80)
        ]);
        stats.value = nextStats;
        records.value = nextRecords;
    }
    catch (err) {
        ElMessage.error(err.message ?? '加载生成门禁记录失败');
    }
    finally {
        loading.value = false;
    }
}
watch(() => workContext.selectedProjectId, refresh);
onMounted(async () => {
    await workContext.init();
    await refresh();
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['stats-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['stats-grid']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "generation-gate" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "stats-grid" },
});
const __VLS_0 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    shadow: "never",
}));
const __VLS_2 = __VLS_1({
    shadow: "never",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_3.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "stat-label" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
(__VLS_ctx.stats?.totalGenerations ?? 0);
var __VLS_3;
const __VLS_4 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
    shadow: "never",
}));
const __VLS_6 = __VLS_5({
    shadow: "never",
}, ...__VLS_functionalComponentArgsRest(__VLS_5));
__VLS_7.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "stat-label" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
(__VLS_ctx.stats?.firstPassCount ?? 0);
var __VLS_7;
const __VLS_8 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    shadow: "never",
}));
const __VLS_10 = __VLS_9({
    shadow: "never",
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
__VLS_11.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "stat-label" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
(__VLS_ctx.stats?.failureCount ?? 0);
var __VLS_11;
const __VLS_12 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
    shadow: "never",
}));
const __VLS_14 = __VLS_13({
    shadow: "never",
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
__VLS_15.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "stat-label" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
(__VLS_ctx.passRate);
var __VLS_15;
const __VLS_16 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
    shadow: "never",
}));
const __VLS_18 = __VLS_17({
    shadow: "never",
}, ...__VLS_functionalComponentArgsRest(__VLS_17));
__VLS_19.slots.default;
{
    const { header: __VLS_thisSlot } = __VLS_19.slots;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "panel-head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    const __VLS_20 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
        ...{ 'onClick': {} },
        size: "small",
        icon: (__VLS_ctx.Refresh),
        loading: (__VLS_ctx.loading),
    }));
    const __VLS_22 = __VLS_21({
        ...{ 'onClick': {} },
        size: "small",
        icon: (__VLS_ctx.Refresh),
        loading: (__VLS_ctx.loading),
    }, ...__VLS_functionalComponentArgsRest(__VLS_21));
    let __VLS_24;
    let __VLS_25;
    let __VLS_26;
    const __VLS_27 = {
        onClick: (__VLS_ctx.refresh)
    };
    __VLS_23.slots.default;
    var __VLS_23;
}
if (!__VLS_ctx.canLoad) {
    const __VLS_28 = {}.ElEmpty;
    /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
    // @ts-ignore
    const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
        description: "请先在顶栏选择 Project",
    }));
    const __VLS_30 = __VLS_29({
        description: "请先在顶栏选择 Project",
    }, ...__VLS_functionalComponentArgsRest(__VLS_29));
}
else {
    const __VLS_32 = {}.ElTable;
    /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
    // @ts-ignore
    const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
        data: (__VLS_ctx.records),
        size: "small",
    }));
    const __VLS_34 = __VLS_33({
        data: (__VLS_ctx.records),
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_33));
    __VLS_asFunctionalDirective(__VLS_directives.vLoading)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.loading) }, null, null);
    __VLS_35.slots.default;
    const __VLS_36 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
        label: "结果",
        width: "86",
    }));
    const __VLS_38 = __VLS_37({
        label: "结果",
        width: "86",
    }, ...__VLS_functionalComponentArgsRest(__VLS_37));
    __VLS_39.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_39.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        const __VLS_40 = {}.ElTag;
        /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
        // @ts-ignore
        const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
            size: "small",
            type: (row.success ? 'success' : 'danger'),
        }));
        const __VLS_42 = __VLS_41({
            size: "small",
            type: (row.success ? 'success' : 'danger'),
        }, ...__VLS_functionalComponentArgsRest(__VLS_41));
        __VLS_43.slots.default;
        (row.success ? '成功' : '失败');
        var __VLS_43;
    }
    var __VLS_39;
    const __VLS_44 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
        label: "章节",
        prop: "chapterId",
        minWidth: "180",
    }));
    const __VLS_46 = __VLS_45({
        label: "章节",
        prop: "chapterId",
        minWidth: "180",
    }, ...__VLS_functionalComponentArgsRest(__VLS_45));
    const __VLS_48 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
        label: "尝试",
        prop: "totalAttempts",
        width: "70",
    }));
    const __VLS_50 = __VLS_49({
        label: "尝试",
        prop: "totalAttempts",
        width: "70",
    }, ...__VLS_functionalComponentArgsRest(__VLS_49));
    const __VLS_52 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
        label: "重写",
        prop: "rewriteCount",
        width: "70",
    }));
    const __VLS_54 = __VLS_53({
        label: "重写",
        prop: "rewriteCount",
        width: "70",
    }, ...__VLS_functionalComponentArgsRest(__VLS_53));
    const __VLS_56 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
        label: "门禁阶段",
        minWidth: "180",
    }));
    const __VLS_58 = __VLS_57({
        label: "门禁阶段",
        minWidth: "180",
    }, ...__VLS_functionalComponentArgsRest(__VLS_57));
    __VLS_59.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_59.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "stage-tags" },
        });
        for (const [stage] of __VLS_getVForSourceType((__VLS_ctx.stages(row)))) {
            const __VLS_60 = {}.ElTag;
            /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
            // @ts-ignore
            const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
                key: (stage),
                size: "small",
                type: (row.success ? 'success' : 'warning'),
            }));
            const __VLS_62 = __VLS_61({
                key: (stage),
                size: "small",
                type: (row.success ? 'success' : 'warning'),
            }, ...__VLS_functionalComponentArgsRest(__VLS_61));
            __VLS_63.slots.default;
            (stage);
            var __VLS_63;
        }
        if (__VLS_ctx.stages(row).length === 0) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "muted" },
            });
        }
    }
    var __VLS_59;
    const __VLS_64 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
        label: "开始时间",
        prop: "startedAt",
        minWidth: "180",
    }));
    const __VLS_66 = __VLS_65({
        label: "开始时间",
        prop: "startedAt",
        minWidth: "180",
    }, ...__VLS_functionalComponentArgsRest(__VLS_65));
    const __VLS_68 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
        type: "expand",
    }));
    const __VLS_70 = __VLS_69({
        type: "expand",
    }, ...__VLS_functionalComponentArgsRest(__VLS_69));
    __VLS_71.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_71.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "record-detail" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "attempt-list" },
        });
        for (const [attempt] of __VLS_getVForSourceType((__VLS_ctx.attempts(row)))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                key: (attempt.attempt),
                ...{ class: "attempt-item" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "attempt-head" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
            (attempt.attempt ?? '-');
            const __VLS_72 = {}.ElTag;
            /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
            // @ts-ignore
            const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
                size: "small",
                type: (__VLS_ctx.gateTagType(attempt)),
            }));
            const __VLS_74 = __VLS_73({
                size: "small",
                type: (__VLS_ctx.gateTagType(attempt)),
            }, ...__VLS_functionalComponentArgsRest(__VLS_73));
            __VLS_75.slots.default;
            (attempt.gate?.success ? '门禁通过' : '门禁失败');
            var __VLS_75;
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "muted" },
            });
            (attempt.model);
            (attempt.charCount ?? 0);
            (attempt.elapsedMs ?? 0);
            if (attempt.gate?.allFailures?.length) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "failure-list" },
                });
                for (const [failure] of __VLS_getVForSourceType((attempt.gate.allFailures.slice(0, 8)))) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                        key: (failure),
                        ...{ class: "failure-line" },
                    });
                    (failure);
                }
            }
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.pre, __VLS_intrinsicElements.pre)({});
        (__VLS_ctx.parseJsonText(row.attempts));
    }
    var __VLS_71;
    var __VLS_35;
}
var __VLS_19;
/** @type {__VLS_StyleScopedClasses['generation-gate']} */ ;
/** @type {__VLS_StyleScopedClasses['stats-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-head']} */ ;
/** @type {__VLS_StyleScopedClasses['stage-tags']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['record-detail']} */ ;
/** @type {__VLS_StyleScopedClasses['attempt-list']} */ ;
/** @type {__VLS_StyleScopedClasses['attempt-item']} */ ;
/** @type {__VLS_StyleScopedClasses['attempt-head']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['failure-list']} */ ;
/** @type {__VLS_StyleScopedClasses['failure-line']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Refresh: Refresh,
            loading: loading,
            records: records,
            stats: stats,
            canLoad: canLoad,
            passRate: passRate,
            parseJsonText: parseJsonText,
            stages: stages,
            attempts: attempts,
            gateTagType: gateTagType,
            refresh: refresh,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
