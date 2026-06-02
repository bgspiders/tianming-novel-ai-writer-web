import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { storeToRefs } from 'pinia';
import { postTestCompletion } from '@/api/modules/aiTest';
import { listProviderConfigs } from '@/api/modules/ai';
import { useI18n } from '@/composables/useI18n';
import { chatHub } from '@/signalr/chat';
import { useAiTestStore } from '@/stores/aiTest';
const store = useAiTestStore();
const { form, output, status, error, isStreaming } = storeToRefs(store);
const { t } = useI18n();
const currentRunId = ref('');
const metaInfo = ref(null);
const configs = ref([]);
const loadingConfigs = ref(false);
const selectedConfig = computed(() => configs.value.find((item) => item.providerId === form.value.configId) ?? null);
function onToken(token) {
    store.appendToken(token);
}
function onStatus(nextStatus) {
    status.value = nextStatus;
}
function onCompleted(reason) {
    status.value = `completed (${reason})`;
}
function onError(message) {
    error.value = message;
    status.value = 'error';
}
onMounted(() => {
    store.loadFromStorage();
    chatHub.onToken(onToken);
    chatHub.onStatus(onStatus);
    chatHub.onCompleted(onCompleted);
    chatHub.onError(onError);
    void refreshConfigs();
});
onBeforeUnmount(async () => {
    chatHub.offToken(onToken);
    chatHub.offStatus(onStatus);
    chatHub.offCompleted(onCompleted);
    chatHub.offError(onError);
    if (currentRunId.value) {
        await chatHub.leaveRun(currentRunId.value);
    }
});
async function submit() {
    const hasResolvedKey = Boolean(form.value.apiKey || form.value.configId);
    if (!form.value.endpoint || !hasResolvedKey || !form.value.model || !form.value.prompt) {
        ElMessage.warning(t('aiTest.messages.required'));
        return;
    }
    store.reset();
    metaInfo.value = null;
    isStreaming.value = true;
    const runId = crypto.randomUUID();
    currentRunId.value = runId;
    try {
        await chatHub.joinRun(runId);
    }
    catch (err) {
        isStreaming.value = false;
        ElMessage.error(t('aiTest.messages.signalrFailed', {
            message: err.message ?? t('aiTest.messages.unknownError')
        }));
        return;
    }
    try {
        const result = await postTestCompletion({
            runId,
            configId: form.value.configId || null,
            endpoint: form.value.endpoint,
            apiKey: form.value.apiKey,
            model: form.value.model,
            prompt: form.value.prompt,
            systemPrompt: form.value.systemPrompt || undefined,
            temperature: form.value.temperature,
            maxTokens: form.value.maxTokens
        });
        metaInfo.value = {
            chunkCount: result.chunkCount,
            charCount: result.charCount,
            elapsedMs: result.elapsedMs,
            finishReason: result.finishReason
        };
        store.saveToStorage();
    }
    catch (err) {
        error.value = err.message ?? t('aiTest.messages.requestFailed');
        ElMessage.error(error.value);
    }
    finally {
        isStreaming.value = false;
        await chatHub.leaveRun(runId);
        currentRunId.value = '';
    }
}
function clearOutput() {
    store.reset();
    metaInfo.value = null;
}
async function refreshConfigs() {
    loadingConfigs.value = true;
    try {
        configs.value = (await listProviderConfigs()).filter((item) => item.isEnabled);
        if (!configs.value.some((item) => item.providerId === form.value.configId)) {
            form.value.configId = configs.value[0]?.providerId ?? '';
        }
    }
    catch (err) {
        ElMessage.error(err.message ?? t('aiTest.messages.loadConfigsFailed'));
    }
    finally {
        loadingConfigs.value = false;
    }
}
watch(() => form.value.configId, (configId) => {
    const config = configs.value.find((item) => item.providerId === configId);
    if (!config)
        return;
    form.value.endpoint = config.defaultEndpoint || form.value.endpoint;
    form.value.model = config.modelCode || form.value.model;
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['hint']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "ai-test" },
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
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({
    ...{ class: "title" },
});
(__VLS_ctx.t('aiTest.title'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "hint" },
});
(__VLS_ctx.t('aiTest.hint'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.br)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
(__VLS_ctx.t('aiTest.memoryOnly'));
const __VLS_4 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
    model: (__VLS_ctx.form),
    labelWidth: "110px",
    ...{ class: "form" },
    disabled: (__VLS_ctx.isStreaming),
}));
const __VLS_6 = __VLS_5({
    model: (__VLS_ctx.form),
    labelWidth: "110px",
    ...{ class: "form" },
    disabled: (__VLS_ctx.isStreaming),
}, ...__VLS_functionalComponentArgsRest(__VLS_5));
__VLS_7.slots.default;
const __VLS_8 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    label: (__VLS_ctx.t('aiTest.labels.config')),
}));
const __VLS_10 = __VLS_9({
    label: (__VLS_ctx.t('aiTest.labels.config')),
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
__VLS_11.slots.default;
const __VLS_12 = {}.ElSelect;
/** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
    modelValue: (__VLS_ctx.form.configId),
    filterable: true,
    clearable: true,
    loading: (__VLS_ctx.loadingConfigs),
    ...{ style: {} },
}));
const __VLS_14 = __VLS_13({
    modelValue: (__VLS_ctx.form.configId),
    filterable: true,
    clearable: true,
    loading: (__VLS_ctx.loadingConfigs),
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
__VLS_15.slots.default;
for (const [config] of __VLS_getVForSourceType((__VLS_ctx.configs))) {
    const __VLS_16 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
        key: (config.providerId),
        label: (`${config.name} / ${config.modelCode || '--'}`),
        value: (config.providerId),
    }));
    const __VLS_18 = __VLS_17({
        key: (config.providerId),
        label: (`${config.name} / ${config.modelCode || '--'}`),
        value: (config.providerId),
    }, ...__VLS_functionalComponentArgsRest(__VLS_17));
}
var __VLS_15;
var __VLS_11;
const __VLS_20 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
    label: (__VLS_ctx.t('aiTest.labels.endpoint')),
}));
const __VLS_22 = __VLS_21({
    label: (__VLS_ctx.t('aiTest.labels.endpoint')),
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
__VLS_23.slots.default;
const __VLS_24 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
    modelValue: (__VLS_ctx.form.endpoint),
    placeholder: (__VLS_ctx.t('aiTest.placeholders.endpoint')),
}));
const __VLS_26 = __VLS_25({
    modelValue: (__VLS_ctx.form.endpoint),
    placeholder: (__VLS_ctx.t('aiTest.placeholders.endpoint')),
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
var __VLS_23;
const __VLS_28 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
    label: (__VLS_ctx.t('aiTest.labels.apiKey')),
}));
const __VLS_30 = __VLS_29({
    label: (__VLS_ctx.t('aiTest.labels.apiKey')),
}, ...__VLS_functionalComponentArgsRest(__VLS_29));
__VLS_31.slots.default;
const __VLS_32 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
    modelValue: (__VLS_ctx.form.apiKey),
    type: "password",
    showPassword: true,
    placeholder: (__VLS_ctx.t('aiTest.placeholders.apiKey')),
}));
const __VLS_34 = __VLS_33({
    modelValue: (__VLS_ctx.form.apiKey),
    type: "password",
    showPassword: true,
    placeholder: (__VLS_ctx.t('aiTest.placeholders.apiKey')),
}, ...__VLS_functionalComponentArgsRest(__VLS_33));
var __VLS_31;
const __VLS_36 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
    label: (__VLS_ctx.t('aiTest.labels.model')),
}));
const __VLS_38 = __VLS_37({
    label: (__VLS_ctx.t('aiTest.labels.model')),
}, ...__VLS_functionalComponentArgsRest(__VLS_37));
__VLS_39.slots.default;
const __VLS_40 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
    modelValue: (__VLS_ctx.form.model),
    placeholder: (__VLS_ctx.t('aiTest.placeholders.model')),
}));
const __VLS_42 = __VLS_41({
    modelValue: (__VLS_ctx.form.model),
    placeholder: (__VLS_ctx.t('aiTest.placeholders.model')),
}, ...__VLS_functionalComponentArgsRest(__VLS_41));
var __VLS_39;
if (__VLS_ctx.selectedConfig) {
    const __VLS_44 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
        label: (__VLS_ctx.t('aiTest.labels.configSummary')),
    }));
    const __VLS_46 = __VLS_45({
        label: (__VLS_ctx.t('aiTest.labels.configSummary')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_45));
    __VLS_47.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "config-summary" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    (__VLS_ctx.selectedConfig.name);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "config-meta" },
    });
    (__VLS_ctx.selectedConfig.defaultEndpoint || '--');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "config-meta" },
    });
    (__VLS_ctx.selectedConfig.apiKeyMaskedTail || __VLS_ctx.t('aiTest.labels.noSavedKey'));
    var __VLS_47;
}
const __VLS_48 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
    label: (__VLS_ctx.t('aiTest.labels.systemPrompt')),
}));
const __VLS_50 = __VLS_49({
    label: (__VLS_ctx.t('aiTest.labels.systemPrompt')),
}, ...__VLS_functionalComponentArgsRest(__VLS_49));
__VLS_51.slots.default;
const __VLS_52 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
    modelValue: (__VLS_ctx.form.systemPrompt),
    type: "textarea",
    rows: (2),
    placeholder: (__VLS_ctx.t('aiTest.placeholders.systemPrompt')),
}));
const __VLS_54 = __VLS_53({
    modelValue: (__VLS_ctx.form.systemPrompt),
    type: "textarea",
    rows: (2),
    placeholder: (__VLS_ctx.t('aiTest.placeholders.systemPrompt')),
}, ...__VLS_functionalComponentArgsRest(__VLS_53));
var __VLS_51;
const __VLS_56 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
    label: (__VLS_ctx.t('aiTest.labels.userPrompt')),
}));
const __VLS_58 = __VLS_57({
    label: (__VLS_ctx.t('aiTest.labels.userPrompt')),
}, ...__VLS_functionalComponentArgsRest(__VLS_57));
__VLS_59.slots.default;
const __VLS_60 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
    modelValue: (__VLS_ctx.form.prompt),
    type: "textarea",
    rows: (3),
}));
const __VLS_62 = __VLS_61({
    modelValue: (__VLS_ctx.form.prompt),
    type: "textarea",
    rows: (3),
}, ...__VLS_functionalComponentArgsRest(__VLS_61));
var __VLS_59;
const __VLS_64 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
    label: (__VLS_ctx.t('aiTest.labels.temperature')),
}));
const __VLS_66 = __VLS_65({
    label: (__VLS_ctx.t('aiTest.labels.temperature')),
}, ...__VLS_functionalComponentArgsRest(__VLS_65));
__VLS_67.slots.default;
const __VLS_68 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
    modelValue: (__VLS_ctx.form.temperature),
    min: (0),
    max: (2),
    step: (0.1),
}));
const __VLS_70 = __VLS_69({
    modelValue: (__VLS_ctx.form.temperature),
    min: (0),
    max: (2),
    step: (0.1),
}, ...__VLS_functionalComponentArgsRest(__VLS_69));
var __VLS_67;
const __VLS_72 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
    label: (__VLS_ctx.t('aiTest.labels.maxTokens')),
}));
const __VLS_74 = __VLS_73({
    label: (__VLS_ctx.t('aiTest.labels.maxTokens')),
}, ...__VLS_functionalComponentArgsRest(__VLS_73));
__VLS_75.slots.default;
const __VLS_76 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({
    modelValue: (__VLS_ctx.form.maxTokens),
    min: (64),
    max: (8192),
    step: (64),
}));
const __VLS_78 = __VLS_77({
    modelValue: (__VLS_ctx.form.maxTokens),
    min: (64),
    max: (8192),
    step: (64),
}, ...__VLS_functionalComponentArgsRest(__VLS_77));
var __VLS_75;
const __VLS_80 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({}));
const __VLS_82 = __VLS_81({}, ...__VLS_functionalComponentArgsRest(__VLS_81));
__VLS_83.slots.default;
const __VLS_84 = {}.ElSpace;
/** @type {[typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, ]} */ ;
// @ts-ignore
const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({
    size: (12),
}));
const __VLS_86 = __VLS_85({
    size: (12),
}, ...__VLS_functionalComponentArgsRest(__VLS_85));
__VLS_87.slots.default;
const __VLS_88 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
    ...{ 'onClick': {} },
    type: "primary",
    loading: (__VLS_ctx.isStreaming),
}));
const __VLS_90 = __VLS_89({
    ...{ 'onClick': {} },
    type: "primary",
    loading: (__VLS_ctx.isStreaming),
}, ...__VLS_functionalComponentArgsRest(__VLS_89));
let __VLS_92;
let __VLS_93;
let __VLS_94;
const __VLS_95 = {
    onClick: (__VLS_ctx.submit)
};
__VLS_91.slots.default;
(__VLS_ctx.isStreaming ? __VLS_ctx.t('aiTest.actions.running') : __VLS_ctx.t('aiTest.actions.send'));
var __VLS_91;
const __VLS_96 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
    ...{ 'onClick': {} },
    disabled: (__VLS_ctx.isStreaming),
}));
const __VLS_98 = __VLS_97({
    ...{ 'onClick': {} },
    disabled: (__VLS_ctx.isStreaming),
}, ...__VLS_functionalComponentArgsRest(__VLS_97));
let __VLS_100;
let __VLS_101;
let __VLS_102;
const __VLS_103 = {
    onClick: (__VLS_ctx.clearOutput)
};
__VLS_99.slots.default;
(__VLS_ctx.t('aiTest.actions.clear'));
var __VLS_99;
var __VLS_87;
var __VLS_83;
var __VLS_7;
const __VLS_104 = {}.ElDivider;
/** @type {[typeof __VLS_components.ElDivider, typeof __VLS_components.elDivider, ]} */ ;
// @ts-ignore
const __VLS_105 = __VLS_asFunctionalComponent(__VLS_104, new __VLS_104({}));
const __VLS_106 = __VLS_105({}, ...__VLS_functionalComponentArgsRest(__VLS_105));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "status-row" },
});
const __VLS_108 = {}.ElTag;
/** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
// @ts-ignore
const __VLS_109 = __VLS_asFunctionalComponent(__VLS_108, new __VLS_108({
    size: "small",
    type: (__VLS_ctx.status === 'error' ? 'danger' : 'info'),
}));
const __VLS_110 = __VLS_109({
    size: "small",
    type: (__VLS_ctx.status === 'error' ? 'danger' : 'info'),
}, ...__VLS_functionalComponentArgsRest(__VLS_109));
__VLS_111.slots.default;
(__VLS_ctx.t('aiTest.status.label', { status: __VLS_ctx.status }));
var __VLS_111;
if (__VLS_ctx.metaInfo) {
    const __VLS_112 = {}.ElTag;
    /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
    // @ts-ignore
    const __VLS_113 = __VLS_asFunctionalComponent(__VLS_112, new __VLS_112({
        size: "small",
        type: "success",
    }));
    const __VLS_114 = __VLS_113({
        size: "small",
        type: "success",
    }, ...__VLS_functionalComponentArgsRest(__VLS_113));
    __VLS_115.slots.default;
    (__VLS_ctx.t('aiTest.status.chunks'));
    (__VLS_ctx.metaInfo.chunkCount);
    (__VLS_ctx.t('aiTest.status.chars'));
    (__VLS_ctx.metaInfo.charCount);
    (__VLS_ctx.metaInfo.elapsedMs);
    (__VLS_ctx.metaInfo.finishReason || __VLS_ctx.t('aiTest.status.completed'));
    var __VLS_115;
}
if (__VLS_ctx.error) {
    const __VLS_116 = {}.ElAlert;
    /** @type {[typeof __VLS_components.ElAlert, typeof __VLS_components.elAlert, ]} */ ;
    // @ts-ignore
    const __VLS_117 = __VLS_asFunctionalComponent(__VLS_116, new __VLS_116({
        title: (__VLS_ctx.error),
        type: "error",
        showIcon: true,
        closable: (false),
        ...{ style: {} },
    }));
    const __VLS_118 = __VLS_117({
        title: (__VLS_ctx.error),
        type: "error",
        showIcon: true,
        closable: (false),
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_117));
}
if (__VLS_ctx.output) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "output" },
    });
    (__VLS_ctx.output);
}
else {
    const __VLS_120 = {}.ElEmpty;
    /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
    // @ts-ignore
    const __VLS_121 = __VLS_asFunctionalComponent(__VLS_120, new __VLS_120({
        description: (__VLS_ctx.t('aiTest.status.noOutput')),
        imageSize: (80),
    }));
    const __VLS_122 = __VLS_121({
        description: (__VLS_ctx.t('aiTest.status.noOutput')),
        imageSize: (80),
    }, ...__VLS_functionalComponentArgsRest(__VLS_121));
}
var __VLS_3;
/** @type {__VLS_StyleScopedClasses['ai-test']} */ ;
/** @type {__VLS_StyleScopedClasses['title']} */ ;
/** @type {__VLS_StyleScopedClasses['hint']} */ ;
/** @type {__VLS_StyleScopedClasses['form']} */ ;
/** @type {__VLS_StyleScopedClasses['config-summary']} */ ;
/** @type {__VLS_StyleScopedClasses['config-meta']} */ ;
/** @type {__VLS_StyleScopedClasses['config-meta']} */ ;
/** @type {__VLS_StyleScopedClasses['status-row']} */ ;
/** @type {__VLS_StyleScopedClasses['output']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            form: form,
            output: output,
            status: status,
            error: error,
            isStreaming: isStreaming,
            t: t,
            metaInfo: metaInfo,
            configs: configs,
            loadingConfigs: loadingConfigs,
            selectedConfig: selectedConfig,
            submit: submit,
            clearOutput: clearOutput,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
