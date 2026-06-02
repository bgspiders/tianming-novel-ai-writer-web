import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Refresh, Delete, VideoPlay, DocumentChecked, Close } from '@element-plus/icons-vue';
import { storeToRefs } from 'pinia';
import { useI18n } from '@/composables/useI18n';
import { listProviderConfigs } from '@/api/modules/ai';
import { useWorkContextStore } from '@/stores/workContext';
import { useAiTestStore } from '@/stores/aiTest';
import { chatHub } from '@/signalr/chat';
import { cancelChapterBatchGeneration, createChapter, deleteChapter, generateChapterDraft, getChapterBatchGenerationStatus, getChapter, listChapters, listChapterBatchGenerationJobs, previewChapterBatchGeneration, queueChapterBatchGeneration, saveChapterContent } from '@/api/modules/chapters';
const workContext = useWorkContextStore();
const route = useRoute();
const aiStore = useAiTestStore();
const { form: aiForm } = storeToRefs(aiStore);
const { t } = useI18n();
const chapters = ref([]);
const selectedChapterId = ref('');
const selectedChapter = ref(null);
const loadingChapters = ref(false);
const creatingChapter = ref(false);
const generating = ref(false);
const savingContent = ref(false);
const loadingAiConfig = ref(false);
const output = ref('');
const status = ref('idle');
const error = ref('');
const currentRunId = ref('');
const lastGenerationRecordId = ref('');
const creatingAndGenerating = ref(false);
const validationReportId = ref('');
const rerunValidationAfterSave = ref(false);
const validationRepairSummary = ref('');
const latestValidationSummary = ref('');
const configs = ref([]);
const selectedConfigId = ref('');
const suppressChapterWatcher = ref(false);
const autoGenerating = ref(false);
const autoLog = ref([]);
const autoJobId = ref('');
const autoJobStatus = ref(null);
const autoPreviewing = ref(false);
const autoPreviewItems = ref([]);
let autoPollTimer = null;
const autoProgress = reactive({
    total: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
    currentNumber: 0,
    currentTitle: ''
});
const chapterForm = reactive({
    chapterNumber: 1,
    title: '',
    summary: ''
});
const promptForm = reactive({
    systemPrompt: '你是一名专业网络小说作者。只返回章节草稿正文。',
    prompt: '',
    temperature: 0.8,
    maxTokens: 4096,
    maxRewriteAttempts: 2
});
const autoForm = reactive({
    startChapterNumber: 1,
    count: 3,
    createMissing: true,
    overwriteExisting: false,
    stopOnFailure: true
});
const selectedConfig = computed(() => configs.value.find((item) => item.providerId === selectedConfigId.value) ?? null);
const autoProgressPercent = computed(() => {
    if (!autoProgress.total)
        return 0;
    return Math.round(((autoProgress.completed + autoProgress.failed + autoProgress.skipped) / autoProgress.total) * 100);
});
const autoJobStatusLabel = computed(() => {
    const statusValue = autoJobStatus.value?.status ?? (autoGenerating.value ? 'running' : 'idle');
    return t(`chapterGeneration.batch.status.${statusValue}`);
});
function onToken(token) {
    output.value += token;
}
function onStatus(next) {
    status.value = next;
}
function onCompleted(reason) {
    status.value = `${t('aiAssistant.status.completed')} (${reason})`;
}
function onError(message) {
    error.value = normalizeGenerationError(message);
    status.value = t('aiAssistant.status.failed');
}
function normalizeGenerationError(message) {
    const hasPartialOutput = output.value.trim().length > 0;
    if (message.includes('An error occurred while sending the request')) {
        return hasPartialOutput
            ? 'AI 上游连接在生成中途断开，已保留当前已返回正文。请降低最大 Tokens，或换用支持更长输出的模型后重试。'
            : 'AI 上游请求发送失败。请检查 Endpoint、API Key、代理/网络，以及模型是否支持当前最大 Tokens。';
    }
    return message;
}
async function refreshChapters() {
    if (!workContext.selectedProjectId || !workContext.selectedVolumeId) {
        chapters.value = [];
        selectedChapterId.value = '';
        selectedChapter.value = null;
        return;
    }
    loadingChapters.value = true;
    try {
        chapters.value = await listChapters(workContext.selectedProjectId, workContext.selectedVolumeId);
        syncChapterSelectionFromRoute();
        if (!chapters.value.some((item) => item.id === selectedChapterId.value)) {
            selectedChapterId.value = chapters.value[0]?.id ?? '';
        }
        await loadSelectedChapter();
    }
    catch (err) {
        ElMessage.error(err.message || t('chapterGeneration.messages.loadChaptersFailed'));
    }
    finally {
        loadingChapters.value = false;
    }
}
async function loadSelectedChapter() {
    if (!selectedChapterId.value) {
        selectedChapter.value = null;
        output.value = '';
        return;
    }
    try {
        selectedChapter.value = await getChapter(selectedChapterId.value);
        output.value = selectedChapter.value.content ?? '';
        buildPromptFromChapter();
    }
    catch (err) {
        ElMessage.error(err.message || t('chapterGeneration.messages.loadChapterDetailsFailed'));
    }
}
function syncChapterSelectionFromRoute() {
    const routeChapterId = route.query.chapterId;
    if (typeof routeChapterId === 'string' && chapters.value.some((item) => item.id === routeChapterId)) {
        selectedChapterId.value = routeChapterId;
    }
    const routeValidationReportId = route.query.validationReportId;
    validationReportId.value = typeof routeValidationReportId === 'string' ? routeValidationReportId : '';
    const repairSummary = route.query.repairSummary;
    validationRepairSummary.value = typeof repairSummary === 'string' ? repairSummary : '';
    const rewriteMode = route.query.rewriteMode;
    rerunValidationAfterSave.value = rewriteMode === 'validation_fix';
}
function resetChapterForm() {
    const nextChapterNumber = (chapters.value.at(-1)?.chapterNumber ?? 0) + 1;
    chapterForm.chapterNumber = nextChapterNumber;
    if (!autoGenerating.value) {
        autoForm.startChapterNumber = selectedChapter.value?.chapterNumber ?? nextChapterNumber;
    }
    chapterForm.title = '';
    chapterForm.summary = '';
}
async function quickCreateChapter() {
    if (!workContext.selectedProjectId || !workContext.selectedVolumeId) {
        ElMessage.warning(t('chapterGeneration.messages.selectProjectVolumeFirst'));
        return;
    }
    if (!chapterForm.title.trim()) {
        ElMessage.warning(t('chapterGeneration.messages.chapterTitleRequired'));
        return;
    }
    creatingChapter.value = true;
    try {
        const chapter = await createChapter({
            projectId: workContext.selectedProjectId,
            volumeId: workContext.selectedVolumeId,
            chapterNumber: chapterForm.chapterNumber,
            title: chapterForm.title.trim(),
            summary: chapterForm.summary.trim(),
            status: 'planned'
        });
        chapters.value = [...chapters.value, chapter].sort((a, b) => a.chapterNumber - b.chapterNumber);
        selectedChapterId.value = chapter.id;
        await loadSelectedChapter();
        resetChapterForm();
        ElMessage.success(t('chapterGeneration.messages.chapterCreated'));
    }
    catch (err) {
        ElMessage.error(err.message || t('chapterGeneration.messages.createChapterFailed'));
    }
    finally {
        creatingChapter.value = false;
    }
}
async function removeChapter(row) {
    try {
        await ElMessageBox.confirm(t('chapterGeneration.messages.deleteConfirm', { number: row.chapterNumber, title: row.title }), t('layout.dialogs.confirm'), { type: 'warning' });
    }
    catch {
        return;
    }
    try {
        await deleteChapter(row.id);
        ElMessage.success(t('chapterGeneration.messages.chapterDeleted'));
        await refreshChapters();
    }
    catch (err) {
        ElMessage.error(err.message || t('chapterGeneration.messages.deleteChapterFailed'));
    }
}
function buildPromptFromChapter() {
    const chapter = selectedChapter.value;
    if (!chapter)
        return;
    promptForm.prompt = buildPromptForChapter(chapter);
}
function buildPromptForChapter(chapter) {
    const volume = workContext.selectedVolume;
    return [
        `项目：${workContext.selectedProject?.name ?? chapter.projectId}`,
        `卷：${volume ? `第 ${volume.volumeNumber} 卷 / ${volume.title}` : chapter.volumeId}`,
        `章节：${chapter.chapterNumber} / ${chapter.title}`,
        chapter.summary ? `摘要：${chapter.summary}` : '',
        validationRepairSummary.value ? `本次修正重点：${validationRepairSummary.value}` : '',
        '',
        '请直接输出章节草稿，保持叙事连贯清晰。'
    ].filter(Boolean).join('\n');
}
function validateGenerationSettings(requireChapter) {
    if (requireChapter && !selectedChapter.value) {
        ElMessage.warning(t('chapterGeneration.messages.selectChapterFirst'));
        return false;
    }
    if (!workContext.selectedProjectId || !workContext.selectedVolumeId) {
        ElMessage.warning(t('chapterGeneration.messages.selectProjectVolumeFirst'));
        return false;
    }
    if (!aiForm.value.endpoint || !aiForm.value.model) {
        ElMessage.warning(t('chapterGeneration.messages.endpointModelRequired'));
        return false;
    }
    if (!selectedConfigId.value && !aiForm.value.apiKey) {
        ElMessage.warning(t('chapterGeneration.messages.selectConfigOrKeyFirst'));
        return false;
    }
    return true;
}
function appendAutoLog(message) {
    autoLog.value = [message, ...autoLog.value].slice(0, 20);
}
function clearAutoPreview() {
    autoPreviewItems.value = [];
}
async function generateDraftForChapter(chapter, silent = false) {
    if (!validateGenerationSettings(false))
        return false;
    const fullChapter = await getChapter(chapter.id);
    if (!promptForm.prompt.trim()) {
        ElMessage.warning(t('chapterGeneration.messages.promptRequired'));
        return false;
    }
    output.value = '';
    error.value = '';
    status.value = t('aiAssistant.status.running');
    generating.value = true;
    const runId = crypto.randomUUID();
    currentRunId.value = runId;
    try {
        await chatHub.joinRun(runId);
        const result = await generateChapterDraft({
            runId,
            projectId: workContext.selectedProjectId,
            volumeId: workContext.selectedVolumeId,
            chapterId: fullChapter.id,
            configId: selectedConfigId.value || null,
            endpoint: aiForm.value.endpoint,
            providerId: selectedConfigId.value || null,
            apiKeyId: null,
            apiKey: aiForm.value.apiKey,
            model: aiForm.value.model,
            systemPrompt: promptForm.systemPrompt,
            prompt: promptForm.prompt,
            temperature: promptForm.temperature,
            maxTokens: promptForm.maxTokens,
            maxRewriteAttempts: promptForm.maxRewriteAttempts,
            validationReportId: validationReportId.value || null,
            rerunValidationAfterSave: rerunValidationAfterSave.value,
            saveToChapter: true
        });
        lastGenerationRecordId.value = result.generationRecordId ?? '';
        selectedChapter.value = await getChapter(fullChapter.id);
        output.value = selectedChapter.value.content ?? '';
        chapters.value = chapters.value.map((item) => (item.id === selectedChapter.value.id ? selectedChapter.value : item));
        aiStore.saveToStorage();
        latestValidationSummary.value = rerunValidationAfterSave.value
            ? t('chapterGeneration.messages.validationRerunCompleted')
            : '';
        if (!silent) {
            ElMessage.success(t('chapterGeneration.messages.draftGenerated'));
        }
        return true;
    }
    catch (err) {
        error.value = normalizeGenerationError(err.message || t('chapterGeneration.messages.generationFailed'));
        if (!silent) {
            ElMessage.error(error.value);
        }
        return false;
    }
    finally {
        generating.value = false;
        await chatHub.leaveRun(runId);
        currentRunId.value = '';
    }
}
function applyAutoJobStatus(next) {
    autoJobStatus.value = next;
    autoJobId.value = next.jobId;
    autoGenerating.value = next.status === 'queued' || next.status === 'running';
    autoLog.value = next.logs ?? [];
    Object.assign(autoProgress, {
        total: next.total,
        completed: next.completed,
        failed: next.failed,
        skipped: next.skipped,
        currentNumber: next.currentChapterNumber,
        currentTitle: next.currentChapterTitle
    });
}
function stopAutoPolling() {
    if (!autoPollTimer)
        return;
    window.clearInterval(autoPollTimer);
    autoPollTimer = null;
}
async function refreshAutoJobStatus() {
    if (!autoJobId.value)
        return;
    try {
        const next = await getChapterBatchGenerationStatus(autoJobId.value);
        applyAutoJobStatus(next);
        if (!autoGenerating.value) {
            stopAutoPolling();
            await refreshChapters();
        }
    }
    catch (err) {
        stopAutoPolling();
        autoGenerating.value = false;
        ElMessage.error(err.message || t('chapterGeneration.batch.loadJobFailed'));
    }
}
function startAutoPolling() {
    stopAutoPolling();
    autoPollTimer = window.setInterval(refreshAutoJobStatus, 3000);
}
async function requestStopAutoGeneration() {
    if (!autoJobId.value)
        return;
    try {
        await cancelChapterBatchGeneration(autoJobId.value);
        ElMessage.warning(t('chapterGeneration.batch.stopRequested'));
        await refreshAutoJobStatus();
    }
    catch (err) {
        ElMessage.error(err.message || t('chapterGeneration.batch.cancelFailed'));
    }
}
async function previewBatchDrafts() {
    if (autoGenerating.value)
        return;
    if (!validateGenerationSettings(false))
        return;
    if (autoForm.count < 1) {
        ElMessage.warning(t('chapterGeneration.batch.countRequired'));
        return;
    }
    autoPreviewing.value = true;
    try {
        autoPreviewItems.value = await previewChapterBatchGeneration({
            projectId: workContext.selectedProjectId,
            volumeId: workContext.selectedVolumeId,
            startChapterNumber: autoForm.startChapterNumber,
            count: autoForm.count,
            createMissing: autoForm.createMissing
        });
        ElMessage.success(t('chapterGeneration.batch.previewReady'));
    }
    catch (err) {
        ElMessage.error(err.message || t('chapterGeneration.batch.previewFailed'));
    }
    finally {
        autoPreviewing.value = false;
    }
}
async function generateBatchDrafts() {
    if (autoGenerating.value)
        return;
    if (!validateGenerationSettings(false))
        return;
    if (autoPreviewItems.value.length === 0) {
        ElMessage.warning(t('chapterGeneration.batch.previewRequired'));
        return;
    }
    autoGenerating.value = false;
    autoLog.value = [];
    autoJobId.value = '';
    autoJobStatus.value = null;
    Object.assign(autoProgress, {
        total: autoForm.count,
        completed: 0,
        failed: 0,
        skipped: 0,
        currentNumber: 0,
        currentTitle: ''
    });
    try {
        const accepted = await queueChapterBatchGeneration({
            projectId: workContext.selectedProjectId,
            volumeId: workContext.selectedVolumeId,
            startChapterNumber: autoForm.startChapterNumber,
            count: autoForm.count,
            createMissing: autoForm.createMissing,
            overwriteExisting: autoForm.overwriteExisting,
            stopOnFailure: autoForm.stopOnFailure,
            configId: selectedConfigId.value || null,
            endpoint: aiForm.value.endpoint,
            providerId: selectedConfigId.value || null,
            apiKeyId: null,
            apiKey: aiForm.value.apiKey,
            model: aiForm.value.model,
            systemPrompt: promptForm.systemPrompt,
            temperature: promptForm.temperature,
            maxTokens: promptForm.maxTokens,
            maxRewriteAttempts: promptForm.maxRewriteAttempts,
            validationReportId: validationReportId.value || null,
            rerunValidationAfterSave: rerunValidationAfterSave.value,
            previewItems: autoPreviewItems.value.map((item) => ({
                ...item,
                title: item.title.trim(),
                summary: item.summary.trim()
            }))
        });
        autoJobId.value = accepted.jobId;
        autoGenerating.value = true;
        appendAutoLog(t('chapterGeneration.batch.queued', { id: accepted.jobId }));
        await refreshAutoJobStatus();
        startAutoPolling();
        clearAutoPreview();
        aiStore.saveToStorage();
        ElMessage.success(t('chapterGeneration.batch.queued', { id: accepted.jobId }));
    }
    catch (err) {
        autoGenerating.value = false;
        ElMessage.error(err.message || t('chapterGeneration.batch.queueFailed'));
    }
}
async function restoreLatestAutoJob() {
    if (!workContext.selectedProjectId)
        return;
    try {
        const jobs = await listChapterBatchGenerationJobs(workContext.selectedProjectId);
        const runningJob = jobs.find((item) => item.status === 'queued' || item.status === 'running') ?? jobs[0];
        if (!runningJob)
            return;
        applyAutoJobStatus(runningJob);
        if (autoGenerating.value)
            startAutoPolling();
    }
    catch {
        // Recent background jobs are best-effort UI state only.
    }
}
async function refreshAiConfig() {
    loadingAiConfig.value = true;
    try {
        configs.value = (await listProviderConfigs()).filter((item) => item.isEnabled);
        if (!configs.value.some((item) => item.providerId === selectedConfigId.value)) {
            selectedConfigId.value = configs.value[0]?.providerId ?? '';
        }
        refreshConfigAssets();
    }
    catch (err) {
        ElMessage.error(err.message || t('chapterGeneration.messages.loadAiConfigFailed'));
    }
    finally {
        loadingAiConfig.value = false;
    }
}
function refreshConfigAssets() {
    if (!selectedConfigId.value) {
        return;
    }
    const config = selectedConfig.value;
    if (config?.defaultEndpoint) {
        aiForm.value.endpoint = config.defaultEndpoint;
    }
    if (config?.modelCode) {
        aiForm.value.model = config.modelCode;
    }
}
async function generateDraft() {
    if (!validateGenerationSettings(true) || !selectedChapter.value)
        return;
    await generateDraftForChapter(selectedChapter.value);
}
async function createFirstChapterAndGenerate() {
    if (chapters.value.length > 0) {
        ElMessage.warning(t('chapterGeneration.messages.firstChapterAlreadyExists'));
        return;
    }
    if (!workContext.selectedProjectId || !workContext.selectedVolumeId) {
        ElMessage.warning(t('chapterGeneration.messages.selectProjectVolumeFirst'));
        return;
    }
    if (!chapterForm.title.trim()) {
        chapterForm.title = t('chapterGeneration.chapter.defaultFirstChapterTitle');
    }
    creatingAndGenerating.value = true;
    try {
        await quickCreateChapter();
        await generateDraft();
    }
    finally {
        creatingAndGenerating.value = false;
    }
}
async function saveDraft() {
    if (!selectedChapter.value)
        return;
    savingContent.value = true;
    try {
        selectedChapter.value = await saveChapterContent(selectedChapter.value.id, output.value, 'drafted');
        chapters.value = chapters.value.map((item) => (item.id === selectedChapter.value.id ? selectedChapter.value : item));
        ElMessage.success(t('chapterGeneration.messages.draftSaved'));
    }
    catch (err) {
        ElMessage.error(err.message || t('chapterGeneration.messages.saveDraftFailed'));
    }
    finally {
        savingContent.value = false;
    }
}
watch(() => [workContext.selectedProjectId, workContext.selectedVolumeId], refreshChapters);
watch(() => [autoForm.startChapterNumber, autoForm.count, autoForm.createMissing], clearAutoPreview);
watch(selectedChapterId, async () => {
    if (suppressChapterWatcher.value)
        return;
    await loadSelectedChapter();
});
watch(selectedConfigId, refreshConfigAssets);
watch(() => route.query, () => {
    syncChapterSelectionFromRoute();
    buildPromptFromChapter();
});
onMounted(async () => {
    aiStore.loadFromStorage();
    resetChapterForm();
    chatHub.onToken(onToken);
    chatHub.onStatus(onStatus);
    chatHub.onCompleted(onCompleted);
    chatHub.onError(onError);
    await workContext.init();
    await refreshAiConfig();
    await refreshChapters();
    await restoreLatestAutoJob();
    syncChapterSelectionFromRoute();
});
onBeforeUnmount(async () => {
    stopAutoPolling();
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
/** @type {__VLS_StyleScopedClasses['batch-controls']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-options']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-progress__meta']} */ ;
/** @type {__VLS_StyleScopedClasses['workspace-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-controls']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-console__head']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-progress__meta']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "chapter-generation" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "workspace-grid" },
});
const __VLS_0 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    shadow: "never",
    ...{ class: "chapter-panel" },
}));
const __VLS_2 = __VLS_1({
    shadow: "never",
    ...{ class: "chapter-panel" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_3.slots.default;
{
    const { header: __VLS_thisSlot } = __VLS_3.slots;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "panel-head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.t('chapterGeneration.chapter.panelTitle'));
    const __VLS_4 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
        ...{ 'onClick': {} },
        size: "small",
        icon: (__VLS_ctx.Refresh),
    }));
    const __VLS_6 = __VLS_5({
        ...{ 'onClick': {} },
        size: "small",
        icon: (__VLS_ctx.Refresh),
    }, ...__VLS_functionalComponentArgsRest(__VLS_5));
    let __VLS_8;
    let __VLS_9;
    let __VLS_10;
    const __VLS_11 = {
        onClick: (__VLS_ctx.refreshChapters)
    };
    __VLS_7.slots.default;
    (__VLS_ctx.t('chapterGeneration.chapter.refresh'));
    var __VLS_7;
}
if (!__VLS_ctx.workContext.selectedProjectId || !__VLS_ctx.workContext.selectedVolumeId) {
    const __VLS_12 = {}.ElEmpty;
    /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
    // @ts-ignore
    const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
        description: (__VLS_ctx.t('chapterGeneration.chapter.empty')),
    }));
    const __VLS_14 = __VLS_13({
        description: (__VLS_ctx.t('chapterGeneration.chapter.empty')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_13));
}
else {
    const __VLS_16 = {}.ElForm;
    /** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
    // @ts-ignore
    const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
        model: (__VLS_ctx.chapterForm),
        labelWidth: "96px",
        size: "small",
        ...{ class: "create-form" },
    }));
    const __VLS_18 = __VLS_17({
        model: (__VLS_ctx.chapterForm),
        labelWidth: "96px",
        size: "small",
        ...{ class: "create-form" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_17));
    __VLS_19.slots.default;
    const __VLS_20 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
        label: (__VLS_ctx.t('chapterGeneration.chapter.number')),
    }));
    const __VLS_22 = __VLS_21({
        label: (__VLS_ctx.t('chapterGeneration.chapter.number')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_21));
    __VLS_23.slots.default;
    const __VLS_24 = {}.ElInputNumber;
    /** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
    // @ts-ignore
    const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
        modelValue: (__VLS_ctx.chapterForm.chapterNumber),
        min: (1),
        controlsPosition: "right",
    }));
    const __VLS_26 = __VLS_25({
        modelValue: (__VLS_ctx.chapterForm.chapterNumber),
        min: (1),
        controlsPosition: "right",
    }, ...__VLS_functionalComponentArgsRest(__VLS_25));
    var __VLS_23;
    const __VLS_28 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
        label: (__VLS_ctx.t('chapterGeneration.chapter.title')),
    }));
    const __VLS_30 = __VLS_29({
        label: (__VLS_ctx.t('chapterGeneration.chapter.title')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_29));
    __VLS_31.slots.default;
    const __VLS_32 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
        modelValue: (__VLS_ctx.chapterForm.title),
        placeholder: (__VLS_ctx.t('chapterGeneration.chapter.titlePlaceholder')),
    }));
    const __VLS_34 = __VLS_33({
        modelValue: (__VLS_ctx.chapterForm.title),
        placeholder: (__VLS_ctx.t('chapterGeneration.chapter.titlePlaceholder')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_33));
    var __VLS_31;
    const __VLS_36 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
        label: (__VLS_ctx.t('chapterGeneration.chapter.summary')),
    }));
    const __VLS_38 = __VLS_37({
        label: (__VLS_ctx.t('chapterGeneration.chapter.summary')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_37));
    __VLS_39.slots.default;
    const __VLS_40 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
        modelValue: (__VLS_ctx.chapterForm.summary),
        type: "textarea",
        rows: (2),
        placeholder: (__VLS_ctx.t('chapterGeneration.chapter.summaryPlaceholder')),
    }));
    const __VLS_42 = __VLS_41({
        modelValue: (__VLS_ctx.chapterForm.summary),
        type: "textarea",
        rows: (2),
        placeholder: (__VLS_ctx.t('chapterGeneration.chapter.summaryPlaceholder')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_41));
    var __VLS_39;
    const __VLS_44 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({}));
    const __VLS_46 = __VLS_45({}, ...__VLS_functionalComponentArgsRest(__VLS_45));
    __VLS_47.slots.default;
    const __VLS_48 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
        ...{ 'onClick': {} },
        type: "primary",
        icon: (__VLS_ctx.Plus),
        loading: (__VLS_ctx.creatingChapter),
    }));
    const __VLS_50 = __VLS_49({
        ...{ 'onClick': {} },
        type: "primary",
        icon: (__VLS_ctx.Plus),
        loading: (__VLS_ctx.creatingChapter),
    }, ...__VLS_functionalComponentArgsRest(__VLS_49));
    let __VLS_52;
    let __VLS_53;
    let __VLS_54;
    const __VLS_55 = {
        onClick: (__VLS_ctx.quickCreateChapter)
    };
    __VLS_51.slots.default;
    (__VLS_ctx.t('chapterGeneration.chapter.create'));
    var __VLS_51;
    var __VLS_47;
    var __VLS_19;
    const __VLS_56 = {}.ElTable;
    /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
    // @ts-ignore
    const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
        ...{ 'onRowClick': {} },
        data: (__VLS_ctx.chapters),
        size: "small",
        highlightCurrentRow: true,
    }));
    const __VLS_58 = __VLS_57({
        ...{ 'onRowClick': {} },
        data: (__VLS_ctx.chapters),
        size: "small",
        highlightCurrentRow: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_57));
    let __VLS_60;
    let __VLS_61;
    let __VLS_62;
    const __VLS_63 = {
        onRowClick: ((row) => __VLS_ctx.selectedChapterId = row.id)
    };
    __VLS_asFunctionalDirective(__VLS_directives.vLoading)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.loadingChapters) }, null, null);
    __VLS_59.slots.default;
    const __VLS_64 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
        label: "#",
        prop: "chapterNumber",
        width: "56",
    }));
    const __VLS_66 = __VLS_65({
        label: "#",
        prop: "chapterNumber",
        width: "56",
    }, ...__VLS_functionalComponentArgsRest(__VLS_65));
    const __VLS_68 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
        label: (__VLS_ctx.t('chapterGeneration.chapter.tableTitle')),
        prop: "title",
        minWidth: "140",
    }));
    const __VLS_70 = __VLS_69({
        label: (__VLS_ctx.t('chapterGeneration.chapter.tableTitle')),
        prop: "title",
        minWidth: "140",
    }, ...__VLS_functionalComponentArgsRest(__VLS_69));
    const __VLS_72 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
        label: (__VLS_ctx.t('chapterGeneration.chapter.tableStatus')),
        prop: "status",
        width: "100",
    }));
    const __VLS_74 = __VLS_73({
        label: (__VLS_ctx.t('chapterGeneration.chapter.tableStatus')),
        prop: "status",
        width: "100",
    }, ...__VLS_functionalComponentArgsRest(__VLS_73));
    const __VLS_76 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({
        label: "",
        width: "52",
        align: "center",
    }));
    const __VLS_78 = __VLS_77({
        label: "",
        width: "52",
        align: "center",
    }, ...__VLS_functionalComponentArgsRest(__VLS_77));
    __VLS_79.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_79.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        const __VLS_80 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
            ...{ 'onClick': {} },
            text: true,
            type: "danger",
            icon: (__VLS_ctx.Delete),
        }));
        const __VLS_82 = __VLS_81({
            ...{ 'onClick': {} },
            text: true,
            type: "danger",
            icon: (__VLS_ctx.Delete),
        }, ...__VLS_functionalComponentArgsRest(__VLS_81));
        let __VLS_84;
        let __VLS_85;
        let __VLS_86;
        const __VLS_87 = {
            onClick: (...[$event]) => {
                if (!!(!__VLS_ctx.workContext.selectedProjectId || !__VLS_ctx.workContext.selectedVolumeId))
                    return;
                __VLS_ctx.removeChapter(row);
            }
        };
        var __VLS_83;
    }
    var __VLS_79;
    var __VLS_59;
}
var __VLS_3;
const __VLS_88 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
    shadow: "never",
    ...{ class: "generator-panel" },
}));
const __VLS_90 = __VLS_89({
    shadow: "never",
    ...{ class: "generator-panel" },
}, ...__VLS_functionalComponentArgsRest(__VLS_89));
__VLS_91.slots.default;
{
    const { header: __VLS_thisSlot } = __VLS_91.slots;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "panel-head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.selectedChapter
        ? __VLS_ctx.t('chapterGeneration.chapter.header', {
            number: __VLS_ctx.selectedChapter.chapterNumber,
            title: __VLS_ctx.selectedChapter.title
        })
        : __VLS_ctx.t('chapterGeneration.chapter.draftFallback'));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "head-actions" },
    });
    const __VLS_92 = {}.ElTag;
    /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
    // @ts-ignore
    const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({
        size: "small",
        type: "info",
    }));
    const __VLS_94 = __VLS_93({
        size: "small",
        type: "info",
    }, ...__VLS_functionalComponentArgsRest(__VLS_93));
    __VLS_95.slots.default;
    (__VLS_ctx.status);
    var __VLS_95;
    if (__VLS_ctx.lastGenerationRecordId) {
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
        (__VLS_ctx.t('chapterGeneration.status.record', { id: __VLS_ctx.lastGenerationRecordId.slice(0, 8) }));
        var __VLS_99;
    }
    const __VLS_100 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_101 = __VLS_asFunctionalComponent(__VLS_100, new __VLS_100({
        ...{ 'onClick': {} },
        size: "small",
        icon: (__VLS_ctx.DocumentChecked),
        loading: (__VLS_ctx.savingContent),
        disabled: (!__VLS_ctx.selectedChapter),
    }));
    const __VLS_102 = __VLS_101({
        ...{ 'onClick': {} },
        size: "small",
        icon: (__VLS_ctx.DocumentChecked),
        loading: (__VLS_ctx.savingContent),
        disabled: (!__VLS_ctx.selectedChapter),
    }, ...__VLS_functionalComponentArgsRest(__VLS_101));
    let __VLS_104;
    let __VLS_105;
    let __VLS_106;
    const __VLS_107 = {
        onClick: (__VLS_ctx.saveDraft)
    };
    __VLS_103.slots.default;
    (__VLS_ctx.t('chapterGeneration.actions.saveDraft'));
    var __VLS_103;
    const __VLS_108 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_109 = __VLS_asFunctionalComponent(__VLS_108, new __VLS_108({
        ...{ 'onClick': {} },
        size: "small",
        type: "warning",
        loading: (__VLS_ctx.creatingAndGenerating),
        disabled: (!__VLS_ctx.workContext.selectedProjectId || !__VLS_ctx.workContext.selectedVolumeId || __VLS_ctx.chapters.length > 0),
    }));
    const __VLS_110 = __VLS_109({
        ...{ 'onClick': {} },
        size: "small",
        type: "warning",
        loading: (__VLS_ctx.creatingAndGenerating),
        disabled: (!__VLS_ctx.workContext.selectedProjectId || !__VLS_ctx.workContext.selectedVolumeId || __VLS_ctx.chapters.length > 0),
    }, ...__VLS_functionalComponentArgsRest(__VLS_109));
    let __VLS_112;
    let __VLS_113;
    let __VLS_114;
    const __VLS_115 = {
        onClick: (__VLS_ctx.createFirstChapterAndGenerate)
    };
    __VLS_111.slots.default;
    (__VLS_ctx.t('chapterGeneration.actions.generateFirstChapter'));
    var __VLS_111;
    const __VLS_116 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_117 = __VLS_asFunctionalComponent(__VLS_116, new __VLS_116({
        ...{ 'onClick': {} },
        type: "primary",
        size: "small",
        icon: (__VLS_ctx.VideoPlay),
        loading: (__VLS_ctx.generating),
        disabled: (!__VLS_ctx.selectedChapter),
    }));
    const __VLS_118 = __VLS_117({
        ...{ 'onClick': {} },
        type: "primary",
        size: "small",
        icon: (__VLS_ctx.VideoPlay),
        loading: (__VLS_ctx.generating),
        disabled: (!__VLS_ctx.selectedChapter),
    }, ...__VLS_functionalComponentArgsRest(__VLS_117));
    let __VLS_120;
    let __VLS_121;
    let __VLS_122;
    const __VLS_123 = {
        onClick: (__VLS_ctx.generateDraft)
    };
    __VLS_119.slots.default;
    (__VLS_ctx.t('chapterGeneration.actions.generateDraft'));
    var __VLS_119;
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "batch-console" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "batch-console__head" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "batch-console__title" },
});
(__VLS_ctx.t('chapterGeneration.batch.title'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "batch-console__subtitle" },
});
(__VLS_ctx.t('chapterGeneration.batch.subtitle'));
if (__VLS_ctx.autoJobId) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "batch-console__job" },
    });
    const __VLS_124 = {}.ElTag;
    /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
    // @ts-ignore
    const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({
        size: "small",
        type: (__VLS_ctx.autoGenerating ? 'warning' : 'success'),
    }));
    const __VLS_126 = __VLS_125({
        size: "small",
        type: (__VLS_ctx.autoGenerating ? 'warning' : 'success'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_125));
    __VLS_127.slots.default;
    (__VLS_ctx.autoJobStatusLabel);
    var __VLS_127;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.t('chapterGeneration.batch.jobId', { id: __VLS_ctx.autoJobId }));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "batch-console__actions" },
});
if (__VLS_ctx.autoGenerating) {
    const __VLS_128 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_129 = __VLS_asFunctionalComponent(__VLS_128, new __VLS_128({
        ...{ 'onClick': {} },
        size: "small",
        type: "danger",
        icon: (__VLS_ctx.Close),
    }));
    const __VLS_130 = __VLS_129({
        ...{ 'onClick': {} },
        size: "small",
        type: "danger",
        icon: (__VLS_ctx.Close),
    }, ...__VLS_functionalComponentArgsRest(__VLS_129));
    let __VLS_132;
    let __VLS_133;
    let __VLS_134;
    const __VLS_135 = {
        onClick: (__VLS_ctx.requestStopAutoGeneration)
    };
    __VLS_131.slots.default;
    (__VLS_ctx.t('chapterGeneration.batch.stop'));
    var __VLS_131;
}
else {
    const __VLS_136 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_137 = __VLS_asFunctionalComponent(__VLS_136, new __VLS_136({
        ...{ 'onClick': {} },
        size: "small",
        type: "primary",
        icon: (__VLS_ctx.DocumentChecked),
        loading: (__VLS_ctx.autoPreviewing),
        disabled: (!__VLS_ctx.workContext.selectedProjectId || !__VLS_ctx.workContext.selectedVolumeId || __VLS_ctx.generating),
    }));
    const __VLS_138 = __VLS_137({
        ...{ 'onClick': {} },
        size: "small",
        type: "primary",
        icon: (__VLS_ctx.DocumentChecked),
        loading: (__VLS_ctx.autoPreviewing),
        disabled: (!__VLS_ctx.workContext.selectedProjectId || !__VLS_ctx.workContext.selectedVolumeId || __VLS_ctx.generating),
    }, ...__VLS_functionalComponentArgsRest(__VLS_137));
    let __VLS_140;
    let __VLS_141;
    let __VLS_142;
    const __VLS_143 = {
        onClick: (__VLS_ctx.previewBatchDrafts)
    };
    __VLS_139.slots.default;
    (__VLS_ctx.t('chapterGeneration.batch.preview'));
    var __VLS_139;
}
if (!__VLS_ctx.autoGenerating) {
    const __VLS_144 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_145 = __VLS_asFunctionalComponent(__VLS_144, new __VLS_144({
        ...{ 'onClick': {} },
        size: "small",
        type: "success",
        icon: (__VLS_ctx.VideoPlay),
        disabled: (!__VLS_ctx.workContext.selectedProjectId || !__VLS_ctx.workContext.selectedVolumeId || __VLS_ctx.generating || __VLS_ctx.autoPreviewItems.length === 0),
    }));
    const __VLS_146 = __VLS_145({
        ...{ 'onClick': {} },
        size: "small",
        type: "success",
        icon: (__VLS_ctx.VideoPlay),
        disabled: (!__VLS_ctx.workContext.selectedProjectId || !__VLS_ctx.workContext.selectedVolumeId || __VLS_ctx.generating || __VLS_ctx.autoPreviewItems.length === 0),
    }, ...__VLS_functionalComponentArgsRest(__VLS_145));
    let __VLS_148;
    let __VLS_149;
    let __VLS_150;
    const __VLS_151 = {
        onClick: (__VLS_ctx.generateBatchDrafts)
    };
    __VLS_147.slots.default;
    (__VLS_ctx.t('chapterGeneration.batch.confirmStart'));
    var __VLS_147;
}
const __VLS_152 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_153 = __VLS_asFunctionalComponent(__VLS_152, new __VLS_152({
    labelWidth: "110px",
    ...{ class: "batch-form" },
}));
const __VLS_154 = __VLS_153({
    labelWidth: "110px",
    ...{ class: "batch-form" },
}, ...__VLS_functionalComponentArgsRest(__VLS_153));
__VLS_155.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "batch-controls" },
});
const __VLS_156 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_157 = __VLS_asFunctionalComponent(__VLS_156, new __VLS_156({
    label: (__VLS_ctx.t('chapterGeneration.batch.startNumber')),
}));
const __VLS_158 = __VLS_157({
    label: (__VLS_ctx.t('chapterGeneration.batch.startNumber')),
}, ...__VLS_functionalComponentArgsRest(__VLS_157));
__VLS_159.slots.default;
const __VLS_160 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_161 = __VLS_asFunctionalComponent(__VLS_160, new __VLS_160({
    modelValue: (__VLS_ctx.autoForm.startChapterNumber),
    min: (1),
    disabled: (__VLS_ctx.autoGenerating),
    controlsPosition: "right",
}));
const __VLS_162 = __VLS_161({
    modelValue: (__VLS_ctx.autoForm.startChapterNumber),
    min: (1),
    disabled: (__VLS_ctx.autoGenerating),
    controlsPosition: "right",
}, ...__VLS_functionalComponentArgsRest(__VLS_161));
var __VLS_159;
const __VLS_164 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_165 = __VLS_asFunctionalComponent(__VLS_164, new __VLS_164({
    label: (__VLS_ctx.t('chapterGeneration.batch.count')),
}));
const __VLS_166 = __VLS_165({
    label: (__VLS_ctx.t('chapterGeneration.batch.count')),
}, ...__VLS_functionalComponentArgsRest(__VLS_165));
__VLS_167.slots.default;
const __VLS_168 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_169 = __VLS_asFunctionalComponent(__VLS_168, new __VLS_168({
    modelValue: (__VLS_ctx.autoForm.count),
    min: (1),
    max: (200),
    disabled: (__VLS_ctx.autoGenerating),
    controlsPosition: "right",
}));
const __VLS_170 = __VLS_169({
    modelValue: (__VLS_ctx.autoForm.count),
    min: (1),
    max: (200),
    disabled: (__VLS_ctx.autoGenerating),
    controlsPosition: "right",
}, ...__VLS_functionalComponentArgsRest(__VLS_169));
var __VLS_167;
const __VLS_172 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_173 = __VLS_asFunctionalComponent(__VLS_172, new __VLS_172({
    label: (__VLS_ctx.t('chapterGeneration.batch.options')),
}));
const __VLS_174 = __VLS_173({
    label: (__VLS_ctx.t('chapterGeneration.batch.options')),
}, ...__VLS_functionalComponentArgsRest(__VLS_173));
__VLS_175.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "batch-options" },
});
const __VLS_176 = {}.ElCheckbox;
/** @type {[typeof __VLS_components.ElCheckbox, typeof __VLS_components.elCheckbox, typeof __VLS_components.ElCheckbox, typeof __VLS_components.elCheckbox, ]} */ ;
// @ts-ignore
const __VLS_177 = __VLS_asFunctionalComponent(__VLS_176, new __VLS_176({
    modelValue: (__VLS_ctx.autoForm.createMissing),
    disabled: (__VLS_ctx.autoGenerating),
}));
const __VLS_178 = __VLS_177({
    modelValue: (__VLS_ctx.autoForm.createMissing),
    disabled: (__VLS_ctx.autoGenerating),
}, ...__VLS_functionalComponentArgsRest(__VLS_177));
__VLS_179.slots.default;
(__VLS_ctx.t('chapterGeneration.batch.createMissing'));
var __VLS_179;
const __VLS_180 = {}.ElCheckbox;
/** @type {[typeof __VLS_components.ElCheckbox, typeof __VLS_components.elCheckbox, typeof __VLS_components.ElCheckbox, typeof __VLS_components.elCheckbox, ]} */ ;
// @ts-ignore
const __VLS_181 = __VLS_asFunctionalComponent(__VLS_180, new __VLS_180({
    modelValue: (__VLS_ctx.autoForm.overwriteExisting),
    disabled: (__VLS_ctx.autoGenerating),
}));
const __VLS_182 = __VLS_181({
    modelValue: (__VLS_ctx.autoForm.overwriteExisting),
    disabled: (__VLS_ctx.autoGenerating),
}, ...__VLS_functionalComponentArgsRest(__VLS_181));
__VLS_183.slots.default;
(__VLS_ctx.t('chapterGeneration.batch.overwriteExisting'));
var __VLS_183;
const __VLS_184 = {}.ElCheckbox;
/** @type {[typeof __VLS_components.ElCheckbox, typeof __VLS_components.elCheckbox, typeof __VLS_components.ElCheckbox, typeof __VLS_components.elCheckbox, ]} */ ;
// @ts-ignore
const __VLS_185 = __VLS_asFunctionalComponent(__VLS_184, new __VLS_184({
    modelValue: (__VLS_ctx.autoForm.stopOnFailure),
    disabled: (__VLS_ctx.autoGenerating),
}));
const __VLS_186 = __VLS_185({
    modelValue: (__VLS_ctx.autoForm.stopOnFailure),
    disabled: (__VLS_ctx.autoGenerating),
}, ...__VLS_functionalComponentArgsRest(__VLS_185));
__VLS_187.slots.default;
(__VLS_ctx.t('chapterGeneration.batch.stopOnFailure'));
var __VLS_187;
var __VLS_175;
if (__VLS_ctx.autoPreviewItems.length) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "batch-preview" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "batch-preview__head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "batch-preview__title" },
    });
    (__VLS_ctx.t('chapterGeneration.batch.previewTitle'));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "batch-preview__subtitle" },
    });
    (__VLS_ctx.t('chapterGeneration.batch.previewSubtitle'));
    const __VLS_188 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_189 = __VLS_asFunctionalComponent(__VLS_188, new __VLS_188({
        ...{ 'onClick': {} },
        size: "small",
        text: true,
        icon: (__VLS_ctx.Refresh),
        loading: (__VLS_ctx.autoPreviewing),
    }));
    const __VLS_190 = __VLS_189({
        ...{ 'onClick': {} },
        size: "small",
        text: true,
        icon: (__VLS_ctx.Refresh),
        loading: (__VLS_ctx.autoPreviewing),
    }, ...__VLS_functionalComponentArgsRest(__VLS_189));
    let __VLS_192;
    let __VLS_193;
    let __VLS_194;
    const __VLS_195 = {
        onClick: (__VLS_ctx.previewBatchDrafts)
    };
    __VLS_191.slots.default;
    (__VLS_ctx.t('chapterGeneration.batch.refreshPreview'));
    var __VLS_191;
    const __VLS_196 = {}.ElTable;
    /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
    // @ts-ignore
    const __VLS_197 = __VLS_asFunctionalComponent(__VLS_196, new __VLS_196({
        data: (__VLS_ctx.autoPreviewItems),
        size: "small",
        ...{ class: "batch-preview__table" },
    }));
    const __VLS_198 = __VLS_197({
        data: (__VLS_ctx.autoPreviewItems),
        size: "small",
        ...{ class: "batch-preview__table" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_197));
    __VLS_199.slots.default;
    const __VLS_200 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_201 = __VLS_asFunctionalComponent(__VLS_200, new __VLS_200({
        label: (__VLS_ctx.t('chapterGeneration.batch.previewNumber')),
        prop: "chapterNumber",
        width: "72",
    }));
    const __VLS_202 = __VLS_201({
        label: (__VLS_ctx.t('chapterGeneration.batch.previewNumber')),
        prop: "chapterNumber",
        width: "72",
    }, ...__VLS_functionalComponentArgsRest(__VLS_201));
    const __VLS_204 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_205 = __VLS_asFunctionalComponent(__VLS_204, new __VLS_204({
        label: (__VLS_ctx.t('chapterGeneration.batch.previewTitleColumn')),
        minWidth: "180",
    }));
    const __VLS_206 = __VLS_205({
        label: (__VLS_ctx.t('chapterGeneration.batch.previewTitleColumn')),
        minWidth: "180",
    }, ...__VLS_functionalComponentArgsRest(__VLS_205));
    __VLS_207.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_207.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        const __VLS_208 = {}.ElInput;
        /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
        // @ts-ignore
        const __VLS_209 = __VLS_asFunctionalComponent(__VLS_208, new __VLS_208({
            modelValue: (row.title),
            size: "small",
        }));
        const __VLS_210 = __VLS_209({
            modelValue: (row.title),
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_209));
    }
    var __VLS_207;
    const __VLS_212 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_213 = __VLS_asFunctionalComponent(__VLS_212, new __VLS_212({
        label: (__VLS_ctx.t('chapterGeneration.batch.previewSummaryColumn')),
        minWidth: "320",
    }));
    const __VLS_214 = __VLS_213({
        label: (__VLS_ctx.t('chapterGeneration.batch.previewSummaryColumn')),
        minWidth: "320",
    }, ...__VLS_functionalComponentArgsRest(__VLS_213));
    __VLS_215.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_215.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        const __VLS_216 = {}.ElInput;
        /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
        // @ts-ignore
        const __VLS_217 = __VLS_asFunctionalComponent(__VLS_216, new __VLS_216({
            modelValue: (row.summary),
            size: "small",
            type: "textarea",
            rows: (2),
        }));
        const __VLS_218 = __VLS_217({
            modelValue: (row.summary),
            size: "small",
            type: "textarea",
            rows: (2),
        }, ...__VLS_functionalComponentArgsRest(__VLS_217));
    }
    var __VLS_215;
    const __VLS_220 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_221 = __VLS_asFunctionalComponent(__VLS_220, new __VLS_220({
        label: (__VLS_ctx.t('chapterGeneration.batch.previewState')),
        width: "120",
    }));
    const __VLS_222 = __VLS_221({
        label: (__VLS_ctx.t('chapterGeneration.batch.previewState')),
        width: "120",
    }, ...__VLS_functionalComponentArgsRest(__VLS_221));
    __VLS_223.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_223.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        const __VLS_224 = {}.ElTag;
        /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
        // @ts-ignore
        const __VLS_225 = __VLS_asFunctionalComponent(__VLS_224, new __VLS_224({
            size: "small",
            type: (row.hasContent ? 'warning' : row.exists ? 'info' : 'success'),
        }));
        const __VLS_226 = __VLS_225({
            size: "small",
            type: (row.hasContent ? 'warning' : row.exists ? 'info' : 'success'),
        }, ...__VLS_functionalComponentArgsRest(__VLS_225));
        __VLS_227.slots.default;
        (row.hasContent
            ? __VLS_ctx.t('chapterGeneration.batch.previewHasContent')
            : row.exists
                ? __VLS_ctx.t('chapterGeneration.batch.previewExists')
                : __VLS_ctx.t('chapterGeneration.batch.previewNew'));
        var __VLS_227;
    }
    var __VLS_223;
    var __VLS_199;
}
if (__VLS_ctx.autoGenerating || __VLS_ctx.autoProgress.total) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "batch-progress" },
    });
    const __VLS_228 = {}.ElProgress;
    /** @type {[typeof __VLS_components.ElProgress, typeof __VLS_components.elProgress, ]} */ ;
    // @ts-ignore
    const __VLS_229 = __VLS_asFunctionalComponent(__VLS_228, new __VLS_228({
        percentage: (__VLS_ctx.autoProgressPercent),
        strokeWidth: (8),
    }));
    const __VLS_230 = __VLS_229({
        percentage: (__VLS_ctx.autoProgressPercent),
        strokeWidth: (8),
    }, ...__VLS_functionalComponentArgsRest(__VLS_229));
    if (__VLS_ctx.autoJobStatus?.message) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "batch-message" },
        });
        (__VLS_ctx.autoJobStatus.message);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "batch-progress__meta" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.t('chapterGeneration.batch.progress', {
        completed: __VLS_ctx.autoProgress.completed,
        skipped: __VLS_ctx.autoProgress.skipped,
        failed: __VLS_ctx.autoProgress.failed,
        total: __VLS_ctx.autoProgress.total
    }));
    if (__VLS_ctx.autoProgress.currentNumber) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.t('chapterGeneration.batch.current', {
            number: __VLS_ctx.autoProgress.currentNumber,
            title: __VLS_ctx.autoProgress.currentTitle || '-'
        }));
    }
    if (__VLS_ctx.autoLog.length) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "batch-log" },
        });
        for (const [item, index] of __VLS_getVForSourceType((__VLS_ctx.autoLog))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                key: (index),
                ...{ class: "batch-log__item" },
            });
            (item);
        }
    }
}
var __VLS_155;
const __VLS_232 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_233 = __VLS_asFunctionalComponent(__VLS_232, new __VLS_232({
    labelWidth: "110px",
    ...{ class: "ai-form" },
    disabled: (__VLS_ctx.generating),
}));
const __VLS_234 = __VLS_233({
    labelWidth: "110px",
    ...{ class: "ai-form" },
    disabled: (__VLS_ctx.generating),
}, ...__VLS_functionalComponentArgsRest(__VLS_233));
__VLS_235.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "ai-source-bar" },
});
const __VLS_236 = {}.ElSwitch;
/** @type {[typeof __VLS_components.ElSwitch, typeof __VLS_components.elSwitch, ]} */ ;
// @ts-ignore
const __VLS_237 = __VLS_asFunctionalComponent(__VLS_236, new __VLS_236({
    modelValue: (__VLS_ctx.rerunValidationAfterSave),
    activeText: (__VLS_ctx.t('chapterGeneration.ai.autoRerunValidation')),
    inactiveText: (__VLS_ctx.t('chapterGeneration.ai.manualValidation')),
}));
const __VLS_238 = __VLS_237({
    modelValue: (__VLS_ctx.rerunValidationAfterSave),
    activeText: (__VLS_ctx.t('chapterGeneration.ai.autoRerunValidation')),
    inactiveText: (__VLS_ctx.t('chapterGeneration.ai.manualValidation')),
}, ...__VLS_functionalComponentArgsRest(__VLS_237));
const __VLS_240 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_241 = __VLS_asFunctionalComponent(__VLS_240, new __VLS_240({
    ...{ 'onClick': {} },
    size: "small",
    icon: (__VLS_ctx.Refresh),
    loading: (__VLS_ctx.loadingAiConfig),
}));
const __VLS_242 = __VLS_241({
    ...{ 'onClick': {} },
    size: "small",
    icon: (__VLS_ctx.Refresh),
    loading: (__VLS_ctx.loadingAiConfig),
}, ...__VLS_functionalComponentArgsRest(__VLS_241));
let __VLS_244;
let __VLS_245;
let __VLS_246;
const __VLS_247 = {
    onClick: (__VLS_ctx.refreshAiConfig)
};
__VLS_243.slots.default;
(__VLS_ctx.t('chapterGeneration.actions.refreshAiConfig'));
var __VLS_243;
const __VLS_248 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_249 = __VLS_asFunctionalComponent(__VLS_248, new __VLS_248({
    label: (__VLS_ctx.t('chapterGeneration.ai.config')),
}));
const __VLS_250 = __VLS_249({
    label: (__VLS_ctx.t('chapterGeneration.ai.config')),
}, ...__VLS_functionalComponentArgsRest(__VLS_249));
__VLS_251.slots.default;
const __VLS_252 = {}.ElSelect;
/** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
// @ts-ignore
const __VLS_253 = __VLS_asFunctionalComponent(__VLS_252, new __VLS_252({
    modelValue: (__VLS_ctx.selectedConfigId),
    placeholder: (__VLS_ctx.t('chapterGeneration.ai.selectConfig')),
    filterable: true,
    clearable: true,
}));
const __VLS_254 = __VLS_253({
    modelValue: (__VLS_ctx.selectedConfigId),
    placeholder: (__VLS_ctx.t('chapterGeneration.ai.selectConfig')),
    filterable: true,
    clearable: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_253));
__VLS_255.slots.default;
for (const [config] of __VLS_getVForSourceType((__VLS_ctx.configs))) {
    const __VLS_256 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_257 = __VLS_asFunctionalComponent(__VLS_256, new __VLS_256({
        key: (config.providerId),
        label: (`${config.name} / ${config.modelCode || '--'}`),
        value: (config.providerId),
    }));
    const __VLS_258 = __VLS_257({
        key: (config.providerId),
        label: (`${config.name} / ${config.modelCode || '--'}`),
        value: (config.providerId),
    }, ...__VLS_functionalComponentArgsRest(__VLS_257));
}
var __VLS_255;
var __VLS_251;
const __VLS_260 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_261 = __VLS_asFunctionalComponent(__VLS_260, new __VLS_260({
    label: (__VLS_ctx.t('chapterGeneration.ai.apiKey')),
}));
const __VLS_262 = __VLS_261({
    label: (__VLS_ctx.t('chapterGeneration.ai.apiKey')),
}, ...__VLS_functionalComponentArgsRest(__VLS_261));
__VLS_263.slots.default;
const __VLS_264 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_265 = __VLS_asFunctionalComponent(__VLS_264, new __VLS_264({
    modelValue: (__VLS_ctx.aiForm.apiKey),
    type: "password",
    showPassword: true,
    placeholder: (__VLS_ctx.t('chapterGeneration.ai.apiKeyPlaceholder')),
}));
const __VLS_266 = __VLS_265({
    modelValue: (__VLS_ctx.aiForm.apiKey),
    type: "password",
    showPassword: true,
    placeholder: (__VLS_ctx.t('chapterGeneration.ai.apiKeyPlaceholder')),
}, ...__VLS_functionalComponentArgsRest(__VLS_265));
var __VLS_263;
const __VLS_268 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_269 = __VLS_asFunctionalComponent(__VLS_268, new __VLS_268({
    label: (__VLS_ctx.t('chapterGeneration.ai.model')),
}));
const __VLS_270 = __VLS_269({
    label: (__VLS_ctx.t('chapterGeneration.ai.model')),
}, ...__VLS_functionalComponentArgsRest(__VLS_269));
__VLS_271.slots.default;
const __VLS_272 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_273 = __VLS_asFunctionalComponent(__VLS_272, new __VLS_272({
    modelValue: (__VLS_ctx.aiForm.model),
    placeholder: (__VLS_ctx.t('chapterGeneration.ai.modelPlaceholder')),
}));
const __VLS_274 = __VLS_273({
    modelValue: (__VLS_ctx.aiForm.model),
    placeholder: (__VLS_ctx.t('chapterGeneration.ai.modelPlaceholder')),
}, ...__VLS_functionalComponentArgsRest(__VLS_273));
var __VLS_271;
const __VLS_276 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_277 = __VLS_asFunctionalComponent(__VLS_276, new __VLS_276({
    label: (__VLS_ctx.t('chapterGeneration.ai.endpoint')),
}));
const __VLS_278 = __VLS_277({
    label: (__VLS_ctx.t('chapterGeneration.ai.endpoint')),
}, ...__VLS_functionalComponentArgsRest(__VLS_277));
__VLS_279.slots.default;
const __VLS_280 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_281 = __VLS_asFunctionalComponent(__VLS_280, new __VLS_280({
    modelValue: (__VLS_ctx.aiForm.endpoint),
    placeholder: (__VLS_ctx.t('chapterGeneration.ai.endpointPlaceholder')),
}));
const __VLS_282 = __VLS_281({
    modelValue: (__VLS_ctx.aiForm.endpoint),
    placeholder: (__VLS_ctx.t('chapterGeneration.ai.endpointPlaceholder')),
}, ...__VLS_functionalComponentArgsRest(__VLS_281));
var __VLS_279;
const __VLS_284 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_285 = __VLS_asFunctionalComponent(__VLS_284, new __VLS_284({
    label: (__VLS_ctx.t('chapterGeneration.ai.systemPrompt')),
}));
const __VLS_286 = __VLS_285({
    label: (__VLS_ctx.t('chapterGeneration.ai.systemPrompt')),
}, ...__VLS_functionalComponentArgsRest(__VLS_285));
__VLS_287.slots.default;
const __VLS_288 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_289 = __VLS_asFunctionalComponent(__VLS_288, new __VLS_288({
    modelValue: (__VLS_ctx.promptForm.systemPrompt),
    type: "textarea",
    rows: (2),
}));
const __VLS_290 = __VLS_289({
    modelValue: (__VLS_ctx.promptForm.systemPrompt),
    type: "textarea",
    rows: (2),
}, ...__VLS_functionalComponentArgsRest(__VLS_289));
var __VLS_287;
const __VLS_292 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_293 = __VLS_asFunctionalComponent(__VLS_292, new __VLS_292({
    label: (__VLS_ctx.t('chapterGeneration.ai.prompt')),
}));
const __VLS_294 = __VLS_293({
    label: (__VLS_ctx.t('chapterGeneration.ai.prompt')),
}, ...__VLS_functionalComponentArgsRest(__VLS_293));
__VLS_295.slots.default;
const __VLS_296 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_297 = __VLS_asFunctionalComponent(__VLS_296, new __VLS_296({
    modelValue: (__VLS_ctx.promptForm.prompt),
    type: "textarea",
    rows: (5),
}));
const __VLS_298 = __VLS_297({
    modelValue: (__VLS_ctx.promptForm.prompt),
    type: "textarea",
    rows: (5),
}, ...__VLS_functionalComponentArgsRest(__VLS_297));
var __VLS_295;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "inline-controls" },
});
const __VLS_300 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_301 = __VLS_asFunctionalComponent(__VLS_300, new __VLS_300({
    label: (__VLS_ctx.t('chapterGeneration.ai.temperature')),
}));
const __VLS_302 = __VLS_301({
    label: (__VLS_ctx.t('chapterGeneration.ai.temperature')),
}, ...__VLS_functionalComponentArgsRest(__VLS_301));
__VLS_303.slots.default;
const __VLS_304 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_305 = __VLS_asFunctionalComponent(__VLS_304, new __VLS_304({
    modelValue: (__VLS_ctx.promptForm.temperature),
    min: (0),
    max: (2),
    step: (0.1),
}));
const __VLS_306 = __VLS_305({
    modelValue: (__VLS_ctx.promptForm.temperature),
    min: (0),
    max: (2),
    step: (0.1),
}, ...__VLS_functionalComponentArgsRest(__VLS_305));
var __VLS_303;
const __VLS_308 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_309 = __VLS_asFunctionalComponent(__VLS_308, new __VLS_308({
    label: (__VLS_ctx.t('chapterGeneration.ai.maxTokens')),
}));
const __VLS_310 = __VLS_309({
    label: (__VLS_ctx.t('chapterGeneration.ai.maxTokens')),
}, ...__VLS_functionalComponentArgsRest(__VLS_309));
__VLS_311.slots.default;
const __VLS_312 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_313 = __VLS_asFunctionalComponent(__VLS_312, new __VLS_312({
    modelValue: (__VLS_ctx.promptForm.maxTokens),
    min: (256),
    max: (12000),
    step: (256),
}));
const __VLS_314 = __VLS_313({
    modelValue: (__VLS_ctx.promptForm.maxTokens),
    min: (256),
    max: (12000),
    step: (256),
}, ...__VLS_functionalComponentArgsRest(__VLS_313));
var __VLS_311;
const __VLS_316 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_317 = __VLS_asFunctionalComponent(__VLS_316, new __VLS_316({
    label: (__VLS_ctx.t('chapterGeneration.ai.maxRewrites')),
}));
const __VLS_318 = __VLS_317({
    label: (__VLS_ctx.t('chapterGeneration.ai.maxRewrites')),
}, ...__VLS_functionalComponentArgsRest(__VLS_317));
__VLS_319.slots.default;
const __VLS_320 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_321 = __VLS_asFunctionalComponent(__VLS_320, new __VLS_320({
    modelValue: (__VLS_ctx.promptForm.maxRewriteAttempts),
    min: (0),
    max: (3),
    step: (1),
}));
const __VLS_322 = __VLS_321({
    modelValue: (__VLS_ctx.promptForm.maxRewriteAttempts),
    min: (0),
    max: (3),
    step: (1),
}, ...__VLS_functionalComponentArgsRest(__VLS_321));
var __VLS_319;
var __VLS_235;
if (__VLS_ctx.error) {
    const __VLS_324 = {}.ElAlert;
    /** @type {[typeof __VLS_components.ElAlert, typeof __VLS_components.elAlert, ]} */ ;
    // @ts-ignore
    const __VLS_325 = __VLS_asFunctionalComponent(__VLS_324, new __VLS_324({
        title: (__VLS_ctx.error),
        type: "error",
        showIcon: true,
        closable: (false),
    }));
    const __VLS_326 = __VLS_325({
        title: (__VLS_ctx.error),
        type: "error",
        showIcon: true,
        closable: (false),
    }, ...__VLS_functionalComponentArgsRest(__VLS_325));
}
if (__VLS_ctx.latestValidationSummary) {
    const __VLS_328 = {}.ElAlert;
    /** @type {[typeof __VLS_components.ElAlert, typeof __VLS_components.elAlert, ]} */ ;
    // @ts-ignore
    const __VLS_329 = __VLS_asFunctionalComponent(__VLS_328, new __VLS_328({
        title: (__VLS_ctx.latestValidationSummary),
        type: "success",
        showIcon: true,
        closable: (false),
        ...{ style: {} },
    }));
    const __VLS_330 = __VLS_329({
        title: (__VLS_ctx.latestValidationSummary),
        type: "success",
        showIcon: true,
        closable: (false),
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_329));
}
const __VLS_332 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_333 = __VLS_asFunctionalComponent(__VLS_332, new __VLS_332({
    modelValue: (__VLS_ctx.output),
    type: "textarea",
    rows: (18),
    ...{ class: "draft-output" },
    placeholder: (__VLS_ctx.t('chapterGeneration.ai.outputPlaceholder')),
}));
const __VLS_334 = __VLS_333({
    modelValue: (__VLS_ctx.output),
    type: "textarea",
    rows: (18),
    ...{ class: "draft-output" },
    placeholder: (__VLS_ctx.t('chapterGeneration.ai.outputPlaceholder')),
}, ...__VLS_functionalComponentArgsRest(__VLS_333));
var __VLS_91;
/** @type {__VLS_StyleScopedClasses['chapter-generation']} */ ;
/** @type {__VLS_StyleScopedClasses['workspace-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['chapter-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-head']} */ ;
/** @type {__VLS_StyleScopedClasses['create-form']} */ ;
/** @type {__VLS_StyleScopedClasses['generator-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-head']} */ ;
/** @type {__VLS_StyleScopedClasses['head-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-console']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-console__head']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-console__title']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-console__subtitle']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-console__job']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-console__actions']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-form']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-controls']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-options']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-preview']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-preview__head']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-preview__title']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-preview__subtitle']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-preview__table']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-progress']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-message']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-progress__meta']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-log']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-log__item']} */ ;
/** @type {__VLS_StyleScopedClasses['ai-form']} */ ;
/** @type {__VLS_StyleScopedClasses['ai-source-bar']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-controls']} */ ;
/** @type {__VLS_StyleScopedClasses['draft-output']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Plus: Plus,
            Refresh: Refresh,
            Delete: Delete,
            VideoPlay: VideoPlay,
            DocumentChecked: DocumentChecked,
            Close: Close,
            workContext: workContext,
            aiForm: aiForm,
            t: t,
            chapters: chapters,
            selectedChapterId: selectedChapterId,
            selectedChapter: selectedChapter,
            loadingChapters: loadingChapters,
            creatingChapter: creatingChapter,
            generating: generating,
            savingContent: savingContent,
            loadingAiConfig: loadingAiConfig,
            output: output,
            status: status,
            error: error,
            lastGenerationRecordId: lastGenerationRecordId,
            creatingAndGenerating: creatingAndGenerating,
            rerunValidationAfterSave: rerunValidationAfterSave,
            latestValidationSummary: latestValidationSummary,
            configs: configs,
            selectedConfigId: selectedConfigId,
            autoGenerating: autoGenerating,
            autoLog: autoLog,
            autoJobId: autoJobId,
            autoJobStatus: autoJobStatus,
            autoPreviewing: autoPreviewing,
            autoPreviewItems: autoPreviewItems,
            autoProgress: autoProgress,
            chapterForm: chapterForm,
            promptForm: promptForm,
            autoForm: autoForm,
            autoProgressPercent: autoProgressPercent,
            autoJobStatusLabel: autoJobStatusLabel,
            refreshChapters: refreshChapters,
            quickCreateChapter: quickCreateChapter,
            removeChapter: removeChapter,
            requestStopAutoGeneration: requestStopAutoGeneration,
            previewBatchDrafts: previewBatchDrafts,
            generateBatchDrafts: generateBatchDrafts,
            refreshAiConfig: refreshAiConfig,
            generateDraft: generateDraft,
            createFirstChapterAndGenerate: createFirstChapterAndGenerate,
            saveDraft: saveDraft,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
