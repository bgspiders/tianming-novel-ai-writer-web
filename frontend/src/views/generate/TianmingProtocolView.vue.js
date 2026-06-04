import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { Collection, DocumentChecked, MagicStick, Refresh } from '@element-plus/icons-vue';
import { storeToRefs } from 'pinia';
import { listProviderConfigs } from '@/api/modules/ai';
import { exportTianmingKnowledgeBase, getTianmingKnowledgeBaseFile, getTianmingKnowledgeBaseStatus, importTianmingKnowledgeBaseFile, listTianmingKnowledgeBaseFiles, listTianmingProtocols, runTianmingProtocol } from '@/api/modules/tianming';
import { useAiTestStore } from '@/stores/aiTest';
import { useWorkContextStore } from '@/stores/workContext';
const workContext = useWorkContextStore();
const aiStore = useAiTestStore();
const { form: aiForm } = storeToRefs(aiStore);
const protocols = ref([]);
const knowledgeFiles = ref([]);
const result = ref(null);
const activeKnowledgeFile = ref(null);
const knowledgeStatus = ref(null);
const loading = ref(false);
const loadingKnowledge = ref(false);
const loadingConfigs = ref(false);
const configs = ref([]);
const selectedConfigId = ref('');
const selectedKey = ref('initialize');
const selectedKnowledgeKey = ref('world_stone');
const stepResults = reactive({});
const form = reactive({
    chapterNumber: 1,
    startChapterNumber: 1,
    endChapterNumber: 10,
    prompt: '',
    systemPrompt: '你是天命长篇小说系统。严格遵守当前协议输出。',
    temperature: 0.8,
    maxTokens: 4096,
    saveToChapter: false
});
const importForm = reactive({
    content: ''
});
const selectedProtocol = computed(() => protocols.value.find((item) => item.key === selectedKey.value) ?? protocols.value[0]);
const selectedConfig = computed(() => configs.value.find((item) => item.providerId === selectedConfigId.value) ?? null);
const workflowSteps = computed(() => {
    const order = ['initialize', 'outline', 'plan', 'directory', 'draft', 'manifest', 'health_check', 'archive'];
    return order
        .map((key, index) => {
        const protocol = protocols.value.find((item) => item.key === key);
        return protocol
            ? {
                index: index + 1,
                key,
                label: protocol.label,
                command: protocol.command,
                apiId: protocol.apiId,
                description: protocol.description,
                result: stepResults[key] ?? null
            }
            : null;
    })
        .filter(Boolean);
});
async function loadProtocols() {
    protocols.value = await listTianmingProtocols();
    if (!protocols.value.some((item) => item.key === selectedKey.value)) {
        selectedKey.value = protocols.value[0]?.key ?? 'initialize';
    }
}
async function loadKnowledgeFiles() {
    knowledgeFiles.value = await listTianmingKnowledgeBaseFiles();
    if (!knowledgeFiles.value.some((item) => item.key === selectedKnowledgeKey.value)) {
        selectedKnowledgeKey.value = knowledgeFiles.value[0]?.key ?? 'world_stone';
    }
}
async function refreshKnowledgeStatus() {
    if (!workContext.selectedProjectId)
        return;
    knowledgeStatus.value = await getTianmingKnowledgeBaseStatus(workContext.selectedProjectId, workContext.selectedProject?.currentSourceBookId ?? null);
}
async function loadConfigs() {
    loadingConfigs.value = true;
    try {
        configs.value = (await listProviderConfigs()).filter((item) => item.isEnabled);
        selectedConfigId.value = configs.value[0]?.providerId ?? '';
        applyConfig();
    }
    finally {
        loadingConfigs.value = false;
    }
}
function applyConfig() {
    const config = selectedConfig.value;
    if (!config)
        return;
    if (config.defaultEndpoint)
        aiForm.value.endpoint = config.defaultEndpoint;
    if (config.modelCode)
        aiForm.value.model = config.modelCode;
}
async function runProtocol(key = selectedKey.value) {
    if (!workContext.selectedProjectId) {
        ElMessage.warning('请先选择项目。');
        return;
    }
    selectedKey.value = key;
    const protocol = selectedProtocol.value;
    loading.value = true;
    result.value = null;
    try {
        result.value = await runTianmingProtocol({
            command: protocol?.command ?? key,
            projectId: workContext.selectedProjectId,
            sourceBookId: workContext.selectedProject?.currentSourceBookId ?? null,
            volumeId: workContext.selectedVolumeId || null,
            chapterNumber: form.chapterNumber,
            startChapterNumber: form.startChapterNumber,
            endChapterNumber: form.endChapterNumber,
            prompt: form.prompt.trim() || null,
            systemPrompt: form.systemPrompt.trim() || null,
            configId: selectedConfigId.value || null,
            providerId: selectedConfigId.value || null,
            endpoint: aiForm.value.endpoint || null,
            model: aiForm.value.model || null,
            apiKey: aiForm.value.apiKey || null,
            temperature: form.temperature,
            maxTokens: form.maxTokens,
            saveToChapter: form.saveToChapter
        });
        stepResults[key] = result.value;
        aiStore.saveToStorage();
        if (result.value.status === 'fatal') {
            ElMessage.error('协议门禁未通过。');
        }
        else {
            ElMessage.success('协议执行完成。');
        }
    }
    catch (err) {
        ElMessage.error(err.message || '协议执行失败。');
    }
    finally {
        loading.value = false;
    }
}
async function runWorkflowUntil(targetKey) {
    const steps = workflowSteps.value;
    const targetIndex = steps.findIndex((item) => item.key === targetKey);
    if (targetIndex < 0)
        return;
    for (const step of steps.slice(0, targetIndex + 1)) {
        await runProtocol(step.key);
        if (result.value?.status === 'fatal')
            break;
    }
}
function getStepState(step) {
    if (selectedKey.value === step.key && loading.value)
        return 'running';
    if (!step.result)
        return 'waiting';
    if (step.result.status === 'fatal')
        return 'fatal';
    if (step.result.status === 'missing')
        return 'missing';
    return 'done';
}
async function loadKnowledgeFile(key = selectedKnowledgeKey.value) {
    if (!workContext.selectedProjectId) {
        ElMessage.warning('请先选择项目。');
        return;
    }
    loadingKnowledge.value = true;
    selectedKnowledgeKey.value = key;
    try {
        activeKnowledgeFile.value = await getTianmingKnowledgeBaseFile(key, workContext.selectedProjectId, workContext.selectedProject?.currentSourceBookId ?? null);
        importForm.content = activeKnowledgeFile.value.content;
        await refreshKnowledgeStatus();
        ElMessage.success(`已生成《${activeKnowledgeFile.value.fileName}》`);
    }
    catch (err) {
        ElMessage.error(err.message || '生成知识库文件失败。');
    }
    finally {
        loadingKnowledge.value = false;
    }
}
async function importCurrentKnowledgeFile() {
    if (!workContext.selectedProjectId) {
        ElMessage.warning('请先选择项目。');
        return;
    }
    if (!importForm.content.trim()) {
        ElMessage.warning('导入内容不能为空。');
        return;
    }
    loadingKnowledge.value = true;
    try {
        activeKnowledgeFile.value = await importTianmingKnowledgeBaseFile({
            projectId: workContext.selectedProjectId,
            sourceBookId: workContext.selectedProject?.currentSourceBookId ?? null,
            key: selectedKnowledgeKey.value,
            content: importForm.content
        });
        await refreshKnowledgeStatus();
        ElMessage.success(`已绑定《${activeKnowledgeFile.value.fileName}》`);
    }
    catch (err) {
        ElMessage.error(err.message || '导入知识库文件失败。');
    }
    finally {
        loadingKnowledge.value = false;
    }
}
async function exportAllKnowledgeFiles() {
    if (!workContext.selectedProjectId) {
        ElMessage.warning('请先选择项目。');
        return;
    }
    loadingKnowledge.value = true;
    try {
        const files = await exportTianmingKnowledgeBase(workContext.selectedProjectId, workContext.selectedProject?.currentSourceBookId ?? null);
        activeKnowledgeFile.value = {
            key: 'all',
            fileName: '天命知识库五件套.md',
            title: '天命知识库五件套',
            description: '五件套合并预览',
            isBound: files.every((item) => item.isBound),
            isMissing: files.some((item) => item.isMissing),
            characterCount: files.reduce((sum, item) => sum + item.characterCount, 0),
            generatedAt: new Date().toISOString(),
            content: files.map((item) => `<!-- ${item.fileName} -->\n\n${item.content}`).join('\n\n---\n\n')
        };
        ElMessage.success('五件套已生成。');
    }
    catch (err) {
        ElMessage.error(err.message || '导出知识库失败。');
    }
    finally {
        loadingKnowledge.value = false;
    }
}
onMounted(async () => {
    aiStore.loadFromStorage();
    await workContext.init();
    await Promise.all([loadProtocols(), loadKnowledgeFiles(), loadConfigs()]);
    await refreshKnowledgeStatus();
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['flow-step']} */ ;
/** @type {__VLS_StyleScopedClasses['flow-step']} */ ;
/** @type {__VLS_StyleScopedClasses['flow-step']} */ ;
/** @type {__VLS_StyleScopedClasses['flow-step']} */ ;
/** @type {__VLS_StyleScopedClasses['flow-step']} */ ;
/** @type {__VLS_StyleScopedClasses['step-copy']} */ ;
/** @type {__VLS_StyleScopedClasses['step-copy']} */ ;
/** @type {__VLS_StyleScopedClasses['step-run']} */ ;
/** @type {__VLS_StyleScopedClasses['protocol-list']} */ ;
/** @type {__VLS_StyleScopedClasses['protocol-item']} */ ;
/** @type {__VLS_StyleScopedClasses['protocol-item']} */ ;
/** @type {__VLS_StyleScopedClasses['protocol-item']} */ ;
/** @type {__VLS_StyleScopedClasses['protocol-item']} */ ;
/** @type {__VLS_StyleScopedClasses['protocol-item']} */ ;
/** @type {__VLS_StyleScopedClasses['protocol-item']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-title']} */ ;
/** @type {__VLS_StyleScopedClasses['gate-summary']} */ ;
/** @type {__VLS_StyleScopedClasses['gate-summary']} */ ;
/** @type {__VLS_StyleScopedClasses['fatal']} */ ;
/** @type {__VLS_StyleScopedClasses['gate-summary']} */ ;
/** @type {__VLS_StyleScopedClasses['flow-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['workspace']} */ ;
/** @type {__VLS_StyleScopedClasses['page-head']} */ ;
/** @type {__VLS_StyleScopedClasses['head-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['actions']} */ ;
/** @type {__VLS_StyleScopedClasses['flow-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['form-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['kb-toolbar']} */ ;
/** @type {__VLS_StyleScopedClasses['gate-summary']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.main, __VLS_intrinsicElements.main)({
    ...{ class: "tm-protocol" },
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
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "head-actions" },
});
const __VLS_0 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ 'onClick': {} },
    icon: (__VLS_ctx.Refresh),
    loading: (__VLS_ctx.loading),
}));
const __VLS_2 = __VLS_1({
    ...{ 'onClick': {} },
    icon: (__VLS_ctx.Refresh),
    loading: (__VLS_ctx.loading),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
let __VLS_4;
let __VLS_5;
let __VLS_6;
const __VLS_7 = {
    onClick: (...[$event]) => {
        __VLS_ctx.runWorkflowUntil('archive');
    }
};
__VLS_3.slots.default;
var __VLS_3;
const __VLS_8 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    ...{ 'onClick': {} },
    type: "primary",
    icon: (__VLS_ctx.Refresh),
    loading: (__VLS_ctx.loading),
}));
const __VLS_10 = __VLS_9({
    ...{ 'onClick': {} },
    type: "primary",
    icon: (__VLS_ctx.Refresh),
    loading: (__VLS_ctx.loading),
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
let __VLS_12;
let __VLS_13;
let __VLS_14;
const __VLS_15 = {
    onClick: (...[$event]) => {
        __VLS_ctx.runProtocol();
    }
};
__VLS_11.slots.default;
var __VLS_11;
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "flow-panel" },
});
for (const [step] of __VLS_getVForSourceType((__VLS_ctx.workflowSteps))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.article, __VLS_intrinsicElements.article)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.selectedKey = step.key;
            } },
        key: (step.key),
        ...{ class: "flow-step" },
        ...{ class: ([__VLS_ctx.getStepState(step), { active: __VLS_ctx.selectedKey === step.key }]) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "step-index" },
    });
    (step.index);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "step-copy" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (step.label);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (step.command);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.runWorkflowUntil(step.key);
            } },
        ...{ class: "step-run" },
        type: "button",
    });
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "workspace" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.aside, __VLS_intrinsicElements.aside)({
    ...{ class: "protocol-list" },
});
for (const [item] of __VLS_getVForSourceType((__VLS_ctx.protocols))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.selectedKey = item.key;
            } },
        key: (item.key),
        ...{ class: "protocol-item" },
        ...{ class: ({ active: __VLS_ctx.selectedKey === item.key }) },
        type: "button",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (item.label);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
    (item.apiId);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "panel" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "panel-title" },
});
const __VLS_16 = {}.ElIcon;
/** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({}));
const __VLS_18 = __VLS_17({}, ...__VLS_functionalComponentArgsRest(__VLS_17));
__VLS_19.slots.default;
const __VLS_20 = {}.Collection;
/** @type {[typeof __VLS_components.Collection, ]} */ ;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({}));
const __VLS_22 = __VLS_21({}, ...__VLS_functionalComponentArgsRest(__VLS_21));
var __VLS_19;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.selectedProtocol?.label ?? '协议');
__VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
(__VLS_ctx.selectedProtocol?.command);
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "protocol-desc" },
});
(__VLS_ctx.selectedProtocol?.description);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "gate-summary" },
    ...{ class: (__VLS_ctx.result?.status === 'fatal' ? 'fatal' : '') },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.result?.status ?? '未执行');
__VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
const __VLS_24 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
    labelPosition: "top",
    ...{ class: "form-grid" },
}));
const __VLS_26 = __VLS_25({
    labelPosition: "top",
    ...{ class: "form-grid" },
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
__VLS_27.slots.default;
const __VLS_28 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
    label: "项目",
}));
const __VLS_30 = __VLS_29({
    label: "项目",
}, ...__VLS_functionalComponentArgsRest(__VLS_29));
__VLS_31.slots.default;
const __VLS_32 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
    modelValue: (__VLS_ctx.workContext.selectedProject?.name ?? '未选择项目'),
    readonly: true,
}));
const __VLS_34 = __VLS_33({
    modelValue: (__VLS_ctx.workContext.selectedProject?.name ?? '未选择项目'),
    readonly: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_33));
var __VLS_31;
const __VLS_36 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
    label: "章节号",
}));
const __VLS_38 = __VLS_37({
    label: "章节号",
}, ...__VLS_functionalComponentArgsRest(__VLS_37));
__VLS_39.slots.default;
const __VLS_40 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
    modelValue: (__VLS_ctx.form.chapterNumber),
    min: (1),
    controlsPosition: "right",
}));
const __VLS_42 = __VLS_41({
    modelValue: (__VLS_ctx.form.chapterNumber),
    min: (1),
    controlsPosition: "right",
}, ...__VLS_functionalComponentArgsRest(__VLS_41));
var __VLS_39;
const __VLS_44 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
    label: "目录起始章",
}));
const __VLS_46 = __VLS_45({
    label: "目录起始章",
}, ...__VLS_functionalComponentArgsRest(__VLS_45));
__VLS_47.slots.default;
const __VLS_48 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
    modelValue: (__VLS_ctx.form.startChapterNumber),
    min: (1),
    controlsPosition: "right",
}));
const __VLS_50 = __VLS_49({
    modelValue: (__VLS_ctx.form.startChapterNumber),
    min: (1),
    controlsPosition: "right",
}, ...__VLS_functionalComponentArgsRest(__VLS_49));
var __VLS_47;
const __VLS_52 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
    label: "目录结束章",
}));
const __VLS_54 = __VLS_53({
    label: "目录结束章",
}, ...__VLS_functionalComponentArgsRest(__VLS_53));
__VLS_55.slots.default;
const __VLS_56 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
    modelValue: (__VLS_ctx.form.endChapterNumber),
    min: (1),
    controlsPosition: "right",
}));
const __VLS_58 = __VLS_57({
    modelValue: (__VLS_ctx.form.endChapterNumber),
    min: (1),
    controlsPosition: "right",
}, ...__VLS_functionalComponentArgsRest(__VLS_57));
var __VLS_55;
const __VLS_60 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
    label: "AI 配置",
}));
const __VLS_62 = __VLS_61({
    label: "AI 配置",
}, ...__VLS_functionalComponentArgsRest(__VLS_61));
__VLS_63.slots.default;
const __VLS_64 = {}.ElSelect;
/** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
// @ts-ignore
const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.selectedConfigId),
    clearable: true,
    filterable: true,
    loading: (__VLS_ctx.loadingConfigs),
}));
const __VLS_66 = __VLS_65({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.selectedConfigId),
    clearable: true,
    filterable: true,
    loading: (__VLS_ctx.loadingConfigs),
}, ...__VLS_functionalComponentArgsRest(__VLS_65));
let __VLS_68;
let __VLS_69;
let __VLS_70;
const __VLS_71 = {
    onChange: (__VLS_ctx.applyConfig)
};
__VLS_67.slots.default;
for (const [item] of __VLS_getVForSourceType((__VLS_ctx.configs))) {
    const __VLS_72 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
        key: (item.providerId),
        label: (item.name),
        value: (item.providerId),
    }));
    const __VLS_74 = __VLS_73({
        key: (item.providerId),
        label: (item.name),
        value: (item.providerId),
    }, ...__VLS_functionalComponentArgsRest(__VLS_73));
}
var __VLS_67;
var __VLS_63;
const __VLS_76 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({
    label: "模型",
}));
const __VLS_78 = __VLS_77({
    label: "模型",
}, ...__VLS_functionalComponentArgsRest(__VLS_77));
__VLS_79.slots.default;
const __VLS_80 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
    modelValue: (__VLS_ctx.aiForm.model),
}));
const __VLS_82 = __VLS_81({
    modelValue: (__VLS_ctx.aiForm.model),
}, ...__VLS_functionalComponentArgsRest(__VLS_81));
var __VLS_79;
const __VLS_84 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({
    label: "Endpoint",
}));
const __VLS_86 = __VLS_85({
    label: "Endpoint",
}, ...__VLS_functionalComponentArgsRest(__VLS_85));
__VLS_87.slots.default;
const __VLS_88 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
    modelValue: (__VLS_ctx.aiForm.endpoint),
}));
const __VLS_90 = __VLS_89({
    modelValue: (__VLS_ctx.aiForm.endpoint),
}, ...__VLS_functionalComponentArgsRest(__VLS_89));
var __VLS_87;
const __VLS_92 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({
    label: "最大 Tokens",
}));
const __VLS_94 = __VLS_93({
    label: "最大 Tokens",
}, ...__VLS_functionalComponentArgsRest(__VLS_93));
__VLS_95.slots.default;
const __VLS_96 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
    modelValue: (__VLS_ctx.form.maxTokens),
    min: (1500),
    max: (30000),
    step: (500),
}));
const __VLS_98 = __VLS_97({
    modelValue: (__VLS_ctx.form.maxTokens),
    min: (1500),
    max: (30000),
    step: (500),
}, ...__VLS_functionalComponentArgsRest(__VLS_97));
var __VLS_95;
var __VLS_27;
const __VLS_100 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_101 = __VLS_asFunctionalComponent(__VLS_100, new __VLS_100({
    labelPosition: "top",
}));
const __VLS_102 = __VLS_101({
    labelPosition: "top",
}, ...__VLS_functionalComponentArgsRest(__VLS_101));
__VLS_103.slots.default;
const __VLS_104 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_105 = __VLS_asFunctionalComponent(__VLS_104, new __VLS_104({
    label: "系统提示词",
}));
const __VLS_106 = __VLS_105({
    label: "系统提示词",
}, ...__VLS_functionalComponentArgsRest(__VLS_105));
__VLS_107.slots.default;
const __VLS_108 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_109 = __VLS_asFunctionalComponent(__VLS_108, new __VLS_108({
    modelValue: (__VLS_ctx.form.systemPrompt),
    type: "textarea",
    rows: (2),
}));
const __VLS_110 = __VLS_109({
    modelValue: (__VLS_ctx.form.systemPrompt),
    type: "textarea",
    rows: (2),
}, ...__VLS_functionalComponentArgsRest(__VLS_109));
var __VLS_107;
const __VLS_112 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_113 = __VLS_asFunctionalComponent(__VLS_112, new __VLS_112({
    label: "补充指令",
}));
const __VLS_114 = __VLS_113({
    label: "补充指令",
}, ...__VLS_functionalComponentArgsRest(__VLS_113));
__VLS_115.slots.default;
const __VLS_116 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_117 = __VLS_asFunctionalComponent(__VLS_116, new __VLS_116({
    modelValue: (__VLS_ctx.form.prompt),
    type: "textarea",
    rows: (4),
    placeholder: "可选。正文协议会附加到生成提示里。",
}));
const __VLS_118 = __VLS_117({
    modelValue: (__VLS_ctx.form.prompt),
    type: "textarea",
    rows: (4),
    placeholder: "可选。正文协议会附加到生成提示里。",
}, ...__VLS_functionalComponentArgsRest(__VLS_117));
var __VLS_115;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "actions" },
});
const __VLS_120 = {}.ElCheckbox;
/** @type {[typeof __VLS_components.ElCheckbox, typeof __VLS_components.elCheckbox, typeof __VLS_components.ElCheckbox, typeof __VLS_components.elCheckbox, ]} */ ;
// @ts-ignore
const __VLS_121 = __VLS_asFunctionalComponent(__VLS_120, new __VLS_120({
    modelValue: (__VLS_ctx.form.saveToChapter),
}));
const __VLS_122 = __VLS_121({
    modelValue: (__VLS_ctx.form.saveToChapter),
}, ...__VLS_functionalComponentArgsRest(__VLS_121));
__VLS_123.slots.default;
var __VLS_123;
const __VLS_124 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({
    ...{ 'onClick': {} },
    type: "primary",
    icon: (__VLS_ctx.MagicStick),
    loading: (__VLS_ctx.loading),
}));
const __VLS_126 = __VLS_125({
    ...{ 'onClick': {} },
    type: "primary",
    icon: (__VLS_ctx.MagicStick),
    loading: (__VLS_ctx.loading),
}, ...__VLS_functionalComponentArgsRest(__VLS_125));
let __VLS_128;
let __VLS_129;
let __VLS_130;
const __VLS_131 = {
    onClick: (...[$event]) => {
        __VLS_ctx.runProtocol();
    }
};
__VLS_127.slots.default;
var __VLS_127;
var __VLS_103;
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "panel result-panel" },
});
const __VLS_132 = {}.ElTabs;
/** @type {[typeof __VLS_components.ElTabs, typeof __VLS_components.elTabs, typeof __VLS_components.ElTabs, typeof __VLS_components.elTabs, ]} */ ;
// @ts-ignore
const __VLS_133 = __VLS_asFunctionalComponent(__VLS_132, new __VLS_132({}));
const __VLS_134 = __VLS_133({}, ...__VLS_functionalComponentArgsRest(__VLS_133));
__VLS_135.slots.default;
const __VLS_136 = {}.ElTabPane;
/** @type {[typeof __VLS_components.ElTabPane, typeof __VLS_components.elTabPane, typeof __VLS_components.ElTabPane, typeof __VLS_components.elTabPane, ]} */ ;
// @ts-ignore
const __VLS_137 = __VLS_asFunctionalComponent(__VLS_136, new __VLS_136({
    label: "协议输出",
}));
const __VLS_138 = __VLS_137({
    label: "协议输出",
}, ...__VLS_functionalComponentArgsRest(__VLS_137));
__VLS_139.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "panel-title" },
});
const __VLS_140 = {}.ElIcon;
/** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
// @ts-ignore
const __VLS_141 = __VLS_asFunctionalComponent(__VLS_140, new __VLS_140({}));
const __VLS_142 = __VLS_141({}, ...__VLS_functionalComponentArgsRest(__VLS_141));
__VLS_143.slots.default;
const __VLS_144 = {}.DocumentChecked;
/** @type {[typeof __VLS_components.DocumentChecked, ]} */ ;
// @ts-ignore
const __VLS_145 = __VLS_asFunctionalComponent(__VLS_144, new __VLS_144({}));
const __VLS_146 = __VLS_145({}, ...__VLS_functionalComponentArgsRest(__VLS_145));
var __VLS_143;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.result?.title ?? '协议输出');
__VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
(__VLS_ctx.result?.status ?? 'idle');
__VLS_asFunctionalElement(__VLS_intrinsicElements.pre, __VLS_intrinsicElements.pre)({
    ...{ class: "result-output" },
});
(__VLS_ctx.result?.content ?? '选择协议并执行后，这里显示结果。');
var __VLS_139;
const __VLS_148 = {}.ElTabPane;
/** @type {[typeof __VLS_components.ElTabPane, typeof __VLS_components.elTabPane, typeof __VLS_components.ElTabPane, typeof __VLS_components.elTabPane, ]} */ ;
// @ts-ignore
const __VLS_149 = __VLS_asFunctionalComponent(__VLS_148, new __VLS_148({
    label: "知识库五件套",
}));
const __VLS_150 = __VLS_149({
    label: "知识库五件套",
}, ...__VLS_functionalComponentArgsRest(__VLS_149));
__VLS_151.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "panel-title" },
});
const __VLS_152 = {}.ElIcon;
/** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
// @ts-ignore
const __VLS_153 = __VLS_asFunctionalComponent(__VLS_152, new __VLS_152({}));
const __VLS_154 = __VLS_153({}, ...__VLS_functionalComponentArgsRest(__VLS_153));
__VLS_155.slots.default;
const __VLS_156 = {}.DocumentChecked;
/** @type {[typeof __VLS_components.DocumentChecked, ]} */ ;
// @ts-ignore
const __VLS_157 = __VLS_asFunctionalComponent(__VLS_156, new __VLS_156({}));
const __VLS_158 = __VLS_157({}, ...__VLS_functionalComponentArgsRest(__VLS_157));
var __VLS_155;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.activeKnowledgeFile?.fileName ?? '知识库文件');
__VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
(__VLS_ctx.knowledgeStatus?.allRequiredBound ? '已全部绑定' : '存在缺失');
if (__VLS_ctx.knowledgeStatus && !__VLS_ctx.knowledgeStatus.allRequiredBound) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "kb-alert" },
    });
    (__VLS_ctx.knowledgeStatus.missingRequiredFiles.join('、'));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "kb-toolbar" },
});
const __VLS_160 = {}.ElSelect;
/** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
// @ts-ignore
const __VLS_161 = __VLS_asFunctionalComponent(__VLS_160, new __VLS_160({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.selectedKnowledgeKey),
    size: "small",
}));
const __VLS_162 = __VLS_161({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.selectedKnowledgeKey),
    size: "small",
}, ...__VLS_functionalComponentArgsRest(__VLS_161));
let __VLS_164;
let __VLS_165;
let __VLS_166;
const __VLS_167 = {
    onChange: ((key) => __VLS_ctx.loadKnowledgeFile(key))
};
__VLS_163.slots.default;
for (const [item] of __VLS_getVForSourceType((__VLS_ctx.knowledgeFiles))) {
    const __VLS_168 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_169 = __VLS_asFunctionalComponent(__VLS_168, new __VLS_168({
        key: (item.key),
        label: (item.fileName),
        value: (item.key),
    }));
    const __VLS_170 = __VLS_169({
        key: (item.key),
        label: (item.fileName),
        value: (item.key),
    }, ...__VLS_functionalComponentArgsRest(__VLS_169));
}
var __VLS_163;
const __VLS_172 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_173 = __VLS_asFunctionalComponent(__VLS_172, new __VLS_172({
    ...{ 'onClick': {} },
    size: "small",
    loading: (__VLS_ctx.loadingKnowledge),
}));
const __VLS_174 = __VLS_173({
    ...{ 'onClick': {} },
    size: "small",
    loading: (__VLS_ctx.loadingKnowledge),
}, ...__VLS_functionalComponentArgsRest(__VLS_173));
let __VLS_176;
let __VLS_177;
let __VLS_178;
const __VLS_179 = {
    onClick: (...[$event]) => {
        __VLS_ctx.loadKnowledgeFile();
    }
};
__VLS_175.slots.default;
var __VLS_175;
const __VLS_180 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_181 = __VLS_asFunctionalComponent(__VLS_180, new __VLS_180({
    ...{ 'onClick': {} },
    size: "small",
    type: "primary",
    loading: (__VLS_ctx.loadingKnowledge),
}));
const __VLS_182 = __VLS_181({
    ...{ 'onClick': {} },
    size: "small",
    type: "primary",
    loading: (__VLS_ctx.loadingKnowledge),
}, ...__VLS_functionalComponentArgsRest(__VLS_181));
let __VLS_184;
let __VLS_185;
let __VLS_186;
const __VLS_187 = {
    onClick: (__VLS_ctx.exportAllKnowledgeFiles)
};
__VLS_183.slots.default;
var __VLS_183;
const __VLS_188 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_189 = __VLS_asFunctionalComponent(__VLS_188, new __VLS_188({
    ...{ 'onClick': {} },
    size: "small",
    type: "success",
    loading: (__VLS_ctx.loadingKnowledge),
}));
const __VLS_190 = __VLS_189({
    ...{ 'onClick': {} },
    size: "small",
    type: "success",
    loading: (__VLS_ctx.loadingKnowledge),
}, ...__VLS_functionalComponentArgsRest(__VLS_189));
let __VLS_192;
let __VLS_193;
let __VLS_194;
const __VLS_195 = {
    onClick: (__VLS_ctx.importCurrentKnowledgeFile)
};
__VLS_191.slots.default;
var __VLS_191;
const __VLS_196 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_197 = __VLS_asFunctionalComponent(__VLS_196, new __VLS_196({
    modelValue: (__VLS_ctx.importForm.content),
    ...{ class: "kb-import" },
    type: "textarea",
    rows: (6),
    placeholder: "可粘贴对应 Markdown 文件内容，然后点击导入绑定。",
}));
const __VLS_198 = __VLS_197({
    modelValue: (__VLS_ctx.importForm.content),
    ...{ class: "kb-import" },
    type: "textarea",
    rows: (6),
    placeholder: "可粘贴对应 Markdown 文件内容，然后点击导入绑定。",
}, ...__VLS_functionalComponentArgsRest(__VLS_197));
__VLS_asFunctionalElement(__VLS_intrinsicElements.pre, __VLS_intrinsicElements.pre)({
    ...{ class: "result-output" },
});
(__VLS_ctx.activeKnowledgeFile?.content ?? '选择文件后生成 Markdown 预览。');
var __VLS_151;
var __VLS_135;
/** @type {__VLS_StyleScopedClasses['tm-protocol']} */ ;
/** @type {__VLS_StyleScopedClasses['page-head']} */ ;
/** @type {__VLS_StyleScopedClasses['eyebrow']} */ ;
/** @type {__VLS_StyleScopedClasses['summary']} */ ;
/** @type {__VLS_StyleScopedClasses['head-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['flow-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['flow-step']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['step-index']} */ ;
/** @type {__VLS_StyleScopedClasses['step-copy']} */ ;
/** @type {__VLS_StyleScopedClasses['step-run']} */ ;
/** @type {__VLS_StyleScopedClasses['workspace']} */ ;
/** @type {__VLS_StyleScopedClasses['protocol-list']} */ ;
/** @type {__VLS_StyleScopedClasses['protocol-item']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-title']} */ ;
/** @type {__VLS_StyleScopedClasses['protocol-desc']} */ ;
/** @type {__VLS_StyleScopedClasses['gate-summary']} */ ;
/** @type {__VLS_StyleScopedClasses['form-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['actions']} */ ;
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
/** @type {__VLS_StyleScopedClasses['result-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-title']} */ ;
/** @type {__VLS_StyleScopedClasses['result-output']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-title']} */ ;
/** @type {__VLS_StyleScopedClasses['kb-alert']} */ ;
/** @type {__VLS_StyleScopedClasses['kb-toolbar']} */ ;
/** @type {__VLS_StyleScopedClasses['kb-import']} */ ;
/** @type {__VLS_StyleScopedClasses['result-output']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Collection: Collection,
            DocumentChecked: DocumentChecked,
            MagicStick: MagicStick,
            Refresh: Refresh,
            workContext: workContext,
            aiForm: aiForm,
            protocols: protocols,
            knowledgeFiles: knowledgeFiles,
            result: result,
            activeKnowledgeFile: activeKnowledgeFile,
            knowledgeStatus: knowledgeStatus,
            loading: loading,
            loadingKnowledge: loadingKnowledge,
            loadingConfigs: loadingConfigs,
            configs: configs,
            selectedConfigId: selectedConfigId,
            selectedKey: selectedKey,
            selectedKnowledgeKey: selectedKnowledgeKey,
            form: form,
            importForm: importForm,
            selectedProtocol: selectedProtocol,
            workflowSteps: workflowSteps,
            applyConfig: applyConfig,
            runProtocol: runProtocol,
            runWorkflowUntil: runWorkflowUntil,
            getStepState: getStepState,
            loadKnowledgeFile: loadKnowledgeFile,
            importCurrentKnowledgeFile: importCurrentKnowledgeFile,
            exportAllKnowledgeFiles: exportAllKnowledgeFiles,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
