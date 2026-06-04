import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { MagicStick, Notebook, Cpu, DocumentAdd, CollectionTag } from '@element-plus/icons-vue';
import { storeToRefs } from 'pinia';
import { listProviderConfigs } from '@/api/modules/ai';
import { generateNovelSeed, getOrCreateNovelSeedConversation, listNovelSeedPlans } from '@/api/modules/novelSeed';
import { chatHub } from '@/signalr/chat';
import { useAiTestStore } from '@/stores/aiTest';
import { useWorkContextStore } from '@/stores/workContext';
const router = useRouter();
const aiStore = useAiTestStore();
const workContext = useWorkContextStore();
const { form: aiForm } = storeToRefs(aiStore);
const configs = ref([]);
const selectedConfigId = ref('');
const loadingConfigs = ref(false);
const generating = ref(false);
const loadingPlans = ref(false);
const result = ref(null);
const plans = ref([]);
const selectedPlanId = ref('');
const currentRunId = ref('');
const streamText = ref('');
const streamStatus = ref('idle');
const streamError = ref('');
const form = reactive({
    description: '',
    genre: '',
    tone: '商业化、节奏清晰、可连续生成长篇',
    targetAudience: '网络小说读者',
    volumeCount: 3,
    chaptersPerVolume: 12,
    initialChapterPlanCount: 120,
    estimatedWordsPerChapter: 4000,
    createChapters: false,
    createDesignData: true,
    temperature: 0.7,
    maxTokens: 7000
});
const selectedConfig = computed(() => configs.value.find((item) => item.providerId === selectedConfigId.value) ?? null);
const selectedPlan = computed(() => plans.value.find((item) => item.projectId === selectedPlanId.value) ?? plans.value[0] ?? null);
const totalChapters = computed(() => form.volumeCount * form.chaptersPerVolume);
const estimatedTotalWords = computed(() => totalChapters.value * form.estimatedWordsPerChapter);
async function loadConfigs() {
    loadingConfigs.value = true;
    try {
        configs.value = await listProviderConfigs();
        if (!selectedConfigId.value && configs.value.length > 0) {
            selectedConfigId.value = configs.value[0].providerId;
            applySelectedConfig();
        }
    }
    catch (err) {
        ElMessage.error(err.message || '加载 AI 配置失败。');
    }
    finally {
        loadingConfigs.value = false;
    }
}
async function loadPlans() {
    loadingPlans.value = true;
    try {
        plans.value = await listNovelSeedPlans();
        if (!plans.value.some((item) => item.projectId === selectedPlanId.value)) {
            selectedPlanId.value = plans.value[0]?.projectId ?? '';
        }
    }
    catch (err) {
        ElMessage.error(err.message || '加载开书计划失败。');
    }
    finally {
        loadingPlans.value = false;
    }
}
function applySelectedConfig() {
    const config = selectedConfig.value;
    if (!config)
        return;
    if (config.defaultEndpoint)
        aiForm.value.endpoint = config.defaultEndpoint;
    if (config.modelCode)
        aiForm.value.model = config.modelCode;
}
async function submit() {
    if (!form.description.trim()) {
        ElMessage.warning('请先输入小说描述。');
        return;
    }
    if (!aiForm.value.endpoint || !aiForm.value.model) {
        ElMessage.warning('请填写 Endpoint 和模型。');
        return;
    }
    if (!selectedConfigId.value && !aiForm.value.apiKey) {
        ElMessage.warning('请选择已保存配置，或填写临时 API Key。');
        return;
    }
    generating.value = true;
    result.value = null;
    streamText.value = '';
    streamError.value = '';
    streamStatus.value = 'connecting';
    const runId = crypto.randomUUID();
    currentRunId.value = runId;
    try {
        await chatHub.joinRun(runId);
        const created = await generateNovelSeed({
            runId,
            description: form.description.trim(),
            genre: form.genre.trim() || null,
            tone: form.tone.trim() || null,
            targetAudience: form.targetAudience.trim() || null,
            volumeCount: form.volumeCount,
            chaptersPerVolume: form.chaptersPerVolume,
            initialChapterPlanCount: form.initialChapterPlanCount,
            estimatedWordsPerChapter: form.estimatedWordsPerChapter,
            createChapters: form.createChapters,
            createDesignData: form.createDesignData,
            configId: selectedConfigId.value || null,
            providerId: selectedConfigId.value || null,
            apiKeyId: null,
            apiKey: aiForm.value.apiKey,
            endpoint: aiForm.value.endpoint,
            model: aiForm.value.model,
            temperature: form.temperature,
            maxTokens: form.maxTokens
        });
        result.value = created;
        await workContext.refreshProjects();
        workContext.selectedProjectId = created.project.id;
        workContext.selectedVolumeId = created.volumes[0]?.id ?? '';
        await loadPlans();
        selectedPlanId.value = created.project.id;
        aiStore.saveToStorage();
        ElMessage.success(`已创建《${created.project.name}》`);
    }
    catch (err) {
        streamError.value = err.message || 'AI 开书失败。';
        streamStatus.value = 'error';
        ElMessage.error(streamError.value);
    }
    finally {
        generating.value = false;
        await chatHub.leaveRun(runId);
        currentRunId.value = '';
    }
}
function openProject() {
    if (!result.value)
        return;
    router.push('/generate/chapters');
}
async function continuePlanConversation(plan = selectedPlan.value) {
    if (!plan)
        return;
    const conversation = await getOrCreateNovelSeedConversation(plan.projectId, selectedConfigId.value || null, aiForm.value.model || null);
    workContext.selectedProjectId = plan.projectId;
    await workContext.refreshProjects();
    router.push({
        path: '/ai-assistant',
        query: {
            projectId: plan.projectId,
            sessionId: conversation.sessionId
        }
    });
}
function onToken(token) {
    if (!currentRunId.value)
        return;
    streamText.value += token;
}
function onStatus(status) {
    if (!currentRunId.value)
        return;
    streamStatus.value = status;
}
function onCompleted(reason) {
    if (!currentRunId.value)
        return;
    streamStatus.value = `completed (${reason})`;
}
function onError(message) {
    if (!currentRunId.value)
        return;
    streamError.value = message;
    streamStatus.value = 'error';
}
onMounted(() => {
    chatHub.onToken(onToken);
    chatHub.onStatus(onStatus);
    chatHub.onCompleted(onCompleted);
    chatHub.onError(onError);
    void loadConfigs();
    void loadPlans();
});
onBeforeUnmount(async () => {
    chatHub.offToken(onToken);
    chatHub.offStatus(onStatus);
    chatHub.offCompleted(onCompleted);
    chatHub.offError(onError);
    if (currentRunId.value)
        await chatHub.leaveRun(currentRunId.value);
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['panel-title']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-item']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-item']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-item']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-item']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-item']} */ ;
/** @type {__VLS_StyleScopedClasses['notice-head']} */ ;
/** @type {__VLS_StyleScopedClasses['notice-head']} */ ;
/** @type {__VLS_StyleScopedClasses['notice-head']} */ ;
/** @type {__VLS_StyleScopedClasses['announcement']} */ ;
/** @type {__VLS_StyleScopedClasses['notice-metrics']} */ ;
/** @type {__VLS_StyleScopedClasses['notice-metrics']} */ ;
/** @type {__VLS_StyleScopedClasses['notice-metrics']} */ ;
/** @type {__VLS_StyleScopedClasses['notice-metrics']} */ ;
/** @type {__VLS_StyleScopedClasses['notice-metrics']} */ ;
/** @type {__VLS_StyleScopedClasses['metrics']} */ ;
/** @type {__VLS_StyleScopedClasses['result-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['metrics']} */ ;
/** @type {__VLS_StyleScopedClasses['result-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['metrics']} */ ;
/** @type {__VLS_StyleScopedClasses['result-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['result-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-layout']} */ ;
/** @type {__VLS_StyleScopedClasses['seed-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['notice-metrics']} */ ;
/** @type {__VLS_StyleScopedClasses['result-grid']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.main, __VLS_intrinsicElements.main)({
    ...{ class: "novel-seed" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.header, __VLS_intrinsicElements.header)({
    ...{ class: "page-head" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "eyebrow" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "summary" },
});
const __VLS_0 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ 'onClick': {} },
    type: "primary",
    icon: (__VLS_ctx.MagicStick),
    loading: (__VLS_ctx.generating),
}));
const __VLS_2 = __VLS_1({
    ...{ 'onClick': {} },
    type: "primary",
    icon: (__VLS_ctx.MagicStick),
    loading: (__VLS_ctx.generating),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
let __VLS_4;
let __VLS_5;
let __VLS_6;
const __VLS_7 = {
    onClick: (__VLS_ctx.submit)
};
__VLS_3.slots.default;
(__VLS_ctx.generating ? '生成中' : '生成新小说');
var __VLS_3;
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "panel plan-board" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "panel-title" },
});
const __VLS_8 = {}.ElIcon;
/** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({}));
const __VLS_10 = __VLS_9({}, ...__VLS_functionalComponentArgsRest(__VLS_9));
__VLS_11.slots.default;
const __VLS_12 = {}.DocumentAdd;
/** @type {[typeof __VLS_components.DocumentAdd, ]} */ ;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({}));
const __VLS_14 = __VLS_13({}, ...__VLS_functionalComponentArgsRest(__VLS_13));
var __VLS_11;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
(__VLS_ctx.plans.length);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "plan-layout" },
});
__VLS_asFunctionalDirective(__VLS_directives.vLoading)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.loadingPlans) }, null, null);
__VLS_asFunctionalElement(__VLS_intrinsicElements.aside, __VLS_intrinsicElements.aside)({
    ...{ class: "plan-list" },
});
for (const [plan] of __VLS_getVForSourceType((__VLS_ctx.plans))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.selectedPlanId = plan.projectId;
            } },
        key: (plan.projectId),
        type: "button",
        ...{ class: "plan-item" },
        ...{ class: ({ active: plan.projectId === __VLS_ctx.selectedPlanId }) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (plan.projectName);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (plan.volumeCount);
    (plan.totalPlannedChapterCount);
    (plan.genre || '未填写题材');
}
if (!__VLS_ctx.loadingPlans && __VLS_ctx.plans.length === 0) {
    const __VLS_16 = {}.ElEmpty;
    /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
    // @ts-ignore
    const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
        description: "还没有开书计划。",
        imageSize: (80),
    }));
    const __VLS_18 = __VLS_17({
        description: "还没有开书计划。",
        imageSize: (80),
    }, ...__VLS_functionalComponentArgsRest(__VLS_17));
}
if (__VLS_ctx.selectedPlan) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.article, __VLS_intrinsicElements.article)({
        ...{ class: "plan-notice" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "notice-head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
    (__VLS_ctx.selectedPlan.projectName);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    (__VLS_ctx.selectedPlan.description || __VLS_ctx.selectedPlan.sourceBookName);
    const __VLS_20 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
        ...{ 'onClick': {} },
        type: "primary",
    }));
    const __VLS_22 = __VLS_21({
        ...{ 'onClick': {} },
        type: "primary",
    }, ...__VLS_functionalComponentArgsRest(__VLS_21));
    let __VLS_24;
    let __VLS_25;
    let __VLS_26;
    const __VLS_27 = {
        onClick: (...[$event]) => {
            if (!(__VLS_ctx.selectedPlan))
                return;
            __VLS_ctx.continuePlanConversation(__VLS_ctx.selectedPlan);
        }
    };
    __VLS_23.slots.default;
    var __VLS_23;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "announcement" },
    });
    (__VLS_ctx.selectedPlan.announcement);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "notice-metrics" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.selectedPlan.characterRuleCount);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.selectedPlan.factionRuleCount);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.selectedPlan.locationRuleCount);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.selectedPlan.chapterPlanCount);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.selectedPlan.chapterBlueprintCount);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "seed-grid" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "panel main-panel" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "panel-title" },
});
const __VLS_28 = {}.ElIcon;
/** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({}));
const __VLS_30 = __VLS_29({}, ...__VLS_functionalComponentArgsRest(__VLS_29));
__VLS_31.slots.default;
const __VLS_32 = {}.Notebook;
/** @type {[typeof __VLS_components.Notebook, ]} */ ;
// @ts-ignore
const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({}));
const __VLS_34 = __VLS_33({}, ...__VLS_functionalComponentArgsRest(__VLS_33));
var __VLS_31;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
const __VLS_36 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
    labelPosition: "top",
}));
const __VLS_38 = __VLS_37({
    labelPosition: "top",
}, ...__VLS_functionalComponentArgsRest(__VLS_37));
__VLS_39.slots.default;
const __VLS_40 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
    label: "一句话或详细描述",
}));
const __VLS_42 = __VLS_41({
    label: "一句话或详细描述",
}, ...__VLS_functionalComponentArgsRest(__VLS_41));
__VLS_43.slots.default;
const __VLS_44 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
    ...{ 'onKeydown': {} },
    modelValue: (__VLS_ctx.form.description),
    type: "textarea",
    rows: (8),
    placeholder: "例如：一个被流放的机械祭司，在潮汐都市里追查旧神引擎失控真相，逐步建立自己的地下秩序。",
}));
const __VLS_46 = __VLS_45({
    ...{ 'onKeydown': {} },
    modelValue: (__VLS_ctx.form.description),
    type: "textarea",
    rows: (8),
    placeholder: "例如：一个被流放的机械祭司，在潮汐都市里追查旧神引擎失控真相，逐步建立自己的地下秩序。",
}, ...__VLS_functionalComponentArgsRest(__VLS_45));
let __VLS_48;
let __VLS_49;
let __VLS_50;
const __VLS_51 = {
    onKeydown: (__VLS_ctx.submit)
};
var __VLS_47;
var __VLS_43;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "form-row" },
});
const __VLS_52 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
    label: "题材",
}));
const __VLS_54 = __VLS_53({
    label: "题材",
}, ...__VLS_functionalComponentArgsRest(__VLS_53));
__VLS_55.slots.default;
const __VLS_56 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
    modelValue: (__VLS_ctx.form.genre),
    placeholder: "都市异能 / 玄幻 / 科幻悬疑",
}));
const __VLS_58 = __VLS_57({
    modelValue: (__VLS_ctx.form.genre),
    placeholder: "都市异能 / 玄幻 / 科幻悬疑",
}, ...__VLS_functionalComponentArgsRest(__VLS_57));
var __VLS_55;
const __VLS_60 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
    label: "目标读者",
}));
const __VLS_62 = __VLS_61({
    label: "目标读者",
}, ...__VLS_functionalComponentArgsRest(__VLS_61));
__VLS_63.slots.default;
const __VLS_64 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
    modelValue: (__VLS_ctx.form.targetAudience),
}));
const __VLS_66 = __VLS_65({
    modelValue: (__VLS_ctx.form.targetAudience),
}, ...__VLS_functionalComponentArgsRest(__VLS_65));
var __VLS_63;
const __VLS_68 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
    label: "风格",
}));
const __VLS_70 = __VLS_69({
    label: "风格",
}, ...__VLS_functionalComponentArgsRest(__VLS_69));
__VLS_71.slots.default;
const __VLS_72 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
    modelValue: (__VLS_ctx.form.tone),
}));
const __VLS_74 = __VLS_73({
    modelValue: (__VLS_ctx.form.tone),
}, ...__VLS_functionalComponentArgsRest(__VLS_73));
var __VLS_71;
var __VLS_39;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "panel" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "panel-title" },
});
const __VLS_76 = {}.ElIcon;
/** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
// @ts-ignore
const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({}));
const __VLS_78 = __VLS_77({}, ...__VLS_functionalComponentArgsRest(__VLS_77));
__VLS_79.slots.default;
const __VLS_80 = {}.CollectionTag;
/** @type {[typeof __VLS_components.CollectionTag, ]} */ ;
// @ts-ignore
const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({}));
const __VLS_82 = __VLS_81({}, ...__VLS_functionalComponentArgsRest(__VLS_81));
var __VLS_79;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
const __VLS_84 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({
    labelPosition: "top",
}));
const __VLS_86 = __VLS_85({
    labelPosition: "top",
}, ...__VLS_functionalComponentArgsRest(__VLS_85));
__VLS_87.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "number-grid" },
});
const __VLS_88 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
    label: "卷数",
}));
const __VLS_90 = __VLS_89({
    label: "卷数",
}, ...__VLS_functionalComponentArgsRest(__VLS_89));
__VLS_91.slots.default;
const __VLS_92 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({
    modelValue: (__VLS_ctx.form.volumeCount),
    min: (1),
    max: (200),
}));
const __VLS_94 = __VLS_93({
    modelValue: (__VLS_ctx.form.volumeCount),
    min: (1),
    max: (200),
}, ...__VLS_functionalComponentArgsRest(__VLS_93));
var __VLS_91;
const __VLS_96 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
    label: "每卷章节",
}));
const __VLS_98 = __VLS_97({
    label: "每卷章节",
}, ...__VLS_functionalComponentArgsRest(__VLS_97));
__VLS_99.slots.default;
const __VLS_100 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_101 = __VLS_asFunctionalComponent(__VLS_100, new __VLS_100({
    modelValue: (__VLS_ctx.form.chaptersPerVolume),
    min: (1),
    max: (500),
}));
const __VLS_102 = __VLS_101({
    modelValue: (__VLS_ctx.form.chaptersPerVolume),
    min: (1),
    max: (500),
}, ...__VLS_functionalComponentArgsRest(__VLS_101));
var __VLS_99;
const __VLS_104 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_105 = __VLS_asFunctionalComponent(__VLS_104, new __VLS_104({
    label: "每章字数",
}));
const __VLS_106 = __VLS_105({
    label: "每章字数",
}, ...__VLS_functionalComponentArgsRest(__VLS_105));
__VLS_107.slots.default;
const __VLS_108 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_109 = __VLS_asFunctionalComponent(__VLS_108, new __VLS_108({
    modelValue: (__VLS_ctx.form.estimatedWordsPerChapter),
    min: (1000),
    max: (20000),
    step: (500),
}));
const __VLS_110 = __VLS_109({
    modelValue: (__VLS_ctx.form.estimatedWordsPerChapter),
    min: (1000),
    max: (20000),
    step: (500),
}, ...__VLS_functionalComponentArgsRest(__VLS_109));
var __VLS_107;
const __VLS_112 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_113 = __VLS_asFunctionalComponent(__VLS_112, new __VLS_112({
    label: "首批章节计划",
}));
const __VLS_114 = __VLS_113({
    label: "首批章节计划",
}, ...__VLS_functionalComponentArgsRest(__VLS_113));
__VLS_115.slots.default;
const __VLS_116 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_117 = __VLS_asFunctionalComponent(__VLS_116, new __VLS_116({
    modelValue: (__VLS_ctx.form.initialChapterPlanCount),
    min: (0),
    max: (500),
    step: (10),
}));
const __VLS_118 = __VLS_117({
    modelValue: (__VLS_ctx.form.initialChapterPlanCount),
    min: (0),
    max: (500),
    step: (10),
}, ...__VLS_functionalComponentArgsRest(__VLS_117));
var __VLS_115;
const __VLS_120 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_121 = __VLS_asFunctionalComponent(__VLS_120, new __VLS_120({
    label: "规划 Tokens",
}));
const __VLS_122 = __VLS_121({
    label: "规划 Tokens",
}, ...__VLS_functionalComponentArgsRest(__VLS_121));
__VLS_123.slots.default;
const __VLS_124 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({
    modelValue: (__VLS_ctx.form.maxTokens),
    min: (1500),
    max: (30000),
    step: (500),
}));
const __VLS_126 = __VLS_125({
    modelValue: (__VLS_ctx.form.maxTokens),
    min: (1500),
    max: (30000),
    step: (500),
}, ...__VLS_functionalComponentArgsRest(__VLS_125));
var __VLS_123;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "metrics" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
(__VLS_ctx.totalChapters);
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
(__VLS_ctx.estimatedTotalWords.toLocaleString());
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
const __VLS_128 = {}.ElCheckbox;
/** @type {[typeof __VLS_components.ElCheckbox, typeof __VLS_components.elCheckbox, typeof __VLS_components.ElCheckbox, typeof __VLS_components.elCheckbox, ]} */ ;
// @ts-ignore
const __VLS_129 = __VLS_asFunctionalComponent(__VLS_128, new __VLS_128({
    modelValue: (__VLS_ctx.form.createDesignData),
}));
const __VLS_130 = __VLS_129({
    modelValue: (__VLS_ctx.form.createDesignData),
}, ...__VLS_functionalComponentArgsRest(__VLS_129));
__VLS_131.slots.default;
var __VLS_131;
const __VLS_132 = {}.ElCheckbox;
/** @type {[typeof __VLS_components.ElCheckbox, typeof __VLS_components.elCheckbox, typeof __VLS_components.ElCheckbox, typeof __VLS_components.elCheckbox, ]} */ ;
// @ts-ignore
const __VLS_133 = __VLS_asFunctionalComponent(__VLS_132, new __VLS_132({
    modelValue: (__VLS_ctx.form.createChapters),
}));
const __VLS_134 = __VLS_133({
    modelValue: (__VLS_ctx.form.createChapters),
}, ...__VLS_functionalComponentArgsRest(__VLS_133));
__VLS_135.slots.default;
var __VLS_135;
var __VLS_87;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "panel" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "panel-title" },
});
const __VLS_136 = {}.ElIcon;
/** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
// @ts-ignore
const __VLS_137 = __VLS_asFunctionalComponent(__VLS_136, new __VLS_136({}));
const __VLS_138 = __VLS_137({}, ...__VLS_functionalComponentArgsRest(__VLS_137));
__VLS_139.slots.default;
const __VLS_140 = {}.Cpu;
/** @type {[typeof __VLS_components.Cpu, ]} */ ;
// @ts-ignore
const __VLS_141 = __VLS_asFunctionalComponent(__VLS_140, new __VLS_140({}));
const __VLS_142 = __VLS_141({}, ...__VLS_functionalComponentArgsRest(__VLS_141));
var __VLS_139;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
const __VLS_144 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_145 = __VLS_asFunctionalComponent(__VLS_144, new __VLS_144({
    labelPosition: "top",
}));
const __VLS_146 = __VLS_145({
    labelPosition: "top",
}, ...__VLS_functionalComponentArgsRest(__VLS_145));
__VLS_147.slots.default;
const __VLS_148 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_149 = __VLS_asFunctionalComponent(__VLS_148, new __VLS_148({
    label: "已保存配置",
}));
const __VLS_150 = __VLS_149({
    label: "已保存配置",
}, ...__VLS_functionalComponentArgsRest(__VLS_149));
__VLS_151.slots.default;
const __VLS_152 = {}.ElSelect;
/** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
// @ts-ignore
const __VLS_153 = __VLS_asFunctionalComponent(__VLS_152, new __VLS_152({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.selectedConfigId),
    filterable: true,
    clearable: true,
    loading: (__VLS_ctx.loadingConfigs),
    placeholder: "选择配置",
}));
const __VLS_154 = __VLS_153({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.selectedConfigId),
    filterable: true,
    clearable: true,
    loading: (__VLS_ctx.loadingConfigs),
    placeholder: "选择配置",
}, ...__VLS_functionalComponentArgsRest(__VLS_153));
let __VLS_156;
let __VLS_157;
let __VLS_158;
const __VLS_159 = {
    onChange: (__VLS_ctx.applySelectedConfig)
};
__VLS_155.slots.default;
for (const [item] of __VLS_getVForSourceType((__VLS_ctx.configs))) {
    const __VLS_160 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_161 = __VLS_asFunctionalComponent(__VLS_160, new __VLS_160({
        key: (item.providerId),
        label: (item.name),
        value: (item.providerId),
    }));
    const __VLS_162 = __VLS_161({
        key: (item.providerId),
        label: (item.name),
        value: (item.providerId),
    }, ...__VLS_functionalComponentArgsRest(__VLS_161));
}
var __VLS_155;
var __VLS_151;
const __VLS_164 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_165 = __VLS_asFunctionalComponent(__VLS_164, new __VLS_164({
    label: "Endpoint",
}));
const __VLS_166 = __VLS_165({
    label: "Endpoint",
}, ...__VLS_functionalComponentArgsRest(__VLS_165));
__VLS_167.slots.default;
const __VLS_168 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_169 = __VLS_asFunctionalComponent(__VLS_168, new __VLS_168({
    modelValue: (__VLS_ctx.aiForm.endpoint),
    placeholder: "https://api.openai.com/v1",
}));
const __VLS_170 = __VLS_169({
    modelValue: (__VLS_ctx.aiForm.endpoint),
    placeholder: "https://api.openai.com/v1",
}, ...__VLS_functionalComponentArgsRest(__VLS_169));
var __VLS_167;
const __VLS_172 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_173 = __VLS_asFunctionalComponent(__VLS_172, new __VLS_172({
    label: "模型",
}));
const __VLS_174 = __VLS_173({
    label: "模型",
}, ...__VLS_functionalComponentArgsRest(__VLS_173));
__VLS_175.slots.default;
const __VLS_176 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_177 = __VLS_asFunctionalComponent(__VLS_176, new __VLS_176({
    modelValue: (__VLS_ctx.aiForm.model),
    placeholder: "gpt-4o / deepseek-chat / ...",
}));
const __VLS_178 = __VLS_177({
    modelValue: (__VLS_ctx.aiForm.model),
    placeholder: "gpt-4o / deepseek-chat / ...",
}, ...__VLS_functionalComponentArgsRest(__VLS_177));
var __VLS_175;
const __VLS_180 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_181 = __VLS_asFunctionalComponent(__VLS_180, new __VLS_180({
    label: "临时 API Key",
}));
const __VLS_182 = __VLS_181({
    label: "临时 API Key",
}, ...__VLS_functionalComponentArgsRest(__VLS_181));
__VLS_183.slots.default;
const __VLS_184 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_185 = __VLS_asFunctionalComponent(__VLS_184, new __VLS_184({
    modelValue: (__VLS_ctx.aiForm.apiKey),
    type: "password",
    showPassword: true,
    placeholder: "已保存配置可不填",
}));
const __VLS_186 = __VLS_185({
    modelValue: (__VLS_ctx.aiForm.apiKey),
    type: "password",
    showPassword: true,
    placeholder: "已保存配置可不填",
}, ...__VLS_functionalComponentArgsRest(__VLS_185));
var __VLS_183;
const __VLS_188 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_189 = __VLS_asFunctionalComponent(__VLS_188, new __VLS_188({
    label: "温度",
}));
const __VLS_190 = __VLS_189({
    label: "温度",
}, ...__VLS_functionalComponentArgsRest(__VLS_189));
__VLS_191.slots.default;
const __VLS_192 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_193 = __VLS_asFunctionalComponent(__VLS_192, new __VLS_192({
    modelValue: (__VLS_ctx.form.temperature),
    min: (0),
    max: (2),
    step: (0.1),
}));
const __VLS_194 = __VLS_193({
    modelValue: (__VLS_ctx.form.temperature),
    min: (0),
    max: (2),
    step: (0.1),
}, ...__VLS_functionalComponentArgsRest(__VLS_193));
var __VLS_191;
var __VLS_147;
if (__VLS_ctx.generating || __VLS_ctx.streamText || __VLS_ctx.streamError) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "panel stream-panel" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "panel-title" },
    });
    const __VLS_196 = {}.ElIcon;
    /** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
    // @ts-ignore
    const __VLS_197 = __VLS_asFunctionalComponent(__VLS_196, new __VLS_196({}));
    const __VLS_198 = __VLS_197({}, ...__VLS_functionalComponentArgsRest(__VLS_197));
    __VLS_199.slots.default;
    const __VLS_200 = {}.MagicStick;
    /** @type {[typeof __VLS_components.MagicStick, ]} */ ;
    // @ts-ignore
    const __VLS_201 = __VLS_asFunctionalComponent(__VLS_200, new __VLS_200({}));
    const __VLS_202 = __VLS_201({}, ...__VLS_functionalComponentArgsRest(__VLS_201));
    var __VLS_199;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
    (__VLS_ctx.streamStatus);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.pre, __VLS_intrinsicElements.pre)({
        ...{ class: "stream-output" },
    });
    (__VLS_ctx.streamText || '等待 AI 返回规划 JSON...');
    if (__VLS_ctx.streamError) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "stream-error" },
        });
        (__VLS_ctx.streamError);
    }
}
if (__VLS_ctx.result) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "panel result-panel" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "panel-title" },
    });
    const __VLS_204 = {}.ElIcon;
    /** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
    // @ts-ignore
    const __VLS_205 = __VLS_asFunctionalComponent(__VLS_204, new __VLS_204({}));
    const __VLS_206 = __VLS_205({}, ...__VLS_functionalComponentArgsRest(__VLS_205));
    __VLS_207.slots.default;
    const __VLS_208 = {}.DocumentAdd;
    /** @type {[typeof __VLS_components.DocumentAdd, ]} */ ;
    // @ts-ignore
    const __VLS_209 = __VLS_asFunctionalComponent(__VLS_208, new __VLS_208({}));
    const __VLS_210 = __VLS_209({}, ...__VLS_functionalComponentArgsRest(__VLS_209));
    var __VLS_207;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "result-grid" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.result.project.name);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.result.volumes.length);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.result.totalPlannedChapterCount);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.result.creativeMaterialCount);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.result.characterRuleCount);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.result.factionRuleCount);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.result.locationRuleCount);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.result.chapterPlanCount);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.result.chapterBlueprintCount);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "result-actions" },
    });
    const __VLS_212 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_213 = __VLS_asFunctionalComponent(__VLS_212, new __VLS_212({
        ...{ 'onClick': {} },
        type: "primary",
    }));
    const __VLS_214 = __VLS_213({
        ...{ 'onClick': {} },
        type: "primary",
    }, ...__VLS_functionalComponentArgsRest(__VLS_213));
    let __VLS_216;
    let __VLS_217;
    let __VLS_218;
    const __VLS_219 = {
        onClick: (__VLS_ctx.openProject)
    };
    __VLS_215.slots.default;
    var __VLS_215;
    const __VLS_220 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_221 = __VLS_asFunctionalComponent(__VLS_220, new __VLS_220({
        ...{ 'onClick': {} },
    }));
    const __VLS_222 = __VLS_221({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_221));
    let __VLS_224;
    let __VLS_225;
    let __VLS_226;
    const __VLS_227 = {
        onClick: (...[$event]) => {
            if (!(__VLS_ctx.result))
                return;
            __VLS_ctx.router.push('/design/world_rules');
        }
    };
    __VLS_223.slots.default;
    var __VLS_223;
    const __VLS_228 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_229 = __VLS_asFunctionalComponent(__VLS_228, new __VLS_228({
        ...{ 'onClick': {} },
    }));
    const __VLS_230 = __VLS_229({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_229));
    let __VLS_232;
    let __VLS_233;
    let __VLS_234;
    const __VLS_235 = {
        onClick: (...[$event]) => {
            if (!(__VLS_ctx.result))
                return;
            __VLS_ctx.router.push('/design/creative_materials');
        }
    };
    __VLS_231.slots.default;
    var __VLS_231;
}
/** @type {__VLS_StyleScopedClasses['novel-seed']} */ ;
/** @type {__VLS_StyleScopedClasses['page-head']} */ ;
/** @type {__VLS_StyleScopedClasses['eyebrow']} */ ;
/** @type {__VLS_StyleScopedClasses['summary']} */ ;
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-board']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-title']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-layout']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-list']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-item']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-notice']} */ ;
/** @type {__VLS_StyleScopedClasses['notice-head']} */ ;
/** @type {__VLS_StyleScopedClasses['announcement']} */ ;
/** @type {__VLS_StyleScopedClasses['notice-metrics']} */ ;
/** @type {__VLS_StyleScopedClasses['seed-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
/** @type {__VLS_StyleScopedClasses['main-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-title']} */ ;
/** @type {__VLS_StyleScopedClasses['form-row']} */ ;
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-title']} */ ;
/** @type {__VLS_StyleScopedClasses['number-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['metrics']} */ ;
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-title']} */ ;
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
/** @type {__VLS_StyleScopedClasses['stream-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-title']} */ ;
/** @type {__VLS_StyleScopedClasses['stream-output']} */ ;
/** @type {__VLS_StyleScopedClasses['stream-error']} */ ;
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
/** @type {__VLS_StyleScopedClasses['result-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-title']} */ ;
/** @type {__VLS_StyleScopedClasses['result-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['result-actions']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            MagicStick: MagicStick,
            Notebook: Notebook,
            Cpu: Cpu,
            DocumentAdd: DocumentAdd,
            CollectionTag: CollectionTag,
            router: router,
            aiForm: aiForm,
            configs: configs,
            selectedConfigId: selectedConfigId,
            loadingConfigs: loadingConfigs,
            generating: generating,
            loadingPlans: loadingPlans,
            result: result,
            plans: plans,
            selectedPlanId: selectedPlanId,
            streamText: streamText,
            streamStatus: streamStatus,
            streamError: streamError,
            form: form,
            selectedPlan: selectedPlan,
            totalChapters: totalChapters,
            estimatedTotalWords: estimatedTotalWords,
            applySelectedConfig: applySelectedConfig,
            submit: submit,
            openProject: openProject,
            continuePlanConversation: continuePlanConversation,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
