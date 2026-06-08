import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Delete, Edit, FolderAdd, MagicStick, Plus, Refresh, Search } from '@element-plus/icons-vue';
import { useI18n } from '@/composables/useI18n';
import { useWorkContextStore } from '@/stores/workContext';
import { DESIGN_MODULES, bookAnalysesApi, chapterBlueprintsApi, chapterPlansApi, characterRulesApi, creativeMaterialsApi, factionRulesApi, locationRulesApi, outlinesApi, plotRulesApi, volumeDesignsApi, worldRulesApi } from '@/api/modules/design';
import { listProviderConfigs } from '@/api/modules/ai';
import { createCategory, deleteCategory, getCategoryTree, reorderCategories, updateCategory } from '@/api/modules/categories';
import { createSourceBook, listSourceBooks } from '@/api/modules/sourceBooks';
import DesignFormField from '@/components/design/DesignFormField.vue';
import { MODULE_SCHEMAS, buildEmptyForm } from '@/components/design/moduleSchemas';
const route = useRoute();
const router = useRouter();
const workContext = useWorkContextStore();
const { t } = useI18n();
const moduleKey = computed(() => {
    const raw = route.params.module;
    return (DESIGN_MODULES.find((item) => item.key === raw)?.key ?? 'world_rules');
});
const moduleMeta = computed(() => DESIGN_MODULES.find((item) => item.key === moduleKey.value));
const schema = computed(() => MODULE_SCHEMAS[moduleKey.value]);
const localizedModuleLabel = computed(() => t(`design.modules.${moduleKey.value}`));
const canRegenerateFromNovelSeed = computed(() => moduleKey.value === 'chapter_plans' || moduleKey.value === 'chapter_blueprints');
const apiMap = {
    world_rules: worldRulesApi,
    character_rules: characterRulesApi,
    faction_rules: factionRulesApi,
    location_rules: locationRulesApi,
    plot_rules: plotRulesApi,
    creative_materials: creativeMaterialsApi,
    book_analyses: bookAnalysesApi,
    outlines: outlinesApi,
    volume_designs: volumeDesignsApi,
    chapter_plans: chapterPlansApi,
    chapter_blueprints: chapterBlueprintsApi
};
const activeApi = computed(() => apiMap[moduleKey.value]);
const pickerRows = ref({
    characters: [],
    factions: [],
    locations: [],
    volumes: []
});
function getPickerValue(row, field) {
    switch (field.pickerValue) {
        case 'id':
            return String(row.id ?? '');
        case 'volumeNumber':
            return Number(row.volumeNumber ?? 0);
        case 'title':
            return String(row.title ?? row.volumeTitle ?? row.name ?? '');
        case 'name':
        default:
            return String(row.name ?? row.title ?? '');
    }
}
function getPickerLabel(row, source) {
    if (source === 'volumes') {
        return t('layout.volumeOption', { number: row.volumeNumber ?? '', title: row.title ?? '' });
    }
    return String(row.name ?? row.title ?? row.id ?? '');
}
async function refreshPickers() {
    const scopedSourceBookId = moduleMeta.value.hasSourceBookScope ? selectedSourceBookId.value || null : null;
    const projectId = workContext.selectedProjectId || null;
    const [characters, factions, locations] = await Promise.all([
        characterRulesApi.list({ sourceBookId: scopedSourceBookId, projectId, isEnabled: true }),
        factionRulesApi.list({ sourceBookId: scopedSourceBookId, projectId, isEnabled: true }),
        locationRulesApi.list({ sourceBookId: scopedSourceBookId, projectId, isEnabled: true })
    ]);
    pickerRows.value = {
        characters,
        factions,
        locations,
        volumes: workContext.volumes
    };
}
function optionsFor(field) {
    if (!field.pickerSource)
        return [];
    return pickerRows.value[field.pickerSource]
        .map((row) => ({
        label: getPickerLabel(row, field.pickerSource),
        value: getPickerValue(row, field)
    }))
        .filter((item) => item.value !== '');
}
function hasPickerOption(options, value) {
    return options.some((option) => option.value === value);
}
function invalidReferenceMessage(field, currentValue) {
    if (!field.pickerSource || currentValue === null || currentValue === undefined || currentValue === '')
        return '';
    const options = optionsFor(field);
    if (Array.isArray(currentValue)) {
        const missing = currentValue.filter((value) => !hasPickerOption(options, value));
        return missing.length ? t('design.messages.missingReferences', { value: missing.join(', ') }) : '';
    }
    return hasPickerOption(options, currentValue)
        ? ''
        : t('design.messages.currentValueMissing', { value: String(currentValue) });
}
function clearInvalidReferences(field) {
    if (!field.pickerSource)
        return;
    const currentValue = editorForm.value[field.key];
    const options = optionsFor(field);
    if (Array.isArray(currentValue)) {
        const validValues = currentValue.filter((value) => hasPickerOption(options, value));
        const removedCount = currentValue.length - validValues.length;
        editorForm.value[field.key] = validValues;
        if (removedCount > 0)
            ElMessage.success(t('design.messages.removedInvalidReferences', { count: removedCount }));
        return;
    }
    if (currentValue !== null && currentValue !== undefined && currentValue !== '' && !hasPickerOption(options, currentValue)) {
        editorForm.value[field.key] = field.type === 'select' ? null : '';
        ElMessage.success(t('design.messages.invalidReferenceCleared'));
    }
}
async function rematchReferences(field) {
    if (!field.pickerSource)
        return;
    try {
        await refreshPickers();
        const message = invalidReferenceMessage(field, editorForm.value[field.key]);
        if (message) {
            ElMessage.warning(t('design.messages.referencesStillInvalid'));
        }
        else {
            ElMessage.success(t('design.messages.referencesRefreshed'));
        }
    }
    catch (err) {
        ElMessage.error(err.message ?? t('design.messages.refreshReferencesFailed'));
    }
}
const sourceBooks = ref([]);
const selectedSourceBookId = ref('');
const newSourceBookVisible = ref(false);
const newSourceBookName = ref('');
async function refreshSourceBooks() {
    try {
        sourceBooks.value = await listSourceBooks();
        if (!selectedSourceBookId.value && workContext.selectedProject?.currentSourceBookId) {
            selectedSourceBookId.value = workContext.selectedProject.currentSourceBookId;
        }
    }
    catch (err) {
        ElMessage.error(err.message ?? t('design.messages.loadSourceBooksFailed'));
    }
}
async function quickCreateSourceBook() {
    if (!newSourceBookName.value.trim()) {
        ElMessage.warning(t('design.messages.sourceBookNameRequired'));
        return;
    }
    try {
        const sourceBook = await createSourceBook({ name: newSourceBookName.value.trim() });
        sourceBooks.value = [sourceBook, ...sourceBooks.value];
        selectedSourceBookId.value = sourceBook.id;
        newSourceBookVisible.value = false;
        newSourceBookName.value = '';
        ElMessage.success(t('design.messages.sourceBookCreated'));
    }
    catch (err) {
        ElMessage.error(err.message ?? t('design.messages.createSourceBookFailed'));
    }
}
async function bindSourceBookToProject() {
    if (!workContext.selectedProjectId) {
        ElMessage.warning(t('design.messages.selectProjectFirst'));
        return;
    }
    try {
        await workContext.updateSelectedProjectSourceBook(selectedSourceBookId.value || null);
        ElMessage.success(t('design.messages.bindSourceBookSuccess'));
    }
    catch (err) {
        ElMessage.error(err.message ?? t('design.messages.bindSourceBookFailed'));
    }
}
function goNovelSeedRegenerate() {
    router.push('/generate/novel-seed');
}
async function rewriteChapterPlanSummaries() {
    try {
        await ElMessageBox.confirm('将按当前项目、源书、分类和筛选条件批量重写章节计划标题与简介，并自动处理重复标题/同质简介。是否继续？', t('layout.dialogs.confirm'), { type: 'warning' });
    }
    catch {
        return;
    }
    rewritingChapterPlanSummaries.value = true;
    try {
        const result = await chapterPlansApi.rewriteSummaries(buildListParams());
        ElMessage.success(`已重写 ${result.updatedCount} 条章节计划标题/简介`);
        await refreshItems();
    }
    catch (err) {
        ElMessage.error(err.message ?? '批量重写章节计划标题/简介失败');
    }
    finally {
        rewritingChapterPlanSummaries.value = false;
    }
}
const categoryTree = ref([]);
const loadingCategories = ref(false);
const selectedCategoryId = ref(null);
async function refreshCategories() {
    loadingCategories.value = true;
    try {
        categoryTree.value = await getCategoryTree(moduleKey.value, moduleMeta.value.hasSourceBookScope ? selectedSourceBookId.value || null : null, workContext.selectedProjectId || null);
    }
    catch (err) {
        ElMessage.error(err.message ?? t('design.messages.loadCategoriesFailed'));
    }
    finally {
        loadingCategories.value = false;
    }
}
const categoryDialogVisible = ref(false);
const categoryDialogMode = ref('create');
const categoryEditId = ref('');
const categoryForm = ref({
    moduleType: '',
    name: '',
    parentId: null,
    sortOrder: 0,
    isEnabled: true,
    sourceBookId: null,
    projectId: null
});
function flattenCategories(nodes, depth = 0) {
    return nodes.flatMap((node) => [
        { label: `${'  '.repeat(depth)}${node.name}`, value: node.id },
        ...flattenCategories(node.children ?? [], depth + 1)
    ]);
}
const categoryParentOptions = computed(() => flattenCategories(categoryTree.value).filter((option) => option.value !== categoryEditId.value));
function openCreateCategory(parent) {
    categoryDialogMode.value = 'create';
    categoryEditId.value = '';
    categoryForm.value = {
        moduleType: moduleKey.value,
        name: '',
        parentId: parent?.id ?? null,
        sortOrder: 0,
        isEnabled: true,
        sourceBookId: moduleMeta.value.hasSourceBookScope ? selectedSourceBookId.value || null : null,
        projectId: workContext.selectedProjectId || null
    };
    categoryDialogVisible.value = true;
}
function openEditCategory(node) {
    categoryDialogMode.value = 'edit';
    categoryEditId.value = node.id;
    categoryForm.value = {
        moduleType: node.moduleType,
        name: node.name,
        parentId: node.parentId,
        sortOrder: node.sortOrder,
        isEnabled: node.isEnabled,
        sourceBookId: node.sourceBookId,
        projectId: workContext.selectedProjectId || null
    };
    categoryDialogVisible.value = true;
}
async function saveCategory() {
    try {
        if (categoryDialogMode.value === 'create') {
            await createCategory(categoryForm.value);
            ElMessage.success(t('design.messages.categoryCreated'));
        }
        else {
            await updateCategory(categoryEditId.value, categoryForm.value);
            ElMessage.success(t('design.messages.categoryUpdated'));
        }
        categoryDialogVisible.value = false;
        await refreshCategories();
    }
    catch (err) {
        ElMessage.error(err.message ?? t('design.messages.saveCategoryFailed'));
    }
}
async function removeCategory(node) {
    if (node.isBuiltIn) {
        ElMessage.warning(t('design.messages.builtInCategoriesCannotDelete'));
        return;
    }
    try {
        await ElMessageBox.confirm(t('design.messages.deleteCategoryConfirm', { name: node.name }), t('layout.dialogs.confirm'), { type: 'warning' });
    }
    catch {
        return;
    }
    try {
        await deleteCategory(node.id);
        if (selectedCategoryId.value === node.id)
            selectedCategoryId.value = null;
        ElMessage.success(t('design.messages.categoryDeleted'));
        await refreshCategories();
    }
    catch (err) {
        ElMessage.error(err.message ?? t('design.messages.deleteCategoryFailed'));
    }
}
function flattenCategoryOrder(nodes, parentId = null) {
    return nodes.flatMap((node, index) => [
        { id: node.id, parentId, sortOrder: index * 10 },
        ...flattenCategoryOrder(node.children ?? [], node.id)
    ]);
}
async function saveCategoryOrder() {
    try {
        await reorderCategories({
            moduleType: moduleKey.value,
            sourceBookId: moduleMeta.value.hasSourceBookScope ? selectedSourceBookId.value || null : null,
            projectId: workContext.selectedProjectId || null,
            items: flattenCategoryOrder(categoryTree.value)
        });
        await refreshCategories();
    }
    catch (err) {
        ElMessage.error(err.message ?? t('design.messages.saveCategoryOrderFailed'));
        await refreshCategories();
    }
}
const items = ref([]);
const loadingItems = ref(false);
const backgroundAnalyzingId = ref('');
const generatingCreativeMaterialId = ref('');
const buildingSkeletonId = ref('');
const rewritingChapterPlanSummaries = ref(false);
const keyword = ref('');
const isEnabledFilter = ref('all');
const includeUncategorized = ref(false);
const updatedRange = ref([]);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
let backgroundAiPollTimer = null;
function buildListParams() {
    return {
        categoryId: includeUncategorized.value ? null : selectedCategoryId.value,
        sourceBookId: moduleMeta.value.hasSourceBookScope ? selectedSourceBookId.value || null : null,
        keyword: keyword.value || null,
        isEnabled: isEnabledFilter.value === 'all' ? null : isEnabledFilter.value === 'enabled',
        updatedFrom: updatedRange.value[0] ?? null,
        updatedTo: updatedRange.value[1] ?? null,
        includeUncategorized: includeUncategorized.value,
        projectId: workContext.selectedProjectId || null,
        page: page.value,
        pageSize: pageSize.value
    };
}
async function refreshItems() {
    loadingItems.value = true;
    try {
        const result = await activeApi.value.listPaged(buildListParams());
        items.value = result.items;
        total.value = result.total;
        page.value = result.page;
        pageSize.value = result.pageSize;
    }
    catch (err) {
        ElMessage.error(err.message ?? t('design.messages.loadRecordsFailed'));
    }
    finally {
        loadingItems.value = false;
    }
}
function stopBackgroundAiPolling() {
    if (backgroundAiPollTimer !== null) {
        window.clearInterval(backgroundAiPollTimer);
        backgroundAiPollTimer = null;
    }
}
function startBackgroundAiPolling() {
    if (backgroundAiPollTimer !== null || moduleKey.value !== 'book_analyses') {
        return;
    }
    backgroundAiPollTimer = window.setInterval(() => {
        const hasBusyItem = items.value.some((row) => row.backgroundAiStatus === 'queued' || row.backgroundAiStatus === 'running');
        if (!hasBusyItem) {
            stopBackgroundAiPolling();
            return;
        }
        void refreshItems();
    }, 15000);
}
async function refreshWorkspaceData() {
    await Promise.all([
        refreshCategories(),
        refreshItems(),
        refreshPickers()
    ]);
}
const editorVisible = ref(false);
const editorMode = ref('create');
const editorId = ref('');
const editorForm = ref({});
const editorTab = ref('');
const saving = ref(false);
function openCreate() {
    editorMode.value = 'create';
    editorId.value = '';
    editorForm.value = buildEmptyForm(moduleKey.value);
    editorForm.value.categoryId = selectedCategoryId.value;
    editorForm.value.sourceBookId = moduleMeta.value.hasSourceBookScope ? selectedSourceBookId.value || null : null;
    editorForm.value.projectId = workContext.selectedProjectId || null;
    editorTab.value = schema.value.tabs[0]?.key ?? '';
    editorVisible.value = true;
}
async function openEdit(row) {
    editorMode.value = 'edit';
    editorId.value = String(row.id);
    try {
        const detail = await activeApi.value.get(String(row.id));
        editorForm.value = { ...buildEmptyForm(moduleKey.value), ...detail };
        editorForm.value.projectId = workContext.selectedProjectId || null;
        editorTab.value = schema.value.tabs[0]?.key ?? '';
        editorVisible.value = true;
    }
    catch (err) {
        ElMessage.error(err.message ?? t('design.messages.loadRecordDetailFailed'));
    }
}
async function saveEditor() {
    if (!editorForm.value.name) {
        ElMessage.warning(t('design.messages.nameRequired'));
        return;
    }
    saving.value = true;
    try {
        if (editorMode.value === 'create') {
            await activeApi.value.create(editorForm.value);
            ElMessage.success(t('design.messages.recordCreated'));
        }
        else {
            await activeApi.value.update(editorId.value, editorForm.value);
            ElMessage.success(t('design.messages.recordUpdated'));
        }
        editorVisible.value = false;
        await refreshItems();
        await refreshCategories();
        await refreshPickers();
    }
    catch (err) {
        ElMessage.error(err.message ?? t('design.messages.saveRecordFailed'));
    }
    finally {
        saving.value = false;
    }
}
async function removeItem(row) {
    try {
        await ElMessageBox.confirm(t('design.messages.deleteRecordConfirm', { name: row.name }), t('layout.dialogs.confirm'), { type: 'warning' });
    }
    catch {
        return;
    }
    try {
        await activeApi.value.remove(String(row.id));
        ElMessage.success(t('design.messages.recordDeleted'));
        await refreshItems();
        await refreshCategories();
        await refreshPickers();
    }
    catch (err) {
        ElMessage.error(err.message ?? t('design.messages.deleteRecordFailed'));
    }
}
function isBackgroundAiBusy(row) {
    return backgroundAnalyzingId.value === String(row.id) || row.backgroundAiStatus === 'queued' || row.backgroundAiStatus === 'running';
}
function getBackgroundAiStatusTagType(status) {
    switch (status) {
        case 'completed':
            return 'success';
        case 'failed':
            return 'danger';
        case 'queued':
            return 'warning';
        case 'running':
            return '';
        default:
            return 'info';
    }
}
function getBackgroundAiStatusLabel(status) {
    switch (status) {
        case 'queued':
            return t('design.labels.aiQueued');
        case 'running':
            return t('design.labels.aiRunning');
        case 'completed':
            return t('design.labels.aiCompleted');
        case 'failed':
            return t('design.labels.aiFailed');
        default:
            return t('design.labels.aiIdle');
    }
}
function getBackgroundAiFailureReason(row) {
    if (row?.backgroundAiStatus !== 'failed')
        return '';
    const message = String(row?.backgroundAiMessage ?? '').trim();
    if (!message)
        return t('design.labels.aiFailureUnknown');
    return message;
}
async function queueBookAnalysisBackgroundAi(row) {
    if (moduleKey.value !== 'book_analyses')
        return;
    if (isBackgroundAiBusy(row)) {
        ElMessage.warning(t('design.messages.backgroundAiAlreadyRunning'));
        return;
    }
    if (!bookAnalysisAiConfigId.value || !bookAnalysisAiEndpoint.value || !bookAnalysisAiModel.value) {
        ElMessage.warning(t('design.messages.aiConfigRequired'));
        return;
    }
    backgroundAnalyzingId.value = String(row.id);
    try {
        await bookAnalysesApi.queueAiAnalyze(String(row.id), {
            providerId: bookAnalysisAiConfigId.value,
            apiKeyId: null,
            endpoint: bookAnalysisAiEndpoint.value,
            model: bookAnalysisAiModel.value,
            maxTokens: 3600
        });
        ElMessage.success(t('design.messages.backgroundAiQueued'));
        await refreshItems();
    }
    catch (err) {
        ElMessage.error(err.message ?? t('design.messages.backgroundAiQueueFailed'));
    }
    finally {
        backgroundAnalyzingId.value = '';
    }
}
async function createCreativeMaterialFromBookAnalysis(row) {
    if (moduleKey.value !== 'book_analyses')
        return;
    generatingCreativeMaterialId.value = String(row.id);
    try {
        const created = await creativeMaterialsApi.createFromBookAnalysis(String(row.id));
        ElMessage.success(t('design.messages.creativeMaterialCreatedFromBookAnalysis', { name: created.name }));
        await router.push({
            path: '/design/creative_materials',
            query: created.sourceBookId ? { sourceBookId: created.sourceBookId } : {}
        });
    }
    catch (err) {
        ElMessage.error(err.message ?? t('design.messages.createCreativeMaterialFromBookAnalysisFailed'));
    }
    finally {
        generatingCreativeMaterialId.value = '';
    }
}
async function buildSkeletonFromCreativeMaterial(row) {
    if (moduleKey.value !== 'creative_materials')
        return;
    buildingSkeletonId.value = String(row.id);
    try {
        const result = await creativeMaterialsApi.buildSkeleton(String(row.id));
        ElMessage.success(t('design.messages.skeletonBuilt', {
            rules: result.ruleCount,
            outlines: result.outlineCount,
            volumes: result.volumeDesignCount,
            chapters: result.chapterPlanCount,
            blueprints: result.chapterBlueprintCount
        }));
        await router.push({
            path: '/generate/outlines',
            query: result.sourceBookId ? { sourceBookId: result.sourceBookId } : {}
        });
    }
    catch (err) {
        ElMessage.error(err.message ?? t('design.messages.skeletonBuildFailed'));
    }
    finally {
        buildingSkeletonId.value = '';
    }
}
function syncSourceBookSelectionFromRoute() {
    if (!moduleMeta.value.hasSourceBookScope)
        return;
    const routeSourceBookId = route.query.sourceBookId;
    if (typeof routeSourceBookId === 'string') {
        selectedSourceBookId.value = routeSourceBookId;
    }
}
function formatCellValue(row, col) {
    const value = row[col.key];
    if (value === null || value === undefined)
        return '--';
    if (Array.isArray(value))
        return value.join(', ');
    if (typeof value === 'object')
        return JSON.stringify(value);
    const text = String(value);
    return text.length > 60 ? `${text.slice(0, 60)}...` : text;
}
const bookAnalysisImportVisible = ref(false);
const importingBookAnalysis = ref(false);
const bookAnalysisImportUrl = ref('');
const bookAnalysisImportPreview = ref(null);
const bookAnalysisImportFileInput = ref(null);
const analyzingBookAnalysis = ref(false);
const bookAnalysisAiConfigs = ref([]);
const bookAnalysisAiConfigId = ref('');
const bookAnalysisAiModel = ref('');
const bookAnalysisAiEndpoint = ref('');
const selectedBookAnalysisAiConfig = computed(() => bookAnalysisAiConfigs.value.find((item) => item.providerId === bookAnalysisAiConfigId.value) ?? null);
function openBookAnalysisImport() {
    bookAnalysisImportUrl.value = '';
    bookAnalysisImportPreview.value = null;
    bookAnalysisImportVisible.value = true;
}
async function previewBookAnalysisImport() {
    if (!bookAnalysisImportUrl.value.trim()) {
        ElMessage.warning(t('design.messages.sourceUrlRequired'));
        return;
    }
    importingBookAnalysis.value = true;
    try {
        bookAnalysisImportPreview.value = await bookAnalysesApi.crawlPreview({
            url: bookAnalysisImportUrl.value.trim(),
            maxChapters: 12,
            includeContent: true
        });
        ElMessage.success(t('design.messages.previewLoaded'));
    }
    catch (err) {
        ElMessage.error(err.message ?? t('design.messages.crawlPreviewFailed'));
    }
    finally {
        importingBookAnalysis.value = false;
    }
}
function openBookAnalysisTxtPicker() {
    bookAnalysisImportFileInput.value?.click();
}
async function importBookAnalysisTxt(event) {
    const input = event.target;
    const file = input.files?.[0];
    input.value = '';
    if (!file)
        return;
    importingBookAnalysis.value = true;
    try {
        const text = await readTextFile(file);
        bookAnalysisImportPreview.value = buildBookAnalysisPreviewFromText(file, text);
        ElMessage.success(t('design.messages.txtImportLoaded'));
    }
    catch (err) {
        ElMessage.error(err.message ?? t('design.messages.txtImportFailed'));
    }
    finally {
        importingBookAnalysis.value = false;
    }
}
async function readTextFile(file) {
    const buffer = await file.arrayBuffer();
    try {
        return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    }
    catch {
        try {
            return new TextDecoder('gb18030').decode(buffer);
        }
        catch {
            return file.text();
        }
    }
}
function buildBookAnalysisPreviewFromText(file, text) {
    const title = file.name.replace(/\.[^.]+$/, '') || t('design.labels.localTxtBook');
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    const chapters = splitTxtChapters(normalized);
    const sampleChapters = chapters.slice(0, 12).map((chapter, index) => ({
        index: index + 1,
        title: chapter.title,
        url: `local://${file.name}#${index + 1}`,
        summary: chapter.content.slice(0, 240),
        wordCount: countTextWords(chapter.content),
        content: chapter.content
    }));
    const totalWordCount = countTextWords(normalized);
    const summary = normalized.slice(0, 900);
    const importedAt = new Date().toISOString();
    return {
        sourceUrl: `local://${file.name}`,
        sourceSite: t('design.labels.localTxtFile'),
        suggestedName: title,
        title,
        author: '',
        genre: '',
        keywords: '',
        chapterCount: chapters.length,
        totalWordCount,
        crawledAt: importedAt,
        summary,
        worldBuildingMethod: t('design.labels.txtAnalysisPlaceholder'),
        powerSystemDesign: '',
        environmentDescription: '',
        factionDesign: '',
        worldviewHighlights: '',
        protagonistDesign: '',
        supportingRoles: '',
        characterRelations: '',
        goldenFingerDesign: '',
        characterHighlights: '',
        plotStructure: chapters.slice(0, 20).map((chapter) => chapter.title).join('\n'),
        conflictDesign: '',
        climaxArrangement: '',
        foreshadowingTechnique: '',
        plotHighlights: '',
        chapters: sampleChapters
    };
}
function splitTxtChapters(text) {
    const chapterTitlePattern = /^(?:\s*)(第[零〇一二三四五六七八九十百千万两\d]+[章节卷集回][^\n]{0,80}|Chapter\s+\d+[^\n]{0,80}|\d+[\.、]\s*[^\n]{1,80})\s*$/i;
    const lines = text.split('\n');
    const chapters = [];
    let currentTitle = t('design.labels.fullText');
    let currentLines = [];
    for (const line of lines) {
        if (chapterTitlePattern.test(line.trim())) {
            if (currentLines.join('').trim()) {
                chapters.push({ title: currentTitle, content: currentLines.join('\n').trim() });
            }
            currentTitle = line.trim();
            currentLines = [];
            continue;
        }
        currentLines.push(line);
    }
    if (currentLines.join('').trim()) {
        chapters.push({ title: currentTitle, content: currentLines.join('\n').trim() });
    }
    return chapters.length > 0 ? chapters : [{ title: currentTitle, content: text }];
}
function countTextWords(text) {
    return text.replace(/\s+/g, '').length;
}
async function refreshBookAnalysisAiConfig() {
    bookAnalysisAiConfigs.value = (await listProviderConfigs()).filter((item) => item.isEnabled);
    if (!bookAnalysisAiConfigs.value.some((item) => item.providerId === bookAnalysisAiConfigId.value)) {
        bookAnalysisAiConfigId.value = bookAnalysisAiConfigs.value[0]?.providerId ?? '';
    }
    refreshBookAnalysisAiProviderAssets();
}
function refreshBookAnalysisAiProviderAssets() {
    if (!bookAnalysisAiConfigId.value) {
        bookAnalysisAiEndpoint.value = '';
        bookAnalysisAiModel.value = '';
        return;
    }
    const config = selectedBookAnalysisAiConfig.value;
    bookAnalysisAiEndpoint.value = config?.defaultEndpoint || '';
    bookAnalysisAiModel.value = config?.modelCode || '';
}
function compactBookAnalysisPreviewForAi(preview) {
    return {
        ...preview,
        summary: preview.summary?.slice(0, 3000) ?? '',
        chapters: preview.chapters.slice(0, 12).map((chapter) => ({
            ...chapter,
            summary: chapter.summary?.slice(0, 1000) ?? '',
            content: chapter.content?.slice(0, 2500) ?? ''
        }))
    };
}
async function analyzeBookAnalysisWithAi() {
    if (!bookAnalysisImportPreview.value) {
        ElMessage.warning(t('design.messages.previewRequiredForAi'));
        return;
    }
    if (!bookAnalysisAiConfigId.value || !bookAnalysisAiEndpoint.value || !bookAnalysisAiModel.value) {
        ElMessage.warning(t('design.messages.aiConfigRequired'));
        return;
    }
    analyzingBookAnalysis.value = true;
    try {
        bookAnalysisImportPreview.value = await bookAnalysesApi.aiAnalyze({
            providerId: bookAnalysisAiConfigId.value,
            apiKeyId: null,
            endpoint: bookAnalysisAiEndpoint.value,
            model: bookAnalysisAiModel.value,
            preview: compactBookAnalysisPreviewForAi(bookAnalysisImportPreview.value),
            maxTokens: 3600
        });
        ElMessage.success(t('design.messages.aiAnalysisCompleted'));
    }
    catch (err) {
        ElMessage.error(err.message ?? t('design.messages.aiAnalysisFailed'));
    }
    finally {
        analyzingBookAnalysis.value = false;
    }
}
function toBookAnalysisDraft(preview) {
    return {
        ...buildEmptyForm('book_analyses'),
        categoryId: selectedCategoryId.value,
        projectId: workContext.selectedProjectId || null,
        name: preview.suggestedName || preview.title || t('design.labels.webBookAnalysis'),
        icon: 'BOOK',
        author: preview.author || '',
        genre: preview.genre || '',
        sourceUrl: preview.sourceUrl || '',
        sourceBookTitle: preview.title || '',
        sourceAuthor: preview.author || '',
        sourceGenre: preview.genre || '',
        sourceKeywords: preview.keywords || '',
        sourceSite: preview.sourceSite || '',
        chapterCount: preview.chapterCount ?? 0,
        totalWordCount: preview.totalWordCount ?? 0,
        crawledAt: preview.crawledAt || null,
        worldBuildingMethod: preview.worldBuildingMethod || '',
        powerSystemDesign: preview.powerSystemDesign || '',
        environmentDescription: preview.environmentDescription || '',
        factionDesign: preview.factionDesign || '',
        worldviewHighlights: preview.worldviewHighlights || '',
        protagonistDesign: preview.protagonistDesign || '',
        supportingRoles: preview.supportingRoles || '',
        characterRelations: preview.characterRelations || '',
        goldenFingerDesign: preview.goldenFingerDesign || '',
        characterHighlights: preview.characterHighlights || '',
        plotStructure: preview.plotStructure || '',
        conflictDesign: preview.conflictDesign || '',
        climaxArrangement: preview.climaxArrangement || '',
        foreshadowingTechnique: preview.foreshadowingTechnique || '',
        plotHighlights: preview.plotHighlights || ''
    };
}
function applyImportedBookAnalysis(mode) {
    if (!bookAnalysisImportPreview.value)
        return;
    const draft = toBookAnalysisDraft(bookAnalysisImportPreview.value);
    if (mode === 'current' && editorVisible.value && moduleKey.value === 'book_analyses') {
        editorForm.value = { ...editorForm.value, ...draft };
    }
    else {
        editorMode.value = 'create';
        editorId.value = '';
        editorForm.value = draft;
        editorTab.value = MODULE_SCHEMAS.book_analyses.tabs[0]?.key ?? '';
        editorVisible.value = true;
    }
    bookAnalysisImportVisible.value = false;
    ElMessage.success(t('design.messages.previewApplied'));
}
function switchModule(key) {
    if (route.path.startsWith('/generate/')) {
        router.push(`/generate/${key}`);
        return;
    }
    router.push(`/design/${key}`);
}
watch(moduleKey, async () => {
    stopBackgroundAiPolling();
    selectedCategoryId.value = null;
    page.value = 1;
    syncSourceBookSelectionFromRoute();
    await refreshWorkspaceData();
});
watch(selectedSourceBookId, async () => {
    selectedCategoryId.value = null;
    page.value = 1;
    await refreshWorkspaceData();
});
watch(selectedCategoryId, () => {
    includeUncategorized.value = false;
    page.value = 1;
    void refreshItems();
});
watch([isEnabledFilter, includeUncategorized, updatedRange], () => {
    page.value = 1;
    void refreshItems();
});
watch(() => workContext.selectedProjectId, async () => {
    selectedSourceBookId.value = workContext.selectedProject?.currentSourceBookId ?? '';
    syncSourceBookSelectionFromRoute();
    page.value = 1;
    await refreshWorkspaceData();
});
watch(() => route.query.sourceBookId, (value) => {
    if (!moduleMeta.value.hasSourceBookScope)
        return;
    selectedSourceBookId.value = typeof value === 'string' ? value : '';
});
watch(() => workContext.selectedVolumeId, () => {
    void refreshPickers();
});
watch(bookAnalysisAiConfigId, refreshBookAnalysisAiProviderAssets);
watch(() => workContext.volumes, () => {
    void refreshPickers();
}, { deep: true });
watch(() => items.value.map((row) => row.backgroundAiStatus).join('|'), () => {
    const hasBusyItem = moduleKey.value === 'book_analyses'
        && items.value.some((row) => row.backgroundAiStatus === 'queued' || row.backgroundAiStatus === 'running');
    if (hasBusyItem) {
        startBackgroundAiPolling();
    }
    else {
        stopBackgroundAiPolling();
    }
});
onMounted(async () => {
    await workContext.init();
    await Promise.all([refreshSourceBooks(), refreshBookAnalysisAiConfig()]);
    syncSourceBookSelectionFromRoute();
    await refreshWorkspaceData();
});
onBeforeUnmount(() => {
    stopBackgroundAiPolling();
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['module-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['module-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['module-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['sourcebook-area']} */ ;
/** @type {__VLS_StyleScopedClasses['tree-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['el-card__body']} */ ;
/** @type {__VLS_StyleScopedClasses['list-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['el-card__body']} */ ;
/** @type {__VLS_StyleScopedClasses['cat-item']} */ ;
/** @type {__VLS_StyleScopedClasses['all']} */ ;
/** @type {__VLS_StyleScopedClasses['cat-item']} */ ;
/** @type {__VLS_StyleScopedClasses['all']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['cat-node']} */ ;
/** @type {__VLS_StyleScopedClasses['cat-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['cat-node']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['cat-name']} */ ;
/** @type {__VLS_StyleScopedClasses['main-layout']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-meta']} */ ;
/** @type {__VLS_StyleScopedClasses['import-input-row']} */ ;
/** @type {__VLS_StyleScopedClasses['ai-config-grid']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "design-view" },
});
const __VLS_0 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    shadow: "never",
    ...{ class: "header-card" },
}));
const __VLS_2 = __VLS_1({
    shadow: "never",
    ...{ class: "header-card" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_3.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "header-row" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "module-tabs" },
});
for (const [moduleItem] of __VLS_getVForSourceType((__VLS_ctx.DESIGN_MODULES))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.switchModule(moduleItem.key);
            } },
        key: (moduleItem.key),
        ...{ class: "module-tab" },
        ...{ class: ({ active: moduleItem.key === __VLS_ctx.moduleKey }) },
        type: "button",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "icon" },
    });
    (moduleItem.icon);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.t(`design.modules.${moduleItem.key}`));
}
if (__VLS_ctx.moduleMeta.hasSourceBookScope) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "sourcebook-area" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "label" },
    });
    (__VLS_ctx.t('design.labels.sourceBook'));
    const __VLS_4 = {}.ElSelect;
    /** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
    // @ts-ignore
    const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
        modelValue: (__VLS_ctx.selectedSourceBookId),
        clearable: true,
        size: "small",
        ...{ style: {} },
    }));
    const __VLS_6 = __VLS_5({
        modelValue: (__VLS_ctx.selectedSourceBookId),
        clearable: true,
        size: "small",
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_5));
    __VLS_7.slots.default;
    const __VLS_8 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
        label: (__VLS_ctx.t('design.labels.all')),
        value: "",
    }));
    const __VLS_10 = __VLS_9({
        label: (__VLS_ctx.t('design.labels.all')),
        value: "",
    }, ...__VLS_functionalComponentArgsRest(__VLS_9));
    for (const [book] of __VLS_getVForSourceType((__VLS_ctx.sourceBooks))) {
        const __VLS_12 = {}.ElOption;
        /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
        // @ts-ignore
        const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
            key: (book.id),
            label: (book.name),
            value: (book.id),
        }));
        const __VLS_14 = __VLS_13({
            key: (book.id),
            label: (book.name),
            value: (book.id),
        }, ...__VLS_functionalComponentArgsRest(__VLS_13));
    }
    var __VLS_7;
    const __VLS_16 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
        ...{ 'onClick': {} },
        size: "small",
        icon: (__VLS_ctx.Plus),
    }));
    const __VLS_18 = __VLS_17({
        ...{ 'onClick': {} },
        size: "small",
        icon: (__VLS_ctx.Plus),
    }, ...__VLS_functionalComponentArgsRest(__VLS_17));
    let __VLS_20;
    let __VLS_21;
    let __VLS_22;
    const __VLS_23 = {
        onClick: (...[$event]) => {
            if (!(__VLS_ctx.moduleMeta.hasSourceBookScope))
                return;
            __VLS_ctx.newSourceBookVisible = true;
        }
    };
    __VLS_19.slots.default;
    (__VLS_ctx.t('design.labels.new'));
    var __VLS_19;
    const __VLS_24 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
        ...{ 'onClick': {} },
        size: "small",
        disabled: (!__VLS_ctx.workContext.selectedProjectId),
    }));
    const __VLS_26 = __VLS_25({
        ...{ 'onClick': {} },
        size: "small",
        disabled: (!__VLS_ctx.workContext.selectedProjectId),
    }, ...__VLS_functionalComponentArgsRest(__VLS_25));
    let __VLS_28;
    let __VLS_29;
    let __VLS_30;
    const __VLS_31 = {
        onClick: (__VLS_ctx.bindSourceBookToProject)
    };
    __VLS_27.slots.default;
    (__VLS_ctx.t('design.labels.setProjectDefault'));
    var __VLS_27;
}
var __VLS_3;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "main-layout" },
});
const __VLS_32 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
    shadow: "never",
    ...{ class: "tree-panel" },
}));
const __VLS_34 = __VLS_33({
    shadow: "never",
    ...{ class: "tree-panel" },
}, ...__VLS_functionalComponentArgsRest(__VLS_33));
__VLS_35.slots.default;
{
    const { header: __VLS_thisSlot } = __VLS_35.slots;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "panel-head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.t('design.labels.categories', { module: __VLS_ctx.localizedModuleLabel }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "head-actions" },
    });
    const __VLS_36 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
        ...{ 'onClick': {} },
        text: true,
        size: "small",
        icon: (__VLS_ctx.Refresh),
    }));
    const __VLS_38 = __VLS_37({
        ...{ 'onClick': {} },
        text: true,
        size: "small",
        icon: (__VLS_ctx.Refresh),
    }, ...__VLS_functionalComponentArgsRest(__VLS_37));
    let __VLS_40;
    let __VLS_41;
    let __VLS_42;
    const __VLS_43 = {
        onClick: (__VLS_ctx.refreshCategories)
    };
    var __VLS_39;
    const __VLS_44 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
        ...{ 'onClick': {} },
        text: true,
        size: "small",
        icon: (__VLS_ctx.FolderAdd),
    }));
    const __VLS_46 = __VLS_45({
        ...{ 'onClick': {} },
        text: true,
        size: "small",
        icon: (__VLS_ctx.FolderAdd),
    }, ...__VLS_functionalComponentArgsRest(__VLS_45));
    let __VLS_48;
    let __VLS_49;
    let __VLS_50;
    const __VLS_51 = {
        onClick: (...[$event]) => {
            __VLS_ctx.openCreateCategory();
        }
    };
    var __VLS_47;
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "tree-body" },
});
__VLS_asFunctionalDirective(__VLS_directives.vLoading)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.loadingCategories) }, null, null);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.selectedCategoryId = null;
        } },
    ...{ class: (['cat-item', 'all', { active: !__VLS_ctx.selectedCategoryId }]) },
});
(__VLS_ctx.t('design.labels.allUncategorized'));
const __VLS_52 = {}.ElTree;
/** @type {[typeof __VLS_components.ElTree, typeof __VLS_components.elTree, typeof __VLS_components.ElTree, typeof __VLS_components.elTree, ]} */ ;
// @ts-ignore
const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
    ...{ 'onNodeDrop': {} },
    data: (__VLS_ctx.categoryTree),
    nodeKey: "id",
    draggable: true,
    defaultExpandAll: (true),
    expandOnClickNode: (false),
    highlightCurrent: (true),
    emptyText: (__VLS_ctx.t('design.labels.noCategories')),
}));
const __VLS_54 = __VLS_53({
    ...{ 'onNodeDrop': {} },
    data: (__VLS_ctx.categoryTree),
    nodeKey: "id",
    draggable: true,
    defaultExpandAll: (true),
    expandOnClickNode: (false),
    highlightCurrent: (true),
    emptyText: (__VLS_ctx.t('design.labels.noCategories')),
}, ...__VLS_functionalComponentArgsRest(__VLS_53));
let __VLS_56;
let __VLS_57;
let __VLS_58;
const __VLS_59 = {
    onNodeDrop: (__VLS_ctx.saveCategoryOrder)
};
__VLS_55.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_55.slots;
    const [{ data }] = __VLS_getSlotParams(__VLS_thisSlot);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.selectedCategoryId = data.id;
            } },
        ...{ class: (['cat-node', { active: __VLS_ctx.selectedCategoryId === data.id }]) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "cat-name" },
    });
    (data.name);
    if (data.isBuiltIn) {
        const __VLS_60 = {}.ElTag;
        /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
        // @ts-ignore
        const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
            size: "small",
            type: "info",
            effect: "plain",
        }));
        const __VLS_62 = __VLS_61({
            size: "small",
            type: "info",
            effect: "plain",
        }, ...__VLS_functionalComponentArgsRest(__VLS_61));
        __VLS_63.slots.default;
        (__VLS_ctx.t('design.labels.builtIn'));
        var __VLS_63;
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "cat-count" },
    });
    (data.itemCount);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "cat-actions" },
    });
    const __VLS_64 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
        ...{ 'onClick': {} },
        text: true,
        size: "small",
        icon: (__VLS_ctx.Plus),
    }));
    const __VLS_66 = __VLS_65({
        ...{ 'onClick': {} },
        text: true,
        size: "small",
        icon: (__VLS_ctx.Plus),
    }, ...__VLS_functionalComponentArgsRest(__VLS_65));
    let __VLS_68;
    let __VLS_69;
    let __VLS_70;
    const __VLS_71 = {
        onClick: (...[$event]) => {
            __VLS_ctx.openCreateCategory(data);
        }
    };
    var __VLS_67;
    const __VLS_72 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
        ...{ 'onClick': {} },
        text: true,
        size: "small",
        icon: (__VLS_ctx.Edit),
    }));
    const __VLS_74 = __VLS_73({
        ...{ 'onClick': {} },
        text: true,
        size: "small",
        icon: (__VLS_ctx.Edit),
    }, ...__VLS_functionalComponentArgsRest(__VLS_73));
    let __VLS_76;
    let __VLS_77;
    let __VLS_78;
    const __VLS_79 = {
        onClick: (...[$event]) => {
            __VLS_ctx.openEditCategory(data);
        }
    };
    var __VLS_75;
    if (!data.isBuiltIn) {
        const __VLS_80 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
            ...{ 'onClick': {} },
            text: true,
            size: "small",
            icon: (__VLS_ctx.Delete),
            type: "danger",
        }));
        const __VLS_82 = __VLS_81({
            ...{ 'onClick': {} },
            text: true,
            size: "small",
            icon: (__VLS_ctx.Delete),
            type: "danger",
        }, ...__VLS_functionalComponentArgsRest(__VLS_81));
        let __VLS_84;
        let __VLS_85;
        let __VLS_86;
        const __VLS_87 = {
            onClick: (...[$event]) => {
                if (!(!data.isBuiltIn))
                    return;
                __VLS_ctx.removeCategory(data);
            }
        };
        var __VLS_83;
    }
}
var __VLS_55;
var __VLS_35;
const __VLS_88 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
    shadow: "never",
    ...{ class: "list-panel" },
}));
const __VLS_90 = __VLS_89({
    shadow: "never",
    ...{ class: "list-panel" },
}, ...__VLS_functionalComponentArgsRest(__VLS_89));
__VLS_91.slots.default;
{
    const { header: __VLS_thisSlot } = __VLS_91.slots;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "panel-head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.t('design.labels.records', { module: __VLS_ctx.localizedModuleLabel }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "head-actions" },
    });
    if (__VLS_ctx.moduleKey === 'book_analyses') {
        const __VLS_92 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({
            ...{ 'onClick': {} },
            size: "small",
        }));
        const __VLS_94 = __VLS_93({
            ...{ 'onClick': {} },
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_93));
        let __VLS_96;
        let __VLS_97;
        let __VLS_98;
        const __VLS_99 = {
            onClick: (__VLS_ctx.openBookAnalysisImport)
        };
        __VLS_95.slots.default;
        (__VLS_ctx.t('design.labels.crawlImport'));
        var __VLS_95;
    }
    if (__VLS_ctx.canRegenerateFromNovelSeed) {
        const __VLS_100 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_101 = __VLS_asFunctionalComponent(__VLS_100, new __VLS_100({
            ...{ 'onClick': {} },
            size: "small",
            type: "primary",
            plain: true,
            icon: (__VLS_ctx.MagicStick),
        }));
        const __VLS_102 = __VLS_101({
            ...{ 'onClick': {} },
            size: "small",
            type: "primary",
            plain: true,
            icon: (__VLS_ctx.MagicStick),
        }, ...__VLS_functionalComponentArgsRest(__VLS_101));
        let __VLS_104;
        let __VLS_105;
        let __VLS_106;
        const __VLS_107 = {
            onClick: (__VLS_ctx.goNovelSeedRegenerate)
        };
        __VLS_103.slots.default;
        var __VLS_103;
    }
    if (__VLS_ctx.moduleKey === 'chapter_plans') {
        const __VLS_108 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_109 = __VLS_asFunctionalComponent(__VLS_108, new __VLS_108({
            ...{ 'onClick': {} },
            size: "small",
            type: "warning",
            plain: true,
            icon: (__VLS_ctx.MagicStick),
            loading: (__VLS_ctx.rewritingChapterPlanSummaries),
        }));
        const __VLS_110 = __VLS_109({
            ...{ 'onClick': {} },
            size: "small",
            type: "warning",
            plain: true,
            icon: (__VLS_ctx.MagicStick),
            loading: (__VLS_ctx.rewritingChapterPlanSummaries),
        }, ...__VLS_functionalComponentArgsRest(__VLS_109));
        let __VLS_112;
        let __VLS_113;
        let __VLS_114;
        const __VLS_115 = {
            onClick: (__VLS_ctx.rewriteChapterPlanSummaries)
        };
        __VLS_111.slots.default;
        var __VLS_111;
    }
    const __VLS_116 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_117 = __VLS_asFunctionalComponent(__VLS_116, new __VLS_116({
        ...{ 'onChange': {} },
        modelValue: (__VLS_ctx.keyword),
        placeholder: (__VLS_ctx.t('design.labels.searchByName')),
        clearable: true,
        size: "small",
        ...{ style: {} },
        prefixIcon: (__VLS_ctx.Search),
    }));
    const __VLS_118 = __VLS_117({
        ...{ 'onChange': {} },
        modelValue: (__VLS_ctx.keyword),
        placeholder: (__VLS_ctx.t('design.labels.searchByName')),
        clearable: true,
        size: "small",
        ...{ style: {} },
        prefixIcon: (__VLS_ctx.Search),
    }, ...__VLS_functionalComponentArgsRest(__VLS_117));
    let __VLS_120;
    let __VLS_121;
    let __VLS_122;
    const __VLS_123 = {
        onChange: (...[$event]) => {
            __VLS_ctx.page = 1;
            __VLS_ctx.refreshItems();
        }
    };
    var __VLS_119;
    const __VLS_124 = {}.ElSelect;
    /** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
    // @ts-ignore
    const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({
        modelValue: (__VLS_ctx.isEnabledFilter),
        size: "small",
        ...{ style: {} },
    }));
    const __VLS_126 = __VLS_125({
        modelValue: (__VLS_ctx.isEnabledFilter),
        size: "small",
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_125));
    __VLS_127.slots.default;
    const __VLS_128 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_129 = __VLS_asFunctionalComponent(__VLS_128, new __VLS_128({
        label: (__VLS_ctx.t('design.labels.all')),
        value: "all",
    }));
    const __VLS_130 = __VLS_129({
        label: (__VLS_ctx.t('design.labels.all')),
        value: "all",
    }, ...__VLS_functionalComponentArgsRest(__VLS_129));
    const __VLS_132 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_133 = __VLS_asFunctionalComponent(__VLS_132, new __VLS_132({
        label: (__VLS_ctx.t('design.labels.enabled')),
        value: "enabled",
    }));
    const __VLS_134 = __VLS_133({
        label: (__VLS_ctx.t('design.labels.enabled')),
        value: "enabled",
    }, ...__VLS_functionalComponentArgsRest(__VLS_133));
    const __VLS_136 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_137 = __VLS_asFunctionalComponent(__VLS_136, new __VLS_136({
        label: (__VLS_ctx.t('design.labels.disabled')),
        value: "disabled",
    }));
    const __VLS_138 = __VLS_137({
        label: (__VLS_ctx.t('design.labels.disabled')),
        value: "disabled",
    }, ...__VLS_functionalComponentArgsRest(__VLS_137));
    var __VLS_127;
    const __VLS_140 = {}.ElDatePicker;
    /** @type {[typeof __VLS_components.ElDatePicker, typeof __VLS_components.elDatePicker, ]} */ ;
    // @ts-ignore
    const __VLS_141 = __VLS_asFunctionalComponent(__VLS_140, new __VLS_140({
        modelValue: (__VLS_ctx.updatedRange),
        type: "datetimerange",
        startPlaceholder: (__VLS_ctx.t('design.labels.updatedFrom')),
        endPlaceholder: (__VLS_ctx.t('design.labels.updatedTo')),
        valueFormat: "YYYY-MM-DDTHH:mm:ss",
        size: "small",
        ...{ style: {} },
    }));
    const __VLS_142 = __VLS_141({
        modelValue: (__VLS_ctx.updatedRange),
        type: "datetimerange",
        startPlaceholder: (__VLS_ctx.t('design.labels.updatedFrom')),
        endPlaceholder: (__VLS_ctx.t('design.labels.updatedTo')),
        valueFormat: "YYYY-MM-DDTHH:mm:ss",
        size: "small",
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_141));
    const __VLS_144 = {}.ElCheckbox;
    /** @type {[typeof __VLS_components.ElCheckbox, typeof __VLS_components.elCheckbox, typeof __VLS_components.ElCheckbox, typeof __VLS_components.elCheckbox, ]} */ ;
    // @ts-ignore
    const __VLS_145 = __VLS_asFunctionalComponent(__VLS_144, new __VLS_144({
        modelValue: (__VLS_ctx.includeUncategorized),
        size: "small",
    }));
    const __VLS_146 = __VLS_145({
        modelValue: (__VLS_ctx.includeUncategorized),
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_145));
    __VLS_147.slots.default;
    (__VLS_ctx.t('design.labels.onlyUncategorized'));
    var __VLS_147;
    const __VLS_148 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_149 = __VLS_asFunctionalComponent(__VLS_148, new __VLS_148({
        ...{ 'onClick': {} },
        size: "small",
        icon: (__VLS_ctx.Refresh),
    }));
    const __VLS_150 = __VLS_149({
        ...{ 'onClick': {} },
        size: "small",
        icon: (__VLS_ctx.Refresh),
    }, ...__VLS_functionalComponentArgsRest(__VLS_149));
    let __VLS_152;
    let __VLS_153;
    let __VLS_154;
    const __VLS_155 = {
        onClick: (__VLS_ctx.refreshItems)
    };
    var __VLS_151;
    const __VLS_156 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_157 = __VLS_asFunctionalComponent(__VLS_156, new __VLS_156({
        ...{ 'onClick': {} },
        type: "primary",
        size: "small",
        icon: (__VLS_ctx.Plus),
    }));
    const __VLS_158 = __VLS_157({
        ...{ 'onClick': {} },
        type: "primary",
        size: "small",
        icon: (__VLS_ctx.Plus),
    }, ...__VLS_functionalComponentArgsRest(__VLS_157));
    let __VLS_160;
    let __VLS_161;
    let __VLS_162;
    const __VLS_163 = {
        onClick: (__VLS_ctx.openCreate)
    };
    __VLS_159.slots.default;
    (__VLS_ctx.t('design.labels.new'));
    var __VLS_159;
}
const __VLS_164 = {}.ElTable;
/** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
// @ts-ignore
const __VLS_165 = __VLS_asFunctionalComponent(__VLS_164, new __VLS_164({
    ...{ 'onRowDblclick': {} },
    data: (__VLS_ctx.items),
    stripe: true,
    size: "small",
}));
const __VLS_166 = __VLS_165({
    ...{ 'onRowDblclick': {} },
    data: (__VLS_ctx.items),
    stripe: true,
    size: "small",
}, ...__VLS_functionalComponentArgsRest(__VLS_165));
let __VLS_168;
let __VLS_169;
let __VLS_170;
const __VLS_171 = {
    onRowDblclick: (__VLS_ctx.openEdit)
};
__VLS_asFunctionalDirective(__VLS_directives.vLoading)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.loadingItems) }, null, null);
__VLS_167.slots.default;
const __VLS_172 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_173 = __VLS_asFunctionalComponent(__VLS_172, new __VLS_172({
    prop: "name",
    label: (__VLS_ctx.t('design.labels.name')),
    minWidth: "200",
}));
const __VLS_174 = __VLS_173({
    prop: "name",
    label: (__VLS_ctx.t('design.labels.name')),
    minWidth: "200",
}, ...__VLS_functionalComponentArgsRest(__VLS_173));
const __VLS_176 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_177 = __VLS_asFunctionalComponent(__VLS_176, new __VLS_176({
    prop: "category",
    label: (__VLS_ctx.t('design.labels.category')),
    width: "120",
}));
const __VLS_178 = __VLS_177({
    prop: "category",
    label: (__VLS_ctx.t('design.labels.category')),
    width: "120",
}, ...__VLS_functionalComponentArgsRest(__VLS_177));
for (const [col] of __VLS_getVForSourceType((__VLS_ctx.schema.listColumns ?? []))) {
    const __VLS_180 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_181 = __VLS_asFunctionalComponent(__VLS_180, new __VLS_180({
        key: (col.key),
        label: (col.label),
        width: (col.width),
    }));
    const __VLS_182 = __VLS_181({
        key: (col.key),
        label: (col.label),
        width: (col.width),
    }, ...__VLS_functionalComponentArgsRest(__VLS_181));
    __VLS_183.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_183.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.formatCellValue(row, col));
    }
    var __VLS_183;
}
const __VLS_184 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_185 = __VLS_asFunctionalComponent(__VLS_184, new __VLS_184({
    label: (__VLS_ctx.t('design.labels.status')),
    width: "80",
}));
const __VLS_186 = __VLS_185({
    label: (__VLS_ctx.t('design.labels.status')),
    width: "80",
}, ...__VLS_functionalComponentArgsRest(__VLS_185));
__VLS_187.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_187.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    const __VLS_188 = {}.ElTag;
    /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
    // @ts-ignore
    const __VLS_189 = __VLS_asFunctionalComponent(__VLS_188, new __VLS_188({
        type: (row.isEnabled ? 'success' : 'info'),
        size: "small",
    }));
    const __VLS_190 = __VLS_189({
        type: (row.isEnabled ? 'success' : 'info'),
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_189));
    __VLS_191.slots.default;
    (row.isEnabled ? __VLS_ctx.t('design.labels.on') : __VLS_ctx.t('design.labels.off'));
    var __VLS_191;
}
var __VLS_187;
const __VLS_192 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_193 = __VLS_asFunctionalComponent(__VLS_192, new __VLS_192({
    label: (__VLS_ctx.t('design.labels.updated')),
    width: "170",
}));
const __VLS_194 = __VLS_193({
    label: (__VLS_ctx.t('design.labels.updated')),
    width: "170",
}, ...__VLS_functionalComponentArgsRest(__VLS_193));
__VLS_195.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_195.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "muted" },
    });
    (new Date(row.updatedAt).toLocaleString());
}
var __VLS_195;
if (__VLS_ctx.moduleKey === 'book_analyses') {
    const __VLS_196 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_197 = __VLS_asFunctionalComponent(__VLS_196, new __VLS_196({
        label: (__VLS_ctx.t('design.labels.aiStatus')),
        width: "120",
        align: "center",
    }));
    const __VLS_198 = __VLS_197({
        label: (__VLS_ctx.t('design.labels.aiStatus')),
        width: "120",
        align: "center",
    }, ...__VLS_functionalComponentArgsRest(__VLS_197));
    __VLS_199.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_199.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        const __VLS_200 = {}.ElTag;
        /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
        // @ts-ignore
        const __VLS_201 = __VLS_asFunctionalComponent(__VLS_200, new __VLS_200({
            type: (__VLS_ctx.getBackgroundAiStatusTagType(row.backgroundAiStatus)),
            size: "small",
            effect: "plain",
        }));
        const __VLS_202 = __VLS_201({
            type: (__VLS_ctx.getBackgroundAiStatusTagType(row.backgroundAiStatus)),
            size: "small",
            effect: "plain",
        }, ...__VLS_functionalComponentArgsRest(__VLS_201));
        __VLS_203.slots.default;
        (__VLS_ctx.getBackgroundAiStatusLabel(row.backgroundAiStatus));
        var __VLS_203;
    }
    var __VLS_199;
}
if (__VLS_ctx.moduleKey === 'book_analyses') {
    const __VLS_204 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_205 = __VLS_asFunctionalComponent(__VLS_204, new __VLS_204({
        label: (__VLS_ctx.t('design.labels.aiFailureReason')),
        minWidth: "240",
    }));
    const __VLS_206 = __VLS_205({
        label: (__VLS_ctx.t('design.labels.aiFailureReason')),
        minWidth: "240",
    }, ...__VLS_functionalComponentArgsRest(__VLS_205));
    __VLS_207.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_207.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        if (row.backgroundAiStatus === 'failed') {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "failure-reason" },
                title: (__VLS_ctx.getBackgroundAiFailureReason(row)),
            });
            (__VLS_ctx.getBackgroundAiFailureReason(row));
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "muted" },
            });
        }
    }
    var __VLS_207;
}
const __VLS_208 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_209 = __VLS_asFunctionalComponent(__VLS_208, new __VLS_208({
    label: (__VLS_ctx.t('design.labels.actions')),
    width: "320",
    align: "center",
    fixed: "right",
}));
const __VLS_210 = __VLS_209({
    label: (__VLS_ctx.t('design.labels.actions')),
    width: "320",
    align: "center",
    fixed: "right",
}, ...__VLS_functionalComponentArgsRest(__VLS_209));
__VLS_211.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_211.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    if (__VLS_ctx.moduleKey === 'book_analyses') {
        const __VLS_212 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_213 = __VLS_asFunctionalComponent(__VLS_212, new __VLS_212({
            ...{ 'onClick': {} },
            text: true,
            size: "small",
            type: "primary",
            loading: (__VLS_ctx.backgroundAnalyzingId === String(row.id)),
            disabled: (__VLS_ctx.isBackgroundAiBusy(row)),
        }));
        const __VLS_214 = __VLS_213({
            ...{ 'onClick': {} },
            text: true,
            size: "small",
            type: "primary",
            loading: (__VLS_ctx.backgroundAnalyzingId === String(row.id)),
            disabled: (__VLS_ctx.isBackgroundAiBusy(row)),
        }, ...__VLS_functionalComponentArgsRest(__VLS_213));
        let __VLS_216;
        let __VLS_217;
        let __VLS_218;
        const __VLS_219 = {
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.moduleKey === 'book_analyses'))
                    return;
                __VLS_ctx.queueBookAnalysisBackgroundAi(row);
            }
        };
        __VLS_215.slots.default;
        (__VLS_ctx.t('design.labels.runAiAnalysis'));
        var __VLS_215;
    }
    if (__VLS_ctx.moduleKey === 'book_analyses') {
        const __VLS_220 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_221 = __VLS_asFunctionalComponent(__VLS_220, new __VLS_220({
            ...{ 'onClick': {} },
            text: true,
            size: "small",
            type: "success",
            loading: (__VLS_ctx.generatingCreativeMaterialId === String(row.id)),
        }));
        const __VLS_222 = __VLS_221({
            ...{ 'onClick': {} },
            text: true,
            size: "small",
            type: "success",
            loading: (__VLS_ctx.generatingCreativeMaterialId === String(row.id)),
        }, ...__VLS_functionalComponentArgsRest(__VLS_221));
        let __VLS_224;
        let __VLS_225;
        let __VLS_226;
        const __VLS_227 = {
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.moduleKey === 'book_analyses'))
                    return;
                __VLS_ctx.createCreativeMaterialFromBookAnalysis(row);
            }
        };
        __VLS_223.slots.default;
        (__VLS_ctx.t('design.labels.generateCreativeMaterial'));
        var __VLS_223;
    }
    if (__VLS_ctx.moduleKey === 'creative_materials') {
        const __VLS_228 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_229 = __VLS_asFunctionalComponent(__VLS_228, new __VLS_228({
            ...{ 'onClick': {} },
            text: true,
            size: "small",
            type: "warning",
            loading: (__VLS_ctx.buildingSkeletonId === String(row.id)),
        }));
        const __VLS_230 = __VLS_229({
            ...{ 'onClick': {} },
            text: true,
            size: "small",
            type: "warning",
            loading: (__VLS_ctx.buildingSkeletonId === String(row.id)),
        }, ...__VLS_functionalComponentArgsRest(__VLS_229));
        let __VLS_232;
        let __VLS_233;
        let __VLS_234;
        const __VLS_235 = {
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.moduleKey === 'creative_materials'))
                    return;
                __VLS_ctx.buildSkeletonFromCreativeMaterial(row);
            }
        };
        __VLS_231.slots.default;
        (__VLS_ctx.t('design.labels.buildSkeleton'));
        var __VLS_231;
    }
    const __VLS_236 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_237 = __VLS_asFunctionalComponent(__VLS_236, new __VLS_236({
        ...{ 'onClick': {} },
        text: true,
        size: "small",
        icon: (__VLS_ctx.Edit),
    }));
    const __VLS_238 = __VLS_237({
        ...{ 'onClick': {} },
        text: true,
        size: "small",
        icon: (__VLS_ctx.Edit),
    }, ...__VLS_functionalComponentArgsRest(__VLS_237));
    let __VLS_240;
    let __VLS_241;
    let __VLS_242;
    const __VLS_243 = {
        onClick: (...[$event]) => {
            __VLS_ctx.openEdit(row);
        }
    };
    __VLS_239.slots.default;
    (__VLS_ctx.t('design.labels.edit'));
    var __VLS_239;
    const __VLS_244 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_245 = __VLS_asFunctionalComponent(__VLS_244, new __VLS_244({
        ...{ 'onClick': {} },
        text: true,
        size: "small",
        icon: (__VLS_ctx.Delete),
        type: "danger",
    }));
    const __VLS_246 = __VLS_245({
        ...{ 'onClick': {} },
        text: true,
        size: "small",
        icon: (__VLS_ctx.Delete),
        type: "danger",
    }, ...__VLS_functionalComponentArgsRest(__VLS_245));
    let __VLS_248;
    let __VLS_249;
    let __VLS_250;
    const __VLS_251 = {
        onClick: (...[$event]) => {
            __VLS_ctx.removeItem(row);
        }
    };
    __VLS_247.slots.default;
    (__VLS_ctx.t('design.labels.delete'));
    var __VLS_247;
}
var __VLS_211;
{
    const { empty: __VLS_thisSlot } = __VLS_167.slots;
    const __VLS_252 = {}.ElEmpty;
    /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
    // @ts-ignore
    const __VLS_253 = __VLS_asFunctionalComponent(__VLS_252, new __VLS_252({
        description: (__VLS_ctx.t('design.labels.noRecordsInModule', { module: __VLS_ctx.localizedModuleLabel })),
    }));
    const __VLS_254 = __VLS_253({
        description: (__VLS_ctx.t('design.labels.noRecordsInModule', { module: __VLS_ctx.localizedModuleLabel })),
    }, ...__VLS_functionalComponentArgsRest(__VLS_253));
}
var __VLS_167;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "pager-row" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "muted" },
});
(__VLS_ctx.t('design.labels.total', { count: __VLS_ctx.total }));
const __VLS_256 = {}.ElPagination;
/** @type {[typeof __VLS_components.ElPagination, typeof __VLS_components.elPagination, ]} */ ;
// @ts-ignore
const __VLS_257 = __VLS_asFunctionalComponent(__VLS_256, new __VLS_256({
    ...{ 'onCurrentChange': {} },
    ...{ 'onSizeChange': {} },
    currentPage: (__VLS_ctx.page),
    pageSize: (__VLS_ctx.pageSize),
    layout: "sizes, prev, pager, next",
    total: (__VLS_ctx.total),
    pageSizes: ([10, 20, 50, 100]),
    small: true,
    background: true,
}));
const __VLS_258 = __VLS_257({
    ...{ 'onCurrentChange': {} },
    ...{ 'onSizeChange': {} },
    currentPage: (__VLS_ctx.page),
    pageSize: (__VLS_ctx.pageSize),
    layout: "sizes, prev, pager, next",
    total: (__VLS_ctx.total),
    pageSizes: ([10, 20, 50, 100]),
    small: true,
    background: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_257));
let __VLS_260;
let __VLS_261;
let __VLS_262;
const __VLS_263 = {
    onCurrentChange: (__VLS_ctx.refreshItems)
};
const __VLS_264 = {
    onSizeChange: (...[$event]) => {
        __VLS_ctx.page = 1;
        __VLS_ctx.refreshItems();
    }
};
var __VLS_259;
var __VLS_91;
const __VLS_265 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_266 = __VLS_asFunctionalComponent(__VLS_265, new __VLS_265({
    modelValue: (__VLS_ctx.categoryDialogVisible),
    title: (__VLS_ctx.categoryDialogMode === 'create' ? __VLS_ctx.t('design.labels.newCategory') : __VLS_ctx.t('design.labels.editCategory')),
    width: "460px",
}));
const __VLS_267 = __VLS_266({
    modelValue: (__VLS_ctx.categoryDialogVisible),
    title: (__VLS_ctx.categoryDialogMode === 'create' ? __VLS_ctx.t('design.labels.newCategory') : __VLS_ctx.t('design.labels.editCategory')),
    width: "460px",
}, ...__VLS_functionalComponentArgsRest(__VLS_266));
__VLS_268.slots.default;
const __VLS_269 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_270 = __VLS_asFunctionalComponent(__VLS_269, new __VLS_269({
    model: (__VLS_ctx.categoryForm),
    labelWidth: "100px",
    labelPosition: "right",
}));
const __VLS_271 = __VLS_270({
    model: (__VLS_ctx.categoryForm),
    labelWidth: "100px",
    labelPosition: "right",
}, ...__VLS_functionalComponentArgsRest(__VLS_270));
__VLS_272.slots.default;
const __VLS_273 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_274 = __VLS_asFunctionalComponent(__VLS_273, new __VLS_273({
    label: (__VLS_ctx.t('design.labels.name')),
    required: true,
}));
const __VLS_275 = __VLS_274({
    label: (__VLS_ctx.t('design.labels.name')),
    required: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_274));
__VLS_276.slots.default;
const __VLS_277 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_278 = __VLS_asFunctionalComponent(__VLS_277, new __VLS_277({
    modelValue: (__VLS_ctx.categoryForm.name),
}));
const __VLS_279 = __VLS_278({
    modelValue: (__VLS_ctx.categoryForm.name),
}, ...__VLS_functionalComponentArgsRest(__VLS_278));
var __VLS_276;
const __VLS_281 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_282 = __VLS_asFunctionalComponent(__VLS_281, new __VLS_281({
    label: (__VLS_ctx.t('design.labels.parent')),
}));
const __VLS_283 = __VLS_282({
    label: (__VLS_ctx.t('design.labels.parent')),
}, ...__VLS_functionalComponentArgsRest(__VLS_282));
__VLS_284.slots.default;
const __VLS_285 = {}.ElSelect;
/** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
// @ts-ignore
const __VLS_286 = __VLS_asFunctionalComponent(__VLS_285, new __VLS_285({
    modelValue: (__VLS_ctx.categoryForm.parentId),
    clearable: true,
    filterable: true,
    ...{ style: {} },
    placeholder: (__VLS_ctx.t('design.labels.rootCategory')),
}));
const __VLS_287 = __VLS_286({
    modelValue: (__VLS_ctx.categoryForm.parentId),
    clearable: true,
    filterable: true,
    ...{ style: {} },
    placeholder: (__VLS_ctx.t('design.labels.rootCategory')),
}, ...__VLS_functionalComponentArgsRest(__VLS_286));
__VLS_288.slots.default;
for (const [option] of __VLS_getVForSourceType((__VLS_ctx.categoryParentOptions))) {
    const __VLS_289 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_290 = __VLS_asFunctionalComponent(__VLS_289, new __VLS_289({
        key: (option.value),
        label: (option.label),
        value: (option.value),
    }));
    const __VLS_291 = __VLS_290({
        key: (option.value),
        label: (option.label),
        value: (option.value),
    }, ...__VLS_functionalComponentArgsRest(__VLS_290));
}
var __VLS_288;
var __VLS_284;
const __VLS_293 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_294 = __VLS_asFunctionalComponent(__VLS_293, new __VLS_293({
    label: (__VLS_ctx.t('design.labels.sort')),
}));
const __VLS_295 = __VLS_294({
    label: (__VLS_ctx.t('design.labels.sort')),
}, ...__VLS_functionalComponentArgsRest(__VLS_294));
__VLS_296.slots.default;
const __VLS_297 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_298 = __VLS_asFunctionalComponent(__VLS_297, new __VLS_297({
    modelValue: (__VLS_ctx.categoryForm.sortOrder),
    min: (0),
}));
const __VLS_299 = __VLS_298({
    modelValue: (__VLS_ctx.categoryForm.sortOrder),
    min: (0),
}, ...__VLS_functionalComponentArgsRest(__VLS_298));
var __VLS_296;
const __VLS_301 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_302 = __VLS_asFunctionalComponent(__VLS_301, new __VLS_301({
    label: (__VLS_ctx.t('design.labels.enabled')),
}));
const __VLS_303 = __VLS_302({
    label: (__VLS_ctx.t('design.labels.enabled')),
}, ...__VLS_functionalComponentArgsRest(__VLS_302));
__VLS_304.slots.default;
const __VLS_305 = {}.ElSwitch;
/** @type {[typeof __VLS_components.ElSwitch, typeof __VLS_components.elSwitch, ]} */ ;
// @ts-ignore
const __VLS_306 = __VLS_asFunctionalComponent(__VLS_305, new __VLS_305({
    modelValue: (__VLS_ctx.categoryForm.isEnabled),
}));
const __VLS_307 = __VLS_306({
    modelValue: (__VLS_ctx.categoryForm.isEnabled),
}, ...__VLS_functionalComponentArgsRest(__VLS_306));
var __VLS_304;
var __VLS_272;
{
    const { footer: __VLS_thisSlot } = __VLS_268.slots;
    const __VLS_309 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_310 = __VLS_asFunctionalComponent(__VLS_309, new __VLS_309({
        ...{ 'onClick': {} },
    }));
    const __VLS_311 = __VLS_310({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_310));
    let __VLS_313;
    let __VLS_314;
    let __VLS_315;
    const __VLS_316 = {
        onClick: (...[$event]) => {
            __VLS_ctx.categoryDialogVisible = false;
        }
    };
    __VLS_312.slots.default;
    (__VLS_ctx.t('design.labels.cancel'));
    var __VLS_312;
    const __VLS_317 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_318 = __VLS_asFunctionalComponent(__VLS_317, new __VLS_317({
        ...{ 'onClick': {} },
        type: "primary",
    }));
    const __VLS_319 = __VLS_318({
        ...{ 'onClick': {} },
        type: "primary",
    }, ...__VLS_functionalComponentArgsRest(__VLS_318));
    let __VLS_321;
    let __VLS_322;
    let __VLS_323;
    const __VLS_324 = {
        onClick: (__VLS_ctx.saveCategory)
    };
    __VLS_320.slots.default;
    (__VLS_ctx.t('design.labels.save'));
    var __VLS_320;
}
var __VLS_268;
const __VLS_325 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_326 = __VLS_asFunctionalComponent(__VLS_325, new __VLS_325({
    modelValue: (__VLS_ctx.editorVisible),
    title: (`${__VLS_ctx.editorMode === 'create' ? __VLS_ctx.t('design.labels.new') : __VLS_ctx.t('design.labels.edit')} ${__VLS_ctx.localizedModuleLabel}`),
    width: "780px",
    closeOnClickModal: (false),
}));
const __VLS_327 = __VLS_326({
    modelValue: (__VLS_ctx.editorVisible),
    title: (`${__VLS_ctx.editorMode === 'create' ? __VLS_ctx.t('design.labels.new') : __VLS_ctx.t('design.labels.edit')} ${__VLS_ctx.localizedModuleLabel}`),
    width: "780px",
    closeOnClickModal: (false),
}, ...__VLS_functionalComponentArgsRest(__VLS_326));
__VLS_328.slots.default;
const __VLS_329 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_330 = __VLS_asFunctionalComponent(__VLS_329, new __VLS_329({
    model: (__VLS_ctx.editorForm),
    labelWidth: "130px",
    labelPosition: "right",
}));
const __VLS_331 = __VLS_330({
    model: (__VLS_ctx.editorForm),
    labelWidth: "130px",
    labelPosition: "right",
}, ...__VLS_functionalComponentArgsRest(__VLS_330));
__VLS_332.slots.default;
for (const [field] of __VLS_getVForSourceType((__VLS_ctx.schema.commonFields))) {
    /** @type {[typeof DesignFormField, ]} */ ;
    // @ts-ignore
    const __VLS_333 = __VLS_asFunctionalComponent(DesignFormField, new DesignFormField({
        ...{ 'onClearInvalidReferences': {} },
        ...{ 'onRematchReferences': {} },
        key: (field.key),
        modelValue: (__VLS_ctx.editorForm[field.key]),
        field: (field),
        pickerOptions: (__VLS_ctx.optionsFor(field)),
        invalidMessage: (__VLS_ctx.invalidReferenceMessage(field, __VLS_ctx.editorForm[field.key])),
    }));
    const __VLS_334 = __VLS_333({
        ...{ 'onClearInvalidReferences': {} },
        ...{ 'onRematchReferences': {} },
        key: (field.key),
        modelValue: (__VLS_ctx.editorForm[field.key]),
        field: (field),
        pickerOptions: (__VLS_ctx.optionsFor(field)),
        invalidMessage: (__VLS_ctx.invalidReferenceMessage(field, __VLS_ctx.editorForm[field.key])),
    }, ...__VLS_functionalComponentArgsRest(__VLS_333));
    let __VLS_336;
    let __VLS_337;
    let __VLS_338;
    const __VLS_339 = {
        onClearInvalidReferences: (...[$event]) => {
            __VLS_ctx.clearInvalidReferences(field);
        }
    };
    const __VLS_340 = {
        onRematchReferences: (...[$event]) => {
            __VLS_ctx.rematchReferences(field);
        }
    };
    var __VLS_335;
}
const __VLS_341 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_342 = __VLS_asFunctionalComponent(__VLS_341, new __VLS_341({
    label: (__VLS_ctx.t('design.labels.categoryId')),
}));
const __VLS_343 = __VLS_342({
    label: (__VLS_ctx.t('design.labels.categoryId')),
}, ...__VLS_functionalComponentArgsRest(__VLS_342));
__VLS_344.slots.default;
if (__VLS_ctx.editorForm.categoryId) {
    const __VLS_345 = {}.ElTag;
    /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
    // @ts-ignore
    const __VLS_346 = __VLS_asFunctionalComponent(__VLS_345, new __VLS_345({
        type: "info",
    }));
    const __VLS_347 = __VLS_346({
        type: "info",
    }, ...__VLS_functionalComponentArgsRest(__VLS_346));
    __VLS_348.slots.default;
    (__VLS_ctx.editorForm.categoryId);
    var __VLS_348;
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "muted" },
    });
    (__VLS_ctx.t('design.labels.notBound'));
}
var __VLS_344;
if (__VLS_ctx.moduleMeta.hasSourceBookScope) {
    const __VLS_349 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_350 = __VLS_asFunctionalComponent(__VLS_349, new __VLS_349({
        label: (__VLS_ctx.t('design.labels.sourceBookId')),
    }));
    const __VLS_351 = __VLS_350({
        label: (__VLS_ctx.t('design.labels.sourceBookId')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_350));
    __VLS_352.slots.default;
    if (__VLS_ctx.editorForm.sourceBookId) {
        const __VLS_353 = {}.ElTag;
        /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
        // @ts-ignore
        const __VLS_354 = __VLS_asFunctionalComponent(__VLS_353, new __VLS_353({
            type: "info",
        }));
        const __VLS_355 = __VLS_354({
            type: "info",
        }, ...__VLS_functionalComponentArgsRest(__VLS_354));
        __VLS_356.slots.default;
        (__VLS_ctx.editorForm.sourceBookId);
        var __VLS_356;
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "muted" },
        });
        (__VLS_ctx.t('design.labels.globalScope'));
    }
    var __VLS_352;
}
if (__VLS_ctx.moduleKey === 'book_analyses' && __VLS_ctx.editorForm.backgroundAiStatus === 'failed') {
    const __VLS_357 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_358 = __VLS_asFunctionalComponent(__VLS_357, new __VLS_357({
        label: (__VLS_ctx.t('design.labels.aiFailureReason')),
    }));
    const __VLS_359 = __VLS_358({
        label: (__VLS_ctx.t('design.labels.aiFailureReason')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_358));
    __VLS_360.slots.default;
    const __VLS_361 = {}.ElAlert;
    /** @type {[typeof __VLS_components.ElAlert, typeof __VLS_components.elAlert, ]} */ ;
    // @ts-ignore
    const __VLS_362 = __VLS_asFunctionalComponent(__VLS_361, new __VLS_361({
        type: "error",
        closable: (false),
        showIcon: true,
        ...{ class: "editor-ai-failure" },
        title: (__VLS_ctx.getBackgroundAiFailureReason(__VLS_ctx.editorForm)),
    }));
    const __VLS_363 = __VLS_362({
        type: "error",
        closable: (false),
        showIcon: true,
        ...{ class: "editor-ai-failure" },
        title: (__VLS_ctx.getBackgroundAiFailureReason(__VLS_ctx.editorForm)),
    }, ...__VLS_functionalComponentArgsRest(__VLS_362));
    var __VLS_360;
}
const __VLS_365 = {}.ElTabs;
/** @type {[typeof __VLS_components.ElTabs, typeof __VLS_components.elTabs, typeof __VLS_components.ElTabs, typeof __VLS_components.elTabs, ]} */ ;
// @ts-ignore
const __VLS_366 = __VLS_asFunctionalComponent(__VLS_365, new __VLS_365({
    modelValue: (__VLS_ctx.editorTab),
    ...{ class: "editor-tabs" },
}));
const __VLS_367 = __VLS_366({
    modelValue: (__VLS_ctx.editorTab),
    ...{ class: "editor-tabs" },
}, ...__VLS_functionalComponentArgsRest(__VLS_366));
__VLS_368.slots.default;
for (const [tabItem] of __VLS_getVForSourceType((__VLS_ctx.schema.tabs))) {
    const __VLS_369 = {}.ElTabPane;
    /** @type {[typeof __VLS_components.ElTabPane, typeof __VLS_components.elTabPane, typeof __VLS_components.ElTabPane, typeof __VLS_components.elTabPane, ]} */ ;
    // @ts-ignore
    const __VLS_370 = __VLS_asFunctionalComponent(__VLS_369, new __VLS_369({
        key: (tabItem.key),
        name: (tabItem.key),
        label: (tabItem.label),
    }));
    const __VLS_371 = __VLS_370({
        key: (tabItem.key),
        name: (tabItem.key),
        label: (tabItem.label),
    }, ...__VLS_functionalComponentArgsRest(__VLS_370));
    __VLS_372.slots.default;
    for (const [field] of __VLS_getVForSourceType((tabItem.fields))) {
        /** @type {[typeof DesignFormField, ]} */ ;
        // @ts-ignore
        const __VLS_373 = __VLS_asFunctionalComponent(DesignFormField, new DesignFormField({
            ...{ 'onClearInvalidReferences': {} },
            ...{ 'onRematchReferences': {} },
            key: (field.key),
            modelValue: (__VLS_ctx.editorForm[field.key]),
            field: (field),
            pickerOptions: (__VLS_ctx.optionsFor(field)),
            invalidMessage: (__VLS_ctx.invalidReferenceMessage(field, __VLS_ctx.editorForm[field.key])),
        }));
        const __VLS_374 = __VLS_373({
            ...{ 'onClearInvalidReferences': {} },
            ...{ 'onRematchReferences': {} },
            key: (field.key),
            modelValue: (__VLS_ctx.editorForm[field.key]),
            field: (field),
            pickerOptions: (__VLS_ctx.optionsFor(field)),
            invalidMessage: (__VLS_ctx.invalidReferenceMessage(field, __VLS_ctx.editorForm[field.key])),
        }, ...__VLS_functionalComponentArgsRest(__VLS_373));
        let __VLS_376;
        let __VLS_377;
        let __VLS_378;
        const __VLS_379 = {
            onClearInvalidReferences: (...[$event]) => {
                __VLS_ctx.clearInvalidReferences(field);
            }
        };
        const __VLS_380 = {
            onRematchReferences: (...[$event]) => {
                __VLS_ctx.rematchReferences(field);
            }
        };
        var __VLS_375;
    }
    var __VLS_372;
}
var __VLS_368;
var __VLS_332;
{
    const { footer: __VLS_thisSlot } = __VLS_328.slots;
    const __VLS_381 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_382 = __VLS_asFunctionalComponent(__VLS_381, new __VLS_381({
        ...{ 'onClick': {} },
    }));
    const __VLS_383 = __VLS_382({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_382));
    let __VLS_385;
    let __VLS_386;
    let __VLS_387;
    const __VLS_388 = {
        onClick: (...[$event]) => {
            __VLS_ctx.editorVisible = false;
        }
    };
    __VLS_384.slots.default;
    (__VLS_ctx.t('design.labels.cancel'));
    var __VLS_384;
    const __VLS_389 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_390 = __VLS_asFunctionalComponent(__VLS_389, new __VLS_389({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.saving),
    }));
    const __VLS_391 = __VLS_390({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.saving),
    }, ...__VLS_functionalComponentArgsRest(__VLS_390));
    let __VLS_393;
    let __VLS_394;
    let __VLS_395;
    const __VLS_396 = {
        onClick: (__VLS_ctx.saveEditor)
    };
    __VLS_392.slots.default;
    (__VLS_ctx.t('design.labels.save'));
    var __VLS_392;
}
var __VLS_328;
const __VLS_397 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_398 = __VLS_asFunctionalComponent(__VLS_397, new __VLS_397({
    modelValue: (__VLS_ctx.newSourceBookVisible),
    title: (__VLS_ctx.t('design.labels.newSourceBook')),
    width: "400px",
}));
const __VLS_399 = __VLS_398({
    modelValue: (__VLS_ctx.newSourceBookVisible),
    title: (__VLS_ctx.t('design.labels.newSourceBook')),
    width: "400px",
}, ...__VLS_functionalComponentArgsRest(__VLS_398));
__VLS_400.slots.default;
const __VLS_401 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_402 = __VLS_asFunctionalComponent(__VLS_401, new __VLS_401({}));
const __VLS_403 = __VLS_402({}, ...__VLS_functionalComponentArgsRest(__VLS_402));
__VLS_404.slots.default;
const __VLS_405 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_406 = __VLS_asFunctionalComponent(__VLS_405, new __VLS_405({
    label: (__VLS_ctx.t('design.labels.name')),
    required: true,
}));
const __VLS_407 = __VLS_406({
    label: (__VLS_ctx.t('design.labels.name')),
    required: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_406));
__VLS_408.slots.default;
const __VLS_409 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_410 = __VLS_asFunctionalComponent(__VLS_409, new __VLS_409({
    ...{ 'onKeyup': {} },
    modelValue: (__VLS_ctx.newSourceBookName),
}));
const __VLS_411 = __VLS_410({
    ...{ 'onKeyup': {} },
    modelValue: (__VLS_ctx.newSourceBookName),
}, ...__VLS_functionalComponentArgsRest(__VLS_410));
let __VLS_413;
let __VLS_414;
let __VLS_415;
const __VLS_416 = {
    onKeyup: (__VLS_ctx.quickCreateSourceBook)
};
var __VLS_412;
var __VLS_408;
var __VLS_404;
{
    const { footer: __VLS_thisSlot } = __VLS_400.slots;
    const __VLS_417 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_418 = __VLS_asFunctionalComponent(__VLS_417, new __VLS_417({
        ...{ 'onClick': {} },
    }));
    const __VLS_419 = __VLS_418({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_418));
    let __VLS_421;
    let __VLS_422;
    let __VLS_423;
    const __VLS_424 = {
        onClick: (...[$event]) => {
            __VLS_ctx.newSourceBookVisible = false;
        }
    };
    __VLS_420.slots.default;
    (__VLS_ctx.t('design.labels.cancel'));
    var __VLS_420;
    const __VLS_425 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_426 = __VLS_asFunctionalComponent(__VLS_425, new __VLS_425({
        ...{ 'onClick': {} },
        type: "primary",
    }));
    const __VLS_427 = __VLS_426({
        ...{ 'onClick': {} },
        type: "primary",
    }, ...__VLS_functionalComponentArgsRest(__VLS_426));
    let __VLS_429;
    let __VLS_430;
    let __VLS_431;
    const __VLS_432 = {
        onClick: (__VLS_ctx.quickCreateSourceBook)
    };
    __VLS_428.slots.default;
    (__VLS_ctx.t('design.labels.create'));
    var __VLS_428;
}
var __VLS_400;
const __VLS_433 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_434 = __VLS_asFunctionalComponent(__VLS_433, new __VLS_433({
    modelValue: (__VLS_ctx.bookAnalysisImportVisible),
    title: (__VLS_ctx.t('design.labels.crawlImportTitle')),
    width: "760px",
    closeOnClickModal: (false),
}));
const __VLS_435 = __VLS_434({
    modelValue: (__VLS_ctx.bookAnalysisImportVisible),
    title: (__VLS_ctx.t('design.labels.crawlImportTitle')),
    width: "760px",
    closeOnClickModal: (false),
}, ...__VLS_functionalComponentArgsRest(__VLS_434));
__VLS_436.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "import-panel" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "import-input-row" },
});
const __VLS_437 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_438 = __VLS_asFunctionalComponent(__VLS_437, new __VLS_437({
    ...{ 'onKeyup': {} },
    modelValue: (__VLS_ctx.bookAnalysisImportUrl),
    placeholder: (__VLS_ctx.t('design.labels.bookDetailUrl')),
    clearable: true,
}));
const __VLS_439 = __VLS_438({
    ...{ 'onKeyup': {} },
    modelValue: (__VLS_ctx.bookAnalysisImportUrl),
    placeholder: (__VLS_ctx.t('design.labels.bookDetailUrl')),
    clearable: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_438));
let __VLS_441;
let __VLS_442;
let __VLS_443;
const __VLS_444 = {
    onKeyup: (__VLS_ctx.previewBookAnalysisImport)
};
var __VLS_440;
const __VLS_445 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_446 = __VLS_asFunctionalComponent(__VLS_445, new __VLS_445({
    ...{ 'onClick': {} },
    type: "primary",
    loading: (__VLS_ctx.importingBookAnalysis),
}));
const __VLS_447 = __VLS_446({
    ...{ 'onClick': {} },
    type: "primary",
    loading: (__VLS_ctx.importingBookAnalysis),
}, ...__VLS_functionalComponentArgsRest(__VLS_446));
let __VLS_449;
let __VLS_450;
let __VLS_451;
const __VLS_452 = {
    onClick: (__VLS_ctx.previewBookAnalysisImport)
};
__VLS_448.slots.default;
(__VLS_ctx.t('design.labels.preview'));
var __VLS_448;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "import-file-row" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ onChange: (__VLS_ctx.importBookAnalysisTxt) },
    ref: "bookAnalysisImportFileInput",
    ...{ class: "hidden-file-input" },
    type: "file",
    accept: ".txt,text/plain",
});
/** @type {typeof __VLS_ctx.bookAnalysisImportFileInput} */ ;
const __VLS_453 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_454 = __VLS_asFunctionalComponent(__VLS_453, new __VLS_453({
    ...{ 'onClick': {} },
    loading: (__VLS_ctx.importingBookAnalysis),
}));
const __VLS_455 = __VLS_454({
    ...{ 'onClick': {} },
    loading: (__VLS_ctx.importingBookAnalysis),
}, ...__VLS_functionalComponentArgsRest(__VLS_454));
let __VLS_457;
let __VLS_458;
let __VLS_459;
const __VLS_460 = {
    onClick: (__VLS_ctx.openBookAnalysisTxtPicker)
};
__VLS_456.slots.default;
(__VLS_ctx.t('design.labels.uploadTxt'));
var __VLS_456;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "muted" },
});
(__VLS_ctx.t('design.labels.uploadTxtHint'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "ai-analysis-box" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "ai-analysis-title" },
});
(__VLS_ctx.t('design.labels.aiAnalysis'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "ai-config-grid" },
});
const __VLS_461 = {}.ElSelect;
/** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
// @ts-ignore
const __VLS_462 = __VLS_asFunctionalComponent(__VLS_461, new __VLS_461({
    modelValue: (__VLS_ctx.bookAnalysisAiConfigId),
    placeholder: (__VLS_ctx.t('design.labels.aiProviderConfig')),
    filterable: true,
    size: "small",
}));
const __VLS_463 = __VLS_462({
    modelValue: (__VLS_ctx.bookAnalysisAiConfigId),
    placeholder: (__VLS_ctx.t('design.labels.aiProviderConfig')),
    filterable: true,
    size: "small",
}, ...__VLS_functionalComponentArgsRest(__VLS_462));
__VLS_464.slots.default;
for (const [config] of __VLS_getVForSourceType((__VLS_ctx.bookAnalysisAiConfigs))) {
    const __VLS_465 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_466 = __VLS_asFunctionalComponent(__VLS_465, new __VLS_465({
        key: (config.providerId),
        label: (`${config.name} / ${config.modelCode || '--'}`),
        value: (config.providerId),
    }));
    const __VLS_467 = __VLS_466({
        key: (config.providerId),
        label: (`${config.name} / ${config.modelCode || '--'}`),
        value: (config.providerId),
    }, ...__VLS_functionalComponentArgsRest(__VLS_466));
}
var __VLS_464;
const __VLS_469 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_470 = __VLS_asFunctionalComponent(__VLS_469, new __VLS_469({
    modelValue: (__VLS_ctx.bookAnalysisAiModel),
    placeholder: (__VLS_ctx.t('design.labels.aiModel')),
    size: "small",
    readonly: true,
}));
const __VLS_471 = __VLS_470({
    modelValue: (__VLS_ctx.bookAnalysisAiModel),
    placeholder: (__VLS_ctx.t('design.labels.aiModel')),
    size: "small",
    readonly: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_470));
const __VLS_473 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_474 = __VLS_asFunctionalComponent(__VLS_473, new __VLS_473({
    modelValue: (__VLS_ctx.bookAnalysisAiEndpoint),
    placeholder: (__VLS_ctx.t('design.labels.aiEndpoint')),
    size: "small",
    readonly: true,
}));
const __VLS_475 = __VLS_474({
    modelValue: (__VLS_ctx.bookAnalysisAiEndpoint),
    placeholder: (__VLS_ctx.t('design.labels.aiEndpoint')),
    size: "small",
    readonly: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_474));
const __VLS_477 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_478 = __VLS_asFunctionalComponent(__VLS_477, new __VLS_477({
    modelValue: (__VLS_ctx.selectedBookAnalysisAiConfig?.apiKeyMaskedTail || __VLS_ctx.t('design.labels.aiKeyAuto')),
    placeholder: (__VLS_ctx.t('design.labels.aiKeyAuto')),
    size: "small",
    readonly: true,
}));
const __VLS_479 = __VLS_478({
    modelValue: (__VLS_ctx.selectedBookAnalysisAiConfig?.apiKeyMaskedTail || __VLS_ctx.t('design.labels.aiKeyAuto')),
    placeholder: (__VLS_ctx.t('design.labels.aiKeyAuto')),
    size: "small",
    readonly: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_478));
const __VLS_481 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_482 = __VLS_asFunctionalComponent(__VLS_481, new __VLS_481({
    ...{ 'onClick': {} },
    type: "primary",
    loading: (__VLS_ctx.analyzingBookAnalysis),
    disabled: (!__VLS_ctx.bookAnalysisImportPreview || __VLS_ctx.importingBookAnalysis),
}));
const __VLS_483 = __VLS_482({
    ...{ 'onClick': {} },
    type: "primary",
    loading: (__VLS_ctx.analyzingBookAnalysis),
    disabled: (!__VLS_ctx.bookAnalysisImportPreview || __VLS_ctx.importingBookAnalysis),
}, ...__VLS_functionalComponentArgsRest(__VLS_482));
let __VLS_485;
let __VLS_486;
let __VLS_487;
const __VLS_488 = {
    onClick: (__VLS_ctx.analyzeBookAnalysisWithAi)
};
__VLS_484.slots.default;
(__VLS_ctx.t('design.labels.runAiAnalysis'));
var __VLS_484;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "muted" },
});
(__VLS_ctx.t('design.labels.aiAnalysisHint'));
if (!__VLS_ctx.bookAnalysisImportPreview) {
    const __VLS_489 = {}.ElEmpty;
    /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
    // @ts-ignore
    const __VLS_490 = __VLS_asFunctionalComponent(__VLS_489, new __VLS_489({
        description: (__VLS_ctx.t('design.labels.enterUrlPreviewApply')),
    }));
    const __VLS_491 = __VLS_490({
        description: (__VLS_ctx.t('design.labels.enterUrlPreviewApply')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_490));
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "preview-meta" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "preview-meta-item" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "preview-label" },
    });
    (__VLS_ctx.t('design.labels.sourceUrl'));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "preview-value" },
    });
    (__VLS_ctx.bookAnalysisImportPreview.sourceUrl);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "preview-meta-item" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "preview-label" },
    });
    (__VLS_ctx.t('design.labels.title'));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "preview-value" },
    });
    (__VLS_ctx.bookAnalysisImportPreview.title || __VLS_ctx.t('design.labels.na'));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "preview-meta-item" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "preview-label" },
    });
    (__VLS_ctx.t('design.labels.site'));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "preview-value" },
    });
    (__VLS_ctx.bookAnalysisImportPreview.sourceSite || __VLS_ctx.t('design.labels.na'));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "preview-meta-item" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "preview-label" },
    });
    (__VLS_ctx.t('design.labels.author'));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "preview-value" },
    });
    (__VLS_ctx.bookAnalysisImportPreview.author || __VLS_ctx.t('design.labels.na'));
    const __VLS_493 = {}.ElAlert;
    /** @type {[typeof __VLS_components.ElAlert, typeof __VLS_components.elAlert, typeof __VLS_components.ElAlert, typeof __VLS_components.elAlert, ]} */ ;
    // @ts-ignore
    const __VLS_494 = __VLS_asFunctionalComponent(__VLS_493, new __VLS_493({
        type: "info",
        showIcon: true,
        closable: (false),
        ...{ class: "import-warning" },
    }));
    const __VLS_495 = __VLS_494({
        type: "info",
        showIcon: true,
        closable: (false),
        ...{ class: "import-warning" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_494));
    __VLS_496.slots.default;
    {
        const { title: __VLS_thisSlot } = __VLS_496.slots;
        (__VLS_ctx.t('design.labels.previewSummary'));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "warning-list" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    (__VLS_ctx.t('design.labels.sampleChapters', { count: __VLS_ctx.bookAnalysisImportPreview.chapters.length }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    (__VLS_ctx.t('design.labels.chapterCount', { count: __VLS_ctx.bookAnalysisImportPreview.chapterCount }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    (__VLS_ctx.t('design.labels.totalWords', { count: __VLS_ctx.bookAnalysisImportPreview.totalWordCount }));
    var __VLS_496;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "preview-block" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "preview-block-title" },
    });
    (__VLS_ctx.t('design.labels.summary'));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "preview-excerpt" },
    });
    (__VLS_ctx.bookAnalysisImportPreview.summary || __VLS_ctx.t('design.labels.noSummary'));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "preview-block" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "preview-block-title" },
    });
    (__VLS_ctx.t('design.labels.mappedDraftFields'));
    const __VLS_497 = {}.ElDescriptions;
    /** @type {[typeof __VLS_components.ElDescriptions, typeof __VLS_components.elDescriptions, typeof __VLS_components.ElDescriptions, typeof __VLS_components.elDescriptions, ]} */ ;
    // @ts-ignore
    const __VLS_498 = __VLS_asFunctionalComponent(__VLS_497, new __VLS_497({
        column: (2),
        border: true,
        size: "small",
    }));
    const __VLS_499 = __VLS_498({
        column: (2),
        border: true,
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_498));
    __VLS_500.slots.default;
    const __VLS_501 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_502 = __VLS_asFunctionalComponent(__VLS_501, new __VLS_501({
        label: (__VLS_ctx.t('design.labels.name')),
    }));
    const __VLS_503 = __VLS_502({
        label: (__VLS_ctx.t('design.labels.name')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_502));
    __VLS_504.slots.default;
    (__VLS_ctx.toBookAnalysisDraft(__VLS_ctx.bookAnalysisImportPreview).name);
    var __VLS_504;
    const __VLS_505 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_506 = __VLS_asFunctionalComponent(__VLS_505, new __VLS_505({
        label: (__VLS_ctx.t('design.labels.sourceUrl')),
    }));
    const __VLS_507 = __VLS_506({
        label: (__VLS_ctx.t('design.labels.sourceUrl')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_506));
    __VLS_508.slots.default;
    (__VLS_ctx.toBookAnalysisDraft(__VLS_ctx.bookAnalysisImportPreview).sourceUrl || __VLS_ctx.t('design.labels.na'));
    var __VLS_508;
    const __VLS_509 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_510 = __VLS_asFunctionalComponent(__VLS_509, new __VLS_509({
        label: (__VLS_ctx.t('design.labels.title')),
    }));
    const __VLS_511 = __VLS_510({
        label: (__VLS_ctx.t('design.labels.title')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_510));
    __VLS_512.slots.default;
    (__VLS_ctx.toBookAnalysisDraft(__VLS_ctx.bookAnalysisImportPreview).sourceBookTitle || __VLS_ctx.t('design.labels.na'));
    var __VLS_512;
    const __VLS_513 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_514 = __VLS_asFunctionalComponent(__VLS_513, new __VLS_513({
        label: (__VLS_ctx.t('design.labels.author')),
    }));
    const __VLS_515 = __VLS_514({
        label: (__VLS_ctx.t('design.labels.author')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_514));
    __VLS_516.slots.default;
    (__VLS_ctx.toBookAnalysisDraft(__VLS_ctx.bookAnalysisImportPreview).sourceAuthor || __VLS_ctx.t('design.labels.na'));
    var __VLS_516;
    const __VLS_517 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_518 = __VLS_asFunctionalComponent(__VLS_517, new __VLS_517({
        label: (__VLS_ctx.t('design.labels.genre')),
    }));
    const __VLS_519 = __VLS_518({
        label: (__VLS_ctx.t('design.labels.genre')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_518));
    __VLS_520.slots.default;
    (__VLS_ctx.toBookAnalysisDraft(__VLS_ctx.bookAnalysisImportPreview).sourceGenre || __VLS_ctx.t('design.labels.na'));
    var __VLS_520;
    const __VLS_521 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_522 = __VLS_asFunctionalComponent(__VLS_521, new __VLS_521({
        label: (__VLS_ctx.t('design.labels.chapterCount', { count: '' })),
    }));
    const __VLS_523 = __VLS_522({
        label: (__VLS_ctx.t('design.labels.chapterCount', { count: '' })),
    }, ...__VLS_functionalComponentArgsRest(__VLS_522));
    __VLS_524.slots.default;
    (__VLS_ctx.toBookAnalysisDraft(__VLS_ctx.bookAnalysisImportPreview).chapterCount ?? 0);
    var __VLS_524;
    var __VLS_500;
}
{
    const { footer: __VLS_thisSlot } = __VLS_436.slots;
    const __VLS_525 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_526 = __VLS_asFunctionalComponent(__VLS_525, new __VLS_525({
        ...{ 'onClick': {} },
    }));
    const __VLS_527 = __VLS_526({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_526));
    let __VLS_529;
    let __VLS_530;
    let __VLS_531;
    const __VLS_532 = {
        onClick: (...[$event]) => {
            __VLS_ctx.bookAnalysisImportVisible = false;
        }
    };
    __VLS_528.slots.default;
    (__VLS_ctx.t('design.labels.close'));
    var __VLS_528;
    const __VLS_533 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_534 = __VLS_asFunctionalComponent(__VLS_533, new __VLS_533({
        ...{ 'onClick': {} },
        type: "primary",
        plain: true,
        disabled: (!__VLS_ctx.bookAnalysisImportPreview),
    }));
    const __VLS_535 = __VLS_534({
        ...{ 'onClick': {} },
        type: "primary",
        plain: true,
        disabled: (!__VLS_ctx.bookAnalysisImportPreview),
    }, ...__VLS_functionalComponentArgsRest(__VLS_534));
    let __VLS_537;
    let __VLS_538;
    let __VLS_539;
    const __VLS_540 = {
        onClick: (...[$event]) => {
            __VLS_ctx.applyImportedBookAnalysis('current');
        }
    };
    __VLS_536.slots.default;
    (__VLS_ctx.t('design.labels.applyToCurrent'));
    var __VLS_536;
    const __VLS_541 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_542 = __VLS_asFunctionalComponent(__VLS_541, new __VLS_541({
        ...{ 'onClick': {} },
        type: "primary",
        disabled: (!__VLS_ctx.bookAnalysisImportPreview),
    }));
    const __VLS_543 = __VLS_542({
        ...{ 'onClick': {} },
        type: "primary",
        disabled: (!__VLS_ctx.bookAnalysisImportPreview),
    }, ...__VLS_functionalComponentArgsRest(__VLS_542));
    let __VLS_545;
    let __VLS_546;
    let __VLS_547;
    const __VLS_548 = {
        onClick: (...[$event]) => {
            __VLS_ctx.applyImportedBookAnalysis('new');
        }
    };
    __VLS_544.slots.default;
    (__VLS_ctx.t('design.labels.newDraft'));
    var __VLS_544;
}
var __VLS_436;
/** @type {__VLS_StyleScopedClasses['design-view']} */ ;
/** @type {__VLS_StyleScopedClasses['header-card']} */ ;
/** @type {__VLS_StyleScopedClasses['header-row']} */ ;
/** @type {__VLS_StyleScopedClasses['module-tabs']} */ ;
/** @type {__VLS_StyleScopedClasses['module-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['icon']} */ ;
/** @type {__VLS_StyleScopedClasses['sourcebook-area']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['main-layout']} */ ;
/** @type {__VLS_StyleScopedClasses['tree-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-head']} */ ;
/** @type {__VLS_StyleScopedClasses['head-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['tree-body']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['cat-item']} */ ;
/** @type {__VLS_StyleScopedClasses['all']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['cat-node']} */ ;
/** @type {__VLS_StyleScopedClasses['cat-name']} */ ;
/** @type {__VLS_StyleScopedClasses['cat-count']} */ ;
/** @type {__VLS_StyleScopedClasses['cat-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['list-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-head']} */ ;
/** @type {__VLS_StyleScopedClasses['head-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['failure-reason']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['pager-row']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['editor-ai-failure']} */ ;
/** @type {__VLS_StyleScopedClasses['editor-tabs']} */ ;
/** @type {__VLS_StyleScopedClasses['import-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['import-input-row']} */ ;
/** @type {__VLS_StyleScopedClasses['import-file-row']} */ ;
/** @type {__VLS_StyleScopedClasses['hidden-file-input']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['ai-analysis-box']} */ ;
/** @type {__VLS_StyleScopedClasses['ai-analysis-title']} */ ;
/** @type {__VLS_StyleScopedClasses['ai-config-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-meta']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-meta-item']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-label']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-value']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-meta-item']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-label']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-value']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-meta-item']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-label']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-value']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-meta-item']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-label']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-value']} */ ;
/** @type {__VLS_StyleScopedClasses['import-warning']} */ ;
/** @type {__VLS_StyleScopedClasses['warning-list']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-block']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-block-title']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-excerpt']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-block']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-block-title']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Delete: Delete,
            Edit: Edit,
            FolderAdd: FolderAdd,
            MagicStick: MagicStick,
            Plus: Plus,
            Refresh: Refresh,
            Search: Search,
            DESIGN_MODULES: DESIGN_MODULES,
            DesignFormField: DesignFormField,
            workContext: workContext,
            t: t,
            moduleKey: moduleKey,
            moduleMeta: moduleMeta,
            schema: schema,
            localizedModuleLabel: localizedModuleLabel,
            canRegenerateFromNovelSeed: canRegenerateFromNovelSeed,
            optionsFor: optionsFor,
            invalidReferenceMessage: invalidReferenceMessage,
            clearInvalidReferences: clearInvalidReferences,
            rematchReferences: rematchReferences,
            sourceBooks: sourceBooks,
            selectedSourceBookId: selectedSourceBookId,
            newSourceBookVisible: newSourceBookVisible,
            newSourceBookName: newSourceBookName,
            quickCreateSourceBook: quickCreateSourceBook,
            bindSourceBookToProject: bindSourceBookToProject,
            goNovelSeedRegenerate: goNovelSeedRegenerate,
            rewriteChapterPlanSummaries: rewriteChapterPlanSummaries,
            categoryTree: categoryTree,
            loadingCategories: loadingCategories,
            selectedCategoryId: selectedCategoryId,
            refreshCategories: refreshCategories,
            categoryDialogVisible: categoryDialogVisible,
            categoryDialogMode: categoryDialogMode,
            categoryForm: categoryForm,
            categoryParentOptions: categoryParentOptions,
            openCreateCategory: openCreateCategory,
            openEditCategory: openEditCategory,
            saveCategory: saveCategory,
            removeCategory: removeCategory,
            saveCategoryOrder: saveCategoryOrder,
            items: items,
            loadingItems: loadingItems,
            backgroundAnalyzingId: backgroundAnalyzingId,
            generatingCreativeMaterialId: generatingCreativeMaterialId,
            buildingSkeletonId: buildingSkeletonId,
            rewritingChapterPlanSummaries: rewritingChapterPlanSummaries,
            keyword: keyword,
            isEnabledFilter: isEnabledFilter,
            includeUncategorized: includeUncategorized,
            updatedRange: updatedRange,
            page: page,
            pageSize: pageSize,
            total: total,
            refreshItems: refreshItems,
            editorVisible: editorVisible,
            editorMode: editorMode,
            editorForm: editorForm,
            editorTab: editorTab,
            saving: saving,
            openCreate: openCreate,
            openEdit: openEdit,
            saveEditor: saveEditor,
            removeItem: removeItem,
            isBackgroundAiBusy: isBackgroundAiBusy,
            getBackgroundAiStatusTagType: getBackgroundAiStatusTagType,
            getBackgroundAiStatusLabel: getBackgroundAiStatusLabel,
            getBackgroundAiFailureReason: getBackgroundAiFailureReason,
            queueBookAnalysisBackgroundAi: queueBookAnalysisBackgroundAi,
            createCreativeMaterialFromBookAnalysis: createCreativeMaterialFromBookAnalysis,
            buildSkeletonFromCreativeMaterial: buildSkeletonFromCreativeMaterial,
            formatCellValue: formatCellValue,
            bookAnalysisImportVisible: bookAnalysisImportVisible,
            importingBookAnalysis: importingBookAnalysis,
            bookAnalysisImportUrl: bookAnalysisImportUrl,
            bookAnalysisImportPreview: bookAnalysisImportPreview,
            bookAnalysisImportFileInput: bookAnalysisImportFileInput,
            analyzingBookAnalysis: analyzingBookAnalysis,
            bookAnalysisAiConfigs: bookAnalysisAiConfigs,
            bookAnalysisAiConfigId: bookAnalysisAiConfigId,
            bookAnalysisAiModel: bookAnalysisAiModel,
            bookAnalysisAiEndpoint: bookAnalysisAiEndpoint,
            selectedBookAnalysisAiConfig: selectedBookAnalysisAiConfig,
            openBookAnalysisImport: openBookAnalysisImport,
            previewBookAnalysisImport: previewBookAnalysisImport,
            openBookAnalysisTxtPicker: openBookAnalysisTxtPicker,
            importBookAnalysisTxt: importBookAnalysisTxt,
            analyzeBookAnalysisWithAi: analyzeBookAnalysisWithAi,
            toBookAnalysisDraft: toBookAnalysisDraft,
            applyImportedBookAnalysis: applyImportedBookAnalysis,
            switchModule: switchModule,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
