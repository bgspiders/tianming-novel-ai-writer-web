import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { storeToRefs } from 'pinia';
import { Delete, Edit, Plus, RefreshRight } from '@element-plus/icons-vue';
import { createProviderConfig, deleteProviderConfig, discoverRemoteModels, listProviderConfigs, updateProviderConfig } from '@/api/modules/ai';
import { postTestCompletion } from '@/api/modules/aiTest';
import { useI18n } from '@/composables/useI18n';
import { chatHub } from '@/signalr/chat';
import { useAiTestStore } from '@/stores/aiTest';
const { t } = useI18n();
const testStore = useAiTestStore();
const { form: testForm, output, status, error, isStreaming } = storeToRefs(testStore);
const platformOptions = [
    { code: 'openai', name: 'OpenAI', endpoint: 'https://api.openai.com/v1', hint: 'OpenAI 官方兼容接口' },
    { code: 'anthropic', name: 'Anthropic', endpoint: 'https://api.anthropic.com/v1', hint: 'Claude OpenAI 兼容接入' },
    { code: 'gemini', name: 'Google Gemini', endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai', hint: 'Gemini OpenAI 兼容入口' },
    { code: 'deepseek', name: 'DeepSeek', endpoint: 'https://api.deepseek.com/v1', hint: 'DeepSeek 官方接口' },
    { code: 'moonshot', name: 'Moonshot', endpoint: 'https://api.moonshot.cn/v1', hint: 'Moonshot 官方接口' },
    { code: 'custom', name: '自定义兼容平台', endpoint: 'https://api.openai.com/v1', hint: '任何 OpenAI 兼容 /v1/models 平台' }
];
function defaultEndpointFor(platformCode) {
    return platformOptions.find((item) => item.code === platformCode)?.endpoint ?? 'https://api.openai.com/v1';
}
const configs = ref([]);
const loading = ref(false);
const selectedConfigId = ref('');
const editorVisible = ref(false);
const editorMode = ref('create');
const editorProviderId = ref('');
const saving = ref(false);
const discoveringModels = ref(false);
const currentRunId = ref('');
const testMeta = ref(null);
const editorForm = ref({
    platformCode: 'openai',
    name: '',
    defaultEndpoint: defaultEndpointFor('openai'),
    notes: '',
    isEnabled: true,
    sortOrder: 0,
    modelCode: '',
    modelName: '',
    plainKey: '',
    apiKeyName: 'Default'
});
const remoteModels = ref([]);
const modelKeyword = ref('');
const filteredRemoteModels = computed(() => {
    const keyword = modelKeyword.value.trim().toLowerCase();
    if (!keyword)
        return remoteModels.value;
    return remoteModels.value.filter((item) => item.id.toLowerCase().includes(keyword) || item.name.toLowerCase().includes(keyword));
});
const selectedConfig = computed(() => configs.value.find((item) => item.providerId === selectedConfigId.value) ?? null);
function onToken(token) {
    testStore.appendToken(token);
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
async function refreshConfigs(keepSelection = true) {
    loading.value = true;
    try {
        configs.value = await listProviderConfigs();
        if (!keepSelection || !configs.value.some((item) => item.providerId === selectedConfigId.value)) {
            selectedConfigId.value = configs.value[0]?.providerId ?? '';
        }
        applySelectedConfigToTest();
    }
    catch (err) {
        ElMessage.error(err.message ?? t('aiModels.messages.providersLoadFailed'));
    }
    finally {
        loading.value = false;
    }
}
function applySelectedConfigToTest() {
    const config = selectedConfig.value;
    if (!config)
        return;
    testForm.value.configId = config.providerId;
    testForm.value.endpoint = config.defaultEndpoint || testForm.value.endpoint;
    testForm.value.model = config.modelCode || testForm.value.model;
}
function resetEditor() {
    editorProviderId.value = '';
    editorForm.value = {
        platformCode: 'openai',
        name: '',
        defaultEndpoint: defaultEndpointFor('openai'),
        notes: '',
        isEnabled: true,
        sortOrder: configs.value.length,
        modelCode: '',
        modelName: '',
        plainKey: '',
        apiKeyName: 'Default'
    };
    remoteModels.value = [];
    modelKeyword.value = '';
}
function openCreate() {
    editorMode.value = 'create';
    resetEditor();
    editorVisible.value = true;
}
function openEdit(config) {
    editorMode.value = 'edit';
    editorProviderId.value = config.providerId;
    editorForm.value = {
        platformCode: config.platformCode || 'custom',
        name: config.name,
        defaultEndpoint: config.defaultEndpoint || defaultEndpointFor(config.platformCode || 'custom'),
        notes: config.notes || '',
        isEnabled: config.isEnabled,
        sortOrder: config.sortOrder,
        modelCode: config.modelCode || '',
        modelName: config.modelName || config.modelCode || '',
        plainKey: '',
        apiKeyName: config.apiKeyName || 'Default'
    };
    remoteModels.value = config.modelCode
        ? [{ id: config.modelCode, name: config.modelName || config.modelCode, ownedBy: null }]
        : [];
    modelKeyword.value = '';
    editorVisible.value = true;
}
watch(() => editorForm.value.platformCode, (platformCode, previous) => {
    if (!platformCode || platformCode === previous)
        return;
    if (!editorForm.value.defaultEndpoint || editorForm.value.defaultEndpoint === defaultEndpointFor(previous || 'openai')) {
        editorForm.value.defaultEndpoint = defaultEndpointFor(platformCode);
    }
});
async function discoverModels() {
    if (!editorForm.value.platformCode) {
        ElMessage.warning(t('aiModels.config.form.platformRequired'));
        return;
    }
    if (!editorForm.value.defaultEndpoint) {
        ElMessage.warning(t('aiModels.config.form.endpointRequired'));
        return;
    }
    if (editorMode.value === 'create' && !editorForm.value.plainKey?.trim()) {
        ElMessage.warning(t('aiModels.config.form.keyRequired'));
        return;
    }
    discoveringModels.value = true;
    try {
        const result = await discoverRemoteModels({
            providerId: editorMode.value === 'edit' ? editorProviderId.value : null,
            platformCode: editorForm.value.platformCode,
            endpoint: editorForm.value.defaultEndpoint,
            apiKey: editorForm.value.plainKey?.trim() || null
        });
        remoteModels.value = result.models;
        editorForm.value.defaultEndpoint = result.resolvedEndpoint;
        if (!remoteModels.value.some((item) => item.id === editorForm.value.modelCode)) {
            editorForm.value.modelCode = remoteModels.value[0]?.id ?? '';
            editorForm.value.modelName = remoteModels.value[0]?.name ?? '';
        }
        ElMessage.success(t('aiModels.messages.modelsDiscovered', { count: remoteModels.value.length }));
    }
    catch (err) {
        ElMessage.error(err.message ?? t('aiModels.messages.modelsDiscoverFailed'));
    }
    finally {
        discoveringModels.value = false;
    }
}
function applyModel(model) {
    editorForm.value.modelCode = model.id;
    editorForm.value.modelName = model.name;
}
async function saveConfig() {
    if (!editorForm.value.platformCode) {
        ElMessage.warning(t('aiModels.config.form.platformRequired'));
        return;
    }
    if (!editorForm.value.name.trim()) {
        ElMessage.warning(t('aiModels.config.form.nameRequired'));
        return;
    }
    if (!editorForm.value.defaultEndpoint?.trim()) {
        ElMessage.warning(t('aiModels.config.form.endpointRequired'));
        return;
    }
    if (!editorForm.value.modelCode.trim()) {
        ElMessage.warning(t('aiModels.config.form.modelRequired'));
        return;
    }
    if (editorMode.value === 'create' && !editorForm.value.plainKey?.trim()) {
        ElMessage.warning(t('aiModels.config.form.keyRequired'));
        return;
    }
    saving.value = true;
    try {
        if (editorMode.value === 'create') {
            await createProviderConfig(editorForm.value);
            ElMessage.success(t('aiModels.messages.providerCreated'));
        }
        else {
            await updateProviderConfig(editorProviderId.value, editorForm.value);
            ElMessage.success(t('aiModels.messages.providerUpdated'));
        }
        editorVisible.value = false;
        await refreshConfigs();
    }
    catch (err) {
        ElMessage.error(err.message ?? t('aiModels.messages.providerSaveFailed'));
    }
    finally {
        saving.value = false;
    }
}
async function removeConfig(config) {
    try {
        await ElMessageBox.confirm(t('aiModels.messages.providerDeleteConfirm', { name: config.name }), t('layout.dialogs.confirm'), { type: 'warning' });
    }
    catch {
        return;
    }
    try {
        await deleteProviderConfig(config.providerId);
        ElMessage.success(t('aiModels.messages.providerDeleted'));
        await refreshConfigs(false);
    }
    catch (err) {
        ElMessage.error(err.message ?? t('aiModels.messages.providerDeleteFailed'));
    }
}
onMounted(() => {
    testStore.loadFromStorage();
    chatHub.onToken(onToken);
    chatHub.onStatus(onStatus);
    chatHub.onCompleted(onCompleted);
    chatHub.onError(onError);
    refreshConfigs();
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
watch(selectedConfigId, () => {
    applySelectedConfigToTest();
});
async function submitModelTest() {
    applySelectedConfigToTest();
    const hasResolvedKey = Boolean(testForm.value.apiKey || testForm.value.configId);
    if (!testForm.value.endpoint || !hasResolvedKey || !testForm.value.model || !testForm.value.prompt) {
        ElMessage.warning(t('aiTest.messages.required'));
        return;
    }
    testStore.reset();
    testMeta.value = null;
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
            configId: testForm.value.configId || null,
            endpoint: testForm.value.endpoint,
            apiKey: testForm.value.apiKey,
            model: testForm.value.model,
            prompt: testForm.value.prompt,
            systemPrompt: testForm.value.systemPrompt || undefined,
            temperature: testForm.value.temperature,
            maxTokens: testForm.value.maxTokens
        });
        testMeta.value = {
            chunkCount: result.chunkCount,
            charCount: result.charCount,
            elapsedMs: result.elapsedMs,
            finishReason: result.finishReason
        };
        testStore.saveToStorage();
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
function clearModelTest() {
    testStore.reset();
    testMeta.value = null;
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['hero-card']} */ ;
/** @type {__VLS_StyleScopedClasses['config-item']} */ ;
/** @type {__VLS_StyleScopedClasses['config-item']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-mono']} */ ;
/** @type {__VLS_StyleScopedClasses['test-head']} */ ;
/** @type {__VLS_StyleScopedClasses['test-head']} */ ;
/** @type {__VLS_StyleScopedClasses['test-form']} */ ;
/** @type {__VLS_StyleScopedClasses['model-item']} */ ;
/** @type {__VLS_StyleScopedClasses['model-item']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['layout']} */ ;
/** @type {__VLS_StyleScopedClasses['editor-shell']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['test-form']} */ ;
/** @type {__VLS_StyleScopedClasses['hero-row']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "ai-models" },
});
const __VLS_0 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    shadow: "never",
    ...{ class: "hero-card" },
}));
const __VLS_2 = __VLS_1({
    shadow: "never",
    ...{ class: "hero-card" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_3.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "hero-row" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({
    ...{ class: "title" },
});
(__VLS_ctx.t('aiModels.title'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "hint" },
});
(__VLS_ctx.t('aiModels.hint'));
const __VLS_4 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
    ...{ 'onClick': {} },
    type: "primary",
    icon: (__VLS_ctx.Plus),
}));
const __VLS_6 = __VLS_5({
    ...{ 'onClick': {} },
    type: "primary",
    icon: (__VLS_ctx.Plus),
}, ...__VLS_functionalComponentArgsRest(__VLS_5));
let __VLS_8;
let __VLS_9;
let __VLS_10;
const __VLS_11 = {
    onClick: (__VLS_ctx.openCreate)
};
__VLS_7.slots.default;
(__VLS_ctx.t('aiModels.provider.create'));
var __VLS_7;
var __VLS_3;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "layout" },
});
const __VLS_12 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
    shadow: "never",
    ...{ class: "config-list-panel" },
}));
const __VLS_14 = __VLS_13({
    shadow: "never",
    ...{ class: "config-list-panel" },
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
__VLS_15.slots.default;
{
    const { header: __VLS_thisSlot } = __VLS_15.slots;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "panel-head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.t('aiModels.provider.title'));
    const __VLS_16 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
        ...{ 'onClick': {} },
        text: true,
        icon: (__VLS_ctx.RefreshRight),
    }));
    const __VLS_18 = __VLS_17({
        ...{ 'onClick': {} },
        text: true,
        icon: (__VLS_ctx.RefreshRight),
    }, ...__VLS_functionalComponentArgsRest(__VLS_17));
    let __VLS_20;
    let __VLS_21;
    let __VLS_22;
    const __VLS_23 = {
        onClick: (...[$event]) => {
            __VLS_ctx.refreshConfigs(false);
        }
    };
    var __VLS_19;
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "config-list" },
});
__VLS_asFunctionalDirective(__VLS_directives.vLoading)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.loading) }, null, null);
for (const [config] of __VLS_getVForSourceType((__VLS_ctx.configs))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.selectedConfigId = config.providerId;
            } },
        key: (config.providerId),
        type: "button",
        ...{ class: (['config-item', { active: config.providerId === __VLS_ctx.selectedConfigId }]) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "config-item-top" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "config-name" },
    });
    (config.name);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "config-code" },
    });
    (config.platformCode);
    (config.providerCode);
    const __VLS_24 = {}.ElTag;
    /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
    // @ts-ignore
    const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
        type: (config.isEnabled ? 'success' : 'info'),
        size: "small",
        effect: "plain",
    }));
    const __VLS_26 = __VLS_25({
        type: (config.isEnabled ? 'success' : 'info'),
        size: "small",
        effect: "plain",
    }, ...__VLS_functionalComponentArgsRest(__VLS_25));
    __VLS_27.slots.default;
    (config.isEnabled ? __VLS_ctx.t('aiModels.status.enabled') : __VLS_ctx.t('aiModels.status.disabled'));
    var __VLS_27;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "config-meta" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (config.modelCode || '--');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (config.hasKey ? (config.apiKeyMaskedTail || '--') : __VLS_ctx.t('aiModels.config.empty.noKey'));
}
if (!__VLS_ctx.loading && __VLS_ctx.configs.length === 0) {
    const __VLS_28 = {}.ElEmpty;
    /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
    // @ts-ignore
    const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
        description: (__VLS_ctx.t('aiModels.provider.empty')),
    }));
    const __VLS_30 = __VLS_29({
        description: (__VLS_ctx.t('aiModels.provider.empty')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_29));
}
var __VLS_15;
const __VLS_32 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
    shadow: "never",
    ...{ class: "detail-panel" },
}));
const __VLS_34 = __VLS_33({
    shadow: "never",
    ...{ class: "detail-panel" },
}, ...__VLS_functionalComponentArgsRest(__VLS_33));
__VLS_35.slots.default;
{
    const { header: __VLS_thisSlot } = __VLS_35.slots;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "panel-head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.selectedConfig?.name || __VLS_ctx.t('aiModels.provider.selectedEmpty'));
    if (__VLS_ctx.selectedConfig) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "detail-actions" },
        });
        const __VLS_36 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
            ...{ 'onClick': {} },
            text: true,
            icon: (__VLS_ctx.Edit),
        }));
        const __VLS_38 = __VLS_37({
            ...{ 'onClick': {} },
            text: true,
            icon: (__VLS_ctx.Edit),
        }, ...__VLS_functionalComponentArgsRest(__VLS_37));
        let __VLS_40;
        let __VLS_41;
        let __VLS_42;
        const __VLS_43 = {
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.selectedConfig))
                    return;
                __VLS_ctx.openEdit(__VLS_ctx.selectedConfig);
            }
        };
        __VLS_39.slots.default;
        (__VLS_ctx.t('aiModels.actions.edit'));
        var __VLS_39;
        const __VLS_44 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
            ...{ 'onClick': {} },
            text: true,
            type: "danger",
            icon: (__VLS_ctx.Delete),
        }));
        const __VLS_46 = __VLS_45({
            ...{ 'onClick': {} },
            text: true,
            type: "danger",
            icon: (__VLS_ctx.Delete),
        }, ...__VLS_functionalComponentArgsRest(__VLS_45));
        let __VLS_48;
        let __VLS_49;
        let __VLS_50;
        const __VLS_51 = {
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.selectedConfig))
                    return;
                __VLS_ctx.removeConfig(__VLS_ctx.selectedConfig);
            }
        };
        __VLS_47.slots.default;
        (__VLS_ctx.t('aiModels.actions.delete'));
        var __VLS_47;
    }
}
if (__VLS_ctx.selectedConfig) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "detail-grid" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "detail-card" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "detail-label" },
    });
    (__VLS_ctx.t('aiModels.config.fields.platform'));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "detail-value" },
    });
    (__VLS_ctx.selectedConfig.platformCode);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "detail-card" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "detail-label" },
    });
    (__VLS_ctx.t('aiModels.config.fields.endpoint'));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "detail-mono" },
    });
    (__VLS_ctx.selectedConfig.defaultEndpoint || '--');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "detail-card" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "detail-label" },
    });
    (__VLS_ctx.t('aiModels.config.fields.model'));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "detail-value" },
    });
    (__VLS_ctx.selectedConfig.modelName || __VLS_ctx.selectedConfig.modelCode || '--');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "detail-sub" },
    });
    (__VLS_ctx.selectedConfig.modelCode || '--');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "detail-card" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "detail-label" },
    });
    (__VLS_ctx.t('aiModels.config.fields.key'));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "detail-value" },
    });
    (__VLS_ctx.selectedConfig.apiKeyMaskedTail || __VLS_ctx.t('aiModels.config.empty.noKey'));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "detail-sub" },
    });
    (__VLS_ctx.selectedConfig.keyLastUsedAt ? new Date(__VLS_ctx.selectedConfig.keyLastUsedAt).toLocaleString() : __VLS_ctx.t('aiModels.config.empty.neverUsed'));
    if (__VLS_ctx.selectedConfig.notes) {
        const __VLS_52 = {}.ElAlert;
        /** @type {[typeof __VLS_components.ElAlert, typeof __VLS_components.elAlert, ]} */ ;
        // @ts-ignore
        const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
            type: "info",
            showIcon: true,
            closable: (false),
            ...{ class: "notes-alert" },
            title: (__VLS_ctx.selectedConfig.notes),
        }));
        const __VLS_54 = __VLS_53({
            type: "info",
            showIcon: true,
            closable: (false),
            ...{ class: "notes-alert" },
            title: (__VLS_ctx.selectedConfig.notes),
        }, ...__VLS_functionalComponentArgsRest(__VLS_53));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "test-panel" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "test-head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
    (__VLS_ctx.t('aiTest.title'));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    (__VLS_ctx.t('aiTest.memoryOnly'));
    const __VLS_56 = {}.ElSpace;
    /** @type {[typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, typeof __VLS_components.ElSpace, typeof __VLS_components.elSpace, ]} */ ;
    // @ts-ignore
    const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({}));
    const __VLS_58 = __VLS_57({}, ...__VLS_functionalComponentArgsRest(__VLS_57));
    __VLS_59.slots.default;
    const __VLS_60 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
        ...{ 'onClick': {} },
        disabled: (__VLS_ctx.isStreaming),
    }));
    const __VLS_62 = __VLS_61({
        ...{ 'onClick': {} },
        disabled: (__VLS_ctx.isStreaming),
    }, ...__VLS_functionalComponentArgsRest(__VLS_61));
    let __VLS_64;
    let __VLS_65;
    let __VLS_66;
    const __VLS_67 = {
        onClick: (__VLS_ctx.clearModelTest)
    };
    __VLS_63.slots.default;
    (__VLS_ctx.t('aiTest.actions.clear'));
    var __VLS_63;
    const __VLS_68 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.isStreaming),
    }));
    const __VLS_70 = __VLS_69({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.isStreaming),
    }, ...__VLS_functionalComponentArgsRest(__VLS_69));
    let __VLS_72;
    let __VLS_73;
    let __VLS_74;
    const __VLS_75 = {
        onClick: (__VLS_ctx.submitModelTest)
    };
    __VLS_71.slots.default;
    (__VLS_ctx.isStreaming ? __VLS_ctx.t('aiTest.actions.running') : __VLS_ctx.t('aiTest.actions.send'));
    var __VLS_71;
    var __VLS_59;
    const __VLS_76 = {}.ElForm;
    /** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
    // @ts-ignore
    const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({
        model: (__VLS_ctx.testForm),
        labelPosition: "top",
        ...{ class: "test-form" },
        disabled: (__VLS_ctx.isStreaming),
    }));
    const __VLS_78 = __VLS_77({
        model: (__VLS_ctx.testForm),
        labelPosition: "top",
        ...{ class: "test-form" },
        disabled: (__VLS_ctx.isStreaming),
    }, ...__VLS_functionalComponentArgsRest(__VLS_77));
    __VLS_79.slots.default;
    const __VLS_80 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
        label: (__VLS_ctx.t('aiTest.labels.endpoint')),
    }));
    const __VLS_82 = __VLS_81({
        label: (__VLS_ctx.t('aiTest.labels.endpoint')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_81));
    __VLS_83.slots.default;
    const __VLS_84 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({
        modelValue: (__VLS_ctx.testForm.endpoint),
        placeholder: (__VLS_ctx.selectedConfig.defaultEndpoint || __VLS_ctx.t('aiTest.placeholders.endpoint')),
    }));
    const __VLS_86 = __VLS_85({
        modelValue: (__VLS_ctx.testForm.endpoint),
        placeholder: (__VLS_ctx.selectedConfig.defaultEndpoint || __VLS_ctx.t('aiTest.placeholders.endpoint')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_85));
    var __VLS_83;
    const __VLS_88 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
        label: (__VLS_ctx.t('aiTest.labels.model')),
    }));
    const __VLS_90 = __VLS_89({
        label: (__VLS_ctx.t('aiTest.labels.model')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_89));
    __VLS_91.slots.default;
    const __VLS_92 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({
        modelValue: (__VLS_ctx.testForm.model),
        placeholder: (__VLS_ctx.selectedConfig.modelCode || __VLS_ctx.t('aiTest.placeholders.model')),
    }));
    const __VLS_94 = __VLS_93({
        modelValue: (__VLS_ctx.testForm.model),
        placeholder: (__VLS_ctx.selectedConfig.modelCode || __VLS_ctx.t('aiTest.placeholders.model')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_93));
    var __VLS_91;
    const __VLS_96 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
        label: (__VLS_ctx.t('aiTest.labels.apiKey')),
    }));
    const __VLS_98 = __VLS_97({
        label: (__VLS_ctx.t('aiTest.labels.apiKey')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_97));
    __VLS_99.slots.default;
    const __VLS_100 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_101 = __VLS_asFunctionalComponent(__VLS_100, new __VLS_100({
        modelValue: (__VLS_ctx.testForm.apiKey),
        type: "password",
        showPassword: true,
        placeholder: (__VLS_ctx.selectedConfig.hasKey ? __VLS_ctx.t('aiTest.labels.noSavedKey') : __VLS_ctx.t('aiTest.placeholders.apiKey')),
    }));
    const __VLS_102 = __VLS_101({
        modelValue: (__VLS_ctx.testForm.apiKey),
        type: "password",
        showPassword: true,
        placeholder: (__VLS_ctx.selectedConfig.hasKey ? __VLS_ctx.t('aiTest.labels.noSavedKey') : __VLS_ctx.t('aiTest.placeholders.apiKey')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_101));
    var __VLS_99;
    const __VLS_104 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_105 = __VLS_asFunctionalComponent(__VLS_104, new __VLS_104({
        label: (__VLS_ctx.t('aiTest.labels.maxTokens')),
    }));
    const __VLS_106 = __VLS_105({
        label: (__VLS_ctx.t('aiTest.labels.maxTokens')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_105));
    __VLS_107.slots.default;
    const __VLS_108 = {}.ElInputNumber;
    /** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
    // @ts-ignore
    const __VLS_109 = __VLS_asFunctionalComponent(__VLS_108, new __VLS_108({
        modelValue: (__VLS_ctx.testForm.maxTokens),
        min: (64),
        max: (8192),
        step: (64),
    }));
    const __VLS_110 = __VLS_109({
        modelValue: (__VLS_ctx.testForm.maxTokens),
        min: (64),
        max: (8192),
        step: (64),
    }, ...__VLS_functionalComponentArgsRest(__VLS_109));
    var __VLS_107;
    const __VLS_112 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_113 = __VLS_asFunctionalComponent(__VLS_112, new __VLS_112({
        label: (__VLS_ctx.t('aiTest.labels.systemPrompt')),
        ...{ class: "span-2" },
    }));
    const __VLS_114 = __VLS_113({
        label: (__VLS_ctx.t('aiTest.labels.systemPrompt')),
        ...{ class: "span-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_113));
    __VLS_115.slots.default;
    const __VLS_116 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_117 = __VLS_asFunctionalComponent(__VLS_116, new __VLS_116({
        modelValue: (__VLS_ctx.testForm.systemPrompt),
        type: "textarea",
        rows: (2),
        placeholder: (__VLS_ctx.t('aiTest.placeholders.systemPrompt')),
    }));
    const __VLS_118 = __VLS_117({
        modelValue: (__VLS_ctx.testForm.systemPrompt),
        type: "textarea",
        rows: (2),
        placeholder: (__VLS_ctx.t('aiTest.placeholders.systemPrompt')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_117));
    var __VLS_115;
    const __VLS_120 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_121 = __VLS_asFunctionalComponent(__VLS_120, new __VLS_120({
        label: (__VLS_ctx.t('aiTest.labels.userPrompt')),
        ...{ class: "span-2" },
    }));
    const __VLS_122 = __VLS_121({
        label: (__VLS_ctx.t('aiTest.labels.userPrompt')),
        ...{ class: "span-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_121));
    __VLS_123.slots.default;
    const __VLS_124 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({
        modelValue: (__VLS_ctx.testForm.prompt),
        type: "textarea",
        rows: (3),
    }));
    const __VLS_126 = __VLS_125({
        modelValue: (__VLS_ctx.testForm.prompt),
        type: "textarea",
        rows: (3),
    }, ...__VLS_functionalComponentArgsRest(__VLS_125));
    var __VLS_123;
    const __VLS_128 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_129 = __VLS_asFunctionalComponent(__VLS_128, new __VLS_128({
        label: (__VLS_ctx.t('aiTest.labels.temperature')),
    }));
    const __VLS_130 = __VLS_129({
        label: (__VLS_ctx.t('aiTest.labels.temperature')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_129));
    __VLS_131.slots.default;
    const __VLS_132 = {}.ElInputNumber;
    /** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
    // @ts-ignore
    const __VLS_133 = __VLS_asFunctionalComponent(__VLS_132, new __VLS_132({
        modelValue: (__VLS_ctx.testForm.temperature),
        min: (0),
        max: (2),
        step: (0.1),
    }));
    const __VLS_134 = __VLS_133({
        modelValue: (__VLS_ctx.testForm.temperature),
        min: (0),
        max: (2),
        step: (0.1),
    }, ...__VLS_functionalComponentArgsRest(__VLS_133));
    var __VLS_131;
    var __VLS_79;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "status-row" },
    });
    const __VLS_136 = {}.ElTag;
    /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
    // @ts-ignore
    const __VLS_137 = __VLS_asFunctionalComponent(__VLS_136, new __VLS_136({
        size: "small",
        type: (__VLS_ctx.status === 'error' ? 'danger' : 'info'),
    }));
    const __VLS_138 = __VLS_137({
        size: "small",
        type: (__VLS_ctx.status === 'error' ? 'danger' : 'info'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_137));
    __VLS_139.slots.default;
    (__VLS_ctx.t('aiTest.status.label', { status: __VLS_ctx.status }));
    var __VLS_139;
    if (__VLS_ctx.testMeta) {
        const __VLS_140 = {}.ElTag;
        /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
        // @ts-ignore
        const __VLS_141 = __VLS_asFunctionalComponent(__VLS_140, new __VLS_140({
            size: "small",
            type: "success",
        }));
        const __VLS_142 = __VLS_141({
            size: "small",
            type: "success",
        }, ...__VLS_functionalComponentArgsRest(__VLS_141));
        __VLS_143.slots.default;
        (__VLS_ctx.t('aiTest.status.chunks'));
        (__VLS_ctx.testMeta.chunkCount);
        (__VLS_ctx.t('aiTest.status.chars'));
        (__VLS_ctx.testMeta.charCount);
        (__VLS_ctx.testMeta.elapsedMs);
        (__VLS_ctx.testMeta.finishReason || __VLS_ctx.t('aiTest.status.completed'));
        var __VLS_143;
    }
    if (__VLS_ctx.error) {
        const __VLS_144 = {}.ElAlert;
        /** @type {[typeof __VLS_components.ElAlert, typeof __VLS_components.elAlert, ]} */ ;
        // @ts-ignore
        const __VLS_145 = __VLS_asFunctionalComponent(__VLS_144, new __VLS_144({
            title: (__VLS_ctx.error),
            type: "error",
            showIcon: true,
            closable: (false),
            ...{ class: "test-error" },
        }));
        const __VLS_146 = __VLS_145({
            title: (__VLS_ctx.error),
            type: "error",
            showIcon: true,
            closable: (false),
            ...{ class: "test-error" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_145));
    }
    if (__VLS_ctx.output) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "test-output" },
        });
        (__VLS_ctx.output);
    }
    else {
        const __VLS_148 = {}.ElEmpty;
        /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
        // @ts-ignore
        const __VLS_149 = __VLS_asFunctionalComponent(__VLS_148, new __VLS_148({
            description: (__VLS_ctx.t('aiTest.status.noOutput')),
            imageSize: (80),
        }));
        const __VLS_150 = __VLS_149({
            description: (__VLS_ctx.t('aiTest.status.noOutput')),
            imageSize: (80),
        }, ...__VLS_functionalComponentArgsRest(__VLS_149));
    }
}
else {
    const __VLS_152 = {}.ElEmpty;
    /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
    // @ts-ignore
    const __VLS_153 = __VLS_asFunctionalComponent(__VLS_152, new __VLS_152({
        description: (__VLS_ctx.t('aiModels.provider.selectedEmpty')),
    }));
    const __VLS_154 = __VLS_153({
        description: (__VLS_ctx.t('aiModels.provider.selectedEmpty')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_153));
}
var __VLS_35;
const __VLS_156 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_157 = __VLS_asFunctionalComponent(__VLS_156, new __VLS_156({
    modelValue: (__VLS_ctx.editorVisible),
    title: (__VLS_ctx.editorMode === 'create' ? __VLS_ctx.t('aiModels.config.create') : __VLS_ctx.t('aiModels.config.edit')),
    width: "860px",
    closeOnClickModal: (false),
}));
const __VLS_158 = __VLS_157({
    modelValue: (__VLS_ctx.editorVisible),
    title: (__VLS_ctx.editorMode === 'create' ? __VLS_ctx.t('aiModels.config.create') : __VLS_ctx.t('aiModels.config.edit')),
    width: "860px",
    closeOnClickModal: (false),
}, ...__VLS_functionalComponentArgsRest(__VLS_157));
__VLS_159.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "editor-shell" },
});
const __VLS_160 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_161 = __VLS_asFunctionalComponent(__VLS_160, new __VLS_160({
    model: (__VLS_ctx.editorForm),
    labelWidth: "110px",
    labelPosition: "right",
    ...{ class: "editor-form" },
}));
const __VLS_162 = __VLS_161({
    model: (__VLS_ctx.editorForm),
    labelWidth: "110px",
    labelPosition: "right",
    ...{ class: "editor-form" },
}, ...__VLS_functionalComponentArgsRest(__VLS_161));
__VLS_163.slots.default;
const __VLS_164 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_165 = __VLS_asFunctionalComponent(__VLS_164, new __VLS_164({
    label: (__VLS_ctx.t('aiModels.config.form.platform')),
    required: true,
}));
const __VLS_166 = __VLS_165({
    label: (__VLS_ctx.t('aiModels.config.form.platform')),
    required: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_165));
__VLS_167.slots.default;
const __VLS_168 = {}.ElSelect;
/** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
// @ts-ignore
const __VLS_169 = __VLS_asFunctionalComponent(__VLS_168, new __VLS_168({
    modelValue: (__VLS_ctx.editorForm.platformCode),
    ...{ style: {} },
}));
const __VLS_170 = __VLS_169({
    modelValue: (__VLS_ctx.editorForm.platformCode),
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_169));
__VLS_171.slots.default;
for (const [platform] of __VLS_getVForSourceType((__VLS_ctx.platformOptions))) {
    const __VLS_172 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_173 = __VLS_asFunctionalComponent(__VLS_172, new __VLS_172({
        key: (platform.code),
        label: (`${platform.name} · ${platform.hint}`),
        value: (platform.code),
    }));
    const __VLS_174 = __VLS_173({
        key: (platform.code),
        label: (`${platform.name} · ${platform.hint}`),
        value: (platform.code),
    }, ...__VLS_functionalComponentArgsRest(__VLS_173));
}
var __VLS_171;
var __VLS_167;
const __VLS_176 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_177 = __VLS_asFunctionalComponent(__VLS_176, new __VLS_176({
    label: (__VLS_ctx.t('aiModels.config.form.name')),
    required: true,
}));
const __VLS_178 = __VLS_177({
    label: (__VLS_ctx.t('aiModels.config.form.name')),
    required: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_177));
__VLS_179.slots.default;
const __VLS_180 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_181 = __VLS_asFunctionalComponent(__VLS_180, new __VLS_180({
    modelValue: (__VLS_ctx.editorForm.name),
    placeholder: (__VLS_ctx.t('aiModels.config.placeholders.name')),
}));
const __VLS_182 = __VLS_181({
    modelValue: (__VLS_ctx.editorForm.name),
    placeholder: (__VLS_ctx.t('aiModels.config.placeholders.name')),
}, ...__VLS_functionalComponentArgsRest(__VLS_181));
var __VLS_179;
const __VLS_184 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_185 = __VLS_asFunctionalComponent(__VLS_184, new __VLS_184({
    label: (__VLS_ctx.t('aiModels.config.form.endpoint')),
    required: true,
}));
const __VLS_186 = __VLS_185({
    label: (__VLS_ctx.t('aiModels.config.form.endpoint')),
    required: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_185));
__VLS_187.slots.default;
const __VLS_188 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_189 = __VLS_asFunctionalComponent(__VLS_188, new __VLS_188({
    modelValue: (__VLS_ctx.editorForm.defaultEndpoint),
    placeholder: (__VLS_ctx.defaultEndpointFor(__VLS_ctx.editorForm.platformCode)),
}));
const __VLS_190 = __VLS_189({
    modelValue: (__VLS_ctx.editorForm.defaultEndpoint),
    placeholder: (__VLS_ctx.defaultEndpointFor(__VLS_ctx.editorForm.platformCode)),
}, ...__VLS_functionalComponentArgsRest(__VLS_189));
var __VLS_187;
const __VLS_192 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_193 = __VLS_asFunctionalComponent(__VLS_192, new __VLS_192({
    label: (__VLS_ctx.t('aiModels.config.form.apiKey')),
    required: (__VLS_ctx.editorMode === 'create'),
}));
const __VLS_194 = __VLS_193({
    label: (__VLS_ctx.t('aiModels.config.form.apiKey')),
    required: (__VLS_ctx.editorMode === 'create'),
}, ...__VLS_functionalComponentArgsRest(__VLS_193));
__VLS_195.slots.default;
const __VLS_196 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_197 = __VLS_asFunctionalComponent(__VLS_196, new __VLS_196({
    modelValue: (__VLS_ctx.editorForm.plainKey),
    type: "password",
    showPassword: true,
    placeholder: (__VLS_ctx.editorMode === 'edit' ? __VLS_ctx.t('aiModels.config.placeholders.keepExistingKey') : 'sk-...'),
}));
const __VLS_198 = __VLS_197({
    modelValue: (__VLS_ctx.editorForm.plainKey),
    type: "password",
    showPassword: true,
    placeholder: (__VLS_ctx.editorMode === 'edit' ? __VLS_ctx.t('aiModels.config.placeholders.keepExistingKey') : 'sk-...'),
}, ...__VLS_functionalComponentArgsRest(__VLS_197));
var __VLS_195;
const __VLS_200 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_201 = __VLS_asFunctionalComponent(__VLS_200, new __VLS_200({
    label: (__VLS_ctx.t('aiModels.config.form.apiKeyName')),
}));
const __VLS_202 = __VLS_201({
    label: (__VLS_ctx.t('aiModels.config.form.apiKeyName')),
}, ...__VLS_functionalComponentArgsRest(__VLS_201));
__VLS_203.slots.default;
const __VLS_204 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_205 = __VLS_asFunctionalComponent(__VLS_204, new __VLS_204({
    modelValue: (__VLS_ctx.editorForm.apiKeyName),
    placeholder: (__VLS_ctx.t('aiModels.config.placeholders.keyName')),
}));
const __VLS_206 = __VLS_205({
    modelValue: (__VLS_ctx.editorForm.apiKeyName),
    placeholder: (__VLS_ctx.t('aiModels.config.placeholders.keyName')),
}, ...__VLS_functionalComponentArgsRest(__VLS_205));
var __VLS_203;
const __VLS_208 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_209 = __VLS_asFunctionalComponent(__VLS_208, new __VLS_208({
    label: (__VLS_ctx.t('aiModels.config.form.notes')),
}));
const __VLS_210 = __VLS_209({
    label: (__VLS_ctx.t('aiModels.config.form.notes')),
}, ...__VLS_functionalComponentArgsRest(__VLS_209));
__VLS_211.slots.default;
const __VLS_212 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_213 = __VLS_asFunctionalComponent(__VLS_212, new __VLS_212({
    modelValue: (__VLS_ctx.editorForm.notes),
    type: "textarea",
    rows: (2),
    placeholder: (__VLS_ctx.t('aiModels.config.placeholders.notes')),
}));
const __VLS_214 = __VLS_213({
    modelValue: (__VLS_ctx.editorForm.notes),
    type: "textarea",
    rows: (2),
    placeholder: (__VLS_ctx.t('aiModels.config.placeholders.notes')),
}, ...__VLS_functionalComponentArgsRest(__VLS_213));
var __VLS_211;
const __VLS_216 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_217 = __VLS_asFunctionalComponent(__VLS_216, new __VLS_216({
    label: (__VLS_ctx.t('aiModels.config.form.sortOrder')),
}));
const __VLS_218 = __VLS_217({
    label: (__VLS_ctx.t('aiModels.config.form.sortOrder')),
}, ...__VLS_functionalComponentArgsRest(__VLS_217));
__VLS_219.slots.default;
const __VLS_220 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_221 = __VLS_asFunctionalComponent(__VLS_220, new __VLS_220({
    modelValue: (__VLS_ctx.editorForm.sortOrder),
    min: (0),
}));
const __VLS_222 = __VLS_221({
    modelValue: (__VLS_ctx.editorForm.sortOrder),
    min: (0),
}, ...__VLS_functionalComponentArgsRest(__VLS_221));
var __VLS_219;
const __VLS_224 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_225 = __VLS_asFunctionalComponent(__VLS_224, new __VLS_224({
    label: (__VLS_ctx.t('aiModels.config.form.enabled')),
}));
const __VLS_226 = __VLS_225({
    label: (__VLS_ctx.t('aiModels.config.form.enabled')),
}, ...__VLS_functionalComponentArgsRest(__VLS_225));
__VLS_227.slots.default;
const __VLS_228 = {}.ElSwitch;
/** @type {[typeof __VLS_components.ElSwitch, typeof __VLS_components.elSwitch, ]} */ ;
// @ts-ignore
const __VLS_229 = __VLS_asFunctionalComponent(__VLS_228, new __VLS_228({
    modelValue: (__VLS_ctx.editorForm.isEnabled),
}));
const __VLS_230 = __VLS_229({
    modelValue: (__VLS_ctx.editorForm.isEnabled),
}, ...__VLS_functionalComponentArgsRest(__VLS_229));
var __VLS_227;
var __VLS_163;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "model-pane" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "model-pane-head" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "model-pane-title" },
});
(__VLS_ctx.t('aiModels.config.modelSection.title'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "model-pane-hint" },
});
(__VLS_ctx.t('aiModels.config.modelSection.hint'));
const __VLS_232 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_233 = __VLS_asFunctionalComponent(__VLS_232, new __VLS_232({
    ...{ 'onClick': {} },
    type: "primary",
    loading: (__VLS_ctx.discoveringModels),
    icon: (__VLS_ctx.RefreshRight),
}));
const __VLS_234 = __VLS_233({
    ...{ 'onClick': {} },
    type: "primary",
    loading: (__VLS_ctx.discoveringModels),
    icon: (__VLS_ctx.RefreshRight),
}, ...__VLS_functionalComponentArgsRest(__VLS_233));
let __VLS_236;
let __VLS_237;
let __VLS_238;
const __VLS_239 = {
    onClick: (__VLS_ctx.discoverModels)
};
__VLS_235.slots.default;
(__VLS_ctx.t('aiModels.config.modelSection.fetch'));
var __VLS_235;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "model-toolbar" },
});
const __VLS_240 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_241 = __VLS_asFunctionalComponent(__VLS_240, new __VLS_240({
    modelValue: (__VLS_ctx.modelKeyword),
    placeholder: (__VLS_ctx.t('aiModels.config.placeholders.searchModel')),
    clearable: true,
}));
const __VLS_242 = __VLS_241({
    modelValue: (__VLS_ctx.modelKeyword),
    placeholder: (__VLS_ctx.t('aiModels.config.placeholders.searchModel')),
    clearable: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_241));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "selected-model" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "detail-label" },
});
(__VLS_ctx.t('aiModels.config.form.selectedModel'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "selected-model-value" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
(__VLS_ctx.editorForm.modelName || __VLS_ctx.editorForm.modelCode || '--');
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "detail-sub" },
});
(__VLS_ctx.editorForm.modelCode || __VLS_ctx.t('aiModels.config.empty.noModel'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "model-list" },
});
for (const [model] of __VLS_getVForSourceType((__VLS_ctx.filteredRemoteModels))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.applyModel(model);
            } },
        key: (model.id),
        type: "button",
        ...{ class: (['model-item', { active: model.id === __VLS_ctx.editorForm.modelCode }]) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "model-name" },
    });
    (model.name);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "model-id" },
    });
    (model.id);
}
if (__VLS_ctx.filteredRemoteModels.length === 0) {
    const __VLS_244 = {}.ElEmpty;
    /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
    // @ts-ignore
    const __VLS_245 = __VLS_asFunctionalComponent(__VLS_244, new __VLS_244({
        description: (__VLS_ctx.t('aiModels.config.empty.noDiscoveredModels')),
    }));
    const __VLS_246 = __VLS_245({
        description: (__VLS_ctx.t('aiModels.config.empty.noDiscoveredModels')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_245));
}
{
    const { footer: __VLS_thisSlot } = __VLS_159.slots;
    const __VLS_248 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_249 = __VLS_asFunctionalComponent(__VLS_248, new __VLS_248({
        ...{ 'onClick': {} },
    }));
    const __VLS_250 = __VLS_249({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_249));
    let __VLS_252;
    let __VLS_253;
    let __VLS_254;
    const __VLS_255 = {
        onClick: (...[$event]) => {
            __VLS_ctx.editorVisible = false;
        }
    };
    __VLS_251.slots.default;
    (__VLS_ctx.t('aiModels.actions.cancel'));
    var __VLS_251;
    const __VLS_256 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_257 = __VLS_asFunctionalComponent(__VLS_256, new __VLS_256({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.saving),
    }));
    const __VLS_258 = __VLS_257({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.saving),
    }, ...__VLS_functionalComponentArgsRest(__VLS_257));
    let __VLS_260;
    let __VLS_261;
    let __VLS_262;
    const __VLS_263 = {
        onClick: (__VLS_ctx.saveConfig)
    };
    __VLS_259.slots.default;
    (__VLS_ctx.t('aiModels.actions.save'));
    var __VLS_259;
}
var __VLS_159;
/** @type {__VLS_StyleScopedClasses['ai-models']} */ ;
/** @type {__VLS_StyleScopedClasses['hero-card']} */ ;
/** @type {__VLS_StyleScopedClasses['hero-row']} */ ;
/** @type {__VLS_StyleScopedClasses['title']} */ ;
/** @type {__VLS_StyleScopedClasses['hint']} */ ;
/** @type {__VLS_StyleScopedClasses['layout']} */ ;
/** @type {__VLS_StyleScopedClasses['config-list-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-head']} */ ;
/** @type {__VLS_StyleScopedClasses['config-list']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['config-item']} */ ;
/** @type {__VLS_StyleScopedClasses['config-item-top']} */ ;
/** @type {__VLS_StyleScopedClasses['config-name']} */ ;
/** @type {__VLS_StyleScopedClasses['config-code']} */ ;
/** @type {__VLS_StyleScopedClasses['config-meta']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-head']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-card']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-label']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-value']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-card']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-label']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-mono']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-card']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-label']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-value']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-sub']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-card']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-label']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-value']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-sub']} */ ;
/** @type {__VLS_StyleScopedClasses['notes-alert']} */ ;
/** @type {__VLS_StyleScopedClasses['test-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['test-head']} */ ;
/** @type {__VLS_StyleScopedClasses['test-form']} */ ;
/** @type {__VLS_StyleScopedClasses['span-2']} */ ;
/** @type {__VLS_StyleScopedClasses['span-2']} */ ;
/** @type {__VLS_StyleScopedClasses['status-row']} */ ;
/** @type {__VLS_StyleScopedClasses['test-error']} */ ;
/** @type {__VLS_StyleScopedClasses['test-output']} */ ;
/** @type {__VLS_StyleScopedClasses['editor-shell']} */ ;
/** @type {__VLS_StyleScopedClasses['editor-form']} */ ;
/** @type {__VLS_StyleScopedClasses['model-pane']} */ ;
/** @type {__VLS_StyleScopedClasses['model-pane-head']} */ ;
/** @type {__VLS_StyleScopedClasses['model-pane-title']} */ ;
/** @type {__VLS_StyleScopedClasses['model-pane-hint']} */ ;
/** @type {__VLS_StyleScopedClasses['model-toolbar']} */ ;
/** @type {__VLS_StyleScopedClasses['selected-model']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-label']} */ ;
/** @type {__VLS_StyleScopedClasses['selected-model-value']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-sub']} */ ;
/** @type {__VLS_StyleScopedClasses['model-list']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['model-item']} */ ;
/** @type {__VLS_StyleScopedClasses['model-name']} */ ;
/** @type {__VLS_StyleScopedClasses['model-id']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Delete: Delete,
            Edit: Edit,
            Plus: Plus,
            RefreshRight: RefreshRight,
            t: t,
            testForm: testForm,
            output: output,
            status: status,
            error: error,
            isStreaming: isStreaming,
            platformOptions: platformOptions,
            defaultEndpointFor: defaultEndpointFor,
            configs: configs,
            loading: loading,
            selectedConfigId: selectedConfigId,
            editorVisible: editorVisible,
            editorMode: editorMode,
            saving: saving,
            discoveringModels: discoveringModels,
            testMeta: testMeta,
            editorForm: editorForm,
            modelKeyword: modelKeyword,
            filteredRemoteModels: filteredRemoteModels,
            selectedConfig: selectedConfig,
            refreshConfigs: refreshConfigs,
            openCreate: openCreate,
            openEdit: openEdit,
            discoverModels: discoverModels,
            applyModel: applyModel,
            saveConfig: saveConfig,
            removeConfig: removeConfig,
            submitModelTest: submitModelTest,
            clearModelTest: clearModelTest,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
