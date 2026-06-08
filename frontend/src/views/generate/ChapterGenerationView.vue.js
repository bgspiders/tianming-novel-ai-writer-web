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
import { analyzeGeneratedChapter, cancelChapterBatchGeneration, composeSceneDrafts, confirmChapterGenerationPreview, createChapter, deleteChapter, generateChapterDraft, generateSceneDraft, getChapterBatchGenerationStatus, getChapter, ensureSceneBlueprints, listChapters, listChapterBatchGenerationJobs, previewChapterBatchGeneration, queueChapterBatchGeneration, runGenerationPreflight, saveChapterContent } from '@/api/modules/chapters';
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
const generationMode = ref('single');
const workflowLoading = ref(false);
const sceneGenerating = ref(false);
const sceneComposing = ref(false);
const analyzingChapter = ref(false);
const ensuringSceneBlueprints = ref(false);
const confirmingPreview = ref(false);
const loopRunning = ref(false);
const loopStage = ref('');
const loopLog = ref([]);
const confirmedPreview = ref(null);
const preflightResult = ref(null);
const sceneDraftResult = ref(null);
const chapterAnalysisResult = ref(null);
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
    stopOnFailure: true,
    autoContinuityMode: true
});
const workflowForm = reactive({
    sceneNumber: 1,
    scenePrompt: '按当前章节蓝图生成这个场景正文，保持与上一场景连贯。',
    minWordCount: 2500
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
const selectedPreviewItem = computed(() => {
    if (!selectedChapter.value)
        return null;
    return autoPreviewItems.value.find((item) => item.chapterNumber === selectedChapter.value?.chapterNumber)
        ?? (autoPreviewItems.value.length === 1 ? autoPreviewItems.value[0] : null);
});
const generationModeLabel = computed(() => generationMode.value === 'single' ? '单章精写闭环' : '批量连续生成');
const generationModeDescription = computed(() => generationMode.value === 'single'
    ? '当前只处理选中的这一章：确认标题和场景蓝图后，按场景写正文、合成并分析。'
    : '按章节号连续生成多章：先确认标题简介，再交给后台队列自动生成并保存。');
const generationModeToggleText = computed(() => generationMode.value === 'single' ? '切换到批量连续生成' : '切换到单章精写闭环');
const canEnsureSceneBlueprints = computed(() => Boolean(selectedChapter.value
    && workContext.selectedProjectId
    && preflightResult.value?.items.some((item) => item.code === 'missing_scene_blueprints')));
const canConfirmSelectedPreview = computed(() => Boolean(selectedChapter.value && workContext.selectedProjectId && selectedPreviewItem.value));
const loopProgressPercent = computed(() => {
    const finished = loopSteps.value.filter((item) => item.status === 'success' || item.status === 'finish').length;
    return Math.round((finished / loopSteps.value.length) * 100);
});
const loopActiveIndex = computed(() => {
    const index = loopSteps.value.findIndex((item) => item.status === 'process');
    return index < 0 ? 0 : index;
});
const loopSteps = computed(() => {
    const previewReady = Boolean(selectedPreviewItem.value);
    const confirmed = Boolean(confirmedPreview.value);
    const preflightPassed = Boolean(preflightResult.value?.passed);
    const sceneReady = Boolean(sceneDraftResult.value?.success);
    const composed = Boolean(selectedChapter.value?.wordCount && selectedChapter.value.wordCount > 0);
    const analyzed = Boolean(chapterAnalysisResult.value);
    return [
        buildLoopStep('preview', '标题简介', previewReady),
        buildLoopStep('confirm', '确认蓝图', confirmed, previewReady),
        buildLoopStep('preflight', '预检', preflightPassed, confirmed),
        buildLoopStep('scene', '写正文', sceneReady, preflightPassed),
        buildLoopStep('compose', '合成正文', composed, sceneReady),
        buildLoopStep('analysis', '生成后分析', analyzed, composed)
    ];
});
function buildLoopStep(key, title, done, enabled = true) {
    return {
        key,
        title,
        status: done ? 'success' : loopStage.value === key ? 'process' : enabled ? 'wait' : 'wait'
    };
}
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
        resetWorkflowState();
        return;
    }
    try {
        resetWorkflowState();
        selectedChapter.value = await getChapter(selectedChapterId.value);
        output.value = selectedChapter.value.content ?? '';
        buildPromptFromChapter();
    }
    catch (err) {
        ElMessage.error(err.message || t('chapterGeneration.messages.loadChapterDetailsFailed'));
    }
}
function resetWorkflowState() {
    if (loopRunning.value)
        return;
    confirmedPreview.value = null;
    preflightResult.value = null;
    sceneDraftResult.value = null;
    chapterAnalysisResult.value = null;
    loopStage.value = '';
    loopLog.value = [];
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
function appendLoopLog(message) {
    loopLog.value = [`${new Date().toLocaleTimeString()} ${message}`, ...loopLog.value].slice(0, 30);
}
function toggleGenerationMode() {
    generationMode.value = generationMode.value === 'single' ? 'batch' : 'single';
}
function clearAutoPreview() {
    autoPreviewItems.value = [];
    confirmedPreview.value = null;
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
async function runPreflightForSelectedChapter() {
    if (!selectedChapter.value || !workContext.selectedProjectId) {
        ElMessage.warning(t('chapterGeneration.messages.selectChapterFirst'));
        return false;
    }
    workflowLoading.value = true;
    loopStage.value = 'preflight';
    try {
        preflightResult.value = await runGenerationPreflight({
            projectId: workContext.selectedProjectId,
            volumeId: workContext.selectedVolumeId,
            chapterId: selectedChapter.value.id,
            requireChapterPlan: true,
            requireSceneBlueprints: true
        });
        if (preflightResult.value.passed) {
            appendLoopLog('预检通过，可以继续按场景蓝图写正文。');
            ElMessage.success('生成预检通过，可以按场景蓝图写正文。');
        }
        else {
            appendLoopLog(`预检未通过：${preflightResult.value.fatalCount} 个致命问题。`);
            ElMessage.warning(`生成预检未通过：${preflightResult.value.fatalCount} 个致命问题。`);
        }
        return preflightResult.value.passed;
    }
    catch (err) {
        ElMessage.error(err.message || '生成预检失败');
        return false;
    }
    finally {
        workflowLoading.value = false;
        if (!loopRunning.value)
            loopStage.value = '';
    }
}
async function previewSelectedChapterBlueprints() {
    if (!selectedChapter.value) {
        ElMessage.warning(t('chapterGeneration.messages.selectChapterFirst'));
        return false;
    }
    autoForm.startChapterNumber = selectedChapter.value.chapterNumber;
    autoForm.count = 1;
    autoForm.createMissing = true;
    loopStage.value = 'preview';
    const ok = await previewBatchDrafts();
    if (ok)
        appendLoopLog('已生成标题简介和场景蓝图预览。');
    if (!loopRunning.value)
        loopStage.value = '';
    return ok;
}
async function confirmPreviewForSelectedChapter(rerunPreflight = true) {
    if (!selectedChapter.value || !workContext.selectedProjectId) {
        ElMessage.warning(t('chapterGeneration.messages.selectChapterFirst'));
        return false;
    }
    if (!selectedPreviewItem.value) {
        ElMessage.warning('请先生成标题简介和场景蓝图。');
        return false;
    }
    confirmingPreview.value = true;
    loopStage.value = 'confirm';
    try {
        confirmedPreview.value = await confirmChapterGenerationPreview({
            projectId: workContext.selectedProjectId,
            chapterId: selectedChapter.value.id,
            preview: selectedPreviewItem.value
        });
        selectedChapter.value = await getChapter(selectedChapter.value.id);
        chapters.value = chapters.value.map((item) => (item.id === selectedChapter.value.id ? selectedChapter.value : item));
        appendLoopLog(`已确认《${confirmedPreview.value.title}》，落库 ${confirmedPreview.value.sceneCount} 个场景蓝图。`);
        ElMessage.success(`已确认标题和场景蓝图，并保存 ${confirmedPreview.value.sceneCount} 个场景。`);
        if (rerunPreflight) {
            await runPreflightForSelectedChapter();
        }
        return true;
    }
    catch (err) {
        ElMessage.error(err.message || '确认标题和场景蓝图失败');
        return false;
    }
    finally {
        confirmingPreview.value = false;
        if (!loopRunning.value)
            loopStage.value = '';
    }
}
async function ensureBlueprintsForSelectedChapter() {
    if (!selectedChapter.value || !workContext.selectedProjectId) {
        ElMessage.warning(t('chapterGeneration.messages.selectChapterFirst'));
        return;
    }
    ensuringSceneBlueprints.value = true;
    try {
        const result = await ensureSceneBlueprints({
            projectId: workContext.selectedProjectId,
            chapterId: selectedChapter.value.id
        });
        const message = result.createdCount > 0
            ? `已自动补齐 ${result.createdCount} 个场景蓝图。`
            : `当前章节已有 ${result.existingCount} 个场景蓝图。`;
        ElMessage.success(message);
        await runPreflightForSelectedChapter();
    }
    catch (err) {
        ElMessage.error(err.message || '自动补齐场景蓝图失败');
    }
    finally {
        ensuringSceneBlueprints.value = false;
    }
}
async function generateSelectedSceneDraft() {
    if (!selectedChapter.value || !validateGenerationSettings(true) || !workContext.selectedProjectId)
        return false;
    sceneGenerating.value = true;
    loopStage.value = 'scene';
    error.value = '';
    try {
        const result = await generateSceneDraft({
            runId: crypto.randomUUID(),
            projectId: workContext.selectedProjectId,
            chapterId: selectedChapter.value.id,
            sceneNumber: workflowForm.sceneNumber,
            configId: selectedConfigId.value || null,
            endpoint: aiForm.value.endpoint,
            providerId: selectedConfigId.value || null,
            apiKeyId: null,
            apiKey: aiForm.value.apiKey,
            model: aiForm.value.model,
            systemPrompt: promptForm.systemPrompt,
            prompt: workflowForm.scenePrompt,
            temperature: promptForm.temperature,
            maxTokens: Math.min(promptForm.maxTokens || 4096, 4096)
        });
        sceneDraftResult.value = result;
        if (result.success) {
            output.value = [output.value.trim(), result.content.trim()].filter(Boolean).join('\n\n');
            appendLoopLog(`场景 ${result.sceneNumber} 已生成：${result.sceneTitle || '未命名场景'}。`);
            ElMessage.success(`场景 ${result.sceneNumber} 已生成。`);
            return true;
        }
        else {
            error.value = result.error || '场景生成失败';
            appendLoopLog(`场景 ${workflowForm.sceneNumber} 生成失败：${error.value}`);
            ElMessage.error(error.value);
            return false;
        }
    }
    catch (err) {
        error.value = normalizeGenerationError(err.message || '场景生成失败');
        ElMessage.error(error.value);
        return false;
    }
    finally {
        sceneGenerating.value = false;
        if (!loopRunning.value)
            loopStage.value = '';
    }
}
async function composeSelectedScenes() {
    if (!selectedChapter.value || !workContext.selectedProjectId) {
        ElMessage.warning(t('chapterGeneration.messages.selectChapterFirst'));
        return false;
    }
    sceneComposing.value = true;
    loopStage.value = 'compose';
    try {
        const result = await composeSceneDrafts({
            projectId: workContext.selectedProjectId,
            chapterId: selectedChapter.value.id,
            saveToChapter: true
        });
        output.value = result.content;
        selectedChapter.value = await getChapter(selectedChapter.value.id);
        chapters.value = chapters.value.map((item) => (item.id === selectedChapter.value.id ? selectedChapter.value : item));
        appendLoopLog(`已合成 ${result.sceneCount} 个场景并保存正文，约 ${result.wordCount} 字。`);
        ElMessage.success(`已合成 ${result.sceneCount} 个场景并保存，约 ${result.wordCount} 字。`);
        return true;
    }
    catch (err) {
        ElMessage.error(err.message || '场景合成失败');
        return false;
    }
    finally {
        sceneComposing.value = false;
        if (!loopRunning.value)
            loopStage.value = '';
    }
}
async function analyzeSelectedChapter() {
    if (!selectedChapter.value || !workContext.selectedProjectId) {
        ElMessage.warning(t('chapterGeneration.messages.selectChapterFirst'));
        return false;
    }
    analyzingChapter.value = true;
    loopStage.value = 'analysis';
    try {
        chapterAnalysisResult.value = await analyzeGeneratedChapter({
            projectId: workContext.selectedProjectId,
            chapterId: selectedChapter.value.id,
            minWordCount: workflowForm.minWordCount,
            maxDuplicateTitleWindow: 5,
            updateChapterSummary: true
        });
        selectedChapter.value = await getChapter(selectedChapter.value.id);
        if (chapterAnalysisResult.value.passed) {
            appendLoopLog('生成后分析通过，章节闭环完成。');
            ElMessage.success('章节分析通过，批量生成可继续。');
        }
        else {
            appendLoopLog('生成后分析未通过，建议暂停并修正。');
            ElMessage.warning('章节分析未通过，建议暂停批量生成并修正。');
        }
        return chapterAnalysisResult.value.passed;
    }
    catch (err) {
        ElMessage.error(err.message || '章节分析失败');
        return false;
    }
    finally {
        analyzingChapter.value = false;
        if (!loopRunning.value)
            loopStage.value = '';
    }
}
async function runClosedLoopForSelectedChapter() {
    if (loopRunning.value)
        return;
    if (!validateGenerationSettings(true))
        return;
    loopRunning.value = true;
    loopLog.value = [];
    try {
        appendLoopLog('开始单章闭环生成。');
        if (!selectedPreviewItem.value && !(await previewSelectedChapterBlueprints()))
            return;
        if (!(await confirmPreviewForSelectedChapter(false)))
            return;
        if (!(await runPreflightForSelectedChapter()))
            return;
        const scenes = confirmedPreview.value?.scenes.length
            ? confirmedPreview.value.scenes
            : selectedPreviewItem.value?.scenes ?? [];
        for (const scene of scenes) {
            workflowForm.sceneNumber = scene.sceneNumber;
            if (!(await generateSelectedSceneDraft()))
                return;
        }
        if (!(await composeSelectedScenes()))
            return;
        await analyzeSelectedChapter();
    }
    finally {
        loopRunning.value = false;
        loopStage.value = '';
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
        return false;
    if (!workContext.selectedProjectId || !workContext.selectedVolumeId) {
        ElMessage.warning(t('chapterGeneration.messages.selectProjectVolumeFirst'));
        return false;
    }
    if (autoForm.count < 1) {
        ElMessage.warning(t('chapterGeneration.batch.countRequired'));
        return false;
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
        return true;
    }
    catch (err) {
        ElMessage.error(err.message || t('chapterGeneration.batch.previewFailed'));
        return false;
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
            stopOnFailure: autoForm.autoContinuityMode ? true : autoForm.stopOnFailure,
            autoContinuityMode: autoForm.autoContinuityMode,
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
            rerunValidationAfterSave: autoForm.autoContinuityMode ? true : rerunValidationAfterSave.value,
            previewItems: autoPreviewItems.value.map((item) => ({
                ...item,
                title: item.title.trim(),
                summary: item.summary.trim(),
                scenes: (item.scenes ?? []).map((scene) => ({
                    ...scene,
                    title: scene.title.trim(),
                    summary: scene.summary.trim(),
                    goal: scene.goal.trim(),
                    conflict: scene.conflict.trim(),
                    hook: scene.hook.trim(),
                    foreshadowingName: scene.foreshadowingName?.trim() ?? '',
                    foreshadowingRole: scene.foreshadowingRole?.trim() ?? '',
                    timeAnchor: scene.timeAnchor?.trim() ?? '',
                    locationAnchor: scene.locationAnchor?.trim() ?? '',
                    elapsedFromPrevious: scene.elapsedFromPrevious?.trim() ?? '',
                    timelineEffect: scene.timelineEffect?.trim() ?? ''
                }))
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
/** @type {__VLS_StyleScopedClasses['workflow-steps']} */ ;
/** @type {__VLS_StyleScopedClasses['single-preview__head']} */ ;
/** @type {__VLS_StyleScopedClasses['single-preview__head']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-controls']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-result-item']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-controls']} */ ;
/** @type {__VLS_StyleScopedClasses['el-form-item']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-options']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-scenes__head']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-scenes__head']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-progress__meta']} */ ;
/** @type {__VLS_StyleScopedClasses['workspace-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['generation-mode-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-controls']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-console__head']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-progress__meta']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-console__head']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-console__actions']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-controls']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-result-item']} */ ;
/** @type {__VLS_StyleScopedClasses['single-preview-scene__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['single-preview-scene__tracking-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-scene__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-scene__tracking-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['single-preview__head']} */ ;
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
    ...{ class: "generation-mode-panel" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "generation-mode-panel__title" },
});
(__VLS_ctx.generationModeLabel);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "generation-mode-panel__subtitle" },
});
(__VLS_ctx.generationModeDescription);
const __VLS_124 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({
    ...{ 'onClick': {} },
    size: "small",
    icon: (__VLS_ctx.Refresh),
}));
const __VLS_126 = __VLS_125({
    ...{ 'onClick': {} },
    size: "small",
    icon: (__VLS_ctx.Refresh),
}, ...__VLS_functionalComponentArgsRest(__VLS_125));
let __VLS_128;
let __VLS_129;
let __VLS_130;
const __VLS_131 = {
    onClick: (__VLS_ctx.toggleGenerationMode)
};
__VLS_127.slots.default;
(__VLS_ctx.generationModeToggleText);
var __VLS_127;
if (__VLS_ctx.generationMode === 'batch') {
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
        const __VLS_132 = {}.ElTag;
        /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
        // @ts-ignore
        const __VLS_133 = __VLS_asFunctionalComponent(__VLS_132, new __VLS_132({
            size: "small",
            type: (__VLS_ctx.autoGenerating ? 'warning' : 'success'),
        }));
        const __VLS_134 = __VLS_133({
            size: "small",
            type: (__VLS_ctx.autoGenerating ? 'warning' : 'success'),
        }, ...__VLS_functionalComponentArgsRest(__VLS_133));
        __VLS_135.slots.default;
        (__VLS_ctx.autoJobStatusLabel);
        var __VLS_135;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.t('chapterGeneration.batch.jobId', { id: __VLS_ctx.autoJobId }));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "batch-console__actions" },
    });
    if (__VLS_ctx.autoGenerating) {
        const __VLS_136 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_137 = __VLS_asFunctionalComponent(__VLS_136, new __VLS_136({
            ...{ 'onClick': {} },
            size: "small",
            type: "danger",
            icon: (__VLS_ctx.Close),
        }));
        const __VLS_138 = __VLS_137({
            ...{ 'onClick': {} },
            size: "small",
            type: "danger",
            icon: (__VLS_ctx.Close),
        }, ...__VLS_functionalComponentArgsRest(__VLS_137));
        let __VLS_140;
        let __VLS_141;
        let __VLS_142;
        const __VLS_143 = {
            onClick: (__VLS_ctx.requestStopAutoGeneration)
        };
        __VLS_139.slots.default;
        (__VLS_ctx.t('chapterGeneration.batch.stop'));
        var __VLS_139;
    }
    else {
        const __VLS_144 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_145 = __VLS_asFunctionalComponent(__VLS_144, new __VLS_144({
            ...{ 'onClick': {} },
            size: "small",
            type: "primary",
            icon: (__VLS_ctx.DocumentChecked),
            loading: (__VLS_ctx.autoPreviewing),
            disabled: (!__VLS_ctx.workContext.selectedProjectId || !__VLS_ctx.workContext.selectedVolumeId || __VLS_ctx.generating),
        }));
        const __VLS_146 = __VLS_145({
            ...{ 'onClick': {} },
            size: "small",
            type: "primary",
            icon: (__VLS_ctx.DocumentChecked),
            loading: (__VLS_ctx.autoPreviewing),
            disabled: (!__VLS_ctx.workContext.selectedProjectId || !__VLS_ctx.workContext.selectedVolumeId || __VLS_ctx.generating),
        }, ...__VLS_functionalComponentArgsRest(__VLS_145));
        let __VLS_148;
        let __VLS_149;
        let __VLS_150;
        const __VLS_151 = {
            onClick: (__VLS_ctx.previewBatchDrafts)
        };
        __VLS_147.slots.default;
        (__VLS_ctx.t('chapterGeneration.batch.preview'));
        var __VLS_147;
    }
    if (!__VLS_ctx.autoGenerating) {
        const __VLS_152 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_153 = __VLS_asFunctionalComponent(__VLS_152, new __VLS_152({
            ...{ 'onClick': {} },
            size: "small",
            type: "success",
            icon: (__VLS_ctx.VideoPlay),
            disabled: (!__VLS_ctx.workContext.selectedProjectId || !__VLS_ctx.workContext.selectedVolumeId || __VLS_ctx.generating || __VLS_ctx.autoPreviewItems.length === 0),
        }));
        const __VLS_154 = __VLS_153({
            ...{ 'onClick': {} },
            size: "small",
            type: "success",
            icon: (__VLS_ctx.VideoPlay),
            disabled: (!__VLS_ctx.workContext.selectedProjectId || !__VLS_ctx.workContext.selectedVolumeId || __VLS_ctx.generating || __VLS_ctx.autoPreviewItems.length === 0),
        }, ...__VLS_functionalComponentArgsRest(__VLS_153));
        let __VLS_156;
        let __VLS_157;
        let __VLS_158;
        const __VLS_159 = {
            onClick: (__VLS_ctx.generateBatchDrafts)
        };
        __VLS_155.slots.default;
        (__VLS_ctx.t('chapterGeneration.batch.confirmStart'));
        var __VLS_155;
    }
    const __VLS_160 = {}.ElForm;
    /** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
    // @ts-ignore
    const __VLS_161 = __VLS_asFunctionalComponent(__VLS_160, new __VLS_160({
        labelWidth: "110px",
        ...{ class: "batch-form" },
    }));
    const __VLS_162 = __VLS_161({
        labelWidth: "110px",
        ...{ class: "batch-form" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_161));
    __VLS_163.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "batch-controls" },
    });
    const __VLS_164 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_165 = __VLS_asFunctionalComponent(__VLS_164, new __VLS_164({
        label: (__VLS_ctx.t('chapterGeneration.batch.startNumber')),
    }));
    const __VLS_166 = __VLS_165({
        label: (__VLS_ctx.t('chapterGeneration.batch.startNumber')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_165));
    __VLS_167.slots.default;
    const __VLS_168 = {}.ElInputNumber;
    /** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
    // @ts-ignore
    const __VLS_169 = __VLS_asFunctionalComponent(__VLS_168, new __VLS_168({
        modelValue: (__VLS_ctx.autoForm.startChapterNumber),
        min: (1),
        disabled: (__VLS_ctx.autoGenerating),
        controlsPosition: "right",
    }));
    const __VLS_170 = __VLS_169({
        modelValue: (__VLS_ctx.autoForm.startChapterNumber),
        min: (1),
        disabled: (__VLS_ctx.autoGenerating),
        controlsPosition: "right",
    }, ...__VLS_functionalComponentArgsRest(__VLS_169));
    var __VLS_167;
    const __VLS_172 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_173 = __VLS_asFunctionalComponent(__VLS_172, new __VLS_172({
        label: (__VLS_ctx.t('chapterGeneration.batch.count')),
    }));
    const __VLS_174 = __VLS_173({
        label: (__VLS_ctx.t('chapterGeneration.batch.count')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_173));
    __VLS_175.slots.default;
    const __VLS_176 = {}.ElInputNumber;
    /** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
    // @ts-ignore
    const __VLS_177 = __VLS_asFunctionalComponent(__VLS_176, new __VLS_176({
        modelValue: (__VLS_ctx.autoForm.count),
        min: (1),
        max: (200),
        disabled: (__VLS_ctx.autoGenerating),
        controlsPosition: "right",
    }));
    const __VLS_178 = __VLS_177({
        modelValue: (__VLS_ctx.autoForm.count),
        min: (1),
        max: (200),
        disabled: (__VLS_ctx.autoGenerating),
        controlsPosition: "right",
    }, ...__VLS_functionalComponentArgsRest(__VLS_177));
    var __VLS_175;
    const __VLS_180 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_181 = __VLS_asFunctionalComponent(__VLS_180, new __VLS_180({
        label: (__VLS_ctx.t('chapterGeneration.batch.options')),
    }));
    const __VLS_182 = __VLS_181({
        label: (__VLS_ctx.t('chapterGeneration.batch.options')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_181));
    __VLS_183.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "batch-options" },
    });
    const __VLS_184 = {}.ElCheckbox;
    /** @type {[typeof __VLS_components.ElCheckbox, typeof __VLS_components.elCheckbox, typeof __VLS_components.ElCheckbox, typeof __VLS_components.elCheckbox, ]} */ ;
    // @ts-ignore
    const __VLS_185 = __VLS_asFunctionalComponent(__VLS_184, new __VLS_184({
        modelValue: (__VLS_ctx.autoForm.createMissing),
        disabled: (__VLS_ctx.autoGenerating),
    }));
    const __VLS_186 = __VLS_185({
        modelValue: (__VLS_ctx.autoForm.createMissing),
        disabled: (__VLS_ctx.autoGenerating),
    }, ...__VLS_functionalComponentArgsRest(__VLS_185));
    __VLS_187.slots.default;
    (__VLS_ctx.t('chapterGeneration.batch.createMissing'));
    var __VLS_187;
    const __VLS_188 = {}.ElCheckbox;
    /** @type {[typeof __VLS_components.ElCheckbox, typeof __VLS_components.elCheckbox, typeof __VLS_components.ElCheckbox, typeof __VLS_components.elCheckbox, ]} */ ;
    // @ts-ignore
    const __VLS_189 = __VLS_asFunctionalComponent(__VLS_188, new __VLS_188({
        modelValue: (__VLS_ctx.autoForm.overwriteExisting),
        disabled: (__VLS_ctx.autoGenerating),
    }));
    const __VLS_190 = __VLS_189({
        modelValue: (__VLS_ctx.autoForm.overwriteExisting),
        disabled: (__VLS_ctx.autoGenerating),
    }, ...__VLS_functionalComponentArgsRest(__VLS_189));
    __VLS_191.slots.default;
    (__VLS_ctx.t('chapterGeneration.batch.overwriteExisting'));
    var __VLS_191;
    const __VLS_192 = {}.ElCheckbox;
    /** @type {[typeof __VLS_components.ElCheckbox, typeof __VLS_components.elCheckbox, typeof __VLS_components.ElCheckbox, typeof __VLS_components.elCheckbox, ]} */ ;
    // @ts-ignore
    const __VLS_193 = __VLS_asFunctionalComponent(__VLS_192, new __VLS_192({
        modelValue: (__VLS_ctx.autoForm.autoContinuityMode),
        disabled: (__VLS_ctx.autoGenerating),
    }));
    const __VLS_194 = __VLS_193({
        modelValue: (__VLS_ctx.autoForm.autoContinuityMode),
        disabled: (__VLS_ctx.autoGenerating),
    }, ...__VLS_functionalComponentArgsRest(__VLS_193));
    __VLS_195.slots.default;
    (__VLS_ctx.t('chapterGeneration.batch.autoContinuityMode'));
    var __VLS_195;
    const __VLS_196 = {}.ElCheckbox;
    /** @type {[typeof __VLS_components.ElCheckbox, typeof __VLS_components.elCheckbox, typeof __VLS_components.ElCheckbox, typeof __VLS_components.elCheckbox, ]} */ ;
    // @ts-ignore
    const __VLS_197 = __VLS_asFunctionalComponent(__VLS_196, new __VLS_196({
        modelValue: (__VLS_ctx.autoForm.stopOnFailure),
        disabled: (__VLS_ctx.autoGenerating || __VLS_ctx.autoForm.autoContinuityMode),
    }));
    const __VLS_198 = __VLS_197({
        modelValue: (__VLS_ctx.autoForm.stopOnFailure),
        disabled: (__VLS_ctx.autoGenerating || __VLS_ctx.autoForm.autoContinuityMode),
    }, ...__VLS_functionalComponentArgsRest(__VLS_197));
    __VLS_199.slots.default;
    (__VLS_ctx.t('chapterGeneration.batch.stopOnFailure'));
    var __VLS_199;
    if (__VLS_ctx.autoForm.autoContinuityMode) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "batch-option-hint" },
        });
        (__VLS_ctx.t('chapterGeneration.batch.autoContinuityHint'));
    }
    var __VLS_183;
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
        const __VLS_200 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_201 = __VLS_asFunctionalComponent(__VLS_200, new __VLS_200({
            ...{ 'onClick': {} },
            size: "small",
            text: true,
            icon: (__VLS_ctx.Refresh),
            loading: (__VLS_ctx.autoPreviewing),
        }));
        const __VLS_202 = __VLS_201({
            ...{ 'onClick': {} },
            size: "small",
            text: true,
            icon: (__VLS_ctx.Refresh),
            loading: (__VLS_ctx.autoPreviewing),
        }, ...__VLS_functionalComponentArgsRest(__VLS_201));
        let __VLS_204;
        let __VLS_205;
        let __VLS_206;
        const __VLS_207 = {
            onClick: (__VLS_ctx.previewBatchDrafts)
        };
        __VLS_203.slots.default;
        (__VLS_ctx.t('chapterGeneration.batch.refreshPreview'));
        var __VLS_203;
        const __VLS_208 = {}.ElTable;
        /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
        // @ts-ignore
        const __VLS_209 = __VLS_asFunctionalComponent(__VLS_208, new __VLS_208({
            data: (__VLS_ctx.autoPreviewItems),
            size: "small",
            ...{ class: "batch-preview__table" },
        }));
        const __VLS_210 = __VLS_209({
            data: (__VLS_ctx.autoPreviewItems),
            size: "small",
            ...{ class: "batch-preview__table" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_209));
        __VLS_211.slots.default;
        const __VLS_212 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_213 = __VLS_asFunctionalComponent(__VLS_212, new __VLS_212({
            type: "expand",
        }));
        const __VLS_214 = __VLS_213({
            type: "expand",
        }, ...__VLS_functionalComponentArgsRest(__VLS_213));
        __VLS_215.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_215.slots;
            const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "batch-scenes" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "batch-scenes__head" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            for (const [scene] of __VLS_getVForSourceType((row.scenes ?? []))) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    key: (scene.sceneNumber),
                    ...{ class: "batch-scene" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "batch-scene__title" },
                });
                const __VLS_216 = {}.ElTag;
                /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
                // @ts-ignore
                const __VLS_217 = __VLS_asFunctionalComponent(__VLS_216, new __VLS_216({
                    size: "small",
                    type: "info",
                }));
                const __VLS_218 = __VLS_217({
                    size: "small",
                    type: "info",
                }, ...__VLS_functionalComponentArgsRest(__VLS_217));
                __VLS_219.slots.default;
                (scene.sceneNumber);
                var __VLS_219;
                const __VLS_220 = {}.ElInput;
                /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
                // @ts-ignore
                const __VLS_221 = __VLS_asFunctionalComponent(__VLS_220, new __VLS_220({
                    modelValue: (scene.title),
                    size: "small",
                    placeholder: "场景标题",
                }));
                const __VLS_222 = __VLS_221({
                    modelValue: (scene.title),
                    size: "small",
                    placeholder: "场景标题",
                }, ...__VLS_functionalComponentArgsRest(__VLS_221));
                const __VLS_224 = {}.ElInput;
                /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
                // @ts-ignore
                const __VLS_225 = __VLS_asFunctionalComponent(__VLS_224, new __VLS_224({
                    modelValue: (scene.summary),
                    size: "small",
                    type: "textarea",
                    rows: (2),
                    placeholder: "场景简介",
                }));
                const __VLS_226 = __VLS_225({
                    modelValue: (scene.summary),
                    size: "small",
                    type: "textarea",
                    rows: (2),
                    placeholder: "场景简介",
                }, ...__VLS_functionalComponentArgsRest(__VLS_225));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "batch-scene__grid" },
                });
                const __VLS_228 = {}.ElInput;
                /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
                // @ts-ignore
                const __VLS_229 = __VLS_asFunctionalComponent(__VLS_228, new __VLS_228({
                    modelValue: (scene.goal),
                    size: "small",
                    placeholder: "场景目标",
                }));
                const __VLS_230 = __VLS_229({
                    modelValue: (scene.goal),
                    size: "small",
                    placeholder: "场景目标",
                }, ...__VLS_functionalComponentArgsRest(__VLS_229));
                const __VLS_232 = {}.ElInput;
                /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
                // @ts-ignore
                const __VLS_233 = __VLS_asFunctionalComponent(__VLS_232, new __VLS_232({
                    modelValue: (scene.conflict),
                    size: "small",
                    placeholder: "场景冲突",
                }));
                const __VLS_234 = __VLS_233({
                    modelValue: (scene.conflict),
                    size: "small",
                    placeholder: "场景冲突",
                }, ...__VLS_functionalComponentArgsRest(__VLS_233));
                const __VLS_236 = {}.ElInput;
                /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
                // @ts-ignore
                const __VLS_237 = __VLS_asFunctionalComponent(__VLS_236, new __VLS_236({
                    modelValue: (scene.hook),
                    size: "small",
                    placeholder: "收束钩子",
                }));
                const __VLS_238 = __VLS_237({
                    modelValue: (scene.hook),
                    size: "small",
                    placeholder: "收束钩子",
                }, ...__VLS_functionalComponentArgsRest(__VLS_237));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "batch-scene__tracking-grid" },
                });
                const __VLS_240 = {}.ElInput;
                /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
                // @ts-ignore
                const __VLS_241 = __VLS_asFunctionalComponent(__VLS_240, new __VLS_240({
                    modelValue: (scene.foreshadowingName),
                    size: "small",
                    placeholder: "伏笔名称",
                }));
                const __VLS_242 = __VLS_241({
                    modelValue: (scene.foreshadowingName),
                    size: "small",
                    placeholder: "伏笔名称",
                }, ...__VLS_functionalComponentArgsRest(__VLS_241));
                const __VLS_244 = {}.ElInput;
                /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
                // @ts-ignore
                const __VLS_245 = __VLS_asFunctionalComponent(__VLS_244, new __VLS_244({
                    modelValue: (scene.foreshadowingRole),
                    size: "small",
                    placeholder: "伏笔职责：埋设/推进/回收",
                }));
                const __VLS_246 = __VLS_245({
                    modelValue: (scene.foreshadowingRole),
                    size: "small",
                    placeholder: "伏笔职责：埋设/推进/回收",
                }, ...__VLS_functionalComponentArgsRest(__VLS_245));
                const __VLS_248 = {}.ElInput;
                /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
                // @ts-ignore
                const __VLS_249 = __VLS_asFunctionalComponent(__VLS_248, new __VLS_248({
                    modelValue: (scene.timeAnchor),
                    size: "small",
                    placeholder: "时间锚点",
                }));
                const __VLS_250 = __VLS_249({
                    modelValue: (scene.timeAnchor),
                    size: "small",
                    placeholder: "时间锚点",
                }, ...__VLS_functionalComponentArgsRest(__VLS_249));
                const __VLS_252 = {}.ElInput;
                /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
                // @ts-ignore
                const __VLS_253 = __VLS_asFunctionalComponent(__VLS_252, new __VLS_252({
                    modelValue: (scene.locationAnchor),
                    size: "small",
                    placeholder: "地点锚点",
                }));
                const __VLS_254 = __VLS_253({
                    modelValue: (scene.locationAnchor),
                    size: "small",
                    placeholder: "地点锚点",
                }, ...__VLS_functionalComponentArgsRest(__VLS_253));
                const __VLS_256 = {}.ElInput;
                /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
                // @ts-ignore
                const __VLS_257 = __VLS_asFunctionalComponent(__VLS_256, new __VLS_256({
                    modelValue: (scene.elapsedFromPrevious),
                    size: "small",
                    placeholder: "距上一场景/上一章经过",
                }));
                const __VLS_258 = __VLS_257({
                    modelValue: (scene.elapsedFromPrevious),
                    size: "small",
                    placeholder: "距上一场景/上一章经过",
                }, ...__VLS_functionalComponentArgsRest(__VLS_257));
                const __VLS_260 = {}.ElInput;
                /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
                // @ts-ignore
                const __VLS_261 = __VLS_asFunctionalComponent(__VLS_260, new __VLS_260({
                    modelValue: (scene.timelineEffect),
                    size: "small",
                    placeholder: "时间线影响",
                }));
                const __VLS_262 = __VLS_261({
                    modelValue: (scene.timelineEffect),
                    size: "small",
                    placeholder: "时间线影响",
                }, ...__VLS_functionalComponentArgsRest(__VLS_261));
            }
        }
        var __VLS_215;
        const __VLS_264 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_265 = __VLS_asFunctionalComponent(__VLS_264, new __VLS_264({
            label: (__VLS_ctx.t('chapterGeneration.batch.previewNumber')),
            prop: "chapterNumber",
            width: "72",
        }));
        const __VLS_266 = __VLS_265({
            label: (__VLS_ctx.t('chapterGeneration.batch.previewNumber')),
            prop: "chapterNumber",
            width: "72",
        }, ...__VLS_functionalComponentArgsRest(__VLS_265));
        const __VLS_268 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_269 = __VLS_asFunctionalComponent(__VLS_268, new __VLS_268({
            label: (__VLS_ctx.t('chapterGeneration.batch.previewTitleColumn')),
            minWidth: "180",
        }));
        const __VLS_270 = __VLS_269({
            label: (__VLS_ctx.t('chapterGeneration.batch.previewTitleColumn')),
            minWidth: "180",
        }, ...__VLS_functionalComponentArgsRest(__VLS_269));
        __VLS_271.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_271.slots;
            const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
            const __VLS_272 = {}.ElInput;
            /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
            // @ts-ignore
            const __VLS_273 = __VLS_asFunctionalComponent(__VLS_272, new __VLS_272({
                modelValue: (row.title),
                size: "small",
            }));
            const __VLS_274 = __VLS_273({
                modelValue: (row.title),
                size: "small",
            }, ...__VLS_functionalComponentArgsRest(__VLS_273));
        }
        var __VLS_271;
        const __VLS_276 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_277 = __VLS_asFunctionalComponent(__VLS_276, new __VLS_276({
            label: (__VLS_ctx.t('chapterGeneration.batch.previewSummaryColumn')),
            minWidth: "320",
        }));
        const __VLS_278 = __VLS_277({
            label: (__VLS_ctx.t('chapterGeneration.batch.previewSummaryColumn')),
            minWidth: "320",
        }, ...__VLS_functionalComponentArgsRest(__VLS_277));
        __VLS_279.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_279.slots;
            const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
            const __VLS_280 = {}.ElInput;
            /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
            // @ts-ignore
            const __VLS_281 = __VLS_asFunctionalComponent(__VLS_280, new __VLS_280({
                modelValue: (row.summary),
                size: "small",
                type: "textarea",
                rows: (2),
            }));
            const __VLS_282 = __VLS_281({
                modelValue: (row.summary),
                size: "small",
                type: "textarea",
                rows: (2),
            }, ...__VLS_functionalComponentArgsRest(__VLS_281));
        }
        var __VLS_279;
        const __VLS_284 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_285 = __VLS_asFunctionalComponent(__VLS_284, new __VLS_284({
            label: (__VLS_ctx.t('chapterGeneration.batch.previewState')),
            width: "120",
        }));
        const __VLS_286 = __VLS_285({
            label: (__VLS_ctx.t('chapterGeneration.batch.previewState')),
            width: "120",
        }, ...__VLS_functionalComponentArgsRest(__VLS_285));
        __VLS_287.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_287.slots;
            const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
            const __VLS_288 = {}.ElTag;
            /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
            // @ts-ignore
            const __VLS_289 = __VLS_asFunctionalComponent(__VLS_288, new __VLS_288({
                size: "small",
                type: (row.hasContent ? 'warning' : row.exists ? 'info' : 'success'),
            }));
            const __VLS_290 = __VLS_289({
                size: "small",
                type: (row.hasContent ? 'warning' : row.exists ? 'info' : 'success'),
            }, ...__VLS_functionalComponentArgsRest(__VLS_289));
            __VLS_291.slots.default;
            (row.hasContent
                ? __VLS_ctx.t('chapterGeneration.batch.previewHasContent')
                : row.exists
                    ? __VLS_ctx.t('chapterGeneration.batch.previewExists')
                    : __VLS_ctx.t('chapterGeneration.batch.previewNew'));
            var __VLS_291;
        }
        var __VLS_287;
        var __VLS_211;
    }
    if (__VLS_ctx.autoGenerating || __VLS_ctx.autoProgress.total) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "batch-progress" },
        });
        const __VLS_292 = {}.ElProgress;
        /** @type {[typeof __VLS_components.ElProgress, typeof __VLS_components.elProgress, ]} */ ;
        // @ts-ignore
        const __VLS_293 = __VLS_asFunctionalComponent(__VLS_292, new __VLS_292({
            percentage: (__VLS_ctx.autoProgressPercent),
            strokeWidth: (8),
        }));
        const __VLS_294 = __VLS_293({
            percentage: (__VLS_ctx.autoProgressPercent),
            strokeWidth: (8),
        }, ...__VLS_functionalComponentArgsRest(__VLS_293));
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
    var __VLS_163;
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "workflow-console" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "workflow-console__head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "workflow-console__title" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "workflow-console__subtitle" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "workflow-console__actions" },
    });
    const __VLS_296 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_297 = __VLS_asFunctionalComponent(__VLS_296, new __VLS_296({
        ...{ 'onClick': {} },
        size: "small",
        icon: (__VLS_ctx.DocumentChecked),
        loading: (__VLS_ctx.autoPreviewing && __VLS_ctx.loopStage === 'preview'),
        disabled: (!__VLS_ctx.selectedChapter || __VLS_ctx.loopRunning || __VLS_ctx.autoGenerating),
    }));
    const __VLS_298 = __VLS_297({
        ...{ 'onClick': {} },
        size: "small",
        icon: (__VLS_ctx.DocumentChecked),
        loading: (__VLS_ctx.autoPreviewing && __VLS_ctx.loopStage === 'preview'),
        disabled: (!__VLS_ctx.selectedChapter || __VLS_ctx.loopRunning || __VLS_ctx.autoGenerating),
    }, ...__VLS_functionalComponentArgsRest(__VLS_297));
    let __VLS_300;
    let __VLS_301;
    let __VLS_302;
    const __VLS_303 = {
        onClick: (__VLS_ctx.previewSelectedChapterBlueprints)
    };
    __VLS_299.slots.default;
    var __VLS_299;
    const __VLS_304 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_305 = __VLS_asFunctionalComponent(__VLS_304, new __VLS_304({
        ...{ 'onClick': {} },
        size: "small",
        type: "primary",
        plain: true,
        loading: (__VLS_ctx.confirmingPreview),
        disabled: (!__VLS_ctx.canConfirmSelectedPreview || __VLS_ctx.loopRunning),
    }));
    const __VLS_306 = __VLS_305({
        ...{ 'onClick': {} },
        size: "small",
        type: "primary",
        plain: true,
        loading: (__VLS_ctx.confirmingPreview),
        disabled: (!__VLS_ctx.canConfirmSelectedPreview || __VLS_ctx.loopRunning),
    }, ...__VLS_functionalComponentArgsRest(__VLS_305));
    let __VLS_308;
    let __VLS_309;
    let __VLS_310;
    const __VLS_311 = {
        onClick: (() => __VLS_ctx.confirmPreviewForSelectedChapter())
    };
    __VLS_307.slots.default;
    var __VLS_307;
    const __VLS_312 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_313 = __VLS_asFunctionalComponent(__VLS_312, new __VLS_312({
        ...{ 'onClick': {} },
        size: "small",
        loading: (__VLS_ctx.workflowLoading),
        disabled: (!__VLS_ctx.selectedChapter),
    }));
    const __VLS_314 = __VLS_313({
        ...{ 'onClick': {} },
        size: "small",
        loading: (__VLS_ctx.workflowLoading),
        disabled: (!__VLS_ctx.selectedChapter),
    }, ...__VLS_functionalComponentArgsRest(__VLS_313));
    let __VLS_316;
    let __VLS_317;
    let __VLS_318;
    const __VLS_319 = {
        onClick: (__VLS_ctx.runPreflightForSelectedChapter)
    };
    __VLS_315.slots.default;
    var __VLS_315;
    if (__VLS_ctx.canEnsureSceneBlueprints) {
        const __VLS_320 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_321 = __VLS_asFunctionalComponent(__VLS_320, new __VLS_320({
            ...{ 'onClick': {} },
            size: "small",
            type: "primary",
            plain: true,
            loading: (__VLS_ctx.ensuringSceneBlueprints),
            disabled: (__VLS_ctx.workflowLoading),
        }));
        const __VLS_322 = __VLS_321({
            ...{ 'onClick': {} },
            size: "small",
            type: "primary",
            plain: true,
            loading: (__VLS_ctx.ensuringSceneBlueprints),
            disabled: (__VLS_ctx.workflowLoading),
        }, ...__VLS_functionalComponentArgsRest(__VLS_321));
        let __VLS_324;
        let __VLS_325;
        let __VLS_326;
        const __VLS_327 = {
            onClick: (__VLS_ctx.ensureBlueprintsForSelectedChapter)
        };
        __VLS_323.slots.default;
        var __VLS_323;
    }
    const __VLS_328 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_329 = __VLS_asFunctionalComponent(__VLS_328, new __VLS_328({
        ...{ 'onClick': {} },
        size: "small",
        type: "primary",
        loading: (__VLS_ctx.sceneGenerating),
        disabled: (!__VLS_ctx.selectedChapter || __VLS_ctx.generating || !__VLS_ctx.preflightResult?.passed),
    }));
    const __VLS_330 = __VLS_329({
        ...{ 'onClick': {} },
        size: "small",
        type: "primary",
        loading: (__VLS_ctx.sceneGenerating),
        disabled: (!__VLS_ctx.selectedChapter || __VLS_ctx.generating || !__VLS_ctx.preflightResult?.passed),
    }, ...__VLS_functionalComponentArgsRest(__VLS_329));
    let __VLS_332;
    let __VLS_333;
    let __VLS_334;
    const __VLS_335 = {
        onClick: (__VLS_ctx.generateSelectedSceneDraft)
    };
    __VLS_331.slots.default;
    var __VLS_331;
    const __VLS_336 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_337 = __VLS_asFunctionalComponent(__VLS_336, new __VLS_336({
        ...{ 'onClick': {} },
        size: "small",
        type: "success",
        loading: (__VLS_ctx.sceneComposing),
        disabled: (!__VLS_ctx.selectedChapter),
    }));
    const __VLS_338 = __VLS_337({
        ...{ 'onClick': {} },
        size: "small",
        type: "success",
        loading: (__VLS_ctx.sceneComposing),
        disabled: (!__VLS_ctx.selectedChapter),
    }, ...__VLS_functionalComponentArgsRest(__VLS_337));
    let __VLS_340;
    let __VLS_341;
    let __VLS_342;
    const __VLS_343 = {
        onClick: (__VLS_ctx.composeSelectedScenes)
    };
    __VLS_339.slots.default;
    var __VLS_339;
    const __VLS_344 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_345 = __VLS_asFunctionalComponent(__VLS_344, new __VLS_344({
        ...{ 'onClick': {} },
        size: "small",
        type: "warning",
        loading: (__VLS_ctx.analyzingChapter),
        disabled: (!__VLS_ctx.selectedChapter),
    }));
    const __VLS_346 = __VLS_345({
        ...{ 'onClick': {} },
        size: "small",
        type: "warning",
        loading: (__VLS_ctx.analyzingChapter),
        disabled: (!__VLS_ctx.selectedChapter),
    }, ...__VLS_functionalComponentArgsRest(__VLS_345));
    let __VLS_348;
    let __VLS_349;
    let __VLS_350;
    const __VLS_351 = {
        onClick: (__VLS_ctx.analyzeSelectedChapter)
    };
    __VLS_347.slots.default;
    var __VLS_347;
    const __VLS_352 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_353 = __VLS_asFunctionalComponent(__VLS_352, new __VLS_352({
        ...{ 'onClick': {} },
        size: "small",
        type: "danger",
        icon: (__VLS_ctx.VideoPlay),
        loading: (__VLS_ctx.loopRunning),
        disabled: (!__VLS_ctx.selectedChapter || __VLS_ctx.generating || __VLS_ctx.autoGenerating),
    }));
    const __VLS_354 = __VLS_353({
        ...{ 'onClick': {} },
        size: "small",
        type: "danger",
        icon: (__VLS_ctx.VideoPlay),
        loading: (__VLS_ctx.loopRunning),
        disabled: (!__VLS_ctx.selectedChapter || __VLS_ctx.generating || __VLS_ctx.autoGenerating),
    }, ...__VLS_functionalComponentArgsRest(__VLS_353));
    let __VLS_356;
    let __VLS_357;
    let __VLS_358;
    const __VLS_359 = {
        onClick: (__VLS_ctx.runClosedLoopForSelectedChapter)
    };
    __VLS_355.slots.default;
    var __VLS_355;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "workflow-steps" },
    });
    const __VLS_360 = {}.ElSteps;
    /** @type {[typeof __VLS_components.ElSteps, typeof __VLS_components.elSteps, typeof __VLS_components.ElSteps, typeof __VLS_components.elSteps, ]} */ ;
    // @ts-ignore
    const __VLS_361 = __VLS_asFunctionalComponent(__VLS_360, new __VLS_360({
        active: (__VLS_ctx.loopActiveIndex),
        finishStatus: "success",
        simple: true,
    }));
    const __VLS_362 = __VLS_361({
        active: (__VLS_ctx.loopActiveIndex),
        finishStatus: "success",
        simple: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_361));
    __VLS_363.slots.default;
    for (const [item] of __VLS_getVForSourceType((__VLS_ctx.loopSteps))) {
        const __VLS_364 = {}.ElStep;
        /** @type {[typeof __VLS_components.ElStep, typeof __VLS_components.elStep, ]} */ ;
        // @ts-ignore
        const __VLS_365 = __VLS_asFunctionalComponent(__VLS_364, new __VLS_364({
            key: (item.key),
            title: (item.title),
            status: (item.status),
        }));
        const __VLS_366 = __VLS_365({
            key: (item.key),
            title: (item.title),
            status: (item.status),
        }, ...__VLS_functionalComponentArgsRest(__VLS_365));
    }
    var __VLS_363;
    if (__VLS_ctx.loopRunning || __VLS_ctx.loopLog.length) {
        const __VLS_368 = {}.ElProgress;
        /** @type {[typeof __VLS_components.ElProgress, typeof __VLS_components.elProgress, ]} */ ;
        // @ts-ignore
        const __VLS_369 = __VLS_asFunctionalComponent(__VLS_368, new __VLS_368({
            percentage: (__VLS_ctx.loopProgressPercent),
            strokeWidth: (8),
        }));
        const __VLS_370 = __VLS_369({
            percentage: (__VLS_ctx.loopProgressPercent),
            strokeWidth: (8),
        }, ...__VLS_functionalComponentArgsRest(__VLS_369));
    }
    if (__VLS_ctx.selectedPreviewItem) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "single-preview" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "single-preview__head" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        const __VLS_372 = {}.ElTag;
        /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
        // @ts-ignore
        const __VLS_373 = __VLS_asFunctionalComponent(__VLS_372, new __VLS_372({
            size: "small",
            type: "info",
        }));
        const __VLS_374 = __VLS_373({
            size: "small",
            type: "info",
        }, ...__VLS_functionalComponentArgsRest(__VLS_373));
        __VLS_375.slots.default;
        (__VLS_ctx.selectedPreviewItem.chapterNumber);
        var __VLS_375;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "single-preview__chapter" },
        });
        const __VLS_376 = {}.ElInput;
        /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
        // @ts-ignore
        const __VLS_377 = __VLS_asFunctionalComponent(__VLS_376, new __VLS_376({
            modelValue: (__VLS_ctx.selectedPreviewItem.title),
            size: "small",
            placeholder: "章节标题",
        }));
        const __VLS_378 = __VLS_377({
            modelValue: (__VLS_ctx.selectedPreviewItem.title),
            size: "small",
            placeholder: "章节标题",
        }, ...__VLS_functionalComponentArgsRest(__VLS_377));
        const __VLS_380 = {}.ElInput;
        /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
        // @ts-ignore
        const __VLS_381 = __VLS_asFunctionalComponent(__VLS_380, new __VLS_380({
            modelValue: (__VLS_ctx.selectedPreviewItem.summary),
            size: "small",
            type: "textarea",
            rows: (2),
            placeholder: "章节简介",
        }));
        const __VLS_382 = __VLS_381({
            modelValue: (__VLS_ctx.selectedPreviewItem.summary),
            size: "small",
            type: "textarea",
            rows: (2),
            placeholder: "章节简介",
        }, ...__VLS_functionalComponentArgsRest(__VLS_381));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "single-preview__scenes" },
        });
        for (const [scene] of __VLS_getVForSourceType((__VLS_ctx.selectedPreviewItem.scenes ?? []))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                key: (scene.sceneNumber),
                ...{ class: "single-preview-scene" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "single-preview-scene__title" },
            });
            const __VLS_384 = {}.ElTag;
            /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
            // @ts-ignore
            const __VLS_385 = __VLS_asFunctionalComponent(__VLS_384, new __VLS_384({
                size: "small",
                type: "info",
            }));
            const __VLS_386 = __VLS_385({
                size: "small",
                type: "info",
            }, ...__VLS_functionalComponentArgsRest(__VLS_385));
            __VLS_387.slots.default;
            (scene.sceneNumber);
            var __VLS_387;
            const __VLS_388 = {}.ElInput;
            /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
            // @ts-ignore
            const __VLS_389 = __VLS_asFunctionalComponent(__VLS_388, new __VLS_388({
                modelValue: (scene.title),
                size: "small",
                placeholder: "场景标题",
            }));
            const __VLS_390 = __VLS_389({
                modelValue: (scene.title),
                size: "small",
                placeholder: "场景标题",
            }, ...__VLS_functionalComponentArgsRest(__VLS_389));
            const __VLS_392 = {}.ElInput;
            /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
            // @ts-ignore
            const __VLS_393 = __VLS_asFunctionalComponent(__VLS_392, new __VLS_392({
                modelValue: (scene.summary),
                size: "small",
                type: "textarea",
                rows: (2),
                placeholder: "场景简介",
            }));
            const __VLS_394 = __VLS_393({
                modelValue: (scene.summary),
                size: "small",
                type: "textarea",
                rows: (2),
                placeholder: "场景简介",
            }, ...__VLS_functionalComponentArgsRest(__VLS_393));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "single-preview-scene__grid" },
            });
            const __VLS_396 = {}.ElInput;
            /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
            // @ts-ignore
            const __VLS_397 = __VLS_asFunctionalComponent(__VLS_396, new __VLS_396({
                modelValue: (scene.goal),
                size: "small",
                placeholder: "场景目标",
            }));
            const __VLS_398 = __VLS_397({
                modelValue: (scene.goal),
                size: "small",
                placeholder: "场景目标",
            }, ...__VLS_functionalComponentArgsRest(__VLS_397));
            const __VLS_400 = {}.ElInput;
            /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
            // @ts-ignore
            const __VLS_401 = __VLS_asFunctionalComponent(__VLS_400, new __VLS_400({
                modelValue: (scene.conflict),
                size: "small",
                placeholder: "场景冲突",
            }));
            const __VLS_402 = __VLS_401({
                modelValue: (scene.conflict),
                size: "small",
                placeholder: "场景冲突",
            }, ...__VLS_functionalComponentArgsRest(__VLS_401));
            const __VLS_404 = {}.ElInput;
            /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
            // @ts-ignore
            const __VLS_405 = __VLS_asFunctionalComponent(__VLS_404, new __VLS_404({
                modelValue: (scene.hook),
                size: "small",
                placeholder: "收束钩子",
            }));
            const __VLS_406 = __VLS_405({
                modelValue: (scene.hook),
                size: "small",
                placeholder: "收束钩子",
            }, ...__VLS_functionalComponentArgsRest(__VLS_405));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "single-preview-scene__tracking-grid" },
            });
            const __VLS_408 = {}.ElInput;
            /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
            // @ts-ignore
            const __VLS_409 = __VLS_asFunctionalComponent(__VLS_408, new __VLS_408({
                modelValue: (scene.foreshadowingName),
                size: "small",
                placeholder: "伏笔名称",
            }));
            const __VLS_410 = __VLS_409({
                modelValue: (scene.foreshadowingName),
                size: "small",
                placeholder: "伏笔名称",
            }, ...__VLS_functionalComponentArgsRest(__VLS_409));
            const __VLS_412 = {}.ElInput;
            /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
            // @ts-ignore
            const __VLS_413 = __VLS_asFunctionalComponent(__VLS_412, new __VLS_412({
                modelValue: (scene.foreshadowingRole),
                size: "small",
                placeholder: "伏笔职责：埋设/推进/回收",
            }));
            const __VLS_414 = __VLS_413({
                modelValue: (scene.foreshadowingRole),
                size: "small",
                placeholder: "伏笔职责：埋设/推进/回收",
            }, ...__VLS_functionalComponentArgsRest(__VLS_413));
            const __VLS_416 = {}.ElInput;
            /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
            // @ts-ignore
            const __VLS_417 = __VLS_asFunctionalComponent(__VLS_416, new __VLS_416({
                modelValue: (scene.timeAnchor),
                size: "small",
                placeholder: "时间锚点",
            }));
            const __VLS_418 = __VLS_417({
                modelValue: (scene.timeAnchor),
                size: "small",
                placeholder: "时间锚点",
            }, ...__VLS_functionalComponentArgsRest(__VLS_417));
            const __VLS_420 = {}.ElInput;
            /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
            // @ts-ignore
            const __VLS_421 = __VLS_asFunctionalComponent(__VLS_420, new __VLS_420({
                modelValue: (scene.locationAnchor),
                size: "small",
                placeholder: "地点锚点",
            }));
            const __VLS_422 = __VLS_421({
                modelValue: (scene.locationAnchor),
                size: "small",
                placeholder: "地点锚点",
            }, ...__VLS_functionalComponentArgsRest(__VLS_421));
            const __VLS_424 = {}.ElInput;
            /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
            // @ts-ignore
            const __VLS_425 = __VLS_asFunctionalComponent(__VLS_424, new __VLS_424({
                modelValue: (scene.elapsedFromPrevious),
                size: "small",
                placeholder: "距上一场景/上一章经过",
            }));
            const __VLS_426 = __VLS_425({
                modelValue: (scene.elapsedFromPrevious),
                size: "small",
                placeholder: "距上一场景/上一章经过",
            }, ...__VLS_functionalComponentArgsRest(__VLS_425));
            const __VLS_428 = {}.ElInput;
            /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
            // @ts-ignore
            const __VLS_429 = __VLS_asFunctionalComponent(__VLS_428, new __VLS_428({
                modelValue: (scene.timelineEffect),
                size: "small",
                placeholder: "时间线影响",
            }));
            const __VLS_430 = __VLS_429({
                modelValue: (scene.timelineEffect),
                size: "small",
                placeholder: "时间线影响",
            }, ...__VLS_functionalComponentArgsRest(__VLS_429));
        }
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "workflow-controls" },
    });
    const __VLS_432 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_433 = __VLS_asFunctionalComponent(__VLS_432, new __VLS_432({
        label: "场景序号",
    }));
    const __VLS_434 = __VLS_433({
        label: "场景序号",
    }, ...__VLS_functionalComponentArgsRest(__VLS_433));
    __VLS_435.slots.default;
    const __VLS_436 = {}.ElInputNumber;
    /** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
    // @ts-ignore
    const __VLS_437 = __VLS_asFunctionalComponent(__VLS_436, new __VLS_436({
        modelValue: (__VLS_ctx.workflowForm.sceneNumber),
        min: (1),
        controlsPosition: "right",
    }));
    const __VLS_438 = __VLS_437({
        modelValue: (__VLS_ctx.workflowForm.sceneNumber),
        min: (1),
        controlsPosition: "right",
    }, ...__VLS_functionalComponentArgsRest(__VLS_437));
    var __VLS_435;
    const __VLS_440 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_441 = __VLS_asFunctionalComponent(__VLS_440, new __VLS_440({
        label: "最低字数",
    }));
    const __VLS_442 = __VLS_441({
        label: "最低字数",
    }, ...__VLS_functionalComponentArgsRest(__VLS_441));
    __VLS_443.slots.default;
    const __VLS_444 = {}.ElInputNumber;
    /** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
    // @ts-ignore
    const __VLS_445 = __VLS_asFunctionalComponent(__VLS_444, new __VLS_444({
        modelValue: (__VLS_ctx.workflowForm.minWordCount),
        min: (100),
        max: (8000),
        step: (100),
        controlsPosition: "right",
    }));
    const __VLS_446 = __VLS_445({
        modelValue: (__VLS_ctx.workflowForm.minWordCount),
        min: (100),
        max: (8000),
        step: (100),
        controlsPosition: "right",
    }, ...__VLS_functionalComponentArgsRest(__VLS_445));
    var __VLS_443;
    const __VLS_448 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_449 = __VLS_asFunctionalComponent(__VLS_448, new __VLS_448({
        label: "场景要求",
        ...{ class: "workflow-controls__prompt" },
    }));
    const __VLS_450 = __VLS_449({
        label: "场景要求",
        ...{ class: "workflow-controls__prompt" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_449));
    __VLS_451.slots.default;
    const __VLS_452 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_453 = __VLS_asFunctionalComponent(__VLS_452, new __VLS_452({
        modelValue: (__VLS_ctx.workflowForm.scenePrompt),
        type: "textarea",
        rows: (2),
    }));
    const __VLS_454 = __VLS_453({
        modelValue: (__VLS_ctx.workflowForm.scenePrompt),
        type: "textarea",
        rows: (2),
    }, ...__VLS_functionalComponentArgsRest(__VLS_453));
    var __VLS_451;
    if (__VLS_ctx.selectedPreviewItem || __VLS_ctx.confirmedPreview || __VLS_ctx.preflightResult || __VLS_ctx.sceneDraftResult || __VLS_ctx.chapterAnalysisResult) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "workflow-results" },
        });
        if (__VLS_ctx.selectedPreviewItem) {
            const __VLS_456 = {}.ElAlert;
            /** @type {[typeof __VLS_components.ElAlert, typeof __VLS_components.elAlert, ]} */ ;
            // @ts-ignore
            const __VLS_457 = __VLS_asFunctionalComponent(__VLS_456, new __VLS_456({
                title: (`标题简介已生成：第 ${__VLS_ctx.selectedPreviewItem.chapterNumber} 章《${__VLS_ctx.selectedPreviewItem.title || '-'}》，场景 ${__VLS_ctx.selectedPreviewItem.scenes?.length ?? 0} 个`),
                type: "info",
                showIcon: true,
                closable: (false),
            }));
            const __VLS_458 = __VLS_457({
                title: (`标题简介已生成：第 ${__VLS_ctx.selectedPreviewItem.chapterNumber} 章《${__VLS_ctx.selectedPreviewItem.title || '-'}》，场景 ${__VLS_ctx.selectedPreviewItem.scenes?.length ?? 0} 个`),
                type: "info",
                showIcon: true,
                closable: (false),
            }, ...__VLS_functionalComponentArgsRest(__VLS_457));
        }
        if (__VLS_ctx.confirmedPreview) {
            const __VLS_460 = {}.ElAlert;
            /** @type {[typeof __VLS_components.ElAlert, typeof __VLS_components.elAlert, ]} */ ;
            // @ts-ignore
            const __VLS_461 = __VLS_asFunctionalComponent(__VLS_460, new __VLS_460({
                title: (`标题简介和场景蓝图已确认入库：${__VLS_ctx.confirmedPreview.sceneCount} 个场景`),
                type: "success",
                showIcon: true,
                closable: (false),
            }));
            const __VLS_462 = __VLS_461({
                title: (`标题简介和场景蓝图已确认入库：${__VLS_ctx.confirmedPreview.sceneCount} 个场景`),
                type: "success",
                showIcon: true,
                closable: (false),
            }, ...__VLS_functionalComponentArgsRest(__VLS_461));
        }
        if (__VLS_ctx.preflightResult) {
            const __VLS_464 = {}.ElAlert;
            /** @type {[typeof __VLS_components.ElAlert, typeof __VLS_components.elAlert, ]} */ ;
            // @ts-ignore
            const __VLS_465 = __VLS_asFunctionalComponent(__VLS_464, new __VLS_464({
                title: (__VLS_ctx.preflightResult.passed ? '预检通过' : `预检未通过：${__VLS_ctx.preflightResult.fatalCount} 个致命问题，${__VLS_ctx.preflightResult.warningCount} 个警告`),
                type: (__VLS_ctx.preflightResult.passed ? 'success' : 'warning'),
                showIcon: true,
                closable: (false),
            }));
            const __VLS_466 = __VLS_465({
                title: (__VLS_ctx.preflightResult.passed ? '预检通过' : `预检未通过：${__VLS_ctx.preflightResult.fatalCount} 个致命问题，${__VLS_ctx.preflightResult.warningCount} 个警告`),
                type: (__VLS_ctx.preflightResult.passed ? 'success' : 'warning'),
                showIcon: true,
                closable: (false),
            }, ...__VLS_functionalComponentArgsRest(__VLS_465));
        }
        if (__VLS_ctx.preflightResult?.items.length) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "workflow-result-list" },
            });
            for (const [item] of __VLS_getVForSourceType((__VLS_ctx.preflightResult.items))) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    key: (item.code),
                    ...{ class: "workflow-result-item" },
                });
                const __VLS_468 = {}.ElTag;
                /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
                // @ts-ignore
                const __VLS_469 = __VLS_asFunctionalComponent(__VLS_468, new __VLS_468({
                    size: "small",
                    type: (item.severity === 'fatal' ? 'danger' : 'warning'),
                }));
                const __VLS_470 = __VLS_469({
                    size: "small",
                    type: (item.severity === 'fatal' ? 'danger' : 'warning'),
                }, ...__VLS_functionalComponentArgsRest(__VLS_469));
                __VLS_471.slots.default;
                (item.severity);
                var __VLS_471;
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
                (item.message);
                __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
                (item.suggestion);
            }
        }
        if (__VLS_ctx.sceneDraftResult) {
            const __VLS_472 = {}.ElAlert;
            /** @type {[typeof __VLS_components.ElAlert, typeof __VLS_components.elAlert, ]} */ ;
            // @ts-ignore
            const __VLS_473 = __VLS_asFunctionalComponent(__VLS_472, new __VLS_472({
                title: (__VLS_ctx.sceneDraftResult.success ? `场景 ${__VLS_ctx.sceneDraftResult.sceneNumber} 已生成：${__VLS_ctx.sceneDraftResult.sceneTitle || '未命名场景'}` : `场景生成失败：${__VLS_ctx.sceneDraftResult.error || '-'}`),
                type: (__VLS_ctx.sceneDraftResult.success ? 'success' : 'error'),
                showIcon: true,
                closable: (false),
            }));
            const __VLS_474 = __VLS_473({
                title: (__VLS_ctx.sceneDraftResult.success ? `场景 ${__VLS_ctx.sceneDraftResult.sceneNumber} 已生成：${__VLS_ctx.sceneDraftResult.sceneTitle || '未命名场景'}` : `场景生成失败：${__VLS_ctx.sceneDraftResult.error || '-'}`),
                type: (__VLS_ctx.sceneDraftResult.success ? 'success' : 'error'),
                showIcon: true,
                closable: (false),
            }, ...__VLS_functionalComponentArgsRest(__VLS_473));
        }
        if (__VLS_ctx.chapterAnalysisResult) {
            const __VLS_476 = {}.ElAlert;
            /** @type {[typeof __VLS_components.ElAlert, typeof __VLS_components.elAlert, ]} */ ;
            // @ts-ignore
            const __VLS_477 = __VLS_asFunctionalComponent(__VLS_476, new __VLS_476({
                title: (`分析结果：${__VLS_ctx.chapterAnalysisResult.passed ? '通过' : '未通过'}，字数 ${__VLS_ctx.chapterAnalysisResult.wordCount}，连贯 ${__VLS_ctx.chapterAnalysisResult.coherenceScore}/10，质量 ${__VLS_ctx.chapterAnalysisResult.qualityScore}/10`),
                type: (__VLS_ctx.chapterAnalysisResult.passed ? 'success' : 'warning'),
                showIcon: true,
                closable: (false),
            }));
            const __VLS_478 = __VLS_477({
                title: (`分析结果：${__VLS_ctx.chapterAnalysisResult.passed ? '通过' : '未通过'}，字数 ${__VLS_ctx.chapterAnalysisResult.wordCount}，连贯 ${__VLS_ctx.chapterAnalysisResult.coherenceScore}/10，质量 ${__VLS_ctx.chapterAnalysisResult.qualityScore}/10`),
                type: (__VLS_ctx.chapterAnalysisResult.passed ? 'success' : 'warning'),
                showIcon: true,
                closable: (false),
            }, ...__VLS_functionalComponentArgsRest(__VLS_477));
        }
        if (__VLS_ctx.chapterAnalysisResult?.items.length) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "workflow-result-list" },
            });
            for (const [item] of __VLS_getVForSourceType((__VLS_ctx.chapterAnalysisResult.items))) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    key: (item.code),
                    ...{ class: "workflow-result-item" },
                });
                const __VLS_480 = {}.ElTag;
                /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
                // @ts-ignore
                const __VLS_481 = __VLS_asFunctionalComponent(__VLS_480, new __VLS_480({
                    size: "small",
                    type: (item.severity === 'fatal' ? 'danger' : 'warning'),
                }));
                const __VLS_482 = __VLS_481({
                    size: "small",
                    type: (item.severity === 'fatal' ? 'danger' : 'warning'),
                }, ...__VLS_functionalComponentArgsRest(__VLS_481));
                __VLS_483.slots.default;
                (item.severity);
                var __VLS_483;
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
                (item.message);
                __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
                (item.suggestion);
            }
        }
    }
    if (__VLS_ctx.loopLog.length) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "workflow-log" },
        });
        for (const [item, index] of __VLS_getVForSourceType((__VLS_ctx.loopLog))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                key: (index),
                ...{ class: "workflow-log__item" },
            });
            (item);
        }
    }
}
const __VLS_484 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_485 = __VLS_asFunctionalComponent(__VLS_484, new __VLS_484({
    labelWidth: "110px",
    ...{ class: "ai-form" },
    disabled: (__VLS_ctx.generating),
}));
const __VLS_486 = __VLS_485({
    labelWidth: "110px",
    ...{ class: "ai-form" },
    disabled: (__VLS_ctx.generating),
}, ...__VLS_functionalComponentArgsRest(__VLS_485));
__VLS_487.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "ai-source-bar" },
});
const __VLS_488 = {}.ElSwitch;
/** @type {[typeof __VLS_components.ElSwitch, typeof __VLS_components.elSwitch, ]} */ ;
// @ts-ignore
const __VLS_489 = __VLS_asFunctionalComponent(__VLS_488, new __VLS_488({
    modelValue: (__VLS_ctx.rerunValidationAfterSave),
    activeText: (__VLS_ctx.t('chapterGeneration.ai.autoRerunValidation')),
    inactiveText: (__VLS_ctx.t('chapterGeneration.ai.manualValidation')),
}));
const __VLS_490 = __VLS_489({
    modelValue: (__VLS_ctx.rerunValidationAfterSave),
    activeText: (__VLS_ctx.t('chapterGeneration.ai.autoRerunValidation')),
    inactiveText: (__VLS_ctx.t('chapterGeneration.ai.manualValidation')),
}, ...__VLS_functionalComponentArgsRest(__VLS_489));
const __VLS_492 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_493 = __VLS_asFunctionalComponent(__VLS_492, new __VLS_492({
    ...{ 'onClick': {} },
    size: "small",
    icon: (__VLS_ctx.Refresh),
    loading: (__VLS_ctx.loadingAiConfig),
}));
const __VLS_494 = __VLS_493({
    ...{ 'onClick': {} },
    size: "small",
    icon: (__VLS_ctx.Refresh),
    loading: (__VLS_ctx.loadingAiConfig),
}, ...__VLS_functionalComponentArgsRest(__VLS_493));
let __VLS_496;
let __VLS_497;
let __VLS_498;
const __VLS_499 = {
    onClick: (__VLS_ctx.refreshAiConfig)
};
__VLS_495.slots.default;
(__VLS_ctx.t('chapterGeneration.actions.refreshAiConfig'));
var __VLS_495;
const __VLS_500 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_501 = __VLS_asFunctionalComponent(__VLS_500, new __VLS_500({
    label: (__VLS_ctx.t('chapterGeneration.ai.config')),
}));
const __VLS_502 = __VLS_501({
    label: (__VLS_ctx.t('chapterGeneration.ai.config')),
}, ...__VLS_functionalComponentArgsRest(__VLS_501));
__VLS_503.slots.default;
const __VLS_504 = {}.ElSelect;
/** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
// @ts-ignore
const __VLS_505 = __VLS_asFunctionalComponent(__VLS_504, new __VLS_504({
    modelValue: (__VLS_ctx.selectedConfigId),
    placeholder: (__VLS_ctx.t('chapterGeneration.ai.selectConfig')),
    filterable: true,
    clearable: true,
}));
const __VLS_506 = __VLS_505({
    modelValue: (__VLS_ctx.selectedConfigId),
    placeholder: (__VLS_ctx.t('chapterGeneration.ai.selectConfig')),
    filterable: true,
    clearable: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_505));
__VLS_507.slots.default;
for (const [config] of __VLS_getVForSourceType((__VLS_ctx.configs))) {
    const __VLS_508 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_509 = __VLS_asFunctionalComponent(__VLS_508, new __VLS_508({
        key: (config.providerId),
        label: (`${config.name} / ${config.modelCode || '--'}`),
        value: (config.providerId),
    }));
    const __VLS_510 = __VLS_509({
        key: (config.providerId),
        label: (`${config.name} / ${config.modelCode || '--'}`),
        value: (config.providerId),
    }, ...__VLS_functionalComponentArgsRest(__VLS_509));
}
var __VLS_507;
var __VLS_503;
const __VLS_512 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_513 = __VLS_asFunctionalComponent(__VLS_512, new __VLS_512({
    label: (__VLS_ctx.t('chapterGeneration.ai.apiKey')),
}));
const __VLS_514 = __VLS_513({
    label: (__VLS_ctx.t('chapterGeneration.ai.apiKey')),
}, ...__VLS_functionalComponentArgsRest(__VLS_513));
__VLS_515.slots.default;
const __VLS_516 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_517 = __VLS_asFunctionalComponent(__VLS_516, new __VLS_516({
    modelValue: (__VLS_ctx.aiForm.apiKey),
    type: "password",
    showPassword: true,
    placeholder: (__VLS_ctx.t('chapterGeneration.ai.apiKeyPlaceholder')),
}));
const __VLS_518 = __VLS_517({
    modelValue: (__VLS_ctx.aiForm.apiKey),
    type: "password",
    showPassword: true,
    placeholder: (__VLS_ctx.t('chapterGeneration.ai.apiKeyPlaceholder')),
}, ...__VLS_functionalComponentArgsRest(__VLS_517));
var __VLS_515;
const __VLS_520 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_521 = __VLS_asFunctionalComponent(__VLS_520, new __VLS_520({
    label: (__VLS_ctx.t('chapterGeneration.ai.model')),
}));
const __VLS_522 = __VLS_521({
    label: (__VLS_ctx.t('chapterGeneration.ai.model')),
}, ...__VLS_functionalComponentArgsRest(__VLS_521));
__VLS_523.slots.default;
const __VLS_524 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_525 = __VLS_asFunctionalComponent(__VLS_524, new __VLS_524({
    modelValue: (__VLS_ctx.aiForm.model),
    placeholder: (__VLS_ctx.t('chapterGeneration.ai.modelPlaceholder')),
}));
const __VLS_526 = __VLS_525({
    modelValue: (__VLS_ctx.aiForm.model),
    placeholder: (__VLS_ctx.t('chapterGeneration.ai.modelPlaceholder')),
}, ...__VLS_functionalComponentArgsRest(__VLS_525));
var __VLS_523;
const __VLS_528 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_529 = __VLS_asFunctionalComponent(__VLS_528, new __VLS_528({
    label: (__VLS_ctx.t('chapterGeneration.ai.endpoint')),
}));
const __VLS_530 = __VLS_529({
    label: (__VLS_ctx.t('chapterGeneration.ai.endpoint')),
}, ...__VLS_functionalComponentArgsRest(__VLS_529));
__VLS_531.slots.default;
const __VLS_532 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_533 = __VLS_asFunctionalComponent(__VLS_532, new __VLS_532({
    modelValue: (__VLS_ctx.aiForm.endpoint),
    placeholder: (__VLS_ctx.t('chapterGeneration.ai.endpointPlaceholder')),
}));
const __VLS_534 = __VLS_533({
    modelValue: (__VLS_ctx.aiForm.endpoint),
    placeholder: (__VLS_ctx.t('chapterGeneration.ai.endpointPlaceholder')),
}, ...__VLS_functionalComponentArgsRest(__VLS_533));
var __VLS_531;
const __VLS_536 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_537 = __VLS_asFunctionalComponent(__VLS_536, new __VLS_536({
    label: (__VLS_ctx.t('chapterGeneration.ai.systemPrompt')),
}));
const __VLS_538 = __VLS_537({
    label: (__VLS_ctx.t('chapterGeneration.ai.systemPrompt')),
}, ...__VLS_functionalComponentArgsRest(__VLS_537));
__VLS_539.slots.default;
const __VLS_540 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_541 = __VLS_asFunctionalComponent(__VLS_540, new __VLS_540({
    modelValue: (__VLS_ctx.promptForm.systemPrompt),
    type: "textarea",
    rows: (2),
}));
const __VLS_542 = __VLS_541({
    modelValue: (__VLS_ctx.promptForm.systemPrompt),
    type: "textarea",
    rows: (2),
}, ...__VLS_functionalComponentArgsRest(__VLS_541));
var __VLS_539;
const __VLS_544 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_545 = __VLS_asFunctionalComponent(__VLS_544, new __VLS_544({
    label: (__VLS_ctx.t('chapterGeneration.ai.prompt')),
}));
const __VLS_546 = __VLS_545({
    label: (__VLS_ctx.t('chapterGeneration.ai.prompt')),
}, ...__VLS_functionalComponentArgsRest(__VLS_545));
__VLS_547.slots.default;
const __VLS_548 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_549 = __VLS_asFunctionalComponent(__VLS_548, new __VLS_548({
    modelValue: (__VLS_ctx.promptForm.prompt),
    type: "textarea",
    rows: (5),
}));
const __VLS_550 = __VLS_549({
    modelValue: (__VLS_ctx.promptForm.prompt),
    type: "textarea",
    rows: (5),
}, ...__VLS_functionalComponentArgsRest(__VLS_549));
var __VLS_547;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "inline-controls" },
});
const __VLS_552 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_553 = __VLS_asFunctionalComponent(__VLS_552, new __VLS_552({
    label: (__VLS_ctx.t('chapterGeneration.ai.temperature')),
}));
const __VLS_554 = __VLS_553({
    label: (__VLS_ctx.t('chapterGeneration.ai.temperature')),
}, ...__VLS_functionalComponentArgsRest(__VLS_553));
__VLS_555.slots.default;
const __VLS_556 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_557 = __VLS_asFunctionalComponent(__VLS_556, new __VLS_556({
    modelValue: (__VLS_ctx.promptForm.temperature),
    min: (0),
    max: (2),
    step: (0.1),
}));
const __VLS_558 = __VLS_557({
    modelValue: (__VLS_ctx.promptForm.temperature),
    min: (0),
    max: (2),
    step: (0.1),
}, ...__VLS_functionalComponentArgsRest(__VLS_557));
var __VLS_555;
const __VLS_560 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_561 = __VLS_asFunctionalComponent(__VLS_560, new __VLS_560({
    label: (__VLS_ctx.t('chapterGeneration.ai.maxTokens')),
}));
const __VLS_562 = __VLS_561({
    label: (__VLS_ctx.t('chapterGeneration.ai.maxTokens')),
}, ...__VLS_functionalComponentArgsRest(__VLS_561));
__VLS_563.slots.default;
const __VLS_564 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_565 = __VLS_asFunctionalComponent(__VLS_564, new __VLS_564({
    modelValue: (__VLS_ctx.promptForm.maxTokens),
    min: (256),
    max: (12000),
    step: (256),
}));
const __VLS_566 = __VLS_565({
    modelValue: (__VLS_ctx.promptForm.maxTokens),
    min: (256),
    max: (12000),
    step: (256),
}, ...__VLS_functionalComponentArgsRest(__VLS_565));
var __VLS_563;
const __VLS_568 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_569 = __VLS_asFunctionalComponent(__VLS_568, new __VLS_568({
    label: (__VLS_ctx.t('chapterGeneration.ai.maxRewrites')),
}));
const __VLS_570 = __VLS_569({
    label: (__VLS_ctx.t('chapterGeneration.ai.maxRewrites')),
}, ...__VLS_functionalComponentArgsRest(__VLS_569));
__VLS_571.slots.default;
const __VLS_572 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_573 = __VLS_asFunctionalComponent(__VLS_572, new __VLS_572({
    modelValue: (__VLS_ctx.promptForm.maxRewriteAttempts),
    min: (0),
    max: (3),
    step: (1),
}));
const __VLS_574 = __VLS_573({
    modelValue: (__VLS_ctx.promptForm.maxRewriteAttempts),
    min: (0),
    max: (3),
    step: (1),
}, ...__VLS_functionalComponentArgsRest(__VLS_573));
var __VLS_571;
var __VLS_487;
if (__VLS_ctx.error) {
    const __VLS_576 = {}.ElAlert;
    /** @type {[typeof __VLS_components.ElAlert, typeof __VLS_components.elAlert, ]} */ ;
    // @ts-ignore
    const __VLS_577 = __VLS_asFunctionalComponent(__VLS_576, new __VLS_576({
        title: (__VLS_ctx.error),
        type: "error",
        showIcon: true,
        closable: (false),
    }));
    const __VLS_578 = __VLS_577({
        title: (__VLS_ctx.error),
        type: "error",
        showIcon: true,
        closable: (false),
    }, ...__VLS_functionalComponentArgsRest(__VLS_577));
}
if (__VLS_ctx.latestValidationSummary) {
    const __VLS_580 = {}.ElAlert;
    /** @type {[typeof __VLS_components.ElAlert, typeof __VLS_components.elAlert, ]} */ ;
    // @ts-ignore
    const __VLS_581 = __VLS_asFunctionalComponent(__VLS_580, new __VLS_580({
        title: (__VLS_ctx.latestValidationSummary),
        type: "success",
        showIcon: true,
        closable: (false),
        ...{ style: {} },
    }));
    const __VLS_582 = __VLS_581({
        title: (__VLS_ctx.latestValidationSummary),
        type: "success",
        showIcon: true,
        closable: (false),
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_581));
}
const __VLS_584 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_585 = __VLS_asFunctionalComponent(__VLS_584, new __VLS_584({
    modelValue: (__VLS_ctx.output),
    type: "textarea",
    rows: (18),
    ...{ class: "draft-output" },
    placeholder: (__VLS_ctx.t('chapterGeneration.ai.outputPlaceholder')),
}));
const __VLS_586 = __VLS_585({
    modelValue: (__VLS_ctx.output),
    type: "textarea",
    rows: (18),
    ...{ class: "draft-output" },
    placeholder: (__VLS_ctx.t('chapterGeneration.ai.outputPlaceholder')),
}, ...__VLS_functionalComponentArgsRest(__VLS_585));
var __VLS_91;
/** @type {__VLS_StyleScopedClasses['chapter-generation']} */ ;
/** @type {__VLS_StyleScopedClasses['workspace-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['chapter-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-head']} */ ;
/** @type {__VLS_StyleScopedClasses['create-form']} */ ;
/** @type {__VLS_StyleScopedClasses['generator-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-head']} */ ;
/** @type {__VLS_StyleScopedClasses['head-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['generation-mode-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['generation-mode-panel__title']} */ ;
/** @type {__VLS_StyleScopedClasses['generation-mode-panel__subtitle']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-console']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-console__head']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-console__title']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-console__subtitle']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-console__job']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-console__actions']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-form']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-controls']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-options']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-option-hint']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-preview']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-preview__head']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-preview__title']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-preview__subtitle']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-preview__table']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-scenes']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-scenes__head']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-scene']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-scene__title']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-scene__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-scene__tracking-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-progress']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-message']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-progress__meta']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-log']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-log__item']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-console']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-console__head']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-console__title']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-console__subtitle']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-console__actions']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-steps']} */ ;
/** @type {__VLS_StyleScopedClasses['single-preview']} */ ;
/** @type {__VLS_StyleScopedClasses['single-preview__head']} */ ;
/** @type {__VLS_StyleScopedClasses['single-preview__chapter']} */ ;
/** @type {__VLS_StyleScopedClasses['single-preview__scenes']} */ ;
/** @type {__VLS_StyleScopedClasses['single-preview-scene']} */ ;
/** @type {__VLS_StyleScopedClasses['single-preview-scene__title']} */ ;
/** @type {__VLS_StyleScopedClasses['single-preview-scene__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['single-preview-scene__tracking-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-controls']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-controls__prompt']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-results']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-result-list']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-result-item']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-result-list']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-result-item']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-log']} */ ;
/** @type {__VLS_StyleScopedClasses['workflow-log__item']} */ ;
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
            generationMode: generationMode,
            workflowLoading: workflowLoading,
            sceneGenerating: sceneGenerating,
            sceneComposing: sceneComposing,
            analyzingChapter: analyzingChapter,
            ensuringSceneBlueprints: ensuringSceneBlueprints,
            confirmingPreview: confirmingPreview,
            loopRunning: loopRunning,
            loopStage: loopStage,
            loopLog: loopLog,
            confirmedPreview: confirmedPreview,
            preflightResult: preflightResult,
            sceneDraftResult: sceneDraftResult,
            chapterAnalysisResult: chapterAnalysisResult,
            autoProgress: autoProgress,
            chapterForm: chapterForm,
            promptForm: promptForm,
            autoForm: autoForm,
            workflowForm: workflowForm,
            autoProgressPercent: autoProgressPercent,
            autoJobStatusLabel: autoJobStatusLabel,
            selectedPreviewItem: selectedPreviewItem,
            generationModeLabel: generationModeLabel,
            generationModeDescription: generationModeDescription,
            generationModeToggleText: generationModeToggleText,
            canEnsureSceneBlueprints: canEnsureSceneBlueprints,
            canConfirmSelectedPreview: canConfirmSelectedPreview,
            loopProgressPercent: loopProgressPercent,
            loopActiveIndex: loopActiveIndex,
            loopSteps: loopSteps,
            refreshChapters: refreshChapters,
            quickCreateChapter: quickCreateChapter,
            removeChapter: removeChapter,
            toggleGenerationMode: toggleGenerationMode,
            runPreflightForSelectedChapter: runPreflightForSelectedChapter,
            previewSelectedChapterBlueprints: previewSelectedChapterBlueprints,
            confirmPreviewForSelectedChapter: confirmPreviewForSelectedChapter,
            ensureBlueprintsForSelectedChapter: ensureBlueprintsForSelectedChapter,
            generateSelectedSceneDraft: generateSelectedSceneDraft,
            composeSelectedScenes: composeSelectedScenes,
            analyzeSelectedChapter: analyzeSelectedChapter,
            runClosedLoopForSelectedChapter: runClosedLoopForSelectedChapter,
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
