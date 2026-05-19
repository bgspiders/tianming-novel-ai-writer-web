import { computed, onMounted, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Edit, Delete, Plus, Promotion } from '@element-plus/icons-vue';
import { listProviders, createProvider, updateProvider, deleteProvider, listModels, createModel, updateModel, deleteModel, listKeys, createKey, updateKey, deleteKey, testKey } from '@/api/modules/ai';
const providers = ref([]);
const selectedProviderId = ref('');
const loadingProviders = ref(false);
const tab = ref('models');
const selectedProvider = computed(() => providers.value.find((p) => p.id === selectedProviderId.value) ?? null);
async function refreshProviders(keepSelection = true) {
    loadingProviders.value = true;
    try {
        providers.value = await listProviders();
        if (!keepSelection || !providers.value.some((p) => p.id === selectedProviderId.value)) {
            selectedProviderId.value = providers.value[0]?.id ?? '';
        }
    }
    catch (err) {
        ElMessage.error(err.message ?? '加载 Provider 失败');
    }
    finally {
        loadingProviders.value = false;
    }
}
// --- Provider 编辑 ---
const providerDialogVisible = ref(false);
const providerDialogMode = ref('create');
const providerForm = ref({
    code: '',
    name: '',
    defaultEndpoint: '',
    iconUrl: '',
    notes: '',
    isEnabled: true,
    sortOrder: 0
});
const providerEditId = ref('');
function openCreateProvider() {
    providerDialogMode.value = 'create';
    providerEditId.value = '';
    providerForm.value = {
        code: '',
        name: '',
        defaultEndpoint: '',
        iconUrl: '',
        notes: '',
        isEnabled: true,
        sortOrder: (providers.value.length || 0)
    };
    providerDialogVisible.value = true;
}
function openEditProvider(p) {
    providerDialogMode.value = 'edit';
    providerEditId.value = p.id;
    providerForm.value = {
        code: p.code,
        name: p.name,
        defaultEndpoint: p.defaultEndpoint,
        iconUrl: p.iconUrl,
        notes: p.notes,
        isEnabled: p.isEnabled,
        sortOrder: p.sortOrder
    };
    providerDialogVisible.value = true;
}
async function saveProvider() {
    try {
        if (providerDialogMode.value === 'create') {
            await createProvider(providerForm.value);
            ElMessage.success('Provider 已创建');
        }
        else {
            await updateProvider(providerEditId.value, providerForm.value);
            ElMessage.success('Provider 已更新');
        }
        providerDialogVisible.value = false;
        await refreshProviders();
    }
    catch (err) {
        ElMessage.error(err.message ?? '保存失败');
    }
}
async function removeProvider(p) {
    if (p.isBuiltIn) {
        ElMessage.warning('内置 Provider 不可删除，可改为禁用');
        return;
    }
    try {
        await ElMessageBox.confirm(`确定删除 "${p.name}"？关联的模型和 Key 会一并删除。`, '确认', { type: 'warning' });
    }
    catch {
        return;
    }
    try {
        await deleteProvider(p.id);
        ElMessage.success('已删除');
        await refreshProviders(false);
    }
    catch (err) {
        ElMessage.error(err.message ?? '删除失败');
    }
}
// --- Models ---
const models = ref([]);
const loadingModels = ref(false);
async function refreshModels() {
    if (!selectedProviderId.value) {
        models.value = [];
        return;
    }
    loadingModels.value = true;
    try {
        models.value = await listModels(selectedProviderId.value);
    }
    catch (err) {
        ElMessage.error(err.message ?? '加载模型失败');
    }
    finally {
        loadingModels.value = false;
    }
}
const modelDialogVisible = ref(false);
const modelDialogMode = ref('create');
const modelEditId = ref('');
const modelForm = ref({
    code: '',
    name: '',
    description: '',
    contextWindow: null,
    maxOutputTokens: null,
    capabilities: '{}',
    inputPricePerMillion: null,
    outputPricePerMillion: null,
    isEnabled: true,
    sortOrder: 0
});
function openCreateModel() {
    modelDialogMode.value = 'create';
    modelEditId.value = '';
    modelForm.value = {
        code: '',
        name: '',
        description: '',
        contextWindow: null,
        maxOutputTokens: null,
        capabilities: '{"streaming":true}',
        inputPricePerMillion: null,
        outputPricePerMillion: null,
        isEnabled: true,
        sortOrder: models.value.length
    };
    modelDialogVisible.value = true;
}
function openEditModel(m) {
    modelDialogMode.value = 'edit';
    modelEditId.value = m.id;
    modelForm.value = {
        code: m.code,
        name: m.name,
        description: m.description,
        contextWindow: m.contextWindow,
        maxOutputTokens: m.maxOutputTokens,
        capabilities: m.capabilities,
        inputPricePerMillion: m.inputPricePerMillion,
        outputPricePerMillion: m.outputPricePerMillion,
        isEnabled: m.isEnabled,
        sortOrder: m.sortOrder
    };
    modelDialogVisible.value = true;
}
async function saveModel() {
    if (!selectedProviderId.value)
        return;
    try {
        if (modelDialogMode.value === 'create') {
            await createModel(selectedProviderId.value, modelForm.value);
            ElMessage.success('模型已创建');
        }
        else {
            await updateModel(selectedProviderId.value, modelEditId.value, modelForm.value);
            ElMessage.success('模型已更新');
        }
        modelDialogVisible.value = false;
        await refreshModels();
        await refreshProviders();
    }
    catch (err) {
        ElMessage.error(err.message ?? '保存失败');
    }
}
async function removeModel(m) {
    try {
        await ElMessageBox.confirm(`删除模型 "${m.name}"？`, '确认', { type: 'warning' });
    }
    catch {
        return;
    }
    try {
        await deleteModel(selectedProviderId.value, m.id);
        ElMessage.success('已删除');
        await refreshModels();
        await refreshProviders();
    }
    catch (err) {
        ElMessage.error(err.message ?? '删除失败');
    }
}
// --- Keys ---
const keys = ref([]);
const loadingKeys = ref(false);
async function refreshKeys() {
    if (!selectedProviderId.value) {
        keys.value = [];
        return;
    }
    loadingKeys.value = true;
    try {
        keys.value = await listKeys(selectedProviderId.value);
    }
    catch (err) {
        ElMessage.error(err.message ?? '加载 Key 失败');
    }
    finally {
        loadingKeys.value = false;
    }
}
const keyDialogVisible = ref(false);
const keyDialogMode = ref('create');
const keyEditId = ref('');
const keyForm = ref({
    providerId: '',
    name: '',
    plainKey: '',
    isEnabled: true,
    rotationOrder: 0
});
function openCreateKey() {
    keyDialogMode.value = 'create';
    keyEditId.value = '';
    keyForm.value = {
        providerId: selectedProviderId.value,
        name: '',
        plainKey: '',
        isEnabled: true,
        rotationOrder: keys.value.length
    };
    keyDialogVisible.value = true;
}
function openEditKey(k) {
    keyDialogMode.value = 'edit';
    keyEditId.value = k.id;
    keyForm.value = {
        providerId: k.providerId,
        name: k.name,
        plainKey: '',
        isEnabled: k.isEnabled,
        rotationOrder: k.rotationOrder
    };
    keyDialogVisible.value = true;
}
async function saveKey() {
    try {
        if (keyDialogMode.value === 'create') {
            if (!keyForm.value.plainKey) {
                ElMessage.warning('请填写 API Key');
                return;
            }
            await createKey({
                providerId: keyForm.value.providerId,
                name: keyForm.value.name,
                plainKey: keyForm.value.plainKey,
                isEnabled: keyForm.value.isEnabled,
                rotationOrder: keyForm.value.rotationOrder
            });
            ElMessage.success('Key 已添加（已加密落库）');
        }
        else {
            await updateKey(keyEditId.value, {
                name: keyForm.value.name,
                plainKey: keyForm.value.plainKey || null,
                isEnabled: keyForm.value.isEnabled,
                rotationOrder: keyForm.value.rotationOrder
            });
            ElMessage.success('Key 已更新');
        }
        keyDialogVisible.value = false;
        await refreshKeys();
        await refreshProviders();
    }
    catch (err) {
        ElMessage.error(err.message ?? '保存失败');
    }
}
async function removeKey(k) {
    try {
        await ElMessageBox.confirm(`删除 Key "${k.name}"？`, '确认', { type: 'warning' });
    }
    catch {
        return;
    }
    try {
        await deleteKey(k.id);
        ElMessage.success('已删除');
        await refreshKeys();
        await refreshProviders();
    }
    catch (err) {
        ElMessage.error(err.message ?? '删除失败');
    }
}
// --- Key 测试 ---
const testDialogVisible = ref(false);
const testingKeyId = ref('');
const testForm = ref({
    endpoint: '',
    modelCode: '',
    prompt: '用一句话介绍你自己'
});
const testResult = ref(null);
const testRunning = ref(false);
function openTest(k) {
    testingKeyId.value = k.id;
    testForm.value = {
        endpoint: selectedProvider.value?.defaultEndpoint ?? '',
        modelCode: models.value[0]?.code ?? '',
        prompt: '用一句话介绍你自己'
    };
    testResult.value = null;
    testDialogVisible.value = true;
}
async function runTest() {
    if (!testForm.value.endpoint || !testForm.value.modelCode) {
        ElMessage.warning('请填写 Endpoint 与 Model Code');
        return;
    }
    testRunning.value = true;
    testResult.value = null;
    try {
        testResult.value = await testKey(testingKeyId.value, testForm.value);
        if (testResult.value.ok) {
            ElMessage.success(`测试通过：${testResult.value.outputChars} 字 / ${testResult.value.elapsedMs}ms`);
        }
        else {
            ElMessage.error(`测试失败：${testResult.value.error}`);
        }
    }
    catch (err) {
        ElMessage.error(err.message ?? '调用失败');
    }
    finally {
        testRunning.value = false;
    }
}
// --- 监听 provider 切换 ---
watch(selectedProviderId, () => {
    refreshModels();
    refreshKeys();
});
onMounted(refreshProviders);
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['header']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-head']} */ ;
/** @type {__VLS_StyleScopedClasses['provider-item']} */ ;
/** @type {__VLS_StyleScopedClasses['provider-item']} */ ;
/** @type {__VLS_StyleScopedClasses['provider-meta']} */ ;
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
}));
const __VLS_2 = __VLS_1({
    shadow: "never",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_3.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "header" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({
    ...{ class: "title" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "hint" },
});
var __VLS_3;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "layout" },
});
const __VLS_4 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
    shadow: "never",
    ...{ class: "provider-panel" },
}));
const __VLS_6 = __VLS_5({
    shadow: "never",
    ...{ class: "provider-panel" },
}, ...__VLS_functionalComponentArgsRest(__VLS_5));
__VLS_7.slots.default;
{
    const { header: __VLS_thisSlot } = __VLS_7.slots;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "panel-head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    const __VLS_8 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
        ...{ 'onClick': {} },
        type: "primary",
        icon: (__VLS_ctx.Plus),
        size: "small",
    }));
    const __VLS_10 = __VLS_9({
        ...{ 'onClick': {} },
        type: "primary",
        icon: (__VLS_ctx.Plus),
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_9));
    let __VLS_12;
    let __VLS_13;
    let __VLS_14;
    const __VLS_15 = {
        onClick: (__VLS_ctx.openCreateProvider)
    };
    __VLS_11.slots.default;
    var __VLS_11;
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "provider-list" },
});
__VLS_asFunctionalDirective(__VLS_directives.vLoading)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.loadingProviders) }, null, null);
for (const [p] of __VLS_getVForSourceType((__VLS_ctx.providers))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.selectedProviderId = p.id;
            } },
        key: (p.id),
        ...{ class: (['provider-item', { active: p.id === __VLS_ctx.selectedProviderId }]) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "provider-row" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "provider-name" },
    });
    (p.name);
    if (p.isBuiltIn) {
        const __VLS_16 = {}.ElTag;
        /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
        // @ts-ignore
        const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
            type: "info",
            size: "small",
            effect: "plain",
        }));
        const __VLS_18 = __VLS_17({
            type: "info",
            size: "small",
            effect: "plain",
        }, ...__VLS_functionalComponentArgsRest(__VLS_17));
        __VLS_19.slots.default;
        var __VLS_19;
    }
    if (!p.isEnabled) {
        const __VLS_20 = {}.ElTag;
        /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
        // @ts-ignore
        const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
            type: "warning",
            size: "small",
        }));
        const __VLS_22 = __VLS_21({
            type: "warning",
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_21));
        __VLS_23.slots.default;
        var __VLS_23;
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "provider-meta" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "code" },
    });
    (p.code);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "counts" },
    });
    (p.modelCount);
    (p.keyCount);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "provider-actions" },
    });
    const __VLS_24 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
        ...{ 'onClick': {} },
        size: "small",
        icon: (__VLS_ctx.Edit),
        link: true,
    }));
    const __VLS_26 = __VLS_25({
        ...{ 'onClick': {} },
        size: "small",
        icon: (__VLS_ctx.Edit),
        link: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_25));
    let __VLS_28;
    let __VLS_29;
    let __VLS_30;
    const __VLS_31 = {
        onClick: (...[$event]) => {
            __VLS_ctx.openEditProvider(p);
        }
    };
    __VLS_27.slots.default;
    var __VLS_27;
    const __VLS_32 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
        ...{ 'onClick': {} },
        size: "small",
        icon: (__VLS_ctx.Delete),
        link: true,
        type: "danger",
        disabled: (p.isBuiltIn),
    }));
    const __VLS_34 = __VLS_33({
        ...{ 'onClick': {} },
        size: "small",
        icon: (__VLS_ctx.Delete),
        link: true,
        type: "danger",
        disabled: (p.isBuiltIn),
    }, ...__VLS_functionalComponentArgsRest(__VLS_33));
    let __VLS_36;
    let __VLS_37;
    let __VLS_38;
    const __VLS_39 = {
        onClick: (...[$event]) => {
            __VLS_ctx.removeProvider(p);
        }
    };
    __VLS_35.slots.default;
    var __VLS_35;
}
if (!__VLS_ctx.loadingProviders && __VLS_ctx.providers.length === 0) {
    const __VLS_40 = {}.ElEmpty;
    /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
    // @ts-ignore
    const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
        description: "暂无 Provider",
    }));
    const __VLS_42 = __VLS_41({
        description: "暂无 Provider",
    }, ...__VLS_functionalComponentArgsRest(__VLS_41));
}
var __VLS_7;
const __VLS_44 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
    shadow: "never",
    ...{ class: "detail-panel" },
}));
const __VLS_46 = __VLS_45({
    shadow: "never",
    ...{ class: "detail-panel" },
}, ...__VLS_functionalComponentArgsRest(__VLS_45));
__VLS_47.slots.default;
{
    const { header: __VLS_thisSlot } = __VLS_47.slots;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "panel-head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.selectedProvider?.name || '请选择 Provider');
    if (__VLS_ctx.selectedProvider?.defaultEndpoint) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "default-endpoint" },
        });
        (__VLS_ctx.selectedProvider.defaultEndpoint);
    }
}
if (__VLS_ctx.selectedProvider) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    const __VLS_48 = {}.ElTabs;
    /** @type {[typeof __VLS_components.ElTabs, typeof __VLS_components.elTabs, typeof __VLS_components.ElTabs, typeof __VLS_components.elTabs, ]} */ ;
    // @ts-ignore
    const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
        modelValue: (__VLS_ctx.tab),
    }));
    const __VLS_50 = __VLS_49({
        modelValue: (__VLS_ctx.tab),
    }, ...__VLS_functionalComponentArgsRest(__VLS_49));
    __VLS_51.slots.default;
    const __VLS_52 = {}.ElTabPane;
    /** @type {[typeof __VLS_components.ElTabPane, typeof __VLS_components.elTabPane, typeof __VLS_components.ElTabPane, typeof __VLS_components.elTabPane, ]} */ ;
    // @ts-ignore
    const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
        label: "模型清单",
        name: "models",
    }));
    const __VLS_54 = __VLS_53({
        label: "模型清单",
        name: "models",
    }, ...__VLS_functionalComponentArgsRest(__VLS_53));
    __VLS_55.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "tab-toolbar" },
    });
    const __VLS_56 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
        ...{ 'onClick': {} },
        type: "primary",
        icon: (__VLS_ctx.Plus),
        size: "small",
    }));
    const __VLS_58 = __VLS_57({
        ...{ 'onClick': {} },
        type: "primary",
        icon: (__VLS_ctx.Plus),
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_57));
    let __VLS_60;
    let __VLS_61;
    let __VLS_62;
    const __VLS_63 = {
        onClick: (__VLS_ctx.openCreateModel)
    };
    __VLS_59.slots.default;
    var __VLS_59;
    const __VLS_64 = {}.ElTable;
    /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
    // @ts-ignore
    const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
        data: (__VLS_ctx.models),
        stripe: true,
        size: "small",
    }));
    const __VLS_66 = __VLS_65({
        data: (__VLS_ctx.models),
        stripe: true,
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_65));
    __VLS_asFunctionalDirective(__VLS_directives.vLoading)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.loadingModels) }, null, null);
    __VLS_67.slots.default;
    const __VLS_68 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
        prop: "code",
        label: "编码",
        minWidth: "180",
    }));
    const __VLS_70 = __VLS_69({
        prop: "code",
        label: "编码",
        minWidth: "180",
    }, ...__VLS_functionalComponentArgsRest(__VLS_69));
    const __VLS_72 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
        prop: "name",
        label: "名称",
        minWidth: "160",
    }));
    const __VLS_74 = __VLS_73({
        prop: "name",
        label: "名称",
        minWidth: "160",
    }, ...__VLS_functionalComponentArgsRest(__VLS_73));
    const __VLS_76 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({
        prop: "contextWindow",
        label: "上下文",
        width: "100",
        align: "right",
    }));
    const __VLS_78 = __VLS_77({
        prop: "contextWindow",
        label: "上下文",
        width: "100",
        align: "right",
    }, ...__VLS_functionalComponentArgsRest(__VLS_77));
    const __VLS_80 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
        prop: "maxOutputTokens",
        label: "最大输出",
        width: "100",
        align: "right",
    }));
    const __VLS_82 = __VLS_81({
        prop: "maxOutputTokens",
        label: "最大输出",
        width: "100",
        align: "right",
    }, ...__VLS_functionalComponentArgsRest(__VLS_81));
    const __VLS_84 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({
        label: "状态",
        width: "80",
    }));
    const __VLS_86 = __VLS_85({
        label: "状态",
        width: "80",
    }, ...__VLS_functionalComponentArgsRest(__VLS_85));
    __VLS_87.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_87.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        const __VLS_88 = {}.ElTag;
        /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
        // @ts-ignore
        const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
            type: (row.isEnabled ? 'success' : 'info'),
            size: "small",
        }));
        const __VLS_90 = __VLS_89({
            type: (row.isEnabled ? 'success' : 'info'),
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_89));
        __VLS_91.slots.default;
        (row.isEnabled ? '启用' : '禁用');
        var __VLS_91;
    }
    var __VLS_87;
    const __VLS_92 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({
        label: "操作",
        width: "140",
        align: "center",
    }));
    const __VLS_94 = __VLS_93({
        label: "操作",
        width: "140",
        align: "center",
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
            icon: (__VLS_ctx.Edit),
            link: true,
        }));
        const __VLS_98 = __VLS_97({
            ...{ 'onClick': {} },
            size: "small",
            icon: (__VLS_ctx.Edit),
            link: true,
        }, ...__VLS_functionalComponentArgsRest(__VLS_97));
        let __VLS_100;
        let __VLS_101;
        let __VLS_102;
        const __VLS_103 = {
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.selectedProvider))
                    return;
                __VLS_ctx.openEditModel(row);
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
            icon: (__VLS_ctx.Delete),
            link: true,
            type: "danger",
        }));
        const __VLS_106 = __VLS_105({
            ...{ 'onClick': {} },
            size: "small",
            icon: (__VLS_ctx.Delete),
            link: true,
            type: "danger",
        }, ...__VLS_functionalComponentArgsRest(__VLS_105));
        let __VLS_108;
        let __VLS_109;
        let __VLS_110;
        const __VLS_111 = {
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.selectedProvider))
                    return;
                __VLS_ctx.removeModel(row);
            }
        };
        __VLS_107.slots.default;
        var __VLS_107;
    }
    var __VLS_95;
    var __VLS_67;
    var __VLS_55;
    const __VLS_112 = {}.ElTabPane;
    /** @type {[typeof __VLS_components.ElTabPane, typeof __VLS_components.elTabPane, typeof __VLS_components.ElTabPane, typeof __VLS_components.elTabPane, ]} */ ;
    // @ts-ignore
    const __VLS_113 = __VLS_asFunctionalComponent(__VLS_112, new __VLS_112({
        label: "API Key",
        name: "keys",
    }));
    const __VLS_114 = __VLS_113({
        label: "API Key",
        name: "keys",
    }, ...__VLS_functionalComponentArgsRest(__VLS_113));
    __VLS_115.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "tab-toolbar" },
    });
    const __VLS_116 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_117 = __VLS_asFunctionalComponent(__VLS_116, new __VLS_116({
        ...{ 'onClick': {} },
        type: "primary",
        icon: (__VLS_ctx.Plus),
        size: "small",
    }));
    const __VLS_118 = __VLS_117({
        ...{ 'onClick': {} },
        type: "primary",
        icon: (__VLS_ctx.Plus),
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_117));
    let __VLS_120;
    let __VLS_121;
    let __VLS_122;
    const __VLS_123 = {
        onClick: (__VLS_ctx.openCreateKey)
    };
    __VLS_119.slots.default;
    var __VLS_119;
    const __VLS_124 = {}.ElTable;
    /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
    // @ts-ignore
    const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({
        data: (__VLS_ctx.keys),
        stripe: true,
        size: "small",
    }));
    const __VLS_126 = __VLS_125({
        data: (__VLS_ctx.keys),
        stripe: true,
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_125));
    __VLS_asFunctionalDirective(__VLS_directives.vLoading)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.loadingKeys) }, null, null);
    __VLS_127.slots.default;
    const __VLS_128 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_129 = __VLS_asFunctionalComponent(__VLS_128, new __VLS_128({
        prop: "name",
        label: "名称",
        minWidth: "160",
    }));
    const __VLS_130 = __VLS_129({
        prop: "name",
        label: "名称",
        minWidth: "160",
    }, ...__VLS_functionalComponentArgsRest(__VLS_129));
    const __VLS_132 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_133 = __VLS_asFunctionalComponent(__VLS_132, new __VLS_132({
        label: "尾段",
        width: "120",
    }));
    const __VLS_134 = __VLS_133({
        label: "尾段",
        width: "120",
    }, ...__VLS_functionalComponentArgsRest(__VLS_133));
    __VLS_135.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_135.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "masked" },
        });
        (row.maskedTail || '—');
    }
    var __VLS_135;
    const __VLS_136 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_137 = __VLS_asFunctionalComponent(__VLS_136, new __VLS_136({
        prop: "rotationOrder",
        label: "轮换序",
        width: "80",
        align: "right",
    }));
    const __VLS_138 = __VLS_137({
        prop: "rotationOrder",
        label: "轮换序",
        width: "80",
        align: "right",
    }, ...__VLS_functionalComponentArgsRest(__VLS_137));
    const __VLS_140 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_141 = __VLS_asFunctionalComponent(__VLS_140, new __VLS_140({
        label: "最近使用",
        width: "180",
    }));
    const __VLS_142 = __VLS_141({
        label: "最近使用",
        width: "180",
    }, ...__VLS_functionalComponentArgsRest(__VLS_141));
    __VLS_143.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_143.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "muted" },
        });
        (row.lastUsedAt ? new Date(row.lastUsedAt).toLocaleString() : '—');
    }
    var __VLS_143;
    const __VLS_144 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_145 = __VLS_asFunctionalComponent(__VLS_144, new __VLS_144({
        label: "状态",
        width: "80",
    }));
    const __VLS_146 = __VLS_145({
        label: "状态",
        width: "80",
    }, ...__VLS_functionalComponentArgsRest(__VLS_145));
    __VLS_147.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_147.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        const __VLS_148 = {}.ElTag;
        /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
        // @ts-ignore
        const __VLS_149 = __VLS_asFunctionalComponent(__VLS_148, new __VLS_148({
            type: (row.isEnabled ? 'success' : 'info'),
            size: "small",
        }));
        const __VLS_150 = __VLS_149({
            type: (row.isEnabled ? 'success' : 'info'),
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_149));
        __VLS_151.slots.default;
        (row.isEnabled ? '启用' : '禁用');
        var __VLS_151;
    }
    var __VLS_147;
    const __VLS_152 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_153 = __VLS_asFunctionalComponent(__VLS_152, new __VLS_152({
        label: "操作",
        width: "220",
        align: "center",
    }));
    const __VLS_154 = __VLS_153({
        label: "操作",
        width: "220",
        align: "center",
    }, ...__VLS_functionalComponentArgsRest(__VLS_153));
    __VLS_155.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_155.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        const __VLS_156 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_157 = __VLS_asFunctionalComponent(__VLS_156, new __VLS_156({
            ...{ 'onClick': {} },
            size: "small",
            icon: (__VLS_ctx.Promotion),
            link: true,
            type: "primary",
        }));
        const __VLS_158 = __VLS_157({
            ...{ 'onClick': {} },
            size: "small",
            icon: (__VLS_ctx.Promotion),
            link: true,
            type: "primary",
        }, ...__VLS_functionalComponentArgsRest(__VLS_157));
        let __VLS_160;
        let __VLS_161;
        let __VLS_162;
        const __VLS_163 = {
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.selectedProvider))
                    return;
                __VLS_ctx.openTest(row);
            }
        };
        __VLS_159.slots.default;
        var __VLS_159;
        const __VLS_164 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_165 = __VLS_asFunctionalComponent(__VLS_164, new __VLS_164({
            ...{ 'onClick': {} },
            size: "small",
            icon: (__VLS_ctx.Edit),
            link: true,
        }));
        const __VLS_166 = __VLS_165({
            ...{ 'onClick': {} },
            size: "small",
            icon: (__VLS_ctx.Edit),
            link: true,
        }, ...__VLS_functionalComponentArgsRest(__VLS_165));
        let __VLS_168;
        let __VLS_169;
        let __VLS_170;
        const __VLS_171 = {
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.selectedProvider))
                    return;
                __VLS_ctx.openEditKey(row);
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
            icon: (__VLS_ctx.Delete),
            link: true,
            type: "danger",
        }));
        const __VLS_174 = __VLS_173({
            ...{ 'onClick': {} },
            size: "small",
            icon: (__VLS_ctx.Delete),
            link: true,
            type: "danger",
        }, ...__VLS_functionalComponentArgsRest(__VLS_173));
        let __VLS_176;
        let __VLS_177;
        let __VLS_178;
        const __VLS_179 = {
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.selectedProvider))
                    return;
                __VLS_ctx.removeKey(row);
            }
        };
        __VLS_175.slots.default;
        var __VLS_175;
    }
    var __VLS_155;
    var __VLS_127;
    var __VLS_115;
    var __VLS_51;
}
else {
    const __VLS_180 = {}.ElEmpty;
    /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
    // @ts-ignore
    const __VLS_181 = __VLS_asFunctionalComponent(__VLS_180, new __VLS_180({
        description: "请在左侧选择 Provider",
    }));
    const __VLS_182 = __VLS_181({
        description: "请在左侧选择 Provider",
    }, ...__VLS_functionalComponentArgsRest(__VLS_181));
}
var __VLS_47;
const __VLS_184 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_185 = __VLS_asFunctionalComponent(__VLS_184, new __VLS_184({
    modelValue: (__VLS_ctx.providerDialogVisible),
    title: (__VLS_ctx.providerDialogMode === 'create' ? '新建 Provider' : '编辑 Provider'),
    width: "520px",
}));
const __VLS_186 = __VLS_185({
    modelValue: (__VLS_ctx.providerDialogVisible),
    title: (__VLS_ctx.providerDialogMode === 'create' ? '新建 Provider' : '编辑 Provider'),
    width: "520px",
}, ...__VLS_functionalComponentArgsRest(__VLS_185));
__VLS_187.slots.default;
const __VLS_188 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_189 = __VLS_asFunctionalComponent(__VLS_188, new __VLS_188({
    model: (__VLS_ctx.providerForm),
    labelWidth: "120px",
    labelPosition: "right",
}));
const __VLS_190 = __VLS_189({
    model: (__VLS_ctx.providerForm),
    labelWidth: "120px",
    labelPosition: "right",
}, ...__VLS_functionalComponentArgsRest(__VLS_189));
__VLS_191.slots.default;
const __VLS_192 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_193 = __VLS_asFunctionalComponent(__VLS_192, new __VLS_192({
    label: "编码",
    required: true,
}));
const __VLS_194 = __VLS_193({
    label: "编码",
    required: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_193));
__VLS_195.slots.default;
const __VLS_196 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_197 = __VLS_asFunctionalComponent(__VLS_196, new __VLS_196({
    modelValue: (__VLS_ctx.providerForm.code),
    placeholder: "如 openai / anthropic",
}));
const __VLS_198 = __VLS_197({
    modelValue: (__VLS_ctx.providerForm.code),
    placeholder: "如 openai / anthropic",
}, ...__VLS_functionalComponentArgsRest(__VLS_197));
var __VLS_195;
const __VLS_200 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_201 = __VLS_asFunctionalComponent(__VLS_200, new __VLS_200({
    label: "名称",
    required: true,
}));
const __VLS_202 = __VLS_201({
    label: "名称",
    required: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_201));
__VLS_203.slots.default;
const __VLS_204 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_205 = __VLS_asFunctionalComponent(__VLS_204, new __VLS_204({
    modelValue: (__VLS_ctx.providerForm.name),
}));
const __VLS_206 = __VLS_205({
    modelValue: (__VLS_ctx.providerForm.name),
}, ...__VLS_functionalComponentArgsRest(__VLS_205));
var __VLS_203;
const __VLS_208 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_209 = __VLS_asFunctionalComponent(__VLS_208, new __VLS_208({
    label: "默认 Endpoint",
}));
const __VLS_210 = __VLS_209({
    label: "默认 Endpoint",
}, ...__VLS_functionalComponentArgsRest(__VLS_209));
__VLS_211.slots.default;
const __VLS_212 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_213 = __VLS_asFunctionalComponent(__VLS_212, new __VLS_212({
    modelValue: (__VLS_ctx.providerForm.defaultEndpoint),
    placeholder: "https://api.openai.com/v1",
}));
const __VLS_214 = __VLS_213({
    modelValue: (__VLS_ctx.providerForm.defaultEndpoint),
    placeholder: "https://api.openai.com/v1",
}, ...__VLS_functionalComponentArgsRest(__VLS_213));
var __VLS_211;
const __VLS_216 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_217 = __VLS_asFunctionalComponent(__VLS_216, new __VLS_216({
    label: "图标 URL",
}));
const __VLS_218 = __VLS_217({
    label: "图标 URL",
}, ...__VLS_functionalComponentArgsRest(__VLS_217));
__VLS_219.slots.default;
const __VLS_220 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_221 = __VLS_asFunctionalComponent(__VLS_220, new __VLS_220({
    modelValue: (__VLS_ctx.providerForm.iconUrl),
}));
const __VLS_222 = __VLS_221({
    modelValue: (__VLS_ctx.providerForm.iconUrl),
}, ...__VLS_functionalComponentArgsRest(__VLS_221));
var __VLS_219;
const __VLS_224 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_225 = __VLS_asFunctionalComponent(__VLS_224, new __VLS_224({
    label: "备注",
}));
const __VLS_226 = __VLS_225({
    label: "备注",
}, ...__VLS_functionalComponentArgsRest(__VLS_225));
__VLS_227.slots.default;
const __VLS_228 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_229 = __VLS_asFunctionalComponent(__VLS_228, new __VLS_228({
    modelValue: (__VLS_ctx.providerForm.notes),
    type: "textarea",
    rows: (2),
}));
const __VLS_230 = __VLS_229({
    modelValue: (__VLS_ctx.providerForm.notes),
    type: "textarea",
    rows: (2),
}, ...__VLS_functionalComponentArgsRest(__VLS_229));
var __VLS_227;
const __VLS_232 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_233 = __VLS_asFunctionalComponent(__VLS_232, new __VLS_232({
    label: "启用",
}));
const __VLS_234 = __VLS_233({
    label: "启用",
}, ...__VLS_functionalComponentArgsRest(__VLS_233));
__VLS_235.slots.default;
const __VLS_236 = {}.ElSwitch;
/** @type {[typeof __VLS_components.ElSwitch, typeof __VLS_components.elSwitch, ]} */ ;
// @ts-ignore
const __VLS_237 = __VLS_asFunctionalComponent(__VLS_236, new __VLS_236({
    modelValue: (__VLS_ctx.providerForm.isEnabled),
}));
const __VLS_238 = __VLS_237({
    modelValue: (__VLS_ctx.providerForm.isEnabled),
}, ...__VLS_functionalComponentArgsRest(__VLS_237));
var __VLS_235;
const __VLS_240 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_241 = __VLS_asFunctionalComponent(__VLS_240, new __VLS_240({
    label: "排序",
}));
const __VLS_242 = __VLS_241({
    label: "排序",
}, ...__VLS_functionalComponentArgsRest(__VLS_241));
__VLS_243.slots.default;
const __VLS_244 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_245 = __VLS_asFunctionalComponent(__VLS_244, new __VLS_244({
    modelValue: (__VLS_ctx.providerForm.sortOrder),
    min: (0),
}));
const __VLS_246 = __VLS_245({
    modelValue: (__VLS_ctx.providerForm.sortOrder),
    min: (0),
}, ...__VLS_functionalComponentArgsRest(__VLS_245));
var __VLS_243;
var __VLS_191;
{
    const { footer: __VLS_thisSlot } = __VLS_187.slots;
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
            __VLS_ctx.providerDialogVisible = false;
        }
    };
    __VLS_251.slots.default;
    var __VLS_251;
    const __VLS_256 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_257 = __VLS_asFunctionalComponent(__VLS_256, new __VLS_256({
        ...{ 'onClick': {} },
        type: "primary",
    }));
    const __VLS_258 = __VLS_257({
        ...{ 'onClick': {} },
        type: "primary",
    }, ...__VLS_functionalComponentArgsRest(__VLS_257));
    let __VLS_260;
    let __VLS_261;
    let __VLS_262;
    const __VLS_263 = {
        onClick: (__VLS_ctx.saveProvider)
    };
    __VLS_259.slots.default;
    var __VLS_259;
}
var __VLS_187;
const __VLS_264 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_265 = __VLS_asFunctionalComponent(__VLS_264, new __VLS_264({
    modelValue: (__VLS_ctx.modelDialogVisible),
    title: (__VLS_ctx.modelDialogMode === 'create' ? '新建模型' : '编辑模型'),
    width: "600px",
}));
const __VLS_266 = __VLS_265({
    modelValue: (__VLS_ctx.modelDialogVisible),
    title: (__VLS_ctx.modelDialogMode === 'create' ? '新建模型' : '编辑模型'),
    width: "600px",
}, ...__VLS_functionalComponentArgsRest(__VLS_265));
__VLS_267.slots.default;
const __VLS_268 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_269 = __VLS_asFunctionalComponent(__VLS_268, new __VLS_268({
    model: (__VLS_ctx.modelForm),
    labelWidth: "130px",
    labelPosition: "right",
}));
const __VLS_270 = __VLS_269({
    model: (__VLS_ctx.modelForm),
    labelWidth: "130px",
    labelPosition: "right",
}, ...__VLS_functionalComponentArgsRest(__VLS_269));
__VLS_271.slots.default;
const __VLS_272 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_273 = __VLS_asFunctionalComponent(__VLS_272, new __VLS_272({
    label: "模型 Code",
    required: true,
}));
const __VLS_274 = __VLS_273({
    label: "模型 Code",
    required: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_273));
__VLS_275.slots.default;
const __VLS_276 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_277 = __VLS_asFunctionalComponent(__VLS_276, new __VLS_276({
    modelValue: (__VLS_ctx.modelForm.code),
    placeholder: "如 gpt-4o-mini",
}));
const __VLS_278 = __VLS_277({
    modelValue: (__VLS_ctx.modelForm.code),
    placeholder: "如 gpt-4o-mini",
}, ...__VLS_functionalComponentArgsRest(__VLS_277));
var __VLS_275;
const __VLS_280 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_281 = __VLS_asFunctionalComponent(__VLS_280, new __VLS_280({
    label: "显示名",
    required: true,
}));
const __VLS_282 = __VLS_281({
    label: "显示名",
    required: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_281));
__VLS_283.slots.default;
const __VLS_284 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_285 = __VLS_asFunctionalComponent(__VLS_284, new __VLS_284({
    modelValue: (__VLS_ctx.modelForm.name),
}));
const __VLS_286 = __VLS_285({
    modelValue: (__VLS_ctx.modelForm.name),
}, ...__VLS_functionalComponentArgsRest(__VLS_285));
var __VLS_283;
const __VLS_288 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_289 = __VLS_asFunctionalComponent(__VLS_288, new __VLS_288({
    label: "描述",
}));
const __VLS_290 = __VLS_289({
    label: "描述",
}, ...__VLS_functionalComponentArgsRest(__VLS_289));
__VLS_291.slots.default;
const __VLS_292 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_293 = __VLS_asFunctionalComponent(__VLS_292, new __VLS_292({
    modelValue: (__VLS_ctx.modelForm.description),
    type: "textarea",
    rows: (2),
}));
const __VLS_294 = __VLS_293({
    modelValue: (__VLS_ctx.modelForm.description),
    type: "textarea",
    rows: (2),
}, ...__VLS_functionalComponentArgsRest(__VLS_293));
var __VLS_291;
const __VLS_296 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_297 = __VLS_asFunctionalComponent(__VLS_296, new __VLS_296({
    label: "上下文窗口",
}));
const __VLS_298 = __VLS_297({
    label: "上下文窗口",
}, ...__VLS_functionalComponentArgsRest(__VLS_297));
__VLS_299.slots.default;
const __VLS_300 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_301 = __VLS_asFunctionalComponent(__VLS_300, new __VLS_300({
    modelValue: (__VLS_ctx.modelForm.contextWindow),
    min: (1),
}));
const __VLS_302 = __VLS_301({
    modelValue: (__VLS_ctx.modelForm.contextWindow),
    min: (1),
}, ...__VLS_functionalComponentArgsRest(__VLS_301));
var __VLS_299;
const __VLS_304 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_305 = __VLS_asFunctionalComponent(__VLS_304, new __VLS_304({
    label: "最大输出 Token",
}));
const __VLS_306 = __VLS_305({
    label: "最大输出 Token",
}, ...__VLS_functionalComponentArgsRest(__VLS_305));
__VLS_307.slots.default;
const __VLS_308 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_309 = __VLS_asFunctionalComponent(__VLS_308, new __VLS_308({
    modelValue: (__VLS_ctx.modelForm.maxOutputTokens),
    min: (1),
}));
const __VLS_310 = __VLS_309({
    modelValue: (__VLS_ctx.modelForm.maxOutputTokens),
    min: (1),
}, ...__VLS_functionalComponentArgsRest(__VLS_309));
var __VLS_307;
const __VLS_312 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_313 = __VLS_asFunctionalComponent(__VLS_312, new __VLS_312({
    label: "能力 JSON",
}));
const __VLS_314 = __VLS_313({
    label: "能力 JSON",
}, ...__VLS_functionalComponentArgsRest(__VLS_313));
__VLS_315.slots.default;
const __VLS_316 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_317 = __VLS_asFunctionalComponent(__VLS_316, new __VLS_316({
    modelValue: (__VLS_ctx.modelForm.capabilities),
    type: "textarea",
    rows: (2),
    placeholder: '{"vision":true,"tools":true,"streaming":true}',
}));
const __VLS_318 = __VLS_317({
    modelValue: (__VLS_ctx.modelForm.capabilities),
    type: "textarea",
    rows: (2),
    placeholder: '{"vision":true,"tools":true,"streaming":true}',
}, ...__VLS_functionalComponentArgsRest(__VLS_317));
var __VLS_315;
const __VLS_320 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_321 = __VLS_asFunctionalComponent(__VLS_320, new __VLS_320({
    label: "输入价 / 1M",
}));
const __VLS_322 = __VLS_321({
    label: "输入价 / 1M",
}, ...__VLS_functionalComponentArgsRest(__VLS_321));
__VLS_323.slots.default;
const __VLS_324 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_325 = __VLS_asFunctionalComponent(__VLS_324, new __VLS_324({
    modelValue: (__VLS_ctx.modelForm.inputPricePerMillion),
    precision: (4),
    step: (0.1),
}));
const __VLS_326 = __VLS_325({
    modelValue: (__VLS_ctx.modelForm.inputPricePerMillion),
    precision: (4),
    step: (0.1),
}, ...__VLS_functionalComponentArgsRest(__VLS_325));
var __VLS_323;
const __VLS_328 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_329 = __VLS_asFunctionalComponent(__VLS_328, new __VLS_328({
    label: "输出价 / 1M",
}));
const __VLS_330 = __VLS_329({
    label: "输出价 / 1M",
}, ...__VLS_functionalComponentArgsRest(__VLS_329));
__VLS_331.slots.default;
const __VLS_332 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_333 = __VLS_asFunctionalComponent(__VLS_332, new __VLS_332({
    modelValue: (__VLS_ctx.modelForm.outputPricePerMillion),
    precision: (4),
    step: (0.1),
}));
const __VLS_334 = __VLS_333({
    modelValue: (__VLS_ctx.modelForm.outputPricePerMillion),
    precision: (4),
    step: (0.1),
}, ...__VLS_functionalComponentArgsRest(__VLS_333));
var __VLS_331;
const __VLS_336 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_337 = __VLS_asFunctionalComponent(__VLS_336, new __VLS_336({
    label: "启用",
}));
const __VLS_338 = __VLS_337({
    label: "启用",
}, ...__VLS_functionalComponentArgsRest(__VLS_337));
__VLS_339.slots.default;
const __VLS_340 = {}.ElSwitch;
/** @type {[typeof __VLS_components.ElSwitch, typeof __VLS_components.elSwitch, ]} */ ;
// @ts-ignore
const __VLS_341 = __VLS_asFunctionalComponent(__VLS_340, new __VLS_340({
    modelValue: (__VLS_ctx.modelForm.isEnabled),
}));
const __VLS_342 = __VLS_341({
    modelValue: (__VLS_ctx.modelForm.isEnabled),
}, ...__VLS_functionalComponentArgsRest(__VLS_341));
var __VLS_339;
var __VLS_271;
{
    const { footer: __VLS_thisSlot } = __VLS_267.slots;
    const __VLS_344 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_345 = __VLS_asFunctionalComponent(__VLS_344, new __VLS_344({
        ...{ 'onClick': {} },
    }));
    const __VLS_346 = __VLS_345({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_345));
    let __VLS_348;
    let __VLS_349;
    let __VLS_350;
    const __VLS_351 = {
        onClick: (...[$event]) => {
            __VLS_ctx.modelDialogVisible = false;
        }
    };
    __VLS_347.slots.default;
    var __VLS_347;
    const __VLS_352 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_353 = __VLS_asFunctionalComponent(__VLS_352, new __VLS_352({
        ...{ 'onClick': {} },
        type: "primary",
    }));
    const __VLS_354 = __VLS_353({
        ...{ 'onClick': {} },
        type: "primary",
    }, ...__VLS_functionalComponentArgsRest(__VLS_353));
    let __VLS_356;
    let __VLS_357;
    let __VLS_358;
    const __VLS_359 = {
        onClick: (__VLS_ctx.saveModel)
    };
    __VLS_355.slots.default;
    var __VLS_355;
}
var __VLS_267;
const __VLS_360 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_361 = __VLS_asFunctionalComponent(__VLS_360, new __VLS_360({
    modelValue: (__VLS_ctx.keyDialogVisible),
    title: (__VLS_ctx.keyDialogMode === 'create' ? '添加 Key' : '编辑 Key'),
    width: "520px",
}));
const __VLS_362 = __VLS_361({
    modelValue: (__VLS_ctx.keyDialogVisible),
    title: (__VLS_ctx.keyDialogMode === 'create' ? '添加 Key' : '编辑 Key'),
    width: "520px",
}, ...__VLS_functionalComponentArgsRest(__VLS_361));
__VLS_363.slots.default;
const __VLS_364 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_365 = __VLS_asFunctionalComponent(__VLS_364, new __VLS_364({
    model: (__VLS_ctx.keyForm),
    labelWidth: "120px",
    labelPosition: "right",
}));
const __VLS_366 = __VLS_365({
    model: (__VLS_ctx.keyForm),
    labelWidth: "120px",
    labelPosition: "right",
}, ...__VLS_functionalComponentArgsRest(__VLS_365));
__VLS_367.slots.default;
const __VLS_368 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_369 = __VLS_asFunctionalComponent(__VLS_368, new __VLS_368({
    label: "名称",
    required: true,
}));
const __VLS_370 = __VLS_369({
    label: "名称",
    required: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_369));
__VLS_371.slots.default;
const __VLS_372 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_373 = __VLS_asFunctionalComponent(__VLS_372, new __VLS_372({
    modelValue: (__VLS_ctx.keyForm.name),
    placeholder: "如 主账号 / 备用 1",
}));
const __VLS_374 = __VLS_373({
    modelValue: (__VLS_ctx.keyForm.name),
    placeholder: "如 主账号 / 备用 1",
}, ...__VLS_functionalComponentArgsRest(__VLS_373));
var __VLS_371;
const __VLS_376 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_377 = __VLS_asFunctionalComponent(__VLS_376, new __VLS_376({
    label: "API Key",
    required: (__VLS_ctx.keyDialogMode === 'create'),
}));
const __VLS_378 = __VLS_377({
    label: "API Key",
    required: (__VLS_ctx.keyDialogMode === 'create'),
}, ...__VLS_functionalComponentArgsRest(__VLS_377));
__VLS_379.slots.default;
const __VLS_380 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_381 = __VLS_asFunctionalComponent(__VLS_380, new __VLS_380({
    modelValue: (__VLS_ctx.keyForm.plainKey),
    placeholder: (__VLS_ctx.keyDialogMode === 'edit' ? '留空则不修改' : 'sk-...'),
    type: "password",
    showPassword: true,
}));
const __VLS_382 = __VLS_381({
    modelValue: (__VLS_ctx.keyForm.plainKey),
    placeholder: (__VLS_ctx.keyDialogMode === 'edit' ? '留空则不修改' : 'sk-...'),
    type: "password",
    showPassword: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_381));
var __VLS_379;
const __VLS_384 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_385 = __VLS_asFunctionalComponent(__VLS_384, new __VLS_384({
    label: "启用",
}));
const __VLS_386 = __VLS_385({
    label: "启用",
}, ...__VLS_functionalComponentArgsRest(__VLS_385));
__VLS_387.slots.default;
const __VLS_388 = {}.ElSwitch;
/** @type {[typeof __VLS_components.ElSwitch, typeof __VLS_components.elSwitch, ]} */ ;
// @ts-ignore
const __VLS_389 = __VLS_asFunctionalComponent(__VLS_388, new __VLS_388({
    modelValue: (__VLS_ctx.keyForm.isEnabled),
}));
const __VLS_390 = __VLS_389({
    modelValue: (__VLS_ctx.keyForm.isEnabled),
}, ...__VLS_functionalComponentArgsRest(__VLS_389));
var __VLS_387;
const __VLS_392 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_393 = __VLS_asFunctionalComponent(__VLS_392, new __VLS_392({
    label: "轮换序",
}));
const __VLS_394 = __VLS_393({
    label: "轮换序",
}, ...__VLS_functionalComponentArgsRest(__VLS_393));
__VLS_395.slots.default;
const __VLS_396 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_397 = __VLS_asFunctionalComponent(__VLS_396, new __VLS_396({
    modelValue: (__VLS_ctx.keyForm.rotationOrder),
    min: (0),
}));
const __VLS_398 = __VLS_397({
    modelValue: (__VLS_ctx.keyForm.rotationOrder),
    min: (0),
}, ...__VLS_functionalComponentArgsRest(__VLS_397));
var __VLS_395;
var __VLS_367;
{
    const { footer: __VLS_thisSlot } = __VLS_363.slots;
    const __VLS_400 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_401 = __VLS_asFunctionalComponent(__VLS_400, new __VLS_400({
        ...{ 'onClick': {} },
    }));
    const __VLS_402 = __VLS_401({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_401));
    let __VLS_404;
    let __VLS_405;
    let __VLS_406;
    const __VLS_407 = {
        onClick: (...[$event]) => {
            __VLS_ctx.keyDialogVisible = false;
        }
    };
    __VLS_403.slots.default;
    var __VLS_403;
    const __VLS_408 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_409 = __VLS_asFunctionalComponent(__VLS_408, new __VLS_408({
        ...{ 'onClick': {} },
        type: "primary",
    }));
    const __VLS_410 = __VLS_409({
        ...{ 'onClick': {} },
        type: "primary",
    }, ...__VLS_functionalComponentArgsRest(__VLS_409));
    let __VLS_412;
    let __VLS_413;
    let __VLS_414;
    const __VLS_415 = {
        onClick: (__VLS_ctx.saveKey)
    };
    __VLS_411.slots.default;
    var __VLS_411;
}
var __VLS_363;
const __VLS_416 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_417 = __VLS_asFunctionalComponent(__VLS_416, new __VLS_416({
    modelValue: (__VLS_ctx.testDialogVisible),
    title: "Key 连通测试",
    width: "520px",
}));
const __VLS_418 = __VLS_417({
    modelValue: (__VLS_ctx.testDialogVisible),
    title: "Key 连通测试",
    width: "520px",
}, ...__VLS_functionalComponentArgsRest(__VLS_417));
__VLS_419.slots.default;
const __VLS_420 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_421 = __VLS_asFunctionalComponent(__VLS_420, new __VLS_420({
    model: (__VLS_ctx.testForm),
    labelWidth: "110px",
    labelPosition: "right",
}));
const __VLS_422 = __VLS_421({
    model: (__VLS_ctx.testForm),
    labelWidth: "110px",
    labelPosition: "right",
}, ...__VLS_functionalComponentArgsRest(__VLS_421));
__VLS_423.slots.default;
const __VLS_424 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_425 = __VLS_asFunctionalComponent(__VLS_424, new __VLS_424({
    label: "Endpoint",
    required: true,
}));
const __VLS_426 = __VLS_425({
    label: "Endpoint",
    required: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_425));
__VLS_427.slots.default;
const __VLS_428 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_429 = __VLS_asFunctionalComponent(__VLS_428, new __VLS_428({
    modelValue: (__VLS_ctx.testForm.endpoint),
    placeholder: "https://api.openai.com/v1",
}));
const __VLS_430 = __VLS_429({
    modelValue: (__VLS_ctx.testForm.endpoint),
    placeholder: "https://api.openai.com/v1",
}, ...__VLS_functionalComponentArgsRest(__VLS_429));
var __VLS_427;
const __VLS_432 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_433 = __VLS_asFunctionalComponent(__VLS_432, new __VLS_432({
    label: "Model Code",
    required: true,
}));
const __VLS_434 = __VLS_433({
    label: "Model Code",
    required: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_433));
__VLS_435.slots.default;
const __VLS_436 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_437 = __VLS_asFunctionalComponent(__VLS_436, new __VLS_436({
    modelValue: (__VLS_ctx.testForm.modelCode),
    placeholder: "gpt-4o-mini",
}));
const __VLS_438 = __VLS_437({
    modelValue: (__VLS_ctx.testForm.modelCode),
    placeholder: "gpt-4o-mini",
}, ...__VLS_functionalComponentArgsRest(__VLS_437));
var __VLS_435;
const __VLS_440 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_441 = __VLS_asFunctionalComponent(__VLS_440, new __VLS_440({
    label: "Prompt",
}));
const __VLS_442 = __VLS_441({
    label: "Prompt",
}, ...__VLS_functionalComponentArgsRest(__VLS_441));
__VLS_443.slots.default;
const __VLS_444 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_445 = __VLS_asFunctionalComponent(__VLS_444, new __VLS_444({
    modelValue: (__VLS_ctx.testForm.prompt),
    type: "textarea",
    rows: (2),
}));
const __VLS_446 = __VLS_445({
    modelValue: (__VLS_ctx.testForm.prompt),
    type: "textarea",
    rows: (2),
}, ...__VLS_functionalComponentArgsRest(__VLS_445));
var __VLS_443;
var __VLS_423;
if (__VLS_ctx.testResult?.ok) {
    const __VLS_448 = {}.ElAlert;
    /** @type {[typeof __VLS_components.ElAlert, typeof __VLS_components.elAlert, ]} */ ;
    // @ts-ignore
    const __VLS_449 = __VLS_asFunctionalComponent(__VLS_448, new __VLS_448({
        type: "success",
        showIcon: true,
        closable: (false),
        title: (`通过 · ${__VLS_ctx.testResult.outputChars} 字 · ${__VLS_ctx.testResult.elapsedMs}ms`),
    }));
    const __VLS_450 = __VLS_449({
        type: "success",
        showIcon: true,
        closable: (false),
        title: (`通过 · ${__VLS_ctx.testResult.outputChars} 字 · ${__VLS_ctx.testResult.elapsedMs}ms`),
    }, ...__VLS_functionalComponentArgsRest(__VLS_449));
}
else if (__VLS_ctx.testResult && !__VLS_ctx.testResult.ok) {
    const __VLS_452 = {}.ElAlert;
    /** @type {[typeof __VLS_components.ElAlert, typeof __VLS_components.elAlert, ]} */ ;
    // @ts-ignore
    const __VLS_453 = __VLS_asFunctionalComponent(__VLS_452, new __VLS_452({
        type: "error",
        showIcon: true,
        closable: (false),
        title: (__VLS_ctx.testResult.error || '失败'),
        description: (`耗时 ${__VLS_ctx.testResult.elapsedMs}ms`),
    }));
    const __VLS_454 = __VLS_453({
        type: "error",
        showIcon: true,
        closable: (false),
        title: (__VLS_ctx.testResult.error || '失败'),
        description: (`耗时 ${__VLS_ctx.testResult.elapsedMs}ms`),
    }, ...__VLS_functionalComponentArgsRest(__VLS_453));
}
{
    const { footer: __VLS_thisSlot } = __VLS_419.slots;
    const __VLS_456 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_457 = __VLS_asFunctionalComponent(__VLS_456, new __VLS_456({
        ...{ 'onClick': {} },
    }));
    const __VLS_458 = __VLS_457({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_457));
    let __VLS_460;
    let __VLS_461;
    let __VLS_462;
    const __VLS_463 = {
        onClick: (...[$event]) => {
            __VLS_ctx.testDialogVisible = false;
        }
    };
    __VLS_459.slots.default;
    var __VLS_459;
    const __VLS_464 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_465 = __VLS_asFunctionalComponent(__VLS_464, new __VLS_464({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.testRunning),
    }));
    const __VLS_466 = __VLS_465({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.testRunning),
    }, ...__VLS_functionalComponentArgsRest(__VLS_465));
    let __VLS_468;
    let __VLS_469;
    let __VLS_470;
    const __VLS_471 = {
        onClick: (__VLS_ctx.runTest)
    };
    __VLS_467.slots.default;
    var __VLS_467;
}
var __VLS_419;
/** @type {__VLS_StyleScopedClasses['ai-models']} */ ;
/** @type {__VLS_StyleScopedClasses['header']} */ ;
/** @type {__VLS_StyleScopedClasses['title']} */ ;
/** @type {__VLS_StyleScopedClasses['hint']} */ ;
/** @type {__VLS_StyleScopedClasses['layout']} */ ;
/** @type {__VLS_StyleScopedClasses['provider-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-head']} */ ;
/** @type {__VLS_StyleScopedClasses['provider-list']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['provider-item']} */ ;
/** @type {__VLS_StyleScopedClasses['provider-row']} */ ;
/** @type {__VLS_StyleScopedClasses['provider-name']} */ ;
/** @type {__VLS_StyleScopedClasses['provider-meta']} */ ;
/** @type {__VLS_StyleScopedClasses['code']} */ ;
/** @type {__VLS_StyleScopedClasses['counts']} */ ;
/** @type {__VLS_StyleScopedClasses['provider-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-head']} */ ;
/** @type {__VLS_StyleScopedClasses['default-endpoint']} */ ;
/** @type {__VLS_StyleScopedClasses['tab-toolbar']} */ ;
/** @type {__VLS_StyleScopedClasses['tab-toolbar']} */ ;
/** @type {__VLS_StyleScopedClasses['masked']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Edit: Edit,
            Delete: Delete,
            Plus: Plus,
            Promotion: Promotion,
            providers: providers,
            selectedProviderId: selectedProviderId,
            loadingProviders: loadingProviders,
            tab: tab,
            selectedProvider: selectedProvider,
            providerDialogVisible: providerDialogVisible,
            providerDialogMode: providerDialogMode,
            providerForm: providerForm,
            openCreateProvider: openCreateProvider,
            openEditProvider: openEditProvider,
            saveProvider: saveProvider,
            removeProvider: removeProvider,
            models: models,
            loadingModels: loadingModels,
            modelDialogVisible: modelDialogVisible,
            modelDialogMode: modelDialogMode,
            modelForm: modelForm,
            openCreateModel: openCreateModel,
            openEditModel: openEditModel,
            saveModel: saveModel,
            removeModel: removeModel,
            keys: keys,
            loadingKeys: loadingKeys,
            keyDialogVisible: keyDialogVisible,
            keyDialogMode: keyDialogMode,
            keyForm: keyForm,
            openCreateKey: openCreateKey,
            openEditKey: openEditKey,
            saveKey: saveKey,
            removeKey: removeKey,
            testDialogVisible: testDialogVisible,
            testForm: testForm,
            testResult: testResult,
            testRunning: testRunning,
            openTest: openTest,
            runTest: runTest,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
