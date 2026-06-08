import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { MagicStick, Notebook, Cpu, DocumentAdd, CollectionTag } from '@element-plus/icons-vue';
import { storeToRefs } from 'pinia';
import { listProviderConfigs } from '@/api/modules/ai';
import { confirmNovelSeedWorkflowStep, createNovelSeedWorkflow, deleteNovelSeedWorkflow, getNovelSeedWorkflow, listNovelSeedWorkflows, previewNovelSeedWorkflowStep, rewriteNovelSeedWorkflowStepFragment, runNovelSeedWorkflowStep, updateNovelSeedWorkflowRequest } from '@/api/modules/novelSeed';
import { chatHub } from '@/signalr/chat';
import { useAiTestStore } from '@/stores/aiTest';
const aiStore = useAiTestStore();
const { form: aiForm } = storeToRefs(aiStore);
const configs = ref([]);
const selectedConfigId = ref('');
const loadingConfigs = ref(false);
const workflow = ref(null);
const workflows = ref([]);
const currentRunId = ref('');
const streamText = ref('');
const streamStatus = ref('idle');
const streamError = ref('');
const runEvents = ref([]);
const workflowCreating = ref(false);
const workflowStepRunning = ref('');
const workflowUpdating = ref(false);
const loadingWorkflows = ref(false);
const previewLoading = ref(false);
const previewDrawer = ref(false);
const stepPreview = ref(null);
const rewriteDialog = ref(false);
const rewriteLoading = ref(false);
const rewriteTarget = ref(null);
const rewriteInstruction = ref('');
const autoPreviewStepKey = ref('');
const agentPrompt = ref('');
const agentMessages = ref([]);
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
const totalChapters = computed(() => form.volumeCount * form.chaptersPerVolume);
const estimatedTotalWords = computed(() => totalChapters.value * form.estimatedWordsPerChapter);
const finalizeProgress = computed(() => {
    let current = workflowStepRunning.value === 'finalize' ? 1 : 0;
    let total = 5;
    for (const event of runEvents.value) {
        const data = event.data;
        if (typeof data?.step === 'number')
            current = Math.max(current, data.step);
        if (typeof data?.total === 'number')
            total = Math.max(total, data.total);
    }
    return Math.min(100, Math.round((current / total) * 100));
});
const hasLiveProgress = computed(() => streamText.value || streamError.value || runEvents.value.length > 0 || workflowStepRunning.value === 'finalize');
function stepOutputLength(stepKey) {
    const step = findWorkflowStep(stepKey);
    return step?.output?.trim().length ?? 0;
}
function nextRunnableStepTitle(stepKey) {
    if (!workflow.value)
        return '';
    const current = workflow.value.steps.find((item) => item.stepKey === stepKey);
    if (!current)
        return '';
    return workflow.value.steps.find((item) => item.sortOrder > current.sortOrder && item.status !== 'completed')?.title ?? '';
}
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
async function loadWorkflows() {
    loadingWorkflows.value = true;
    try {
        workflows.value = await listNovelSeedWorkflows(20);
        if (workflow.value && !workflows.value.some((item) => item.id === workflow.value?.id)) {
            workflow.value = null;
        }
    }
    catch (err) {
        ElMessage.error(err.message || '加载分步工作流失败。');
    }
    finally {
        loadingWorkflows.value = false;
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
function validateAgentForm() {
    if (!form.description.trim()) {
        ElMessage.warning('请先输入小说描述。');
        return false;
    }
    if (!aiForm.value.endpoint || !aiForm.value.model) {
        ElMessage.warning('请填写 Endpoint 和模型。');
        return false;
    }
    if (!selectedConfigId.value && !aiForm.value.apiKey) {
        ElMessage.warning('请选择已保存配置，或填写临时 API Key。');
        return false;
    }
    return true;
}
async function submit() {
    await startAgent();
}
async function startAgent() {
    if (workflowCreating.value || workflowStepRunning.value)
        return;
    if (!validateAgentForm())
        return;
    streamText.value = '';
    streamError.value = '';
    streamStatus.value = 'agent';
    workflowCreating.value = true;
    try {
        workflow.value = await createNovelSeedWorkflow({
            request: buildNovelSeedRequest(null)
        });
        await loadWorkflows();
        aiStore.saveToStorage();
        ElMessage.success('已启动开书 Agent，正在生成第一步产物。');
        await runWorkflowStep('story', { preview: true });
    }
    catch (err) {
        ElMessage.error(err.message || '启动开书 Agent 失败。');
    }
    finally {
        workflowCreating.value = false;
    }
}
function buildNovelSeedRequest(runId) {
    return {
        runId: runId ?? '',
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
    };
}
function syncFormFromWorkflow(item) {
    const request = item.request;
    form.description = request.description || '';
    form.genre = request.genre || '';
    form.tone = request.tone || '';
    form.targetAudience = request.targetAudience || '';
    form.volumeCount = request.volumeCount;
    form.chaptersPerVolume = request.chaptersPerVolume;
    form.initialChapterPlanCount = request.initialChapterPlanCount;
    form.estimatedWordsPerChapter = request.estimatedWordsPerChapter;
    form.createChapters = request.createChapters;
    form.createDesignData = request.createDesignData;
    form.temperature = request.temperature ?? form.temperature;
    form.maxTokens = request.maxTokens ?? form.maxTokens;
    selectedConfigId.value = request.providerId || request.configId || selectedConfigId.value;
    if (request.endpoint)
        aiForm.value.endpoint = request.endpoint;
    if (request.model)
        aiForm.value.model = request.model;
}
async function updateWorkflowRequest() {
    if (!workflow.value || workflowUpdating.value)
        return;
    if (!validateAgentForm())
        return;
    workflowUpdating.value = true;
    try {
        workflow.value = await updateNovelSeedWorkflowRequest(workflow.value.id, {
            request: buildNovelSeedRequest(null)
        });
        await loadWorkflows();
        aiStore.saveToStorage();
        ElMessage.success('已更新 Agent 参数，并重置步骤产物。');
    }
    catch (err) {
        ElMessage.error(err.message || '更新 Agent 参数失败。');
    }
    finally {
        workflowUpdating.value = false;
    }
}
function applyAgentInstruction(text) {
    const normalized = text.replace(/\s+/g, '');
    const totalMatch = normalized.match(/(?:总章数|目标章数|生成|写|规划)(\d+)章/);
    if (totalMatch) {
        const total = Math.max(1, Number(totalMatch[1]));
        form.chaptersPerVolume = Math.max(1, Math.ceil(total / Math.max(1, form.volumeCount)));
        form.initialChapterPlanCount = Math.min(500, Math.max(1, total));
    }
    const volumeMatch = normalized.match(/(?:卷数|分成|分为)(\d+)卷/);
    if (volumeMatch) {
        form.volumeCount = Math.min(200, Math.max(1, Number(volumeMatch[1])));
    }
    const chaptersPerVolumeMatch = normalized.match(/(?:每卷|单卷)(\d+)章/);
    if (chaptersPerVolumeMatch) {
        form.chaptersPerVolume = Math.min(500, Math.max(1, Number(chaptersPerVolumeMatch[1])));
    }
    const firstBatchMatch = normalized.match(/(?:首批|先规划|先生成)(\d+)章/);
    if (firstBatchMatch) {
        form.initialChapterPlanCount = Math.min(500, Math.max(1, Number(firstBatchMatch[1])));
    }
    const wordsMatch = normalized.match(/(?:每章|章均)(\d+)(?:字|词)/);
    if (wordsMatch) {
        form.estimatedWordsPerChapter = Math.min(20000, Math.max(1000, Number(wordsMatch[1])));
    }
    const tokenMatch = normalized.match(/(?:tokens|token|规划tokens|规划token)(\d+)/i);
    if (tokenMatch) {
        form.maxTokens = Math.min(30000, Math.max(1500, Number(tokenMatch[1])));
    }
    form.description = `${form.description.trim()}\n\nAgent 追加要求：${text}`.trim();
}
async function submitAgentPrompt() {
    const text = agentPrompt.value.trim();
    if (!text)
        return;
    agentMessages.value.push({ role: 'user', content: text });
    applyAgentInstruction(text);
    agentPrompt.value = '';
    if (workflow.value) {
        await updateWorkflowRequest();
        agentMessages.value.push({
            role: 'agent',
            content: `已更新当前 Agent：目标 ${totalChapters.value} 章，首批规划 ${form.initialChapterPlanCount} 章，章均 ${form.estimatedWordsPerChapter} 字。步骤产物已重置，请重新运行。`
        });
    }
    else {
        agentMessages.value.push({
            role: 'agent',
            content: `已写入开书要求：目标 ${totalChapters.value} 章，首批规划 ${form.initialChapterPlanCount} 章。点击“启动开书 Agent”开始生成。`
        });
    }
}
async function runWorkflowStep(stepKey, options = {}) {
    if (!workflow.value)
        return;
    workflowStepRunning.value = stepKey;
    const runId = workflow.value.request.runId?.trim() || `seed_${workflow.value.id}_${stepKey}`;
    currentRunId.value = runId;
    streamText.value = '';
    streamError.value = '';
    runEvents.value = [];
    streamStatus.value = 'connecting';
    try {
        await chatHub.joinRun(runId);
        await runNovelSeedWorkflowStep(workflow.value.id, stepKey);
        workflow.value = await getNovelSeedWorkflow(workflow.value.id);
        await loadWorkflows();
        const step = workflow.value.steps.find((item) => item.stepKey === stepKey);
        if (step?.output) {
            const nextTitle = nextRunnableStepTitle(stepKey);
            agentMessages.value.push({
                role: 'agent',
                content: stepKey === 'finalize'
                    ? `已完成「${step.title}」，正式项目数据已经写入数据库。章节计划、章节蓝图、伏笔账本和时间线已经生成，可以去“叙事追踪”查看伏笔和时间线。`
                    : `已自动保存到「${step.title}」步骤产物，当前 ${step.output.trim().length} 字。${nextTitle ? `下一步可以运行「${nextTitle}」。` : '全部步骤已完成，最后运行「落库生成项目」即可创建正式项目数据。'}`
            });
        }
        ElMessage.success(`${step?.title ?? stepKey} 已完成。`);
        if (options.preview || stepKey !== 'finalize') {
            autoPreviewStepKey.value = stepKey;
            await openStepPreview(stepKey);
        }
    }
    catch (err) {
        ElMessage.error(err.message || '运行工作流步骤失败。');
        if (workflow.value) {
            workflow.value = await getNovelSeedWorkflow(workflow.value.id);
            await loadWorkflows();
        }
    }
    finally {
        workflowStepRunning.value = '';
        if (workflow.value) {
            workflow.value = await getNovelSeedWorkflow(workflow.value.id);
            await loadWorkflows();
        }
        await chatHub.leaveRun(runId);
        currentRunId.value = '';
    }
}
async function confirmWorkflowStep(stepKey, confirmed) {
    if (!workflow.value)
        return;
    try {
        await confirmNovelSeedWorkflowStep(workflow.value.id, stepKey, confirmed);
        workflow.value = await getNovelSeedWorkflow(workflow.value.id);
        await loadWorkflows();
        ElMessage.success(confirmed ? '步骤产物已确认。' : '已取消确认。');
    }
    catch (err) {
        ElMessage.error(err.message || '确认步骤失败。');
    }
}
function findWorkflowStep(stepKey) {
    return workflow.value?.steps.find((item) => item.stepKey === stepKey) ?? null;
}
async function toggleWorkflowStepConfirmation(stepKey) {
    const step = findWorkflowStep(stepKey);
    if (!step)
        return;
    if (!step.output) {
        ElMessage.warning('当前步骤还没有产物，请先点击“运行”。');
        return;
    }
    if (step.status === 'running') {
        ElMessage.warning('当前步骤还在运行中，请等待完成后再确认。');
        return;
    }
    await confirmWorkflowStep(stepKey, !step.isConfirmed);
}
async function openStepPreview(stepKey) {
    if (!workflow.value)
        return;
    previewLoading.value = true;
    previewDrawer.value = true;
    try {
        stepPreview.value = await previewNovelSeedWorkflowStep(workflow.value.id, stepKey);
    }
    catch (err) {
        ElMessage.error(err.message || '加载结构化预览失败。');
    }
    finally {
        previewLoading.value = false;
    }
}
async function previewWorkflowStep(stepKey) {
    const step = findWorkflowStep(stepKey);
    if (!step)
        return;
    if (!step.output) {
        ElMessage.warning('当前步骤还没有产物，请先点击“运行”。');
        return;
    }
    await openStepPreview(stepKey);
}
function openRewriteDialog(item) {
    rewriteTarget.value = item;
    rewriteInstruction.value = '';
    rewriteDialog.value = true;
}
async function submitRewriteFragment() {
    if (!workflow.value || !stepPreview.value || !rewriteTarget.value)
        return;
    if (!rewriteInstruction.value.trim()) {
        ElMessage.warning('请输入重写要求。');
        return;
    }
    rewriteLoading.value = true;
    try {
        await rewriteNovelSeedWorkflowStepFragment(workflow.value.id, stepPreview.value.stepKey, rewriteTarget.value.key, rewriteInstruction.value.trim());
        workflow.value = await getNovelSeedWorkflow(workflow.value.id);
        stepPreview.value = await previewNovelSeedWorkflowStep(workflow.value.id, stepPreview.value.stepKey);
        await loadWorkflows();
        rewriteDialog.value = false;
        ElMessage.success('片段已重写，步骤确认状态已重置。');
    }
    catch (err) {
        ElMessage.error(err.message || '重写片段失败。');
    }
    finally {
        rewriteLoading.value = false;
    }
}
async function openWorkflow(item) {
    workflow.value = await getNovelSeedWorkflow(item.id);
    syncFormFromWorkflow(workflow.value);
}
async function removeWorkflow(item) {
    try {
        await deleteNovelSeedWorkflow(item.id);
        if (workflow.value?.id === item.id)
            workflow.value = null;
        await loadWorkflows();
        ElMessage.success('已删除分步开书记录。');
    }
    catch (err) {
        ElMessage.error(err.message || '删除分步工作流失败。');
    }
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
function onRunEvent(event) {
    if (!currentRunId.value)
        return;
    runEvents.value.push(event);
    streamStatus.value = event.message || event.type;
}
onMounted(() => {
    chatHub.onToken(onToken);
    chatHub.onStatus(onStatus);
    chatHub.onCompleted(onCompleted);
    chatHub.onError(onError);
    chatHub.onRunEvent(onRunEvent);
    void loadConfigs();
    void loadWorkflows();
});
onBeforeUnmount(async () => {
    chatHub.offToken(onToken);
    chatHub.offStatus(onStatus);
    chatHub.offCompleted(onCompleted);
    chatHub.offError(onError);
    chatHub.offRunEvent(onRunEvent);
    if (currentRunId.value)
        await chatHub.leaveRun(currentRunId.value);
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['panel-title']} */ ;
/** @type {__VLS_StyleScopedClasses['board-head']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-title']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-list__item']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-list__item']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-list__item']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-list__item']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-list__item']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['agent-summary']} */ ;
/** @type {__VLS_StyleScopedClasses['agent-summary']} */ ;
/** @type {__VLS_StyleScopedClasses['agent-summary']} */ ;
/** @type {__VLS_StyleScopedClasses['agent-summary']} */ ;
/** @type {__VLS_StyleScopedClasses['agent-summary']} */ ;
/** @type {__VLS_StyleScopedClasses['agent-chat__messages']} */ ;
/** @type {__VLS_StyleScopedClasses['agent-chat__message']} */ ;
/** @type {__VLS_StyleScopedClasses['agent-chat__message']} */ ;
/** @type {__VLS_StyleScopedClasses['agent-chat__input']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-save-note']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-save-note']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-step__head']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-step__head']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-step__head']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-step__head']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-step__saved']} */ ;
/** @type {__VLS_StyleScopedClasses['metrics']} */ ;
/** @type {__VLS_StyleScopedClasses['metrics']} */ ;
/** @type {__VLS_StyleScopedClasses['metrics']} */ ;
/** @type {__VLS_StyleScopedClasses['run-event']} */ ;
/** @type {__VLS_StyleScopedClasses['run-event']} */ ;
/** @type {__VLS_StyleScopedClasses['run-event']} */ ;
/** @type {__VLS_StyleScopedClasses['run-event']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-item__head']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-item__head']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-item__head']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-item']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-item']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-item']} */ ;
/** @type {__VLS_StyleScopedClasses['rewrite-box']} */ ;
/** @type {__VLS_StyleScopedClasses['board-head']} */ ;
/** @type {__VLS_StyleScopedClasses['agent-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['agent-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['el-button']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-layout']} */ ;
/** @type {__VLS_StyleScopedClasses['seed-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['agent-summary']} */ ;
/** @type {__VLS_StyleScopedClasses['agent-chat__input']} */ ;
/** @type {__VLS_StyleScopedClasses['run-event']} */ ;
/** @type {__VLS_StyleScopedClasses['run-event']} */ ;
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
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "agent-actions" },
});
const __VLS_0 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ 'onClick': {} },
    type: "primary",
    icon: (__VLS_ctx.MagicStick),
    loading: (__VLS_ctx.workflowCreating),
}));
const __VLS_2 = __VLS_1({
    ...{ 'onClick': {} },
    type: "primary",
    icon: (__VLS_ctx.MagicStick),
    loading: (__VLS_ctx.workflowCreating),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
let __VLS_4;
let __VLS_5;
let __VLS_6;
const __VLS_7 = {
    onClick: (__VLS_ctx.startAgent)
};
__VLS_3.slots.default;
(__VLS_ctx.workflowCreating ? 'Agent 启动中' : '启动开书 Agent');
var __VLS_3;
const __VLS_8 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    ...{ 'onClick': {} },
    icon: (__VLS_ctx.DocumentAdd),
    disabled: (!__VLS_ctx.workflow),
    loading: (__VLS_ctx.workflowUpdating),
}));
const __VLS_10 = __VLS_9({
    ...{ 'onClick': {} },
    icon: (__VLS_ctx.DocumentAdd),
    disabled: (!__VLS_ctx.workflow),
    loading: (__VLS_ctx.workflowUpdating),
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
let __VLS_12;
let __VLS_13;
let __VLS_14;
const __VLS_15 = {
    onClick: (__VLS_ctx.updateWorkflowRequest)
};
__VLS_11.slots.default;
var __VLS_11;
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "seed-grid" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "panel main-panel" },
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
const __VLS_20 = {}.Notebook;
/** @type {[typeof __VLS_components.Notebook, ]} */ ;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({}));
const __VLS_22 = __VLS_21({}, ...__VLS_functionalComponentArgsRest(__VLS_21));
var __VLS_19;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
const __VLS_24 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
    labelPosition: "top",
}));
const __VLS_26 = __VLS_25({
    labelPosition: "top",
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
__VLS_27.slots.default;
const __VLS_28 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
    label: "一句话或详细描述",
}));
const __VLS_30 = __VLS_29({
    label: "一句话或详细描述",
}, ...__VLS_functionalComponentArgsRest(__VLS_29));
__VLS_31.slots.default;
const __VLS_32 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
    ...{ 'onKeydown': {} },
    modelValue: (__VLS_ctx.form.description),
    type: "textarea",
    rows: (8),
    placeholder: "例如：一个被流放的机械祭司，在潮汐都市里追查旧神引擎失控真相，逐步建立自己的地下秩序。",
}));
const __VLS_34 = __VLS_33({
    ...{ 'onKeydown': {} },
    modelValue: (__VLS_ctx.form.description),
    type: "textarea",
    rows: (8),
    placeholder: "例如：一个被流放的机械祭司，在潮汐都市里追查旧神引擎失控真相，逐步建立自己的地下秩序。",
}, ...__VLS_functionalComponentArgsRest(__VLS_33));
let __VLS_36;
let __VLS_37;
let __VLS_38;
const __VLS_39 = {
    onKeydown: (__VLS_ctx.submit)
};
var __VLS_35;
var __VLS_31;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "form-row" },
});
const __VLS_40 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
    label: "题材",
}));
const __VLS_42 = __VLS_41({
    label: "题材",
}, ...__VLS_functionalComponentArgsRest(__VLS_41));
__VLS_43.slots.default;
const __VLS_44 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
    modelValue: (__VLS_ctx.form.genre),
    placeholder: "都市异能 / 玄幻 / 科幻悬疑",
}));
const __VLS_46 = __VLS_45({
    modelValue: (__VLS_ctx.form.genre),
    placeholder: "都市异能 / 玄幻 / 科幻悬疑",
}, ...__VLS_functionalComponentArgsRest(__VLS_45));
var __VLS_43;
const __VLS_48 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
    label: "目标读者",
}));
const __VLS_50 = __VLS_49({
    label: "目标读者",
}, ...__VLS_functionalComponentArgsRest(__VLS_49));
__VLS_51.slots.default;
const __VLS_52 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
    modelValue: (__VLS_ctx.form.targetAudience),
}));
const __VLS_54 = __VLS_53({
    modelValue: (__VLS_ctx.form.targetAudience),
}, ...__VLS_functionalComponentArgsRest(__VLS_53));
var __VLS_51;
const __VLS_56 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
    label: "风格",
}));
const __VLS_58 = __VLS_57({
    label: "风格",
}, ...__VLS_functionalComponentArgsRest(__VLS_57));
__VLS_59.slots.default;
const __VLS_60 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
    modelValue: (__VLS_ctx.form.tone),
}));
const __VLS_62 = __VLS_61({
    modelValue: (__VLS_ctx.form.tone),
}, ...__VLS_functionalComponentArgsRest(__VLS_61));
var __VLS_59;
var __VLS_27;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "panel" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "panel-title" },
});
const __VLS_64 = {}.ElIcon;
/** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
// @ts-ignore
const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({}));
const __VLS_66 = __VLS_65({}, ...__VLS_functionalComponentArgsRest(__VLS_65));
__VLS_67.slots.default;
const __VLS_68 = {}.CollectionTag;
/** @type {[typeof __VLS_components.CollectionTag, ]} */ ;
// @ts-ignore
const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({}));
const __VLS_70 = __VLS_69({}, ...__VLS_functionalComponentArgsRest(__VLS_69));
var __VLS_67;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
const __VLS_72 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
    labelPosition: "top",
}));
const __VLS_74 = __VLS_73({
    labelPosition: "top",
}, ...__VLS_functionalComponentArgsRest(__VLS_73));
__VLS_75.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "number-grid" },
});
const __VLS_76 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({
    label: "卷数",
}));
const __VLS_78 = __VLS_77({
    label: "卷数",
}, ...__VLS_functionalComponentArgsRest(__VLS_77));
__VLS_79.slots.default;
const __VLS_80 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
    modelValue: (__VLS_ctx.form.volumeCount),
    min: (1),
    max: (200),
}));
const __VLS_82 = __VLS_81({
    modelValue: (__VLS_ctx.form.volumeCount),
    min: (1),
    max: (200),
}, ...__VLS_functionalComponentArgsRest(__VLS_81));
var __VLS_79;
const __VLS_84 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({
    label: "每卷章节",
}));
const __VLS_86 = __VLS_85({
    label: "每卷章节",
}, ...__VLS_functionalComponentArgsRest(__VLS_85));
__VLS_87.slots.default;
const __VLS_88 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
    modelValue: (__VLS_ctx.form.chaptersPerVolume),
    min: (1),
    max: (500),
}));
const __VLS_90 = __VLS_89({
    modelValue: (__VLS_ctx.form.chaptersPerVolume),
    min: (1),
    max: (500),
}, ...__VLS_functionalComponentArgsRest(__VLS_89));
var __VLS_87;
const __VLS_92 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({
    label: "每章字数",
}));
const __VLS_94 = __VLS_93({
    label: "每章字数",
}, ...__VLS_functionalComponentArgsRest(__VLS_93));
__VLS_95.slots.default;
const __VLS_96 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
    modelValue: (__VLS_ctx.form.estimatedWordsPerChapter),
    min: (1000),
    max: (20000),
    step: (500),
}));
const __VLS_98 = __VLS_97({
    modelValue: (__VLS_ctx.form.estimatedWordsPerChapter),
    min: (1000),
    max: (20000),
    step: (500),
}, ...__VLS_functionalComponentArgsRest(__VLS_97));
var __VLS_95;
const __VLS_100 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_101 = __VLS_asFunctionalComponent(__VLS_100, new __VLS_100({
    label: "首批章节计划",
}));
const __VLS_102 = __VLS_101({
    label: "首批章节计划",
}, ...__VLS_functionalComponentArgsRest(__VLS_101));
__VLS_103.slots.default;
const __VLS_104 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_105 = __VLS_asFunctionalComponent(__VLS_104, new __VLS_104({
    modelValue: (__VLS_ctx.form.initialChapterPlanCount),
    min: (0),
    max: (500),
    step: (10),
}));
const __VLS_106 = __VLS_105({
    modelValue: (__VLS_ctx.form.initialChapterPlanCount),
    min: (0),
    max: (500),
    step: (10),
}, ...__VLS_functionalComponentArgsRest(__VLS_105));
var __VLS_103;
const __VLS_108 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_109 = __VLS_asFunctionalComponent(__VLS_108, new __VLS_108({
    label: "规划 Tokens",
}));
const __VLS_110 = __VLS_109({
    label: "规划 Tokens",
}, ...__VLS_functionalComponentArgsRest(__VLS_109));
__VLS_111.slots.default;
const __VLS_112 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_113 = __VLS_asFunctionalComponent(__VLS_112, new __VLS_112({
    modelValue: (__VLS_ctx.form.maxTokens),
    min: (1500),
    max: (30000),
    step: (500),
}));
const __VLS_114 = __VLS_113({
    modelValue: (__VLS_ctx.form.maxTokens),
    min: (1500),
    max: (30000),
    step: (500),
}, ...__VLS_functionalComponentArgsRest(__VLS_113));
var __VLS_111;
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
const __VLS_116 = {}.ElCheckbox;
/** @type {[typeof __VLS_components.ElCheckbox, typeof __VLS_components.elCheckbox, typeof __VLS_components.ElCheckbox, typeof __VLS_components.elCheckbox, ]} */ ;
// @ts-ignore
const __VLS_117 = __VLS_asFunctionalComponent(__VLS_116, new __VLS_116({
    modelValue: (__VLS_ctx.form.createDesignData),
}));
const __VLS_118 = __VLS_117({
    modelValue: (__VLS_ctx.form.createDesignData),
}, ...__VLS_functionalComponentArgsRest(__VLS_117));
__VLS_119.slots.default;
var __VLS_119;
const __VLS_120 = {}.ElCheckbox;
/** @type {[typeof __VLS_components.ElCheckbox, typeof __VLS_components.elCheckbox, typeof __VLS_components.ElCheckbox, typeof __VLS_components.elCheckbox, ]} */ ;
// @ts-ignore
const __VLS_121 = __VLS_asFunctionalComponent(__VLS_120, new __VLS_120({
    modelValue: (__VLS_ctx.form.createChapters),
}));
const __VLS_122 = __VLS_121({
    modelValue: (__VLS_ctx.form.createChapters),
}, ...__VLS_functionalComponentArgsRest(__VLS_121));
__VLS_123.slots.default;
var __VLS_123;
var __VLS_75;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "panel" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "panel-title" },
});
const __VLS_124 = {}.ElIcon;
/** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
// @ts-ignore
const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({}));
const __VLS_126 = __VLS_125({}, ...__VLS_functionalComponentArgsRest(__VLS_125));
__VLS_127.slots.default;
const __VLS_128 = {}.Cpu;
/** @type {[typeof __VLS_components.Cpu, ]} */ ;
// @ts-ignore
const __VLS_129 = __VLS_asFunctionalComponent(__VLS_128, new __VLS_128({}));
const __VLS_130 = __VLS_129({}, ...__VLS_functionalComponentArgsRest(__VLS_129));
var __VLS_127;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
const __VLS_132 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_133 = __VLS_asFunctionalComponent(__VLS_132, new __VLS_132({
    labelPosition: "top",
}));
const __VLS_134 = __VLS_133({
    labelPosition: "top",
}, ...__VLS_functionalComponentArgsRest(__VLS_133));
__VLS_135.slots.default;
const __VLS_136 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_137 = __VLS_asFunctionalComponent(__VLS_136, new __VLS_136({
    label: "已保存配置",
}));
const __VLS_138 = __VLS_137({
    label: "已保存配置",
}, ...__VLS_functionalComponentArgsRest(__VLS_137));
__VLS_139.slots.default;
const __VLS_140 = {}.ElSelect;
/** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
// @ts-ignore
const __VLS_141 = __VLS_asFunctionalComponent(__VLS_140, new __VLS_140({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.selectedConfigId),
    filterable: true,
    clearable: true,
    loading: (__VLS_ctx.loadingConfigs),
    placeholder: "选择配置",
}));
const __VLS_142 = __VLS_141({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.selectedConfigId),
    filterable: true,
    clearable: true,
    loading: (__VLS_ctx.loadingConfigs),
    placeholder: "选择配置",
}, ...__VLS_functionalComponentArgsRest(__VLS_141));
let __VLS_144;
let __VLS_145;
let __VLS_146;
const __VLS_147 = {
    onChange: (__VLS_ctx.applySelectedConfig)
};
__VLS_143.slots.default;
for (const [item] of __VLS_getVForSourceType((__VLS_ctx.configs))) {
    const __VLS_148 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_149 = __VLS_asFunctionalComponent(__VLS_148, new __VLS_148({
        key: (item.providerId),
        label: (item.name),
        value: (item.providerId),
    }));
    const __VLS_150 = __VLS_149({
        key: (item.providerId),
        label: (item.name),
        value: (item.providerId),
    }, ...__VLS_functionalComponentArgsRest(__VLS_149));
}
var __VLS_143;
var __VLS_139;
const __VLS_152 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_153 = __VLS_asFunctionalComponent(__VLS_152, new __VLS_152({
    label: "Endpoint",
}));
const __VLS_154 = __VLS_153({
    label: "Endpoint",
}, ...__VLS_functionalComponentArgsRest(__VLS_153));
__VLS_155.slots.default;
const __VLS_156 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_157 = __VLS_asFunctionalComponent(__VLS_156, new __VLS_156({
    modelValue: (__VLS_ctx.aiForm.endpoint),
    placeholder: "https://api.openai.com/v1",
}));
const __VLS_158 = __VLS_157({
    modelValue: (__VLS_ctx.aiForm.endpoint),
    placeholder: "https://api.openai.com/v1",
}, ...__VLS_functionalComponentArgsRest(__VLS_157));
var __VLS_155;
const __VLS_160 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_161 = __VLS_asFunctionalComponent(__VLS_160, new __VLS_160({
    label: "模型",
}));
const __VLS_162 = __VLS_161({
    label: "模型",
}, ...__VLS_functionalComponentArgsRest(__VLS_161));
__VLS_163.slots.default;
const __VLS_164 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_165 = __VLS_asFunctionalComponent(__VLS_164, new __VLS_164({
    modelValue: (__VLS_ctx.aiForm.model),
    placeholder: "gpt-4o / deepseek-chat / ...",
}));
const __VLS_166 = __VLS_165({
    modelValue: (__VLS_ctx.aiForm.model),
    placeholder: "gpt-4o / deepseek-chat / ...",
}, ...__VLS_functionalComponentArgsRest(__VLS_165));
var __VLS_163;
const __VLS_168 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_169 = __VLS_asFunctionalComponent(__VLS_168, new __VLS_168({
    label: "临时 API Key",
}));
const __VLS_170 = __VLS_169({
    label: "临时 API Key",
}, ...__VLS_functionalComponentArgsRest(__VLS_169));
__VLS_171.slots.default;
const __VLS_172 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_173 = __VLS_asFunctionalComponent(__VLS_172, new __VLS_172({
    modelValue: (__VLS_ctx.aiForm.apiKey),
    type: "password",
    showPassword: true,
    placeholder: "已保存配置可不填",
}));
const __VLS_174 = __VLS_173({
    modelValue: (__VLS_ctx.aiForm.apiKey),
    type: "password",
    showPassword: true,
    placeholder: "已保存配置可不填",
}, ...__VLS_functionalComponentArgsRest(__VLS_173));
var __VLS_171;
const __VLS_176 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_177 = __VLS_asFunctionalComponent(__VLS_176, new __VLS_176({
    label: "温度",
}));
const __VLS_178 = __VLS_177({
    label: "温度",
}, ...__VLS_functionalComponentArgsRest(__VLS_177));
__VLS_179.slots.default;
const __VLS_180 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_181 = __VLS_asFunctionalComponent(__VLS_180, new __VLS_180({
    modelValue: (__VLS_ctx.form.temperature),
    min: (0),
    max: (2),
    step: (0.1),
}));
const __VLS_182 = __VLS_181({
    modelValue: (__VLS_ctx.form.temperature),
    min: (0),
    max: (2),
    step: (0.1),
}, ...__VLS_functionalComponentArgsRest(__VLS_181));
var __VLS_179;
var __VLS_135;
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "panel open-book-board" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "board-head" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "panel-title" },
});
const __VLS_184 = {}.ElIcon;
/** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
// @ts-ignore
const __VLS_185 = __VLS_asFunctionalComponent(__VLS_184, new __VLS_184({}));
const __VLS_186 = __VLS_185({}, ...__VLS_functionalComponentArgsRest(__VLS_185));
__VLS_187.slots.default;
const __VLS_188 = {}.DocumentAdd;
/** @type {[typeof __VLS_components.DocumentAdd, ]} */ ;
// @ts-ignore
const __VLS_189 = __VLS_asFunctionalComponent(__VLS_188, new __VLS_188({}));
const __VLS_190 = __VLS_189({}, ...__VLS_functionalComponentArgsRest(__VLS_189));
var __VLS_187;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
(__VLS_ctx.workflow?.status ?? '未选择');
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "workflow-layout" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.aside, __VLS_intrinsicElements.aside)({
    ...{ class: "workflow-list" },
});
__VLS_asFunctionalDirective(__VLS_directives.vLoading)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.loadingWorkflows) }, null, null);
for (const [item] of __VLS_getVForSourceType((__VLS_ctx.workflows))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.openWorkflow(item);
            } },
        key: (item.id),
        type: "button",
        ...{ class: "workflow-list__item" },
        ...{ class: ({ active: item.id === __VLS_ctx.workflow?.id }) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (item.request.description || '未命名开书计划');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (item.status);
    (new Date(item.createdAt).toLocaleString());
}
if (!__VLS_ctx.loadingWorkflows && __VLS_ctx.workflows.length === 0) {
    const __VLS_192 = {}.ElEmpty;
    /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
    // @ts-ignore
    const __VLS_193 = __VLS_asFunctionalComponent(__VLS_192, new __VLS_192({
        description: "还没有开书 Agent 记录。",
        imageSize: (76),
    }));
    const __VLS_194 = __VLS_193({
        description: "还没有开书 Agent 记录。",
        imageSize: (76),
    }, ...__VLS_functionalComponentArgsRest(__VLS_193));
}
if (__VLS_ctx.workflow) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "workflow-steps" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "workflow-actions" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.workflow.id.slice(0, 8));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    const __VLS_196 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_197 = __VLS_asFunctionalComponent(__VLS_196, new __VLS_196({
        ...{ 'onClick': {} },
        size: "small",
        loading: (__VLS_ctx.workflowUpdating),
    }));
    const __VLS_198 = __VLS_197({
        ...{ 'onClick': {} },
        size: "small",
        loading: (__VLS_ctx.workflowUpdating),
    }, ...__VLS_functionalComponentArgsRest(__VLS_197));
    let __VLS_200;
    let __VLS_201;
    let __VLS_202;
    const __VLS_203 = {
        onClick: (__VLS_ctx.updateWorkflowRequest)
    };
    __VLS_199.slots.default;
    var __VLS_199;
    const __VLS_204 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_205 = __VLS_asFunctionalComponent(__VLS_204, new __VLS_204({
        ...{ 'onClick': {} },
        size: "small",
        type: "danger",
        plain: true,
    }));
    const __VLS_206 = __VLS_205({
        ...{ 'onClick': {} },
        size: "small",
        type: "danger",
        plain: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_205));
    let __VLS_208;
    let __VLS_209;
    let __VLS_210;
    const __VLS_211 = {
        onClick: (...[$event]) => {
            if (!(__VLS_ctx.workflow))
                return;
            __VLS_ctx.removeWorkflow(__VLS_ctx.workflow);
        }
    };
    __VLS_207.slots.default;
    var __VLS_207;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "agent-summary" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.workflow.request.volumeCount * __VLS_ctx.workflow.request.chaptersPerVolume);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.workflow.request.initialChapterPlanCount);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.workflow.request.estimatedWordsPerChapter);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.workflow.request.maxTokens ?? 0);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "workflow-save-note" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "agent-chat" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "agent-chat__messages" },
    });
    if (__VLS_ctx.agentMessages.length === 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    }
    for (const [message, index] of __VLS_getVForSourceType((__VLS_ctx.agentMessages))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            key: (index),
            ...{ class: (['agent-chat__message', message.role]) },
        });
        (message.content);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "agent-chat__input" },
    });
    const __VLS_212 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_213 = __VLS_asFunctionalComponent(__VLS_212, new __VLS_212({
        ...{ 'onKeydown': {} },
        modelValue: (__VLS_ctx.agentPrompt),
        type: "textarea",
        rows: (2),
        placeholder: "和开书 Agent 对话：例如“改成 300 章，10 卷，每章 3000 字，主线更偏末世科技爽文”。",
    }));
    const __VLS_214 = __VLS_213({
        ...{ 'onKeydown': {} },
        modelValue: (__VLS_ctx.agentPrompt),
        type: "textarea",
        rows: (2),
        placeholder: "和开书 Agent 对话：例如“改成 300 章，10 卷，每章 3000 字，主线更偏末世科技爽文”。",
    }, ...__VLS_functionalComponentArgsRest(__VLS_213));
    let __VLS_216;
    let __VLS_217;
    let __VLS_218;
    const __VLS_219 = {
        onKeydown: (__VLS_ctx.submitAgentPrompt)
    };
    var __VLS_215;
    const __VLS_220 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_221 = __VLS_asFunctionalComponent(__VLS_220, new __VLS_220({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.workflowUpdating),
    }));
    const __VLS_222 = __VLS_221({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.workflowUpdating),
    }, ...__VLS_functionalComponentArgsRest(__VLS_221));
    let __VLS_224;
    let __VLS_225;
    let __VLS_226;
    const __VLS_227 = {
        onClick: (__VLS_ctx.submitAgentPrompt)
    };
    __VLS_223.slots.default;
    var __VLS_223;
    for (const [step] of __VLS_getVForSourceType((__VLS_ctx.workflow.steps))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.article, __VLS_intrinsicElements.article)({
            key: (step.id),
            ...{ class: "workflow-step" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "workflow-step__head" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
        (step.title);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (step.stepKey);
        (step.status);
        (step.isConfirmed ? '已确认' : '待确认');
        if (step.output) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({
                ...{ class: "workflow-step__saved" },
            });
            (__VLS_ctx.stepOutputLength(step.stepKey));
            (new Date(step.updatedAt).toLocaleString());
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({
                ...{ class: "workflow-step__saved muted" },
            });
        }
        if (step.stepKey === 'finalize') {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({
                ...{ class: "workflow-step__finalize" },
            });
        }
        if (step.stepKey === 'tracking') {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({
                ...{ class: "workflow-step__finalize" },
            });
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "workflow-step__actions" },
        });
        const __VLS_228 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_229 = __VLS_asFunctionalComponent(__VLS_228, new __VLS_228({
            ...{ 'onClick': {} },
            size: "small",
            type: "success",
            plain: true,
            disabled: (step.status === 'running'),
        }));
        const __VLS_230 = __VLS_229({
            ...{ 'onClick': {} },
            size: "small",
            type: "success",
            plain: true,
            disabled: (step.status === 'running'),
        }, ...__VLS_functionalComponentArgsRest(__VLS_229));
        let __VLS_232;
        let __VLS_233;
        let __VLS_234;
        const __VLS_235 = {
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.workflow))
                    return;
                __VLS_ctx.toggleWorkflowStepConfirmation(step.stepKey);
            }
        };
        __VLS_231.slots.default;
        (step.isConfirmed ? '取消锁定' : '确认并锁定');
        var __VLS_231;
        const __VLS_236 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_237 = __VLS_asFunctionalComponent(__VLS_236, new __VLS_236({
            ...{ 'onClick': {} },
            size: "small",
            plain: true,
        }));
        const __VLS_238 = __VLS_237({
            ...{ 'onClick': {} },
            size: "small",
            plain: true,
        }, ...__VLS_functionalComponentArgsRest(__VLS_237));
        let __VLS_240;
        let __VLS_241;
        let __VLS_242;
        const __VLS_243 = {
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.workflow))
                    return;
                __VLS_ctx.previewWorkflowStep(step.stepKey);
            }
        };
        __VLS_239.slots.default;
        var __VLS_239;
        const __VLS_244 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_245 = __VLS_asFunctionalComponent(__VLS_244, new __VLS_244({
            ...{ 'onClick': {} },
            size: "small",
            type: "primary",
            loading: (__VLS_ctx.workflowStepRunning === step.stepKey),
            disabled: (__VLS_ctx.workflowStepRunning !== '' || step.status === 'pending'),
        }));
        const __VLS_246 = __VLS_245({
            ...{ 'onClick': {} },
            size: "small",
            type: "primary",
            loading: (__VLS_ctx.workflowStepRunning === step.stepKey),
            disabled: (__VLS_ctx.workflowStepRunning !== '' || step.status === 'pending'),
        }, ...__VLS_functionalComponentArgsRest(__VLS_245));
        let __VLS_248;
        let __VLS_249;
        let __VLS_250;
        const __VLS_251 = {
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.workflow))
                    return;
                __VLS_ctx.runWorkflowStep(step.stepKey, { preview: step.stepKey !== 'finalize' });
            }
        };
        __VLS_247.slots.default;
        (step.stepKey === 'finalize' ? (step.status === 'completed' ? '重新生成项目数据' : '落库生成项目') : (step.status === 'completed' ? '重新运行' : '运行'));
        var __VLS_247;
        if (step.output) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.pre, __VLS_intrinsicElements.pre)({
                ...{ class: "workflow-output" },
            });
            (step.output);
        }
        if (step.error) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
                ...{ class: "workflow-error" },
            });
            (step.error);
        }
    }
}
else {
    const __VLS_252 = {}.ElEmpty;
    /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
    // @ts-ignore
    const __VLS_253 = __VLS_asFunctionalComponent(__VLS_252, new __VLS_252({
        ...{ class: "workflow-empty" },
        description: "选择历史记录，或点击顶部“启动开书 Agent”。",
        imageSize: (86),
    }));
    const __VLS_254 = __VLS_253({
        ...{ class: "workflow-empty" },
        description: "选择历史记录，或点击顶部“启动开书 Agent”。",
        imageSize: (86),
    }, ...__VLS_functionalComponentArgsRest(__VLS_253));
}
if (__VLS_ctx.hasLiveProgress) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "panel stream-panel" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "panel-title" },
    });
    const __VLS_256 = {}.ElIcon;
    /** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
    // @ts-ignore
    const __VLS_257 = __VLS_asFunctionalComponent(__VLS_256, new __VLS_256({}));
    const __VLS_258 = __VLS_257({}, ...__VLS_functionalComponentArgsRest(__VLS_257));
    __VLS_259.slots.default;
    const __VLS_260 = {}.MagicStick;
    /** @type {[typeof __VLS_components.MagicStick, ]} */ ;
    // @ts-ignore
    const __VLS_261 = __VLS_asFunctionalComponent(__VLS_260, new __VLS_260({}));
    const __VLS_262 = __VLS_261({}, ...__VLS_functionalComponentArgsRest(__VLS_261));
    var __VLS_259;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.workflowStepRunning === 'finalize' ? '落库执行日志' : 'AI 实时规划');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
    (__VLS_ctx.streamStatus);
    if (__VLS_ctx.workflowStepRunning === 'finalize' || __VLS_ctx.runEvents.length > 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "run-progress" },
        });
        const __VLS_264 = {}.ElProgress;
        /** @type {[typeof __VLS_components.ElProgress, typeof __VLS_components.elProgress, ]} */ ;
        // @ts-ignore
        const __VLS_265 = __VLS_asFunctionalComponent(__VLS_264, new __VLS_264({
            percentage: (__VLS_ctx.finalizeProgress),
            strokeWidth: (10),
            striped: true,
            stripedFlow: true,
        }));
        const __VLS_266 = __VLS_265({
            percentage: (__VLS_ctx.finalizeProgress),
            strokeWidth: (10),
            striped: true,
            stripedFlow: true,
        }, ...__VLS_functionalComponentArgsRest(__VLS_265));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "run-events" },
        });
        for (const [event, index] of __VLS_getVForSourceType((__VLS_ctx.runEvents))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                key: (`${event.at}-${index}`),
                ...{ class: "run-event" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            (new Date(event.at).toLocaleTimeString());
            __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
            (event.message);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
            (event.type);
        }
        if (__VLS_ctx.runEvents.length === 0) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "run-event muted" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
        }
    }
    if (__VLS_ctx.streamText || (!__VLS_ctx.runEvents.length && __VLS_ctx.workflowStepRunning !== 'finalize')) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.pre, __VLS_intrinsicElements.pre)({
            ...{ class: "stream-output" },
        });
        (__VLS_ctx.streamText || '等待 AI 返回规划 JSON...');
    }
    if (__VLS_ctx.streamError) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "stream-error" },
        });
        (__VLS_ctx.streamError);
    }
}
const __VLS_268 = {}.ElDrawer;
/** @type {[typeof __VLS_components.ElDrawer, typeof __VLS_components.elDrawer, typeof __VLS_components.ElDrawer, typeof __VLS_components.elDrawer, ]} */ ;
// @ts-ignore
const __VLS_269 = __VLS_asFunctionalComponent(__VLS_268, new __VLS_268({
    modelValue: (__VLS_ctx.previewDrawer),
    title: "步骤结构化预览",
    size: "56%",
}));
const __VLS_270 = __VLS_269({
    modelValue: (__VLS_ctx.previewDrawer),
    title: "步骤结构化预览",
    size: "56%",
}, ...__VLS_functionalComponentArgsRest(__VLS_269));
__VLS_271.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "step-preview" },
});
__VLS_asFunctionalDirective(__VLS_directives.vLoading)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.previewLoading) }, null, null);
if (!__VLS_ctx.stepPreview || __VLS_ctx.stepPreview.items.length === 0) {
    const __VLS_272 = {}.ElEmpty;
    /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
    // @ts-ignore
    const __VLS_273 = __VLS_asFunctionalComponent(__VLS_272, new __VLS_272({
        description: "当前步骤暂无可解析片段。",
        imageSize: (80),
    }));
    const __VLS_274 = __VLS_273({
        description: "当前步骤暂无可解析片段。",
        imageSize: (80),
    }, ...__VLS_functionalComponentArgsRest(__VLS_273));
}
for (const [item] of __VLS_getVForSourceType((__VLS_ctx.stepPreview?.items ?? []))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.article, __VLS_intrinsicElements.article)({
        key: (item.key),
        ...{ class: "preview-item" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "preview-item__head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (item.title);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (item.key);
    const __VLS_276 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_277 = __VLS_asFunctionalComponent(__VLS_276, new __VLS_276({
        ...{ 'onClick': {} },
        size: "small",
        type: "primary",
        plain: true,
    }));
    const __VLS_278 = __VLS_277({
        ...{ 'onClick': {} },
        size: "small",
        type: "primary",
        plain: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_277));
    let __VLS_280;
    let __VLS_281;
    let __VLS_282;
    const __VLS_283 = {
        onClick: (...[$event]) => {
            __VLS_ctx.openRewriteDialog(item);
        }
    };
    __VLS_279.slots.default;
    var __VLS_279;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    (item.summary || '暂无简介');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.pre, __VLS_intrinsicElements.pre)({});
    (item.rawJson);
}
var __VLS_271;
const __VLS_284 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_285 = __VLS_asFunctionalComponent(__VLS_284, new __VLS_284({
    modelValue: (__VLS_ctx.rewriteDialog),
    title: "重写结构化片段",
    width: "560px",
}));
const __VLS_286 = __VLS_285({
    modelValue: (__VLS_ctx.rewriteDialog),
    title: "重写结构化片段",
    width: "560px",
}, ...__VLS_functionalComponentArgsRest(__VLS_285));
__VLS_287.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "rewrite-box" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
(__VLS_ctx.rewriteTarget?.title);
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
(__VLS_ctx.rewriteTarget?.summary);
const __VLS_288 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_289 = __VLS_asFunctionalComponent(__VLS_288, new __VLS_288({
    modelValue: (__VLS_ctx.rewriteInstruction),
    type: "textarea",
    rows: (5),
    placeholder: "例如：把这一章改成潜入线更明确，增加沈栀与潮汐财团的直接冲突。",
}));
const __VLS_290 = __VLS_289({
    modelValue: (__VLS_ctx.rewriteInstruction),
    type: "textarea",
    rows: (5),
    placeholder: "例如：把这一章改成潜入线更明确，增加沈栀与潮汐财团的直接冲突。",
}, ...__VLS_functionalComponentArgsRest(__VLS_289));
{
    const { footer: __VLS_thisSlot } = __VLS_287.slots;
    const __VLS_292 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_293 = __VLS_asFunctionalComponent(__VLS_292, new __VLS_292({
        ...{ 'onClick': {} },
    }));
    const __VLS_294 = __VLS_293({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_293));
    let __VLS_296;
    let __VLS_297;
    let __VLS_298;
    const __VLS_299 = {
        onClick: (...[$event]) => {
            __VLS_ctx.rewriteDialog = false;
        }
    };
    __VLS_295.slots.default;
    var __VLS_295;
    const __VLS_300 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_301 = __VLS_asFunctionalComponent(__VLS_300, new __VLS_300({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.rewriteLoading),
    }));
    const __VLS_302 = __VLS_301({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.rewriteLoading),
    }, ...__VLS_functionalComponentArgsRest(__VLS_301));
    let __VLS_304;
    let __VLS_305;
    let __VLS_306;
    const __VLS_307 = {
        onClick: (__VLS_ctx.submitRewriteFragment)
    };
    __VLS_303.slots.default;
    var __VLS_303;
}
var __VLS_287;
/** @type {__VLS_StyleScopedClasses['novel-seed']} */ ;
/** @type {__VLS_StyleScopedClasses['page-head']} */ ;
/** @type {__VLS_StyleScopedClasses['eyebrow']} */ ;
/** @type {__VLS_StyleScopedClasses['summary']} */ ;
/** @type {__VLS_StyleScopedClasses['agent-actions']} */ ;
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
/** @type {__VLS_StyleScopedClasses['open-book-board']} */ ;
/** @type {__VLS_StyleScopedClasses['board-head']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-title']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-layout']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-list']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-list__item']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-steps']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['agent-summary']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-save-note']} */ ;
/** @type {__VLS_StyleScopedClasses['agent-chat']} */ ;
/** @type {__VLS_StyleScopedClasses['agent-chat__messages']} */ ;
/** @type {__VLS_StyleScopedClasses['agent-chat__message']} */ ;
/** @type {__VLS_StyleScopedClasses['agent-chat__input']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-step']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-step__head']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-step__saved']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-step__saved']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-step__finalize']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-step__finalize']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-step__actions']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-output']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-error']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-empty']} */ ;
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
/** @type {__VLS_StyleScopedClasses['stream-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-title']} */ ;
/** @type {__VLS_StyleScopedClasses['run-progress']} */ ;
/** @type {__VLS_StyleScopedClasses['run-events']} */ ;
/** @type {__VLS_StyleScopedClasses['run-event']} */ ;
/** @type {__VLS_StyleScopedClasses['run-event']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['stream-output']} */ ;
/** @type {__VLS_StyleScopedClasses['stream-error']} */ ;
/** @type {__VLS_StyleScopedClasses['step-preview']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-item']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-item__head']} */ ;
/** @type {__VLS_StyleScopedClasses['rewrite-box']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            MagicStick: MagicStick,
            Notebook: Notebook,
            Cpu: Cpu,
            DocumentAdd: DocumentAdd,
            CollectionTag: CollectionTag,
            aiForm: aiForm,
            configs: configs,
            selectedConfigId: selectedConfigId,
            loadingConfigs: loadingConfigs,
            workflow: workflow,
            workflows: workflows,
            streamText: streamText,
            streamStatus: streamStatus,
            streamError: streamError,
            runEvents: runEvents,
            workflowCreating: workflowCreating,
            workflowStepRunning: workflowStepRunning,
            workflowUpdating: workflowUpdating,
            loadingWorkflows: loadingWorkflows,
            previewLoading: previewLoading,
            previewDrawer: previewDrawer,
            stepPreview: stepPreview,
            rewriteDialog: rewriteDialog,
            rewriteLoading: rewriteLoading,
            rewriteTarget: rewriteTarget,
            rewriteInstruction: rewriteInstruction,
            agentPrompt: agentPrompt,
            agentMessages: agentMessages,
            form: form,
            totalChapters: totalChapters,
            estimatedTotalWords: estimatedTotalWords,
            finalizeProgress: finalizeProgress,
            hasLiveProgress: hasLiveProgress,
            stepOutputLength: stepOutputLength,
            applySelectedConfig: applySelectedConfig,
            submit: submit,
            startAgent: startAgent,
            updateWorkflowRequest: updateWorkflowRequest,
            submitAgentPrompt: submitAgentPrompt,
            runWorkflowStep: runWorkflowStep,
            toggleWorkflowStepConfirmation: toggleWorkflowStepConfirmation,
            previewWorkflowStep: previewWorkflowStep,
            openRewriteDialog: openRewriteDialog,
            submitRewriteFragment: submitRewriteFragment,
            openWorkflow: openWorkflow,
            removeWorkflow: removeWorkflow,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
