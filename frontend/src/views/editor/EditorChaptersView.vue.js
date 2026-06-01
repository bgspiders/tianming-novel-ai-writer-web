import { computed, onMounted, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { Search, RefreshRight, Connection, EditPen, Clock } from '@element-plus/icons-vue';
import { chaptersApi } from '@/api/modules/chapters';
import { listSourceBooks } from '@/api/modules/sourceBooks';
import MonacoMarkdownEditor from '@/components/editor/MonacoMarkdownEditor.vue';
import { useI18n } from '@/composables/useI18n';
const markdownModuleName = 'markdown-it';
const diff2htmlModuleName = 'diff2html';
const { t } = useI18n();
const loading = ref(false);
const detailLoading = ref(false);
const saving = ref(false);
const recalling = ref(false);
const versionsLoading = ref(false);
const restoringVersion = ref(false);
const keyword = ref('');
const selectedSourceBookId = ref('');
const chapters = ref([]);
const sourceBooks = ref([]);
const selectedChapterId = ref('');
const chapterDetail = ref(null);
const editorContent = ref('');
const lastSavedContent = ref('');
const activeTab = ref('write');
const recallQuery = ref('');
const recallResults = ref([]);
const recallQuerySource = ref('');
const monacoFallback = ref(false);
const markdownFallback = ref(false);
const diffFallback = ref(true);
const diffHtml = ref('');
const versions = ref([]);
const selectedVersionId = ref('');
const selectedVersionDetail = ref(null);
const markdownRenderer = ref((value) => fallbackMarkdownRender(value));
const selectedChapter = computed(() => chapters.value.find((item) => item.id === selectedChapterId.value) ?? null);
const previewHtml = computed(() => markdownRenderer.value(editorContent.value || ''));
const hasUnsavedChanges = computed(() => editorContent.value !== lastSavedContent.value);
const diffBaseContent = computed(() => selectedVersionDetail.value?.content ?? lastSavedContent.value);
const restoreDisabled = computed(() => !selectedVersionId.value);
const diffLines = computed(() => {
    const beforeLines = diffBaseContent.value.split(/\r?\n/);
    const afterLines = editorContent.value.split(/\r?\n/);
    const max = Math.max(beforeLines.length, afterLines.length);
    return Array.from({ length: max }, (_, index) => {
        const before = beforeLines[index] ?? '';
        const after = afterLines[index] ?? '';
        let type = 'same';
        if (!before && after)
            type = 'added';
        else if (before && !after)
            type = 'removed';
        else if (before !== after)
            type = 'changed';
        return {
            line: index + 1,
            before,
            after,
            type
        };
    }).filter((item) => item.type !== 'same');
});
function escapeHtml(value) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}
function fallbackMarkdownRender(value) {
    if (!value)
        return '';
    return escapeHtml(value).replaceAll('\n', '<br />');
}
function buildUnifiedDiff(before, after) {
    const beforeLines = before.split(/\r?\n/);
    const afterLines = after.split(/\r?\n/);
    const chunks = [
        '--- 基准版本.md',
        '+++ 当前编辑.md',
        `@@ -1,${Math.max(beforeLines.length, 1)} +1,${Math.max(afterLines.length, 1)} @@`
    ];
    const total = Math.max(beforeLines.length, afterLines.length);
    for (let index = 0; index < total; index++) {
        const oldLine = beforeLines[index];
        const newLine = afterLines[index];
        if (oldLine === newLine) {
            if (oldLine !== undefined)
                chunks.push(` ${oldLine}`);
            continue;
        }
        if (oldLine !== undefined)
            chunks.push(`-${oldLine}`);
        if (newLine !== undefined)
            chunks.push(`+${newLine}`);
    }
    return chunks.join('\n');
}
function formatTime(value) {
    if (!value)
        return t('editor.labels.unknownTime');
    const time = new Date(value);
    if (Number.isNaN(time.getTime()))
        return value;
    return time.toLocaleString('zh-CN', { hour12: false });
}
function formatSize(size) {
    if (size < 1024)
        return t('editor.labels.sizeBytes', { size });
    if (size < 1024 * 1024)
        return t('editor.labels.sizeKilobytes', { size: (size / 1024).toFixed(1) });
    return t('editor.labels.sizeMegabytes', { size: (size / 1024 / 1024).toFixed(1) });
}
async function loadOptionalMarkdown() {
    try {
        const markdownModule = await import(/* @vite-ignore */ markdownModuleName);
        const MarkdownIt = markdownModule.default;
        const renderer = new MarkdownIt({
            html: false,
            linkify: true,
            breaks: true
        });
        markdownRenderer.value = (value) => renderer.render(value);
    }
    catch {
        markdownFallback.value = true;
    }
}
async function renderOptionalDiff() {
    try {
        const diff2htmlModule = await import(/* @vite-ignore */ diff2htmlModuleName);
        const html = diff2htmlModule.html(buildUnifiedDiff(diffBaseContent.value, editorContent.value), {
            drawFileList: false,
            matching: 'lines',
            outputFormat: 'side-by-side'
        });
        diffHtml.value = html;
        diffFallback.value = false;
    }
    catch {
        diffFallback.value = true;
        diffHtml.value = '';
    }
}
async function loadSourceBooks() {
    try {
        sourceBooks.value = await listSourceBooks();
    }
    catch (error) {
        ElMessage.error(error instanceof Error ? error.message : t('editor.messages.loadSourceBooksFailed'));
    }
}
async function loadChapters() {
    loading.value = true;
    try {
        chapters.value = await chaptersApi.list({
            sourceBookId: selectedSourceBookId.value || null,
            keyword: keyword.value || null
        });
        if (!chapters.value.length) {
            selectedChapterId.value = '';
            chapterDetail.value = null;
            editorContent.value = '';
            lastSavedContent.value = '';
            recallResults.value = [];
            versions.value = [];
            selectedVersionId.value = '';
            selectedVersionDetail.value = null;
            diffHtml.value = '';
            return;
        }
        const nextId = chapters.value.some((item) => item.id === selectedChapterId.value)
            ? selectedChapterId.value
            : chapters.value[0].id;
        if (nextId === selectedChapterId.value) {
            await loadChapterDetail(nextId);
        }
        else {
            selectedChapterId.value = nextId;
        }
    }
    catch (error) {
        ElMessage.error(error instanceof Error ? error.message : t('editor.messages.loadChaptersFailed'));
    }
    finally {
        loading.value = false;
    }
}
async function loadChapterDetail(id) {
    if (!id)
        return;
    detailLoading.value = true;
    try {
        const detail = await chaptersApi.get(id);
        chapterDetail.value = detail;
        editorContent.value = detail.content;
        lastSavedContent.value = detail.content;
        recallQuery.value = detail.title;
        recallResults.value = [];
        await loadVersions(id);
    }
    catch (error) {
        ElMessage.error(error instanceof Error ? error.message : t('editor.messages.loadChapterDetailFailed'));
    }
    finally {
        detailLoading.value = false;
    }
}
async function loadVersions(id) {
    versionsLoading.value = true;
    try {
        versions.value = await chaptersApi.versions(id);
        if (!versions.value.length) {
            selectedVersionId.value = '';
            selectedVersionDetail.value = null;
            diffHtml.value = '';
            return;
        }
        const currentSelected = versions.value.find((item) => item.versionId === selectedVersionId.value);
        selectedVersionId.value = currentSelected?.versionId ?? versions.value[0].versionId;
        await loadVersionDetail();
    }
    catch (error) {
        versions.value = [];
        selectedVersionId.value = '';
        selectedVersionDetail.value = null;
        ElMessage.error(error instanceof Error ? error.message : t('editor.messages.loadVersionsFailed'));
    }
    finally {
        versionsLoading.value = false;
    }
}
async function loadVersionDetail() {
    if (!selectedChapterId.value || !selectedVersionId.value) {
        selectedVersionDetail.value = null;
        return;
    }
    try {
        selectedVersionDetail.value = await chaptersApi.version(selectedChapterId.value, selectedVersionId.value);
        if (activeTab.value === 'diff') {
            await renderOptionalDiff();
        }
    }
    catch (error) {
        selectedVersionDetail.value = null;
        ElMessage.error(error instanceof Error ? error.message : t('editor.messages.loadVersionDetailFailed'));
    }
}
async function saveContent() {
    if (!selectedChapterId.value)
        return;
    saving.value = true;
    try {
        const detail = await chaptersApi.saveContent(selectedChapterId.value, { content: editorContent.value });
        chapterDetail.value = detail;
        lastSavedContent.value = detail.content;
        const index = chapters.value.findIndex((item) => item.id === detail.id);
        if (index >= 0) {
            chapters.value[index] = { ...chapters.value[index], ...detail };
        }
        await loadVersions(selectedChapterId.value);
        ElMessage.success(t('editor.messages.contentSaved'));
    }
    catch (error) {
        ElMessage.error(error instanceof Error ? error.message : t('editor.messages.saveContentFailed'));
    }
    finally {
        saving.value = false;
    }
}
async function restoreSelectedVersion() {
    if (!selectedChapterId.value || !selectedVersionId.value)
        return;
    restoringVersion.value = true;
    try {
        const detail = await chaptersApi.restoreVersion(selectedChapterId.value, {
            versionId: selectedVersionId.value
        });
        chapterDetail.value = detail;
        editorContent.value = detail.content;
        lastSavedContent.value = detail.content;
        const index = chapters.value.findIndex((item) => item.id === detail.id);
        if (index >= 0) {
            chapters.value[index] = { ...chapters.value[index], ...detail };
        }
        await loadVersions(selectedChapterId.value);
        activeTab.value = 'write';
        ElMessage.success(t('editor.messages.versionRestored'));
    }
    catch (error) {
        ElMessage.error(error instanceof Error ? error.message : t('editor.messages.restoreVersionFailed'));
    }
    finally {
        restoringVersion.value = false;
    }
}
async function runRecall() {
    if (!selectedChapterId.value)
        return;
    recalling.value = true;
    try {
        const response = await chaptersApi.recall(selectedChapterId.value, {
            query: recallQuery.value || null,
            topK: 6
        });
        recallResults.value = response.results;
        recallQuerySource.value = response.querySource;
        activeTab.value = 'recall';
    }
    catch (error) {
        ElMessage.error(error instanceof Error ? error.message : t('editor.messages.loadRecallFailed'));
    }
    finally {
        recalling.value = false;
    }
}
function onMonacoFallback() {
    monacoFallback.value = true;
}
watch(selectedChapterId, (id, previousId) => {
    if (!id || id === previousId)
        return;
    void loadChapterDetail(id);
});
watch(selectedVersionId, (id, previousId) => {
    if (!id || id === previousId)
        return;
    void loadVersionDetail();
});
watch(() => [diffBaseContent.value, editorContent.value, activeTab.value], ([, , tab]) => {
    if (tab === 'diff') {
        void renderOptionalDiff();
    }
});
onMounted(async () => {
    await loadOptionalMarkdown();
    await Promise.all([loadSourceBooks(), loadChapters()]);
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['chapter-item']} */ ;
/** @type {__VLS_StyleScopedClasses['chapter-item']} */ ;
/** @type {__VLS_StyleScopedClasses['history-item']} */ ;
/** @type {__VLS_StyleScopedClasses['history-item']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['editor-meta']} */ ;
/** @type {__VLS_StyleScopedClasses['history-item-meta']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-pane']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-pane']} */ ;
/** @type {__VLS_StyleScopedClasses['diff-toolbar']} */ ;
/** @type {__VLS_StyleScopedClasses['diff-row']} */ ;
/** @type {__VLS_StyleScopedClasses['diff-line']} */ ;
/** @type {__VLS_StyleScopedClasses['diff-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['diff-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['diff-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['diff-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['workspace']} */ ;
/** @type {__VLS_StyleScopedClasses['history-layout']} */ ;
/** @type {__VLS_StyleScopedClasses['chapter-list']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "editor-view" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "toolbar" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "toolbar-left" },
});
const __VLS_0 = {}.ElSelect;
/** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.selectedSourceBookId),
    clearable: true,
    placeholder: (__VLS_ctx.t('editor.placeholders.filterBySourceBook')),
    ...{ style: {} },
}));
const __VLS_2 = __VLS_1({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.selectedSourceBookId),
    clearable: true,
    placeholder: (__VLS_ctx.t('editor.placeholders.filterBySourceBook')),
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
let __VLS_4;
let __VLS_5;
let __VLS_6;
const __VLS_7 = {
    onChange: (__VLS_ctx.loadChapters)
};
__VLS_3.slots.default;
for (const [book] of __VLS_getVForSourceType((__VLS_ctx.sourceBooks))) {
    const __VLS_8 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
        key: (book.id),
        label: (book.name),
        value: (book.id),
    }));
    const __VLS_10 = __VLS_9({
        key: (book.id),
        label: (book.name),
        value: (book.id),
    }, ...__VLS_functionalComponentArgsRest(__VLS_9));
}
var __VLS_3;
const __VLS_12 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
    ...{ 'onKeyup': {} },
    ...{ 'onClear': {} },
    modelValue: (__VLS_ctx.keyword),
    placeholder: (__VLS_ctx.t('editor.placeholders.searchKeyword')),
    clearable: true,
    ...{ style: {} },
    prefixIcon: (__VLS_ctx.Search),
}));
const __VLS_14 = __VLS_13({
    ...{ 'onKeyup': {} },
    ...{ 'onClear': {} },
    modelValue: (__VLS_ctx.keyword),
    placeholder: (__VLS_ctx.t('editor.placeholders.searchKeyword')),
    clearable: true,
    ...{ style: {} },
    prefixIcon: (__VLS_ctx.Search),
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
let __VLS_16;
let __VLS_17;
let __VLS_18;
const __VLS_19 = {
    onKeyup: (__VLS_ctx.loadChapters)
};
const __VLS_20 = {
    onClear: (__VLS_ctx.loadChapters)
};
var __VLS_15;
const __VLS_21 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_22 = __VLS_asFunctionalComponent(__VLS_21, new __VLS_21({
    ...{ 'onClick': {} },
    icon: (__VLS_ctx.RefreshRight),
}));
const __VLS_23 = __VLS_22({
    ...{ 'onClick': {} },
    icon: (__VLS_ctx.RefreshRight),
}, ...__VLS_functionalComponentArgsRest(__VLS_22));
let __VLS_25;
let __VLS_26;
let __VLS_27;
const __VLS_28 = {
    onClick: (__VLS_ctx.loadChapters)
};
__VLS_24.slots.default;
(__VLS_ctx.t('editor.actions.refresh'));
var __VLS_24;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "toolbar-right" },
});
if (__VLS_ctx.monacoFallback) {
    const __VLS_29 = {}.ElTag;
    /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
    // @ts-ignore
    const __VLS_30 = __VLS_asFunctionalComponent(__VLS_29, new __VLS_29({
        type: "warning",
        effect: "plain",
    }));
    const __VLS_31 = __VLS_30({
        type: "warning",
        effect: "plain",
    }, ...__VLS_functionalComponentArgsRest(__VLS_30));
    __VLS_32.slots.default;
    (__VLS_ctx.t('editor.hints.monacoFallback'));
    var __VLS_32;
}
if (__VLS_ctx.markdownFallback) {
    const __VLS_33 = {}.ElTag;
    /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
    // @ts-ignore
    const __VLS_34 = __VLS_asFunctionalComponent(__VLS_33, new __VLS_33({
        type: "info",
        effect: "plain",
    }));
    const __VLS_35 = __VLS_34({
        type: "info",
        effect: "plain",
    }, ...__VLS_functionalComponentArgsRest(__VLS_34));
    __VLS_36.slots.default;
    (__VLS_ctx.t('editor.hints.markdownFallback'));
    var __VLS_36;
}
const __VLS_37 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_38 = __VLS_asFunctionalComponent(__VLS_37, new __VLS_37({
    ...{ 'onClick': {} },
    type: "success",
    icon: (__VLS_ctx.Connection),
    loading: (__VLS_ctx.recalling),
    disabled: (!__VLS_ctx.selectedChapterId),
}));
const __VLS_39 = __VLS_38({
    ...{ 'onClick': {} },
    type: "success",
    icon: (__VLS_ctx.Connection),
    loading: (__VLS_ctx.recalling),
    disabled: (!__VLS_ctx.selectedChapterId),
}, ...__VLS_functionalComponentArgsRest(__VLS_38));
let __VLS_41;
let __VLS_42;
let __VLS_43;
const __VLS_44 = {
    onClick: (__VLS_ctx.runRecall)
};
__VLS_40.slots.default;
(__VLS_ctx.t('editor.actions.runRecall'));
var __VLS_40;
const __VLS_45 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_46 = __VLS_asFunctionalComponent(__VLS_45, new __VLS_45({
    ...{ 'onClick': {} },
    type: "primary",
    icon: (__VLS_ctx.EditPen),
    loading: (__VLS_ctx.saving),
    disabled: (!__VLS_ctx.selectedChapterId || !__VLS_ctx.hasUnsavedChanges),
}));
const __VLS_47 = __VLS_46({
    ...{ 'onClick': {} },
    type: "primary",
    icon: (__VLS_ctx.EditPen),
    loading: (__VLS_ctx.saving),
    disabled: (!__VLS_ctx.selectedChapterId || !__VLS_ctx.hasUnsavedChanges),
}, ...__VLS_functionalComponentArgsRest(__VLS_46));
let __VLS_49;
let __VLS_50;
let __VLS_51;
const __VLS_52 = {
    onClick: (__VLS_ctx.saveContent)
};
__VLS_48.slots.default;
(__VLS_ctx.t('editor.actions.saveContent'));
var __VLS_48;
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "workspace" },
});
const __VLS_53 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_54 = __VLS_asFunctionalComponent(__VLS_53, new __VLS_53({
    ...{ class: "chapter-list-card" },
    shadow: "never",
}));
const __VLS_55 = __VLS_54({
    ...{ class: "chapter-list-card" },
    shadow: "never",
}, ...__VLS_functionalComponentArgsRest(__VLS_54));
__VLS_56.slots.default;
{
    const { header: __VLS_thisSlot } = __VLS_56.slots;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "card-header" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.t('editor.labels.chapterList'));
    const __VLS_57 = {}.ElTag;
    /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
    // @ts-ignore
    const __VLS_58 = __VLS_asFunctionalComponent(__VLS_57, new __VLS_57({
        type: "info",
        effect: "plain",
    }));
    const __VLS_59 = __VLS_58({
        type: "info",
        effect: "plain",
    }, ...__VLS_functionalComponentArgsRest(__VLS_58));
    __VLS_60.slots.default;
    (__VLS_ctx.chapters.length);
    var __VLS_60;
}
const __VLS_61 = {}.ElSkeleton;
/** @type {[typeof __VLS_components.ElSkeleton, typeof __VLS_components.elSkeleton, typeof __VLS_components.ElSkeleton, typeof __VLS_components.elSkeleton, ]} */ ;
// @ts-ignore
const __VLS_62 = __VLS_asFunctionalComponent(__VLS_61, new __VLS_61({
    rows: (8),
    animated: true,
    loading: (__VLS_ctx.loading),
}));
const __VLS_63 = __VLS_62({
    rows: (8),
    animated: true,
    loading: (__VLS_ctx.loading),
}, ...__VLS_functionalComponentArgsRest(__VLS_62));
__VLS_64.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "chapter-list" },
});
for (const [chapter] of __VLS_getVForSourceType((__VLS_ctx.chapters))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.selectedChapterId = chapter.id;
            } },
        key: (chapter.id),
        ...{ class: "chapter-item" },
        ...{ class: ({ active: chapter.id === __VLS_ctx.selectedChapterId }) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "chapter-item-top" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "chapter-index" },
    });
    (__VLS_ctx.t('editor.labels.chapterNumber', { number: chapter.chapterNumber }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "chapter-status" },
    });
    (chapter.status);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "chapter-title" },
    });
    (chapter.title);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "chapter-summary" },
    });
    (chapter.summary || __VLS_ctx.t('editor.empty.noSummary'));
}
var __VLS_64;
var __VLS_56;
const __VLS_65 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_66 = __VLS_asFunctionalComponent(__VLS_65, new __VLS_65({
    ...{ class: "editor-card" },
    shadow: "never",
}));
const __VLS_67 = __VLS_66({
    ...{ class: "editor-card" },
    shadow: "never",
}, ...__VLS_functionalComponentArgsRest(__VLS_66));
__VLS_68.slots.default;
{
    const { header: __VLS_thisSlot } = __VLS_68.slots;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "card-header" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "editor-title" },
    });
    (__VLS_ctx.selectedChapter?.title || __VLS_ctx.t('editor.empty.noChapterSelected'));
    if (__VLS_ctx.chapterDetail) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "editor-meta" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.chapterDetail.projectName || __VLS_ctx.chapterDetail.projectId);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.t('editor.labels.volumeNumber', { number: __VLS_ctx.chapterDetail.volumeNumber }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.t('editor.labels.wordCount', { count: __VLS_ctx.chapterDetail.wordCount }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.chapterDetail.status);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.formatTime(__VLS_ctx.chapterDetail.updatedAt));
    }
    const __VLS_69 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_70 = __VLS_asFunctionalComponent(__VLS_69, new __VLS_69({
        modelValue: (__VLS_ctx.recallQuery),
        placeholder: (__VLS_ctx.t('editor.placeholders.recallQuery')),
        clearable: true,
        ...{ style: {} },
    }));
    const __VLS_71 = __VLS_70({
        modelValue: (__VLS_ctx.recallQuery),
        placeholder: (__VLS_ctx.t('editor.placeholders.recallQuery')),
        clearable: true,
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_70));
}
if (!__VLS_ctx.selectedChapterId) {
    const __VLS_73 = {}.ElEmpty;
    /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
    // @ts-ignore
    const __VLS_74 = __VLS_asFunctionalComponent(__VLS_73, new __VLS_73({
        description: (__VLS_ctx.t('editor.empty.selectChapterFirst')),
    }));
    const __VLS_75 = __VLS_74({
        description: (__VLS_ctx.t('editor.empty.selectChapterFirst')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_74));
}
else {
    const __VLS_77 = {}.ElSkeleton;
    /** @type {[typeof __VLS_components.ElSkeleton, typeof __VLS_components.elSkeleton, typeof __VLS_components.ElSkeleton, typeof __VLS_components.elSkeleton, ]} */ ;
    // @ts-ignore
    const __VLS_78 = __VLS_asFunctionalComponent(__VLS_77, new __VLS_77({
        rows: (10),
        animated: true,
        loading: (__VLS_ctx.detailLoading),
    }));
    const __VLS_79 = __VLS_78({
        rows: (10),
        animated: true,
        loading: (__VLS_ctx.detailLoading),
    }, ...__VLS_functionalComponentArgsRest(__VLS_78));
    __VLS_80.slots.default;
    const __VLS_81 = {}.ElTabs;
    /** @type {[typeof __VLS_components.ElTabs, typeof __VLS_components.elTabs, typeof __VLS_components.ElTabs, typeof __VLS_components.elTabs, ]} */ ;
    // @ts-ignore
    const __VLS_82 = __VLS_asFunctionalComponent(__VLS_81, new __VLS_81({
        modelValue: (__VLS_ctx.activeTab),
        ...{ class: "editor-tabs" },
    }));
    const __VLS_83 = __VLS_82({
        modelValue: (__VLS_ctx.activeTab),
        ...{ class: "editor-tabs" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_82));
    __VLS_84.slots.default;
    const __VLS_85 = {}.ElTabPane;
    /** @type {[typeof __VLS_components.ElTabPane, typeof __VLS_components.elTabPane, typeof __VLS_components.ElTabPane, typeof __VLS_components.elTabPane, ]} */ ;
    // @ts-ignore
    const __VLS_86 = __VLS_asFunctionalComponent(__VLS_85, new __VLS_85({
        label: (__VLS_ctx.t('editor.tabs.write')),
        name: "write",
    }));
    const __VLS_87 = __VLS_86({
        label: (__VLS_ctx.t('editor.tabs.write')),
        name: "write",
    }, ...__VLS_functionalComponentArgsRest(__VLS_86));
    __VLS_88.slots.default;
    /** @type {[typeof MonacoMarkdownEditor, ]} */ ;
    // @ts-ignore
    const __VLS_89 = __VLS_asFunctionalComponent(MonacoMarkdownEditor, new MonacoMarkdownEditor({
        ...{ 'onFallback': {} },
        modelValue: (__VLS_ctx.editorContent),
        height: "58vh",
        placeholder: (__VLS_ctx.t('editor.placeholders.editorContent')),
    }));
    const __VLS_90 = __VLS_89({
        ...{ 'onFallback': {} },
        modelValue: (__VLS_ctx.editorContent),
        height: "58vh",
        placeholder: (__VLS_ctx.t('editor.placeholders.editorContent')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_89));
    let __VLS_92;
    let __VLS_93;
    let __VLS_94;
    const __VLS_95 = {
        onFallback: (__VLS_ctx.onMonacoFallback)
    };
    var __VLS_91;
    var __VLS_88;
    const __VLS_96 = {}.ElTabPane;
    /** @type {[typeof __VLS_components.ElTabPane, typeof __VLS_components.elTabPane, typeof __VLS_components.ElTabPane, typeof __VLS_components.elTabPane, ]} */ ;
    // @ts-ignore
    const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
        label: (__VLS_ctx.t('editor.tabs.preview')),
        name: "preview",
    }));
    const __VLS_98 = __VLS_97({
        label: (__VLS_ctx.t('editor.tabs.preview')),
        name: "preview",
    }, ...__VLS_functionalComponentArgsRest(__VLS_97));
    __VLS_99.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "preview-pane" },
    });
    __VLS_asFunctionalDirective(__VLS_directives.vHtml)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.previewHtml) }, null, null);
    var __VLS_99;
    const __VLS_100 = {}.ElTabPane;
    /** @type {[typeof __VLS_components.ElTabPane, typeof __VLS_components.elTabPane, typeof __VLS_components.ElTabPane, typeof __VLS_components.elTabPane, ]} */ ;
    // @ts-ignore
    const __VLS_101 = __VLS_asFunctionalComponent(__VLS_100, new __VLS_100({
        label: (__VLS_ctx.t('editor.tabs.recall')),
        name: "recall",
    }));
    const __VLS_102 = __VLS_101({
        label: (__VLS_ctx.t('editor.tabs.recall')),
        name: "recall",
    }, ...__VLS_functionalComponentArgsRest(__VLS_101));
    __VLS_103.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "recall-meta" },
    });
    const __VLS_104 = {}.ElTag;
    /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
    // @ts-ignore
    const __VLS_105 = __VLS_asFunctionalComponent(__VLS_104, new __VLS_104({
        type: "info",
        effect: "plain",
    }));
    const __VLS_106 = __VLS_105({
        type: "info",
        effect: "plain",
    }, ...__VLS_functionalComponentArgsRest(__VLS_105));
    __VLS_107.slots.default;
    (__VLS_ctx.t('editor.labels.recallQuerySource', { source: __VLS_ctx.recallQuerySource || __VLS_ctx.t('editor.labels.manualInput') }));
    var __VLS_107;
    if (!__VLS_ctx.recallResults.length) {
        const __VLS_108 = {}.ElEmpty;
        /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
        // @ts-ignore
        const __VLS_109 = __VLS_asFunctionalComponent(__VLS_108, new __VLS_108({
            description: (__VLS_ctx.t('editor.empty.noRecallResults')),
        }));
        const __VLS_110 = __VLS_109({
            description: (__VLS_ctx.t('editor.empty.noRecallResults')),
        }, ...__VLS_functionalComponentArgsRest(__VLS_109));
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "recall-list" },
        });
        for (const [item] of __VLS_getVForSourceType((__VLS_ctx.recallResults))) {
            const __VLS_112 = {}.ElCard;
            /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
            // @ts-ignore
            const __VLS_113 = __VLS_asFunctionalComponent(__VLS_112, new __VLS_112({
                key: (item.chapterId),
                shadow: "hover",
                ...{ class: "recall-item" },
            }));
            const __VLS_114 = __VLS_113({
                key: (item.chapterId),
                shadow: "hover",
                ...{ class: "recall-item" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_113));
            __VLS_115.slots.default;
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "recall-item-top" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "recall-title" },
            });
            (__VLS_ctx.t('editor.labels.chapterTitle', { number: item.chapterNumber, title: item.chapterTitle }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "recall-reason" },
            });
            (item.reason);
            const __VLS_116 = {}.ElTag;
            /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
            // @ts-ignore
            const __VLS_117 = __VLS_asFunctionalComponent(__VLS_116, new __VLS_116({
                type: "success",
                effect: "plain",
            }));
            const __VLS_118 = __VLS_117({
                type: "success",
                effect: "plain",
            }, ...__VLS_functionalComponentArgsRest(__VLS_117));
            __VLS_119.slots.default;
            (__VLS_ctx.t('editor.labels.score', { score: item.score }));
            var __VLS_119;
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
                ...{ class: "recall-summary" },
            });
            (item.summary || __VLS_ctx.t('editor.empty.noSummary'));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "recall-keywords" },
            });
            for (const [keywordItem] of __VLS_getVForSourceType((item.matchedKeywords))) {
                const __VLS_120 = {}.ElTag;
                /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
                // @ts-ignore
                const __VLS_121 = __VLS_asFunctionalComponent(__VLS_120, new __VLS_120({
                    key: (keywordItem),
                    size: "small",
                    effect: "plain",
                }));
                const __VLS_122 = __VLS_121({
                    key: (keywordItem),
                    size: "small",
                    effect: "plain",
                }, ...__VLS_functionalComponentArgsRest(__VLS_121));
                __VLS_123.slots.default;
                (keywordItem);
                var __VLS_123;
            }
            var __VLS_115;
        }
    }
    var __VLS_103;
    const __VLS_124 = {}.ElTabPane;
    /** @type {[typeof __VLS_components.ElTabPane, typeof __VLS_components.elTabPane, typeof __VLS_components.ElTabPane, typeof __VLS_components.elTabPane, ]} */ ;
    // @ts-ignore
    const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({
        label: (__VLS_ctx.t('editor.tabs.history')),
        name: "history",
    }));
    const __VLS_126 = __VLS_125({
        label: (__VLS_ctx.t('editor.tabs.history')),
        name: "history",
    }, ...__VLS_functionalComponentArgsRest(__VLS_125));
    __VLS_127.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "history-toolbar" },
    });
    const __VLS_128 = {}.ElSelect;
    /** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
    // @ts-ignore
    const __VLS_129 = __VLS_asFunctionalComponent(__VLS_128, new __VLS_128({
        modelValue: (__VLS_ctx.selectedVersionId),
        loading: (__VLS_ctx.versionsLoading),
        placeholder: (__VLS_ctx.t('editor.placeholders.selectVersion')),
        ...{ style: {} },
    }));
    const __VLS_130 = __VLS_129({
        modelValue: (__VLS_ctx.selectedVersionId),
        loading: (__VLS_ctx.versionsLoading),
        placeholder: (__VLS_ctx.t('editor.placeholders.selectVersion')),
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_129));
    __VLS_131.slots.default;
    for (const [item] of __VLS_getVForSourceType((__VLS_ctx.versions))) {
        const __VLS_132 = {}.ElOption;
        /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
        // @ts-ignore
        const __VLS_133 = __VLS_asFunctionalComponent(__VLS_132, new __VLS_132({
            key: (item.versionId),
            label: (`${item.label}${item.isCurrent ? __VLS_ctx.t('editor.labels.currentVersionSuffix') : ''}`),
            value: (item.versionId),
        }));
        const __VLS_134 = __VLS_133({
            key: (item.versionId),
            label: (`${item.label}${item.isCurrent ? __VLS_ctx.t('editor.labels.currentVersionSuffix') : ''}`),
            value: (item.versionId),
        }, ...__VLS_functionalComponentArgsRest(__VLS_133));
    }
    var __VLS_131;
    const __VLS_136 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_137 = __VLS_asFunctionalComponent(__VLS_136, new __VLS_136({
        ...{ 'onClick': {} },
        type: "warning",
        loading: (__VLS_ctx.restoringVersion),
        disabled: (__VLS_ctx.restoreDisabled),
    }));
    const __VLS_138 = __VLS_137({
        ...{ 'onClick': {} },
        type: "warning",
        loading: (__VLS_ctx.restoringVersion),
        disabled: (__VLS_ctx.restoreDisabled),
    }, ...__VLS_functionalComponentArgsRest(__VLS_137));
    let __VLS_140;
    let __VLS_141;
    let __VLS_142;
    const __VLS_143 = {
        onClick: (__VLS_ctx.restoreSelectedVersion)
    };
    __VLS_139.slots.default;
    (__VLS_ctx.t('editor.actions.restoreVersion'));
    var __VLS_139;
    if (!__VLS_ctx.versions.length) {
        const __VLS_144 = {}.ElEmpty;
        /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
        // @ts-ignore
        const __VLS_145 = __VLS_asFunctionalComponent(__VLS_144, new __VLS_144({
            description: (__VLS_ctx.t('editor.empty.noVersions')),
        }));
        const __VLS_146 = __VLS_145({
            description: (__VLS_ctx.t('editor.empty.noVersions')),
        }, ...__VLS_functionalComponentArgsRest(__VLS_145));
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "history-layout" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "history-list" },
        });
        for (const [item] of __VLS_getVForSourceType((__VLS_ctx.versions))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(!__VLS_ctx.selectedChapterId))
                            return;
                        if (!!(!__VLS_ctx.versions.length))
                            return;
                        __VLS_ctx.selectedVersionId = item.versionId;
                    } },
                key: (item.versionId),
                ...{ class: "history-item" },
                ...{ class: ({ active: item.versionId === __VLS_ctx.selectedVersionId }) },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "history-item-top" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            (item.label);
            if (item.isCurrent) {
                const __VLS_148 = {}.ElTag;
                /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
                // @ts-ignore
                const __VLS_149 = __VLS_asFunctionalComponent(__VLS_148, new __VLS_148({
                    type: "success",
                    size: "small",
                    effect: "plain",
                }));
                const __VLS_150 = __VLS_149({
                    type: "success",
                    size: "small",
                    effect: "plain",
                }, ...__VLS_functionalComponentArgsRest(__VLS_149));
                __VLS_151.slots.default;
                (__VLS_ctx.t('editor.labels.current'));
                var __VLS_151;
            }
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "history-item-meta" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            (item.fileName);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            (__VLS_ctx.formatSize(item.size));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            (__VLS_ctx.formatTime(item.createdAt));
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "history-preview" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "history-preview-title" },
        });
        const __VLS_152 = {}.ElIcon;
        /** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
        // @ts-ignore
        const __VLS_153 = __VLS_asFunctionalComponent(__VLS_152, new __VLS_152({}));
        const __VLS_154 = __VLS_153({}, ...__VLS_functionalComponentArgsRest(__VLS_153));
        __VLS_155.slots.default;
        const __VLS_156 = {}.Clock;
        /** @type {[typeof __VLS_components.Clock, ]} */ ;
        // @ts-ignore
        const __VLS_157 = __VLS_asFunctionalComponent(__VLS_156, new __VLS_156({}));
        const __VLS_158 = __VLS_157({}, ...__VLS_functionalComponentArgsRest(__VLS_157));
        var __VLS_155;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.selectedVersionDetail?.label || __VLS_ctx.t('editor.empty.noVersionSelected'));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.pre, __VLS_intrinsicElements.pre)({
            ...{ class: "history-content" },
        });
        (__VLS_ctx.selectedVersionDetail?.content || __VLS_ctx.t('editor.empty.noVersionContent'));
    }
    var __VLS_127;
    const __VLS_160 = {}.ElTabPane;
    /** @type {[typeof __VLS_components.ElTabPane, typeof __VLS_components.elTabPane, typeof __VLS_components.ElTabPane, typeof __VLS_components.elTabPane, ]} */ ;
    // @ts-ignore
    const __VLS_161 = __VLS_asFunctionalComponent(__VLS_160, new __VLS_160({
        label: (__VLS_ctx.t('editor.tabs.diff')),
        name: "diff",
    }));
    const __VLS_162 = __VLS_161({
        label: (__VLS_ctx.t('editor.tabs.diff')),
        name: "diff",
    }, ...__VLS_functionalComponentArgsRest(__VLS_161));
    __VLS_163.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "diff-toolbar" },
    });
    const __VLS_164 = {}.ElSelect;
    /** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
    // @ts-ignore
    const __VLS_165 = __VLS_asFunctionalComponent(__VLS_164, new __VLS_164({
        modelValue: (__VLS_ctx.selectedVersionId),
        loading: (__VLS_ctx.versionsLoading),
        placeholder: (__VLS_ctx.t('editor.placeholders.selectDiffBaseVersion')),
        ...{ style: {} },
    }));
    const __VLS_166 = __VLS_165({
        modelValue: (__VLS_ctx.selectedVersionId),
        loading: (__VLS_ctx.versionsLoading),
        placeholder: (__VLS_ctx.t('editor.placeholders.selectDiffBaseVersion')),
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_165));
    __VLS_167.slots.default;
    for (const [item] of __VLS_getVForSourceType((__VLS_ctx.versions))) {
        const __VLS_168 = {}.ElOption;
        /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
        // @ts-ignore
        const __VLS_169 = __VLS_asFunctionalComponent(__VLS_168, new __VLS_168({
            key: (item.versionId),
            label: (`${item.label}${item.isCurrent ? __VLS_ctx.t('editor.labels.currentVersionSuffix') : ''}`),
            value: (item.versionId),
        }));
        const __VLS_170 = __VLS_169({
            key: (item.versionId),
            label: (`${item.label}${item.isCurrent ? __VLS_ctx.t('editor.labels.currentVersionSuffix') : ''}`),
            value: (item.versionId),
        }, ...__VLS_functionalComponentArgsRest(__VLS_169));
    }
    var __VLS_167;
    const __VLS_172 = {}.ElTag;
    /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
    // @ts-ignore
    const __VLS_173 = __VLS_asFunctionalComponent(__VLS_172, new __VLS_172({
        type: "info",
        effect: "plain",
    }));
    const __VLS_174 = __VLS_173({
        type: "info",
        effect: "plain",
    }, ...__VLS_functionalComponentArgsRest(__VLS_173));
    __VLS_175.slots.default;
    (__VLS_ctx.t('editor.hints.diffBaseVsCurrent'));
    var __VLS_175;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "diff-hint" },
    });
    const __VLS_176 = {}.ElAlert;
    /** @type {[typeof __VLS_components.ElAlert, typeof __VLS_components.elAlert, ]} */ ;
    // @ts-ignore
    const __VLS_177 = __VLS_asFunctionalComponent(__VLS_176, new __VLS_176({
        title: (__VLS_ctx.diffFallback ? __VLS_ctx.t('editor.hints.diffFallback') : __VLS_ctx.t('editor.hints.diffEnhanced')),
        type: "info",
        closable: (false),
        showIcon: true,
    }));
    const __VLS_178 = __VLS_177({
        title: (__VLS_ctx.diffFallback ? __VLS_ctx.t('editor.hints.diffFallback') : __VLS_ctx.t('editor.hints.diffEnhanced')),
        type: "info",
        closable: (false),
        showIcon: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_177));
    if (!__VLS_ctx.diffFallback && __VLS_ctx.diffHtml) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "diff2html-pane" },
        });
        __VLS_asFunctionalDirective(__VLS_directives.vHtml)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.diffHtml) }, null, null);
    }
    else if (__VLS_ctx.diffLines.length) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "diff-table" },
        });
        for (const [item] of __VLS_getVForSourceType((__VLS_ctx.diffLines))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                key: (item.line),
                ...{ class: "diff-row" },
                ...{ class: (`diff-${item.type}`) },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "diff-line" },
            });
            (item.line);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.pre, __VLS_intrinsicElements.pre)({
                ...{ class: "diff-cell" },
            });
            (item.before);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.pre, __VLS_intrinsicElements.pre)({
                ...{ class: "diff-cell" },
            });
            (item.after);
        }
    }
    else {
        const __VLS_180 = {}.ElEmpty;
        /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
        // @ts-ignore
        const __VLS_181 = __VLS_asFunctionalComponent(__VLS_180, new __VLS_180({
            description: (__VLS_ctx.t('editor.empty.noDiff')),
        }));
        const __VLS_182 = __VLS_181({
            description: (__VLS_ctx.t('editor.empty.noDiff')),
        }, ...__VLS_functionalComponentArgsRest(__VLS_181));
    }
    var __VLS_163;
    var __VLS_84;
    var __VLS_80;
}
var __VLS_68;
/** @type {__VLS_StyleScopedClasses['editor-view']} */ ;
/** @type {__VLS_StyleScopedClasses['toolbar']} */ ;
/** @type {__VLS_StyleScopedClasses['toolbar-left']} */ ;
/** @type {__VLS_StyleScopedClasses['toolbar-right']} */ ;
/** @type {__VLS_StyleScopedClasses['workspace']} */ ;
/** @type {__VLS_StyleScopedClasses['chapter-list-card']} */ ;
/** @type {__VLS_StyleScopedClasses['card-header']} */ ;
/** @type {__VLS_StyleScopedClasses['chapter-list']} */ ;
/** @type {__VLS_StyleScopedClasses['chapter-item']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['chapter-item-top']} */ ;
/** @type {__VLS_StyleScopedClasses['chapter-index']} */ ;
/** @type {__VLS_StyleScopedClasses['chapter-status']} */ ;
/** @type {__VLS_StyleScopedClasses['chapter-title']} */ ;
/** @type {__VLS_StyleScopedClasses['chapter-summary']} */ ;
/** @type {__VLS_StyleScopedClasses['editor-card']} */ ;
/** @type {__VLS_StyleScopedClasses['card-header']} */ ;
/** @type {__VLS_StyleScopedClasses['editor-title']} */ ;
/** @type {__VLS_StyleScopedClasses['editor-meta']} */ ;
/** @type {__VLS_StyleScopedClasses['editor-tabs']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-pane']} */ ;
/** @type {__VLS_StyleScopedClasses['recall-meta']} */ ;
/** @type {__VLS_StyleScopedClasses['recall-list']} */ ;
/** @type {__VLS_StyleScopedClasses['recall-item']} */ ;
/** @type {__VLS_StyleScopedClasses['recall-item-top']} */ ;
/** @type {__VLS_StyleScopedClasses['recall-title']} */ ;
/** @type {__VLS_StyleScopedClasses['recall-reason']} */ ;
/** @type {__VLS_StyleScopedClasses['recall-summary']} */ ;
/** @type {__VLS_StyleScopedClasses['recall-keywords']} */ ;
/** @type {__VLS_StyleScopedClasses['history-toolbar']} */ ;
/** @type {__VLS_StyleScopedClasses['history-layout']} */ ;
/** @type {__VLS_StyleScopedClasses['history-list']} */ ;
/** @type {__VLS_StyleScopedClasses['history-item']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['history-item-top']} */ ;
/** @type {__VLS_StyleScopedClasses['history-item-meta']} */ ;
/** @type {__VLS_StyleScopedClasses['history-preview']} */ ;
/** @type {__VLS_StyleScopedClasses['history-preview-title']} */ ;
/** @type {__VLS_StyleScopedClasses['history-content']} */ ;
/** @type {__VLS_StyleScopedClasses['diff-toolbar']} */ ;
/** @type {__VLS_StyleScopedClasses['diff-hint']} */ ;
/** @type {__VLS_StyleScopedClasses['diff2html-pane']} */ ;
/** @type {__VLS_StyleScopedClasses['diff-table']} */ ;
/** @type {__VLS_StyleScopedClasses['diff-row']} */ ;
/** @type {__VLS_StyleScopedClasses['diff-line']} */ ;
/** @type {__VLS_StyleScopedClasses['diff-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['diff-cell']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Search: Search,
            RefreshRight: RefreshRight,
            Connection: Connection,
            EditPen: EditPen,
            Clock: Clock,
            MonacoMarkdownEditor: MonacoMarkdownEditor,
            t: t,
            loading: loading,
            detailLoading: detailLoading,
            saving: saving,
            recalling: recalling,
            versionsLoading: versionsLoading,
            restoringVersion: restoringVersion,
            keyword: keyword,
            selectedSourceBookId: selectedSourceBookId,
            chapters: chapters,
            sourceBooks: sourceBooks,
            selectedChapterId: selectedChapterId,
            chapterDetail: chapterDetail,
            editorContent: editorContent,
            activeTab: activeTab,
            recallQuery: recallQuery,
            recallResults: recallResults,
            recallQuerySource: recallQuerySource,
            monacoFallback: monacoFallback,
            markdownFallback: markdownFallback,
            diffFallback: diffFallback,
            diffHtml: diffHtml,
            versions: versions,
            selectedVersionId: selectedVersionId,
            selectedVersionDetail: selectedVersionDetail,
            selectedChapter: selectedChapter,
            previewHtml: previewHtml,
            hasUnsavedChanges: hasUnsavedChanges,
            restoreDisabled: restoreDisabled,
            diffLines: diffLines,
            formatTime: formatTime,
            formatSize: formatSize,
            loadChapters: loadChapters,
            saveContent: saveContent,
            restoreSelectedVersion: restoreSelectedVersion,
            runRecall: runRecall,
            onMonacoFallback: onMonacoFallback,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
