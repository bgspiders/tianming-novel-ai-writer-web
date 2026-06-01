import { computed, onMounted, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Delete, Edit, Plus, RefreshRight } from '@element-plus/icons-vue';
import { useI18n } from '@/composables/useI18n';
import { createProviderConfig, deleteProviderConfig, discoverRemoteModels, listProviderConfigs, updateProviderConfig } from '@/api/modules/ai';
const { t } = useI18n();
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
async function refreshConfigs(keepSelection = true) {
    loading.value = true;
    try {
        configs.value = await listProviderConfigs();
        if (!keepSelection || !configs.value.some((item) => item.providerId === selectedConfigId.value)) {
            selectedConfigId.value = configs.value[0]?.providerId ?? '';
        }
    }
    catch (err) {
        ElMessage.error(err.message ?? t('aiModels.messages.providersLoadFailed'));
    }
    finally {
        loading.value = false;
    }
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
    refreshConfigs();
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['hero-card']} */ ;
/** @type {__VLS_StyleScopedClasses['config-item']} */ ;
/** @type {__VLS_StyleScopedClasses['config-item']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-mono']} */ ;
/** @type {__VLS_StyleScopedClasses['model-item']} */ ;
/** @type {__VLS_StyleScopedClasses['model-item']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['layout']} */ ;
/** @type {__VLS_StyleScopedClasses['editor-shell']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-grid']} */ ;
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
}
else {
    const __VLS_56 = {}.ElEmpty;
    /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
    // @ts-ignore
    const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
        description: (__VLS_ctx.t('aiModels.provider.selectedEmpty')),
    }));
    const __VLS_58 = __VLS_57({
        description: (__VLS_ctx.t('aiModels.provider.selectedEmpty')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_57));
}
var __VLS_35;
const __VLS_60 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
    modelValue: (__VLS_ctx.editorVisible),
    title: (__VLS_ctx.editorMode === 'create' ? __VLS_ctx.t('aiModels.config.create') : __VLS_ctx.t('aiModels.config.edit')),
    width: "860px",
    closeOnClickModal: (false),
}));
const __VLS_62 = __VLS_61({
    modelValue: (__VLS_ctx.editorVisible),
    title: (__VLS_ctx.editorMode === 'create' ? __VLS_ctx.t('aiModels.config.create') : __VLS_ctx.t('aiModels.config.edit')),
    width: "860px",
    closeOnClickModal: (false),
}, ...__VLS_functionalComponentArgsRest(__VLS_61));
__VLS_63.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "editor-shell" },
});
const __VLS_64 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
    model: (__VLS_ctx.editorForm),
    labelWidth: "110px",
    labelPosition: "right",
    ...{ class: "editor-form" },
}));
const __VLS_66 = __VLS_65({
    model: (__VLS_ctx.editorForm),
    labelWidth: "110px",
    labelPosition: "right",
    ...{ class: "editor-form" },
}, ...__VLS_functionalComponentArgsRest(__VLS_65));
__VLS_67.slots.default;
const __VLS_68 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
    label: (__VLS_ctx.t('aiModels.config.form.platform')),
    required: true,
}));
const __VLS_70 = __VLS_69({
    label: (__VLS_ctx.t('aiModels.config.form.platform')),
    required: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_69));
__VLS_71.slots.default;
const __VLS_72 = {}.ElSelect;
/** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
// @ts-ignore
const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
    modelValue: (__VLS_ctx.editorForm.platformCode),
    ...{ style: {} },
}));
const __VLS_74 = __VLS_73({
    modelValue: (__VLS_ctx.editorForm.platformCode),
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_73));
__VLS_75.slots.default;
for (const [platform] of __VLS_getVForSourceType((__VLS_ctx.platformOptions))) {
    const __VLS_76 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({
        key: (platform.code),
        label: (`${platform.name} · ${platform.hint}`),
        value: (platform.code),
    }));
    const __VLS_78 = __VLS_77({
        key: (platform.code),
        label: (`${platform.name} · ${platform.hint}`),
        value: (platform.code),
    }, ...__VLS_functionalComponentArgsRest(__VLS_77));
}
var __VLS_75;
var __VLS_71;
const __VLS_80 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
    label: (__VLS_ctx.t('aiModels.config.form.name')),
    required: true,
}));
const __VLS_82 = __VLS_81({
    label: (__VLS_ctx.t('aiModels.config.form.name')),
    required: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_81));
__VLS_83.slots.default;
const __VLS_84 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({
    modelValue: (__VLS_ctx.editorForm.name),
    placeholder: (__VLS_ctx.t('aiModels.config.placeholders.name')),
}));
const __VLS_86 = __VLS_85({
    modelValue: (__VLS_ctx.editorForm.name),
    placeholder: (__VLS_ctx.t('aiModels.config.placeholders.name')),
}, ...__VLS_functionalComponentArgsRest(__VLS_85));
var __VLS_83;
const __VLS_88 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
    label: (__VLS_ctx.t('aiModels.config.form.endpoint')),
    required: true,
}));
const __VLS_90 = __VLS_89({
    label: (__VLS_ctx.t('aiModels.config.form.endpoint')),
    required: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_89));
__VLS_91.slots.default;
const __VLS_92 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({
    modelValue: (__VLS_ctx.editorForm.defaultEndpoint),
    placeholder: (__VLS_ctx.defaultEndpointFor(__VLS_ctx.editorForm.platformCode)),
}));
const __VLS_94 = __VLS_93({
    modelValue: (__VLS_ctx.editorForm.defaultEndpoint),
    placeholder: (__VLS_ctx.defaultEndpointFor(__VLS_ctx.editorForm.platformCode)),
}, ...__VLS_functionalComponentArgsRest(__VLS_93));
var __VLS_91;
const __VLS_96 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
    label: (__VLS_ctx.t('aiModels.config.form.apiKey')),
    required: (__VLS_ctx.editorMode === 'create'),
}));
const __VLS_98 = __VLS_97({
    label: (__VLS_ctx.t('aiModels.config.form.apiKey')),
    required: (__VLS_ctx.editorMode === 'create'),
}, ...__VLS_functionalComponentArgsRest(__VLS_97));
__VLS_99.slots.default;
const __VLS_100 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_101 = __VLS_asFunctionalComponent(__VLS_100, new __VLS_100({
    modelValue: (__VLS_ctx.editorForm.plainKey),
    type: "password",
    showPassword: true,
    placeholder: (__VLS_ctx.editorMode === 'edit' ? __VLS_ctx.t('aiModels.config.placeholders.keepExistingKey') : 'sk-...'),
}));
const __VLS_102 = __VLS_101({
    modelValue: (__VLS_ctx.editorForm.plainKey),
    type: "password",
    showPassword: true,
    placeholder: (__VLS_ctx.editorMode === 'edit' ? __VLS_ctx.t('aiModels.config.placeholders.keepExistingKey') : 'sk-...'),
}, ...__VLS_functionalComponentArgsRest(__VLS_101));
var __VLS_99;
const __VLS_104 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_105 = __VLS_asFunctionalComponent(__VLS_104, new __VLS_104({
    label: (__VLS_ctx.t('aiModels.config.form.apiKeyName')),
}));
const __VLS_106 = __VLS_105({
    label: (__VLS_ctx.t('aiModels.config.form.apiKeyName')),
}, ...__VLS_functionalComponentArgsRest(__VLS_105));
__VLS_107.slots.default;
const __VLS_108 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_109 = __VLS_asFunctionalComponent(__VLS_108, new __VLS_108({
    modelValue: (__VLS_ctx.editorForm.apiKeyName),
    placeholder: (__VLS_ctx.t('aiModels.config.placeholders.keyName')),
}));
const __VLS_110 = __VLS_109({
    modelValue: (__VLS_ctx.editorForm.apiKeyName),
    placeholder: (__VLS_ctx.t('aiModels.config.placeholders.keyName')),
}, ...__VLS_functionalComponentArgsRest(__VLS_109));
var __VLS_107;
const __VLS_112 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_113 = __VLS_asFunctionalComponent(__VLS_112, new __VLS_112({
    label: (__VLS_ctx.t('aiModels.config.form.notes')),
}));
const __VLS_114 = __VLS_113({
    label: (__VLS_ctx.t('aiModels.config.form.notes')),
}, ...__VLS_functionalComponentArgsRest(__VLS_113));
__VLS_115.slots.default;
const __VLS_116 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_117 = __VLS_asFunctionalComponent(__VLS_116, new __VLS_116({
    modelValue: (__VLS_ctx.editorForm.notes),
    type: "textarea",
    rows: (2),
    placeholder: (__VLS_ctx.t('aiModels.config.placeholders.notes')),
}));
const __VLS_118 = __VLS_117({
    modelValue: (__VLS_ctx.editorForm.notes),
    type: "textarea",
    rows: (2),
    placeholder: (__VLS_ctx.t('aiModels.config.placeholders.notes')),
}, ...__VLS_functionalComponentArgsRest(__VLS_117));
var __VLS_115;
const __VLS_120 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_121 = __VLS_asFunctionalComponent(__VLS_120, new __VLS_120({
    label: (__VLS_ctx.t('aiModels.config.form.sortOrder')),
}));
const __VLS_122 = __VLS_121({
    label: (__VLS_ctx.t('aiModels.config.form.sortOrder')),
}, ...__VLS_functionalComponentArgsRest(__VLS_121));
__VLS_123.slots.default;
const __VLS_124 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({
    modelValue: (__VLS_ctx.editorForm.sortOrder),
    min: (0),
}));
const __VLS_126 = __VLS_125({
    modelValue: (__VLS_ctx.editorForm.sortOrder),
    min: (0),
}, ...__VLS_functionalComponentArgsRest(__VLS_125));
var __VLS_123;
const __VLS_128 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_129 = __VLS_asFunctionalComponent(__VLS_128, new __VLS_128({
    label: (__VLS_ctx.t('aiModels.config.form.enabled')),
}));
const __VLS_130 = __VLS_129({
    label: (__VLS_ctx.t('aiModels.config.form.enabled')),
}, ...__VLS_functionalComponentArgsRest(__VLS_129));
__VLS_131.slots.default;
const __VLS_132 = {}.ElSwitch;
/** @type {[typeof __VLS_components.ElSwitch, typeof __VLS_components.elSwitch, ]} */ ;
// @ts-ignore
const __VLS_133 = __VLS_asFunctionalComponent(__VLS_132, new __VLS_132({
    modelValue: (__VLS_ctx.editorForm.isEnabled),
}));
const __VLS_134 = __VLS_133({
    modelValue: (__VLS_ctx.editorForm.isEnabled),
}, ...__VLS_functionalComponentArgsRest(__VLS_133));
var __VLS_131;
var __VLS_67;
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
const __VLS_136 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_137 = __VLS_asFunctionalComponent(__VLS_136, new __VLS_136({
    ...{ 'onClick': {} },
    type: "primary",
    loading: (__VLS_ctx.discoveringModels),
    icon: (__VLS_ctx.RefreshRight),
}));
const __VLS_138 = __VLS_137({
    ...{ 'onClick': {} },
    type: "primary",
    loading: (__VLS_ctx.discoveringModels),
    icon: (__VLS_ctx.RefreshRight),
}, ...__VLS_functionalComponentArgsRest(__VLS_137));
let __VLS_140;
let __VLS_141;
let __VLS_142;
const __VLS_143 = {
    onClick: (__VLS_ctx.discoverModels)
};
__VLS_139.slots.default;
(__VLS_ctx.t('aiModels.config.modelSection.fetch'));
var __VLS_139;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "model-toolbar" },
});
const __VLS_144 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_145 = __VLS_asFunctionalComponent(__VLS_144, new __VLS_144({
    modelValue: (__VLS_ctx.modelKeyword),
    placeholder: (__VLS_ctx.t('aiModels.config.placeholders.searchModel')),
    clearable: true,
}));
const __VLS_146 = __VLS_145({
    modelValue: (__VLS_ctx.modelKeyword),
    placeholder: (__VLS_ctx.t('aiModels.config.placeholders.searchModel')),
    clearable: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_145));
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
    const __VLS_148 = {}.ElEmpty;
    /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
    // @ts-ignore
    const __VLS_149 = __VLS_asFunctionalComponent(__VLS_148, new __VLS_148({
        description: (__VLS_ctx.t('aiModels.config.empty.noDiscoveredModels')),
    }));
    const __VLS_150 = __VLS_149({
        description: (__VLS_ctx.t('aiModels.config.empty.noDiscoveredModels')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_149));
}
{
    const { footer: __VLS_thisSlot } = __VLS_63.slots;
    const __VLS_152 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_153 = __VLS_asFunctionalComponent(__VLS_152, new __VLS_152({
        ...{ 'onClick': {} },
    }));
    const __VLS_154 = __VLS_153({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_153));
    let __VLS_156;
    let __VLS_157;
    let __VLS_158;
    const __VLS_159 = {
        onClick: (...[$event]) => {
            __VLS_ctx.editorVisible = false;
        }
    };
    __VLS_155.slots.default;
    (__VLS_ctx.t('aiModels.actions.cancel'));
    var __VLS_155;
    const __VLS_160 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_161 = __VLS_asFunctionalComponent(__VLS_160, new __VLS_160({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.saving),
    }));
    const __VLS_162 = __VLS_161({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.saving),
    }, ...__VLS_functionalComponentArgsRest(__VLS_161));
    let __VLS_164;
    let __VLS_165;
    let __VLS_166;
    const __VLS_167 = {
        onClick: (__VLS_ctx.saveConfig)
    };
    __VLS_163.slots.default;
    (__VLS_ctx.t('aiModels.actions.save'));
    var __VLS_163;
}
var __VLS_63;
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
            platformOptions: platformOptions,
            defaultEndpointFor: defaultEndpointFor,
            configs: configs,
            loading: loading,
            selectedConfigId: selectedConfigId,
            editorVisible: editorVisible,
            editorMode: editorMode,
            saving: saving,
            discoveringModels: discoveringModels,
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
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
