import { onMounted, onBeforeUnmount, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { storeToRefs } from 'pinia';
import { useAiTestStore } from '@/stores/aiTest';
import { postTestCompletion } from '@/api/modules/aiTest';
import { chatHub } from '@/signalr/chat';
const store = useAiTestStore();
const { form, output, status, error, isStreaming } = storeToRefs(store);
const currentRunId = ref('');
const metaInfo = ref(null);
function onToken(token) {
    store.appendToken(token);
}
function onStatus(s) {
    status.value = s;
}
function onCompleted(reason) {
    status.value = `completed (${reason})`;
}
function onError(msg) {
    error.value = msg;
    status.value = 'error';
}
onMounted(() => {
    store.loadFromStorage();
    chatHub.onToken(onToken);
    chatHub.onStatus(onStatus);
    chatHub.onCompleted(onCompleted);
    chatHub.onError(onError);
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
    if (!form.value.endpoint || !form.value.apiKey || !form.value.model || !form.value.prompt) {
        ElMessage.warning('请填写完整的 endpoint / apiKey / model / prompt');
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
    catch (e) {
        isStreaming.value = false;
        const err = e;
        ElMessage.error('SignalR 连接失败：' + (err.message ?? '未知错误'));
        return;
    }
    try {
        const result = await postTestCompletion({
            runId,
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
    catch (e) {
        const err = e;
        error.value = err.message ?? '请求失败';
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
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "hint" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.code, __VLS_intrinsicElements.code)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.code, __VLS_intrinsicElements.code)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.br)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.code, __VLS_intrinsicElements.code)({});
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
    label: "Endpoint",
}));
const __VLS_10 = __VLS_9({
    label: "Endpoint",
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
__VLS_11.slots.default;
const __VLS_12 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
    modelValue: (__VLS_ctx.form.endpoint),
    placeholder: "https://api.openai.com/v1",
}));
const __VLS_14 = __VLS_13({
    modelValue: (__VLS_ctx.form.endpoint),
    placeholder: "https://api.openai.com/v1",
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
var __VLS_11;
const __VLS_16 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
    label: "API Key",
}));
const __VLS_18 = __VLS_17({
    label: "API Key",
}, ...__VLS_functionalComponentArgsRest(__VLS_17));
__VLS_19.slots.default;
const __VLS_20 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
    modelValue: (__VLS_ctx.form.apiKey),
    type: "password",
    showPassword: true,
    placeholder: "sk-...",
}));
const __VLS_22 = __VLS_21({
    modelValue: (__VLS_ctx.form.apiKey),
    type: "password",
    showPassword: true,
    placeholder: "sk-...",
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
var __VLS_19;
const __VLS_24 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
    label: "Model",
}));
const __VLS_26 = __VLS_25({
    label: "Model",
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
__VLS_27.slots.default;
const __VLS_28 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
    modelValue: (__VLS_ctx.form.model),
    placeholder: "gpt-4o-mini / deepseek-chat / ...",
}));
const __VLS_30 = __VLS_29({
    modelValue: (__VLS_ctx.form.model),
    placeholder: "gpt-4o-mini / deepseek-chat / ...",
}, ...__VLS_functionalComponentArgsRest(__VLS_29));
var __VLS_27;
const __VLS_32 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
    label: "System Prompt",
}));
const __VLS_34 = __VLS_33({
    label: "System Prompt",
}, ...__VLS_functionalComponentArgsRest(__VLS_33));
__VLS_35.slots.default;
const __VLS_36 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
    modelValue: (__VLS_ctx.form.systemPrompt),
    type: "textarea",
    rows: (2),
    placeholder: "可选",
}));
const __VLS_38 = __VLS_37({
    modelValue: (__VLS_ctx.form.systemPrompt),
    type: "textarea",
    rows: (2),
    placeholder: "可选",
}, ...__VLS_functionalComponentArgsRest(__VLS_37));
var __VLS_35;
const __VLS_40 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
    label: "User Prompt",
}));
const __VLS_42 = __VLS_41({
    label: "User Prompt",
}, ...__VLS_functionalComponentArgsRest(__VLS_41));
__VLS_43.slots.default;
const __VLS_44 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
    modelValue: (__VLS_ctx.form.prompt),
    type: "textarea",
    rows: (3),
}));
const __VLS_46 = __VLS_45({
    modelValue: (__VLS_ctx.form.prompt),
    type: "textarea",
    rows: (3),
}, ...__VLS_functionalComponentArgsRest(__VLS_45));
var __VLS_43;
const __VLS_48 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
    label: "Temperature",
}));
const __VLS_50 = __VLS_49({
    label: "Temperature",
}, ...__VLS_functionalComponentArgsRest(__VLS_49));
__VLS_51.slots.default;
const __VLS_52 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
    modelValue: (__VLS_ctx.form.temperature),
    min: (0),
    max: (2),
    step: (0.1),
}));
const __VLS_54 = __VLS_53({
    modelValue: (__VLS_ctx.form.temperature),
    min: (0),
    max: (2),
    step: (0.1),
}, ...__VLS_functionalComponentArgsRest(__VLS_53));
var __VLS_51;
const __VLS_56 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
    label: "Max Tokens",
}));
const __VLS_58 = __VLS_57({
    label: "Max Tokens",
}, ...__VLS_functionalComponentArgsRest(__VLS_57));
__VLS_59.slots.default;
const __VLS_60 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
    modelValue: (__VLS_ctx.form.maxTokens),
    min: (64),
    max: (8192),
    step: (64),
}));
const __VLS_62 = __VLS_61({
    modelValue: (__VLS_ctx.form.maxTokens),
    min: (64),
    max: (8192),
    step: (64),
}, ...__VLS_functionalComponentArgsRest(__VLS_61));
var __VLS_59;
const __VLS_64 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({}));
const __VLS_66 = __VLS_65({}, ...__VLS_functionalComponentArgsRest(__VLS_65));
__VLS_67.slots.default;
const __VLS_68 = {}.ElSpace;
/** @type {[typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, ]} */ ;
// @ts-ignore
const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
    size: (12),
}));
const __VLS_70 = __VLS_69({
    size: (12),
}, ...__VLS_functionalComponentArgsRest(__VLS_69));
__VLS_71.slots.default;
const __VLS_72 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
    ...{ 'onClick': {} },
    type: "primary",
    loading: (__VLS_ctx.isStreaming),
}));
const __VLS_74 = __VLS_73({
    ...{ 'onClick': {} },
    type: "primary",
    loading: (__VLS_ctx.isStreaming),
}, ...__VLS_functionalComponentArgsRest(__VLS_73));
let __VLS_76;
let __VLS_77;
let __VLS_78;
const __VLS_79 = {
    onClick: (__VLS_ctx.submit)
};
__VLS_75.slots.default;
(__VLS_ctx.isStreaming ? '生成中…' : '发送');
var __VLS_75;
const __VLS_80 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
    ...{ 'onClick': {} },
    disabled: (__VLS_ctx.isStreaming),
}));
const __VLS_82 = __VLS_81({
    ...{ 'onClick': {} },
    disabled: (__VLS_ctx.isStreaming),
}, ...__VLS_functionalComponentArgsRest(__VLS_81));
let __VLS_84;
let __VLS_85;
let __VLS_86;
const __VLS_87 = {
    onClick: (__VLS_ctx.clearOutput)
};
__VLS_83.slots.default;
var __VLS_83;
var __VLS_71;
var __VLS_67;
var __VLS_7;
const __VLS_88 = {}.ElDivider;
/** @type {[typeof __VLS_components.ElDivider, typeof __VLS_components.elDivider, ]} */ ;
// @ts-ignore
const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({}));
const __VLS_90 = __VLS_89({}, ...__VLS_functionalComponentArgsRest(__VLS_89));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "status-row" },
});
const __VLS_92 = {}.ElTag;
/** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
// @ts-ignore
const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({
    size: "small",
    type: (__VLS_ctx.status === 'error' ? 'danger' : 'info'),
}));
const __VLS_94 = __VLS_93({
    size: "small",
    type: (__VLS_ctx.status === 'error' ? 'danger' : 'info'),
}, ...__VLS_functionalComponentArgsRest(__VLS_93));
__VLS_95.slots.default;
(__VLS_ctx.status);
var __VLS_95;
if (__VLS_ctx.metaInfo) {
    const __VLS_96 = {}.ElTag;
    /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
    // @ts-ignore
    const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
        size: "small",
        type: "success",
    }));
    const __VLS_98 = __VLS_97({
        size: "small",
        type: "success",
    }, ...__VLS_functionalComponentArgsRest(__VLS_97));
    __VLS_99.slots.default;
    (__VLS_ctx.metaInfo.chunkCount);
    (__VLS_ctx.metaInfo.charCount);
    (__VLS_ctx.metaInfo.elapsedMs);
    (__VLS_ctx.metaInfo.finishReason);
    var __VLS_99;
}
if (__VLS_ctx.error) {
    const __VLS_100 = {}.ElAlert;
    /** @type {[typeof __VLS_components.ElAlert, typeof __VLS_components.elAlert, ]} */ ;
    // @ts-ignore
    const __VLS_101 = __VLS_asFunctionalComponent(__VLS_100, new __VLS_100({
        title: (__VLS_ctx.error),
        type: "error",
        showIcon: true,
        closable: (false),
        ...{ style: {} },
    }));
    const __VLS_102 = __VLS_101({
        title: (__VLS_ctx.error),
        type: "error",
        showIcon: true,
        closable: (false),
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_101));
}
if (__VLS_ctx.output) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "output" },
    });
    (__VLS_ctx.output);
}
else {
    const __VLS_104 = {}.ElEmpty;
    /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
    // @ts-ignore
    const __VLS_105 = __VLS_asFunctionalComponent(__VLS_104, new __VLS_104({
        description: "尚未生成内容",
        imageSize: (80),
    }));
    const __VLS_106 = __VLS_105({
        description: "尚未生成内容",
        imageSize: (80),
    }, ...__VLS_functionalComponentArgsRest(__VLS_105));
}
var __VLS_3;
/** @type {__VLS_StyleScopedClasses['ai-test']} */ ;
/** @type {__VLS_StyleScopedClasses['title']} */ ;
/** @type {__VLS_StyleScopedClasses['hint']} */ ;
/** @type {__VLS_StyleScopedClasses['form']} */ ;
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
            metaInfo: metaInfo,
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
