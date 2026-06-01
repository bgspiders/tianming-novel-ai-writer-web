import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Refresh, Delete, VideoPlay, DocumentChecked } from '@element-plus/icons-vue';
import { storeToRefs } from 'pinia';
import { useI18n } from '@/composables/useI18n';
import { useWorkContextStore } from '@/stores/workContext';
import { useAiTestStore } from '@/stores/aiTest';
import { chatHub } from '@/signalr/chat';
import { listKeys, listModels, listProviders } from '@/api/modules/ai';
import { createChapter, deleteChapter, generateChapterDraft, getChapter, listChapters, saveChapterContent } from '@/api/modules/chapters';
const workContext = useWorkContextStore();
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
const providers = ref([]);
const models = ref([]);
const apiKeys = ref([]);
const selectedProviderId = ref('');
const selectedModelCode = ref('');
const selectedApiKeyId = ref('');
const useSavedApiKey = ref(true);
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
    error.value = message;
    status.value = t('aiAssistant.status.failed');
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
function resetChapterForm() {
    chapterForm.chapterNumber = (chapters.value.at(-1)?.chapterNumber ?? 0) + 1;
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
    const volume = workContext.selectedVolume;
    if (!chapter)
        return;
    promptForm.prompt = [
        `项目：${workContext.selectedProject?.name ?? chapter.projectId}`,
        `卷：${volume ? `第 ${volume.volumeNumber} 卷 / ${volume.title}` : chapter.volumeId}`,
        `章节：${chapter.chapterNumber} / ${chapter.title}`,
        chapter.summary ? `摘要：${chapter.summary}` : '',
        '',
        '请直接输出章节草稿，保持叙事连贯清晰。'
    ].filter(Boolean).join('\n');
}
async function refreshAiConfig() {
    loadingAiConfig.value = true;
    try {
        providers.value = (await listProviders()).filter((item) => item.isEnabled);
        if (!providers.value.some((item) => item.id === selectedProviderId.value)) {
            selectedProviderId.value = providers.value[0]?.id ?? '';
        }
        await refreshProviderAssets();
    }
    catch (err) {
        ElMessage.error(err.message || t('chapterGeneration.messages.loadAiConfigFailed'));
    }
    finally {
        loadingAiConfig.value = false;
    }
}
async function refreshProviderAssets() {
    if (!selectedProviderId.value) {
        models.value = [];
        apiKeys.value = [];
        return;
    }
    const [nextModels, nextKeys] = await Promise.all([
        listModels(selectedProviderId.value),
        listKeys(selectedProviderId.value)
    ]);
    models.value = nextModels;
    apiKeys.value = nextKeys;
    const provider = providers.value.find((item) => item.id === selectedProviderId.value);
    if (provider?.defaultEndpoint) {
        aiForm.value.endpoint = provider.defaultEndpoint;
    }
    const enabledModels = models.value.filter((item) => item.isEnabled);
    const enabledKeys = apiKeys.value.filter((item) => item.isEnabled);
    if (!enabledModels.some((item) => item.code === selectedModelCode.value)) {
        selectedModelCode.value = enabledModels[0]?.code ?? aiForm.value.model ?? '';
    }
    if (selectedModelCode.value) {
        aiForm.value.model = selectedModelCode.value;
    }
    if (!enabledKeys.some((item) => item.id === selectedApiKeyId.value)) {
        selectedApiKeyId.value = '';
    }
}
async function generateDraft() {
    if (!selectedChapter.value) {
        ElMessage.warning(t('chapterGeneration.messages.selectChapterFirst'));
        return;
    }
    if (!aiForm.value.endpoint || !aiForm.value.model) {
        ElMessage.warning(t('chapterGeneration.messages.endpointModelRequired'));
        return;
    }
    if (useSavedApiKey.value && !selectedProviderId.value) {
        ElMessage.warning(t('chapterGeneration.messages.selectProviderFirst'));
        return;
    }
    if (!useSavedApiKey.value && !aiForm.value.apiKey) {
        ElMessage.warning(t('chapterGeneration.messages.tempKeyRequired'));
        return;
    }
    if (!promptForm.prompt.trim()) {
        ElMessage.warning(t('chapterGeneration.messages.promptRequired'));
        return;
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
            chapterId: selectedChapter.value.id,
            endpoint: aiForm.value.endpoint,
            providerId: useSavedApiKey.value ? selectedProviderId.value : null,
            apiKeyId: useSavedApiKey.value ? (selectedApiKeyId.value || null) : null,
            apiKey: useSavedApiKey.value ? '' : aiForm.value.apiKey,
            model: aiForm.value.model,
            systemPrompt: promptForm.systemPrompt,
            prompt: promptForm.prompt,
            temperature: promptForm.temperature,
            maxTokens: promptForm.maxTokens,
            maxRewriteAttempts: promptForm.maxRewriteAttempts,
            saveToChapter: true
        });
        lastGenerationRecordId.value = result.generationRecordId ?? '';
        selectedChapter.value = await getChapter(selectedChapter.value.id);
        output.value = selectedChapter.value.content ?? '';
        chapters.value = chapters.value.map((item) => (item.id === selectedChapter.value.id ? selectedChapter.value : item));
        aiStore.saveToStorage();
        ElMessage.success(t('chapterGeneration.messages.draftGenerated'));
    }
    catch (err) {
        error.value = err.message || t('chapterGeneration.messages.generationFailed');
        ElMessage.error(error.value);
    }
    finally {
        generating.value = false;
        await chatHub.leaveRun(runId);
        currentRunId.value = '';
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
watch(selectedChapterId, loadSelectedChapter);
watch(selectedProviderId, refreshProviderAssets);
watch(selectedModelCode, (code) => {
    if (code)
        aiForm.value.model = code;
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
/** @type {__VLS_StyleScopedClasses['workspace-grid']} */ ;
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
        type: "primary",
        size: "small",
        icon: (__VLS_ctx.VideoPlay),
        loading: (__VLS_ctx.generating),
        disabled: (!__VLS_ctx.selectedChapter),
    }));
    const __VLS_110 = __VLS_109({
        ...{ 'onClick': {} },
        type: "primary",
        size: "small",
        icon: (__VLS_ctx.VideoPlay),
        loading: (__VLS_ctx.generating),
        disabled: (!__VLS_ctx.selectedChapter),
    }, ...__VLS_functionalComponentArgsRest(__VLS_109));
    let __VLS_112;
    let __VLS_113;
    let __VLS_114;
    const __VLS_115 = {
        onClick: (__VLS_ctx.generateDraft)
    };
    __VLS_111.slots.default;
    (__VLS_ctx.t('chapterGeneration.actions.generateDraft'));
    var __VLS_111;
}
const __VLS_116 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_117 = __VLS_asFunctionalComponent(__VLS_116, new __VLS_116({
    labelWidth: "110px",
    ...{ class: "ai-form" },
    disabled: (__VLS_ctx.generating),
}));
const __VLS_118 = __VLS_117({
    labelWidth: "110px",
    ...{ class: "ai-form" },
    disabled: (__VLS_ctx.generating),
}, ...__VLS_functionalComponentArgsRest(__VLS_117));
__VLS_119.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "ai-source-bar" },
});
const __VLS_120 = {}.ElSwitch;
/** @type {[typeof __VLS_components.ElSwitch, typeof __VLS_components.elSwitch, ]} */ ;
// @ts-ignore
const __VLS_121 = __VLS_asFunctionalComponent(__VLS_120, new __VLS_120({
    modelValue: (__VLS_ctx.useSavedApiKey),
    activeText: (__VLS_ctx.t('chapterGeneration.ai.savedKey')),
    inactiveText: (__VLS_ctx.t('chapterGeneration.ai.temporaryKey')),
}));
const __VLS_122 = __VLS_121({
    modelValue: (__VLS_ctx.useSavedApiKey),
    activeText: (__VLS_ctx.t('chapterGeneration.ai.savedKey')),
    inactiveText: (__VLS_ctx.t('chapterGeneration.ai.temporaryKey')),
}, ...__VLS_functionalComponentArgsRest(__VLS_121));
const __VLS_124 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({
    ...{ 'onClick': {} },
    size: "small",
    icon: (__VLS_ctx.Refresh),
    loading: (__VLS_ctx.loadingAiConfig),
}));
const __VLS_126 = __VLS_125({
    ...{ 'onClick': {} },
    size: "small",
    icon: (__VLS_ctx.Refresh),
    loading: (__VLS_ctx.loadingAiConfig),
}, ...__VLS_functionalComponentArgsRest(__VLS_125));
let __VLS_128;
let __VLS_129;
let __VLS_130;
const __VLS_131 = {
    onClick: (__VLS_ctx.refreshAiConfig)
};
__VLS_127.slots.default;
(__VLS_ctx.t('chapterGeneration.actions.refreshAiConfig'));
var __VLS_127;
if (__VLS_ctx.useSavedApiKey) {
    const __VLS_132 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_133 = __VLS_asFunctionalComponent(__VLS_132, new __VLS_132({
        label: (__VLS_ctx.t('chapterGeneration.ai.provider')),
    }));
    const __VLS_134 = __VLS_133({
        label: (__VLS_ctx.t('chapterGeneration.ai.provider')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_133));
    __VLS_135.slots.default;
    const __VLS_136 = {}.ElSelect;
    /** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
    // @ts-ignore
    const __VLS_137 = __VLS_asFunctionalComponent(__VLS_136, new __VLS_136({
        modelValue: (__VLS_ctx.selectedProviderId),
        placeholder: (__VLS_ctx.t('chapterGeneration.ai.selectProvider')),
        filterable: true,
    }));
    const __VLS_138 = __VLS_137({
        modelValue: (__VLS_ctx.selectedProviderId),
        placeholder: (__VLS_ctx.t('chapterGeneration.ai.selectProvider')),
        filterable: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_137));
    __VLS_139.slots.default;
    for (const [provider] of __VLS_getVForSourceType((__VLS_ctx.providers))) {
        const __VLS_140 = {}.ElOption;
        /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
        // @ts-ignore
        const __VLS_141 = __VLS_asFunctionalComponent(__VLS_140, new __VLS_140({
            key: (provider.id),
            label: (`${provider.name} (${provider.keyCount} keys)`),
            value: (provider.id),
        }));
        const __VLS_142 = __VLS_141({
            key: (provider.id),
            label: (`${provider.name} (${provider.keyCount} keys)`),
            value: (provider.id),
        }, ...__VLS_functionalComponentArgsRest(__VLS_141));
    }
    var __VLS_139;
    var __VLS_135;
    const __VLS_144 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_145 = __VLS_asFunctionalComponent(__VLS_144, new __VLS_144({
        label: (__VLS_ctx.t('chapterGeneration.ai.apiKey')),
    }));
    const __VLS_146 = __VLS_145({
        label: (__VLS_ctx.t('chapterGeneration.ai.apiKey')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_145));
    __VLS_147.slots.default;
    const __VLS_148 = {}.ElSelect;
    /** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
    // @ts-ignore
    const __VLS_149 = __VLS_asFunctionalComponent(__VLS_148, new __VLS_148({
        modelValue: (__VLS_ctx.selectedApiKeyId),
        placeholder: (__VLS_ctx.t('chapterGeneration.ai.optionalKey')),
        filterable: true,
        clearable: true,
    }));
    const __VLS_150 = __VLS_149({
        modelValue: (__VLS_ctx.selectedApiKeyId),
        placeholder: (__VLS_ctx.t('chapterGeneration.ai.optionalKey')),
        filterable: true,
        clearable: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_149));
    __VLS_151.slots.default;
    for (const [key] of __VLS_getVForSourceType((__VLS_ctx.apiKeys.filter((item) => item.isEnabled)))) {
        const __VLS_152 = {}.ElOption;
        /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
        // @ts-ignore
        const __VLS_153 = __VLS_asFunctionalComponent(__VLS_152, new __VLS_152({
            key: (key.id),
            label: (`${key.name}${key.maskedTail ? ` / ${key.maskedTail}` : ''}`),
            value: (key.id),
        }));
        const __VLS_154 = __VLS_153({
            key: (key.id),
            label: (`${key.name}${key.maskedTail ? ` / ${key.maskedTail}` : ''}`),
            value: (key.id),
        }, ...__VLS_functionalComponentArgsRest(__VLS_153));
    }
    var __VLS_151;
    var __VLS_147;
    const __VLS_156 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_157 = __VLS_asFunctionalComponent(__VLS_156, new __VLS_156({
        label: (__VLS_ctx.t('chapterGeneration.ai.model')),
    }));
    const __VLS_158 = __VLS_157({
        label: (__VLS_ctx.t('chapterGeneration.ai.model')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_157));
    __VLS_159.slots.default;
    const __VLS_160 = {}.ElSelect;
    /** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
    // @ts-ignore
    const __VLS_161 = __VLS_asFunctionalComponent(__VLS_160, new __VLS_160({
        modelValue: (__VLS_ctx.selectedModelCode),
        placeholder: (__VLS_ctx.t('chapterGeneration.ai.selectModel')),
        filterable: true,
        allowCreate: true,
    }));
    const __VLS_162 = __VLS_161({
        modelValue: (__VLS_ctx.selectedModelCode),
        placeholder: (__VLS_ctx.t('chapterGeneration.ai.selectModel')),
        filterable: true,
        allowCreate: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_161));
    __VLS_163.slots.default;
    for (const [model] of __VLS_getVForSourceType((__VLS_ctx.models.filter((item) => item.isEnabled)))) {
        const __VLS_164 = {}.ElOption;
        /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
        // @ts-ignore
        const __VLS_165 = __VLS_asFunctionalComponent(__VLS_164, new __VLS_164({
            key: (model.id),
            label: (`${model.name} (${model.code})`),
            value: (model.code),
        }));
        const __VLS_166 = __VLS_165({
            key: (model.id),
            label: (`${model.name} (${model.code})`),
            value: (model.code),
        }, ...__VLS_functionalComponentArgsRest(__VLS_165));
    }
    var __VLS_163;
    var __VLS_159;
}
else {
    const __VLS_168 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_169 = __VLS_asFunctionalComponent(__VLS_168, new __VLS_168({
        label: (__VLS_ctx.t('chapterGeneration.ai.apiKey')),
    }));
    const __VLS_170 = __VLS_169({
        label: (__VLS_ctx.t('chapterGeneration.ai.apiKey')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_169));
    __VLS_171.slots.default;
    const __VLS_172 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_173 = __VLS_asFunctionalComponent(__VLS_172, new __VLS_172({
        modelValue: (__VLS_ctx.aiForm.apiKey),
        type: "password",
        showPassword: true,
        placeholder: (__VLS_ctx.t('chapterGeneration.ai.apiKeyPlaceholder')),
    }));
    const __VLS_174 = __VLS_173({
        modelValue: (__VLS_ctx.aiForm.apiKey),
        type: "password",
        showPassword: true,
        placeholder: (__VLS_ctx.t('chapterGeneration.ai.apiKeyPlaceholder')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_173));
    var __VLS_171;
    const __VLS_176 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_177 = __VLS_asFunctionalComponent(__VLS_176, new __VLS_176({
        label: (__VLS_ctx.t('chapterGeneration.ai.model')),
    }));
    const __VLS_178 = __VLS_177({
        label: (__VLS_ctx.t('chapterGeneration.ai.model')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_177));
    __VLS_179.slots.default;
    const __VLS_180 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_181 = __VLS_asFunctionalComponent(__VLS_180, new __VLS_180({
        modelValue: (__VLS_ctx.aiForm.model),
        placeholder: (__VLS_ctx.t('chapterGeneration.ai.modelPlaceholder')),
    }));
    const __VLS_182 = __VLS_181({
        modelValue: (__VLS_ctx.aiForm.model),
        placeholder: (__VLS_ctx.t('chapterGeneration.ai.modelPlaceholder')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_181));
    var __VLS_179;
}
const __VLS_184 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_185 = __VLS_asFunctionalComponent(__VLS_184, new __VLS_184({
    label: (__VLS_ctx.t('chapterGeneration.ai.endpoint')),
}));
const __VLS_186 = __VLS_185({
    label: (__VLS_ctx.t('chapterGeneration.ai.endpoint')),
}, ...__VLS_functionalComponentArgsRest(__VLS_185));
__VLS_187.slots.default;
const __VLS_188 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_189 = __VLS_asFunctionalComponent(__VLS_188, new __VLS_188({
    modelValue: (__VLS_ctx.aiForm.endpoint),
    placeholder: (__VLS_ctx.t('chapterGeneration.ai.endpointPlaceholder')),
}));
const __VLS_190 = __VLS_189({
    modelValue: (__VLS_ctx.aiForm.endpoint),
    placeholder: (__VLS_ctx.t('chapterGeneration.ai.endpointPlaceholder')),
}, ...__VLS_functionalComponentArgsRest(__VLS_189));
var __VLS_187;
const __VLS_192 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_193 = __VLS_asFunctionalComponent(__VLS_192, new __VLS_192({
    label: (__VLS_ctx.t('chapterGeneration.ai.systemPrompt')),
}));
const __VLS_194 = __VLS_193({
    label: (__VLS_ctx.t('chapterGeneration.ai.systemPrompt')),
}, ...__VLS_functionalComponentArgsRest(__VLS_193));
__VLS_195.slots.default;
const __VLS_196 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_197 = __VLS_asFunctionalComponent(__VLS_196, new __VLS_196({
    modelValue: (__VLS_ctx.promptForm.systemPrompt),
    type: "textarea",
    rows: (2),
}));
const __VLS_198 = __VLS_197({
    modelValue: (__VLS_ctx.promptForm.systemPrompt),
    type: "textarea",
    rows: (2),
}, ...__VLS_functionalComponentArgsRest(__VLS_197));
var __VLS_195;
const __VLS_200 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_201 = __VLS_asFunctionalComponent(__VLS_200, new __VLS_200({
    label: (__VLS_ctx.t('chapterGeneration.ai.prompt')),
}));
const __VLS_202 = __VLS_201({
    label: (__VLS_ctx.t('chapterGeneration.ai.prompt')),
}, ...__VLS_functionalComponentArgsRest(__VLS_201));
__VLS_203.slots.default;
const __VLS_204 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_205 = __VLS_asFunctionalComponent(__VLS_204, new __VLS_204({
    modelValue: (__VLS_ctx.promptForm.prompt),
    type: "textarea",
    rows: (5),
}));
const __VLS_206 = __VLS_205({
    modelValue: (__VLS_ctx.promptForm.prompt),
    type: "textarea",
    rows: (5),
}, ...__VLS_functionalComponentArgsRest(__VLS_205));
var __VLS_203;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "inline-controls" },
});
const __VLS_208 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_209 = __VLS_asFunctionalComponent(__VLS_208, new __VLS_208({
    label: (__VLS_ctx.t('chapterGeneration.ai.temperature')),
}));
const __VLS_210 = __VLS_209({
    label: (__VLS_ctx.t('chapterGeneration.ai.temperature')),
}, ...__VLS_functionalComponentArgsRest(__VLS_209));
__VLS_211.slots.default;
const __VLS_212 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_213 = __VLS_asFunctionalComponent(__VLS_212, new __VLS_212({
    modelValue: (__VLS_ctx.promptForm.temperature),
    min: (0),
    max: (2),
    step: (0.1),
}));
const __VLS_214 = __VLS_213({
    modelValue: (__VLS_ctx.promptForm.temperature),
    min: (0),
    max: (2),
    step: (0.1),
}, ...__VLS_functionalComponentArgsRest(__VLS_213));
var __VLS_211;
const __VLS_216 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_217 = __VLS_asFunctionalComponent(__VLS_216, new __VLS_216({
    label: (__VLS_ctx.t('chapterGeneration.ai.maxTokens')),
}));
const __VLS_218 = __VLS_217({
    label: (__VLS_ctx.t('chapterGeneration.ai.maxTokens')),
}, ...__VLS_functionalComponentArgsRest(__VLS_217));
__VLS_219.slots.default;
const __VLS_220 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_221 = __VLS_asFunctionalComponent(__VLS_220, new __VLS_220({
    modelValue: (__VLS_ctx.promptForm.maxTokens),
    min: (256),
    max: (12000),
    step: (256),
}));
const __VLS_222 = __VLS_221({
    modelValue: (__VLS_ctx.promptForm.maxTokens),
    min: (256),
    max: (12000),
    step: (256),
}, ...__VLS_functionalComponentArgsRest(__VLS_221));
var __VLS_219;
const __VLS_224 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_225 = __VLS_asFunctionalComponent(__VLS_224, new __VLS_224({
    label: (__VLS_ctx.t('chapterGeneration.ai.maxRewrites')),
}));
const __VLS_226 = __VLS_225({
    label: (__VLS_ctx.t('chapterGeneration.ai.maxRewrites')),
}, ...__VLS_functionalComponentArgsRest(__VLS_225));
__VLS_227.slots.default;
const __VLS_228 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_229 = __VLS_asFunctionalComponent(__VLS_228, new __VLS_228({
    modelValue: (__VLS_ctx.promptForm.maxRewriteAttempts),
    min: (0),
    max: (3),
    step: (1),
}));
const __VLS_230 = __VLS_229({
    modelValue: (__VLS_ctx.promptForm.maxRewriteAttempts),
    min: (0),
    max: (3),
    step: (1),
}, ...__VLS_functionalComponentArgsRest(__VLS_229));
var __VLS_227;
var __VLS_119;
if (__VLS_ctx.error) {
    const __VLS_232 = {}.ElAlert;
    /** @type {[typeof __VLS_components.ElAlert, typeof __VLS_components.elAlert, ]} */ ;
    // @ts-ignore
    const __VLS_233 = __VLS_asFunctionalComponent(__VLS_232, new __VLS_232({
        title: (__VLS_ctx.error),
        type: "error",
        showIcon: true,
        closable: (false),
    }));
    const __VLS_234 = __VLS_233({
        title: (__VLS_ctx.error),
        type: "error",
        showIcon: true,
        closable: (false),
    }, ...__VLS_functionalComponentArgsRest(__VLS_233));
}
const __VLS_236 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_237 = __VLS_asFunctionalComponent(__VLS_236, new __VLS_236({
    modelValue: (__VLS_ctx.output),
    type: "textarea",
    rows: (18),
    ...{ class: "draft-output" },
    placeholder: (__VLS_ctx.t('chapterGeneration.ai.outputPlaceholder')),
}));
const __VLS_238 = __VLS_237({
    modelValue: (__VLS_ctx.output),
    type: "textarea",
    rows: (18),
    ...{ class: "draft-output" },
    placeholder: (__VLS_ctx.t('chapterGeneration.ai.outputPlaceholder')),
}, ...__VLS_functionalComponentArgsRest(__VLS_237));
var __VLS_91;
/** @type {__VLS_StyleScopedClasses['chapter-generation']} */ ;
/** @type {__VLS_StyleScopedClasses['workspace-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['chapter-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-head']} */ ;
/** @type {__VLS_StyleScopedClasses['create-form']} */ ;
/** @type {__VLS_StyleScopedClasses['generator-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-head']} */ ;
/** @type {__VLS_StyleScopedClasses['head-actions']} */ ;
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
            providers: providers,
            models: models,
            apiKeys: apiKeys,
            selectedProviderId: selectedProviderId,
            selectedModelCode: selectedModelCode,
            selectedApiKeyId: selectedApiKeyId,
            useSavedApiKey: useSavedApiKey,
            chapterForm: chapterForm,
            promptForm: promptForm,
            refreshChapters: refreshChapters,
            quickCreateChapter: quickCreateChapter,
            removeChapter: removeChapter,
            refreshAiConfig: refreshAiConfig,
            generateDraft: generateDraft,
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
