import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { DocumentChecked, Position, Refresh, Search } from '@element-plus/icons-vue';
import { useWorkContextStore } from '@/stores/workContext';
import { getEditorIndexStatus, getEditorChapterAssist, listEditorChapters, rebuildEditorIndex, saveEditorChapterContent, searchVectorRecall } from '@/api/modules/editor';
const workContext = useWorkContextStore();
const chapters = ref([]);
const selectedChapterId = ref('');
const selectedChapter = ref(null);
const editorContent = ref('');
const baselineContent = ref('');
const baselineSavedAt = ref('');
const loadingChapters = ref(false);
const loadingChapter = ref(false);
const saving = ref(false);
const previewMode = ref('split');
const editorInputRef = ref(null);
const searchText = ref('');
const replaceText = ref('');
const currentSearchIndex = ref(-1);
const recallQuery = ref('');
const recallResults = ref([]);
const searchingRecall = ref(false);
const loadingAssist = ref(false);
const indexStatus = ref(null);
const loadingIndexStatus = ref(false);
const rebuildingIndex = ref(false);
const canUseWorkspace = computed(() => !!workContext.selectedProjectId);
const currentWordCount = computed(() => editorContent.value.trim().length);
const hasUnsavedChanges = computed(() => editorContent.value !== baselineContent.value);
const currentTitle = computed(() => {
    if (!selectedChapter.value)
        return '未选择章节';
    return `第 ${selectedChapter.value.chapterNumber} 章 · ${selectedChapter.value.title}`;
});
const versionSnapshots = computed(() => {
    const currentTime = selectedChapter.value?.updatedAt || new Date().toISOString();
    return [
        {
            id: 'baseline',
            label: '加载时版本',
            content: baselineContent.value,
            savedAt: baselineSavedAt.value
        },
        {
            id: 'current',
            label: hasUnsavedChanges.value ? '当前编辑（未保存）' : '当前编辑',
            content: editorContent.value,
            savedAt: currentTime
        }
    ];
});
const diffStats = computed(() => {
    const before = baselineContent.value;
    const after = editorContent.value;
    return {
        beforeChars: before.length,
        afterChars: after.length,
        deltaChars: after.length - before.length,
        beforeLines: before ? before.split('\n').length : 0,
        afterLines: after ? after.split('\n').length : 0
    };
});
const markdownHtml = computed(() => renderMarkdown(editorContent.value));
const searchMatches = computed(() => {
    const needle = searchText.value;
    if (!needle)
        return [];
    const matches = [];
    const lowerContent = editorContent.value.toLocaleLowerCase();
    const lowerNeedle = needle.toLocaleLowerCase();
    let start = 0;
    let index = lowerContent.indexOf(lowerNeedle, start);
    while (index !== -1) {
        matches.push({ start: index, end: index + needle.length });
        start = index + needle.length;
        index = lowerContent.indexOf(lowerNeedle, start);
    }
    return matches;
});
const activeMatchLabel = computed(() => {
    if (!searchText.value)
        return '未输入';
    if (searchMatches.value.length === 0)
        return '0 / 0';
    return `${currentSearchIndex.value + 1} / ${searchMatches.value.length}`;
});
const indexProgressLabel = computed(() => {
    if (!indexStatus.value)
        return '未加载';
    return `${indexStatus.value.indexedChapterCount}/${indexStatus.value.totalChapterCount} 章`;
});
const indexStatusType = computed(() => {
    const status = indexStatus.value?.status;
    if (status === 'ready')
        return 'success';
    if (status === 'stale')
        return 'warning';
    if (status === 'failed')
        return 'danger';
    if (status === 'building')
        return 'info';
    return 'info';
});
function escapeHtml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function renderInlineMarkdown(value) {
    return escapeHtml(value)
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>');
}
function renderMarkdown(value) {
    const lines = value.split('\n');
    const html = [];
    let listOpen = false;
    for (const rawLine of lines) {
        const line = rawLine.trimEnd();
        const heading = line.match(/^(#{1,6})\s+(.+)$/);
        const bullet = line.match(/^[-*]\s+(.+)$/);
        if (heading) {
            if (listOpen) {
                html.push('</ul>');
                listOpen = false;
            }
            html.push(`<h${heading[1].length}>${renderInlineMarkdown(heading[2])}</h${heading[1].length}>`);
        }
        else if (bullet) {
            if (!listOpen) {
                html.push('<ul>');
                listOpen = true;
            }
            html.push(`<li>${renderInlineMarkdown(bullet[1])}</li>`);
        }
        else if (!line.trim()) {
            if (listOpen) {
                html.push('</ul>');
                listOpen = false;
            }
        }
        else {
            if (listOpen) {
                html.push('</ul>');
                listOpen = false;
            }
            html.push(`<p>${renderInlineMarkdown(line)}</p>`);
        }
    }
    if (listOpen)
        html.push('</ul>');
    return html.join('\n');
}
function formatTime(value) {
    return value ? new Date(value).toLocaleString() : '-';
}
function statusType(status) {
    if (status === 'validated')
        return 'success';
    if (status === 'needs_fix')
        return 'danger';
    if (status === 'drafted')
        return 'warning';
    if (status === 'planned')
        return 'info';
    return 'info';
}
function getEditorTextarea() {
    return editorInputRef.value?.textarea ?? null;
}
async function focusEditorRange(start, end = start) {
    if (previewMode.value === 'preview') {
        previewMode.value = 'edit';
        await nextTick();
    }
    await nextTick();
    const textarea = getEditorTextarea();
    if (!textarea)
        return;
    textarea.focus();
    textarea.setSelectionRange(start, end);
}
function normalizeSearchIndex(index) {
    const total = searchMatches.value.length;
    if (total === 0)
        return -1;
    return (index + total) % total;
}
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
async function goToSearchMatch(index) {
    currentSearchIndex.value = normalizeSearchIndex(index);
    const match = searchMatches.value[currentSearchIndex.value];
    if (!match)
        return;
    await focusEditorRange(match.start, match.end);
}
async function findNextMatch(step = 1) {
    if (!searchText.value) {
        ElMessage.warning('请输入搜索内容');
        return;
    }
    if (searchMatches.value.length === 0) {
        ElMessage.info('当前章节未找到匹配内容');
        return;
    }
    await goToSearchMatch(currentSearchIndex.value + step);
}
async function replaceCurrentMatch() {
    const match = searchMatches.value[currentSearchIndex.value];
    if (!match) {
        await findNextMatch();
        return;
    }
    editorContent.value =
        editorContent.value.slice(0, match.start) + replaceText.value + editorContent.value.slice(match.end);
    const nextStart = match.start + replaceText.value.length;
    await nextTick();
    const nextIndex = searchMatches.value.findIndex((item) => item.start >= nextStart);
    await goToSearchMatch(nextIndex === -1 ? 0 : nextIndex);
}
async function replaceAllMatches() {
    if (!searchText.value) {
        ElMessage.warning('请输入搜索内容');
        return;
    }
    const total = searchMatches.value.length;
    if (total === 0) {
        ElMessage.info('没有可替换的匹配内容');
        return;
    }
    editorContent.value = editorContent.value.replace(new RegExp(escapeRegExp(searchText.value), 'gi'), replaceText.value);
    currentSearchIndex.value = -1;
    ElMessage.success(`已替换 ${total} 处`);
}
async function insertTextAtCursor(text) {
    if (!selectedChapter.value) {
        ElMessage.warning('请先选择章节');
        return;
    }
    const textarea = getEditorTextarea();
    const start = textarea?.selectionStart ?? editorContent.value.length;
    const end = textarea?.selectionEnd ?? editorContent.value.length;
    const prefix = editorContent.value.slice(0, start);
    const suffix = editorContent.value.slice(end);
    const spacerBefore = prefix && !prefix.endsWith('\n') ? '\n\n' : '';
    const spacerAfter = suffix && !suffix.startsWith('\n') ? '\n\n' : '';
    const inserted = `${spacerBefore}${text.trim()}${spacerAfter}`;
    editorContent.value = `${prefix}${inserted}${suffix}`;
    await focusEditorRange(start + inserted.length);
}
async function insertRecallResult(item) {
    const text = `> ${item.source} · ${item.title}\n${item.excerpt}`;
    await insertTextAtCursor(text);
    ElMessage.success('召回片段已插入');
}
async function refreshIndexStatus(silent = false) {
    if (!workContext.selectedProjectId) {
        indexStatus.value = null;
        return;
    }
    loadingIndexStatus.value = true;
    try {
        indexStatus.value = await getEditorIndexStatus(workContext.selectedProjectId);
    }
    catch (err) {
        indexStatus.value = null;
        if (!silent)
            ElMessage.error(err.message || '加载索引状态失败');
    }
    finally {
        loadingIndexStatus.value = false;
    }
}
async function rebuildIndex() {
    if (!workContext.selectedProjectId) {
        ElMessage.warning('请先选择项目');
        return;
    }
    rebuildingIndex.value = true;
    try {
        indexStatus.value = await rebuildEditorIndex(workContext.selectedProjectId);
        ElMessage.success('轻量索引已重建');
    }
    catch (err) {
        ElMessage.error(err.message || '重建轻量索引失败');
    }
    finally {
        rebuildingIndex.value = false;
    }
}
async function refreshChapters() {
    if (!canUseWorkspace.value) {
        chapters.value = [];
        selectedChapterId.value = '';
        selectedChapter.value = null;
        editorContent.value = '';
        baselineContent.value = '';
        indexStatus.value = null;
        return;
    }
    loadingChapters.value = true;
    try {
        chapters.value = await listEditorChapters(workContext.selectedProjectId, workContext.selectedVolumeId || null);
        if (!chapters.value.some((chapter) => chapter.id === selectedChapterId.value)) {
            selectedChapterId.value = chapters.value[0]?.id ?? '';
        }
        await loadSelectedChapter();
    }
    catch (err) {
        ElMessage.error(err.message || '加载章节失败');
    }
    finally {
        loadingChapters.value = false;
    }
}
async function loadSelectedChapter() {
    if (!selectedChapterId.value) {
        selectedChapter.value = null;
        editorContent.value = '';
        baselineContent.value = '';
        baselineSavedAt.value = '';
        recallResults.value = [];
        return;
    }
    loadingChapter.value = true;
    loadingAssist.value = true;
    try {
        const assist = await getEditorChapterAssist(selectedChapterId.value);
        selectedChapter.value = assist.chapter;
        editorContent.value = assist.chapter.content ?? '';
        baselineContent.value = assist.chapter.content ?? '';
        baselineSavedAt.value = assist.chapter.updatedAt;
        recallResults.value = assist.related;
    }
    catch (err) {
        ElMessage.error(err.message || '加载章节详情失败');
    }
    finally {
        loadingChapter.value = false;
        loadingAssist.value = false;
    }
}
async function saveContent() {
    if (!selectedChapter.value) {
        ElMessage.warning('请先选择章节');
        return;
    }
    saving.value = true;
    try {
        const chapter = await saveEditorChapterContent(selectedChapter.value.id, editorContent.value, 'drafted');
        selectedChapter.value = chapter;
        baselineContent.value = chapter.content ?? '';
        baselineSavedAt.value = chapter.updatedAt;
        editorContent.value = chapter.content ?? '';
        chapters.value = chapters.value.map((item) => (item.id === chapter.id ? chapter : item));
        await refreshIndexStatus(true);
        ElMessage.success('章节内容已保存');
    }
    catch (err) {
        ElMessage.error(err.message || '保存章节失败');
    }
    finally {
        saving.value = false;
    }
}
async function runVectorRecall() {
    if (!workContext.selectedProjectId) {
        ElMessage.warning('请先选择项目');
        return;
    }
    if (!recallQuery.value.trim()) {
        ElMessage.warning('请输入召回关键词');
        return;
    }
    searchingRecall.value = true;
    try {
        recallResults.value = await searchVectorRecall({
            projectId: workContext.selectedProjectId,
            chapterId: selectedChapter.value?.id,
            query: recallQuery.value.trim(),
            topK: 5
        });
        if (recallResults.value.length === 0) {
            ElMessage.info('没有匹配到可召回上下文');
        }
    }
    catch (err) {
        ElMessage.error(err.message || '向量召回失败');
    }
    finally {
        searchingRecall.value = false;
    }
}
watch(() => [workContext.selectedProjectId, workContext.selectedVolumeId], refreshChapters);
watch(selectedChapterId, loadSelectedChapter);
watch(() => workContext.selectedProjectId, () => refreshIndexStatus(true));
watch(searchMatches, (matches) => {
    if (matches.length === 0) {
        currentSearchIndex.value = -1;
    }
    else if (currentSearchIndex.value >= matches.length) {
        currentSearchIndex.value = matches.length - 1;
    }
});
onMounted(async () => {
    await workContext.init();
    await refreshChapters();
    await refreshIndexStatus(true);
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['toolbar-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-head']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-head']} */ ;
/** @type {__VLS_StyleScopedClasses['chapter-item']} */ ;
/** @type {__VLS_StyleScopedClasses['chapter-item']} */ ;
/** @type {__VLS_StyleScopedClasses['chapter-item']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['chapter-meta']} */ ;
/** @type {__VLS_StyleScopedClasses['writer-surface']} */ ;
/** @type {__VLS_StyleScopedClasses['writer-surface']} */ ;
/** @type {__VLS_StyleScopedClasses['writer-surface']} */ ;
/** @type {__VLS_StyleScopedClasses['markdown-editor']} */ ;
/** @type {__VLS_StyleScopedClasses['markdown-preview']} */ ;
/** @type {__VLS_StyleScopedClasses['markdown-preview']} */ ;
/** @type {__VLS_StyleScopedClasses['markdown-preview']} */ ;
/** @type {__VLS_StyleScopedClasses['markdown-preview']} */ ;
/** @type {__VLS_StyleScopedClasses['markdown-preview']} */ ;
/** @type {__VLS_StyleScopedClasses['diff-metrics']} */ ;
/** @type {__VLS_StyleScopedClasses['diff-metrics']} */ ;
/** @type {__VLS_StyleScopedClasses['index-metrics']} */ ;
/** @type {__VLS_StyleScopedClasses['diff-metrics']} */ ;
/** @type {__VLS_StyleScopedClasses['index-metrics']} */ ;
/** @type {__VLS_StyleScopedClasses['index-metrics']} */ ;
/** @type {__VLS_StyleScopedClasses['version-title']} */ ;
/** @type {__VLS_StyleScopedClasses['version-title']} */ ;
/** @type {__VLS_StyleScopedClasses['version-item']} */ ;
/** @type {__VLS_StyleScopedClasses['recall-item']} */ ;
/** @type {__VLS_StyleScopedClasses['recall-item']} */ ;
/** @type {__VLS_StyleScopedClasses['recall-item']} */ ;
/** @type {__VLS_StyleScopedClasses['editor-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['side-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['editor-toolbar']} */ ;
/** @type {__VLS_StyleScopedClasses['toolbar-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['editor-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['side-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['search-replace-bar']} */ ;
/** @type {__VLS_StyleScopedClasses['writer-surface']} */ ;
/** @type {__VLS_StyleScopedClasses['mode-split']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "editor-page" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "editor-toolbar" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "eyebrow" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "subtitle" },
});
(__VLS_ctx.workContext.selectedProject?.name || '未选择项目');
if (__VLS_ctx.workContext.selectedVolume) {
    (__VLS_ctx.workContext.selectedVolume.volumeNumber);
    (__VLS_ctx.workContext.selectedVolume.title);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "toolbar-actions" },
});
const __VLS_0 = {}.ElSegmented;
/** @type {[typeof __VLS_components.ElSegmented, typeof __VLS_components.elSegmented, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    modelValue: (__VLS_ctx.previewMode),
    options: ([
        { label: '编辑', value: 'edit' },
        { label: '预览', value: 'preview' },
        { label: '分屏', value: 'split' }
    ]),
}));
const __VLS_2 = __VLS_1({
    modelValue: (__VLS_ctx.previewMode),
    options: ([
        { label: '编辑', value: 'edit' },
        { label: '预览', value: 'preview' },
        { label: '分屏', value: 'split' }
    ]),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
const __VLS_4 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
    ...{ 'onClick': {} },
    icon: (__VLS_ctx.Refresh),
    loading: (__VLS_ctx.loadingChapters),
}));
const __VLS_6 = __VLS_5({
    ...{ 'onClick': {} },
    icon: (__VLS_ctx.Refresh),
    loading: (__VLS_ctx.loadingChapters),
}, ...__VLS_functionalComponentArgsRest(__VLS_5));
let __VLS_8;
let __VLS_9;
let __VLS_10;
const __VLS_11 = {
    onClick: (__VLS_ctx.refreshChapters)
};
__VLS_7.slots.default;
var __VLS_7;
const __VLS_12 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
    ...{ 'onClick': {} },
    type: "primary",
    icon: (__VLS_ctx.DocumentChecked),
    loading: (__VLS_ctx.saving),
    disabled: (!__VLS_ctx.selectedChapter),
}));
const __VLS_14 = __VLS_13({
    ...{ 'onClick': {} },
    type: "primary",
    icon: (__VLS_ctx.DocumentChecked),
    loading: (__VLS_ctx.saving),
    disabled: (!__VLS_ctx.selectedChapter),
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
let __VLS_16;
let __VLS_17;
let __VLS_18;
const __VLS_19 = {
    onClick: (__VLS_ctx.saveContent)
};
__VLS_15.slots.default;
var __VLS_15;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "editor-grid" },
});
const __VLS_20 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
    shadow: "never",
    ...{ class: "chapter-panel" },
}));
const __VLS_22 = __VLS_21({
    shadow: "never",
    ...{ class: "chapter-panel" },
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
__VLS_23.slots.default;
{
    const { header: __VLS_thisSlot } = __VLS_23.slots;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "panel-head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    const __VLS_24 = {}.ElTag;
    /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
    // @ts-ignore
    const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
        size: "small",
        type: "info",
    }));
    const __VLS_26 = __VLS_25({
        size: "small",
        type: "info",
    }, ...__VLS_functionalComponentArgsRest(__VLS_25));
    __VLS_27.slots.default;
    (__VLS_ctx.chapters.length);
    var __VLS_27;
}
if (!__VLS_ctx.canUseWorkspace) {
    const __VLS_28 = {}.ElEmpty;
    /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
    // @ts-ignore
    const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
        description: "请先在顶栏选择 Project",
    }));
    const __VLS_30 = __VLS_29({
        description: "请先在顶栏选择 Project",
    }, ...__VLS_functionalComponentArgsRest(__VLS_29));
}
else if (__VLS_ctx.chapters.length === 0 && !__VLS_ctx.loadingChapters) {
    const __VLS_32 = {}.ElEmpty;
    /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
    // @ts-ignore
    const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
        description: "暂无章节，可先到章节生成创建",
    }));
    const __VLS_34 = __VLS_33({
        description: "暂无章节，可先到章节生成创建",
    }, ...__VLS_functionalComponentArgsRest(__VLS_33));
}
else {
    const __VLS_36 = {}.ElScrollbar;
    /** @type {[typeof __VLS_components.ElScrollbar, typeof __VLS_components.elScrollbar, typeof __VLS_components.ElScrollbar, typeof __VLS_components.elScrollbar, ]} */ ;
    // @ts-ignore
    const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
        ...{ class: "chapter-scroll" },
    }));
    const __VLS_38 = __VLS_37({
        ...{ class: "chapter-scroll" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_37));
    __VLS_asFunctionalDirective(__VLS_directives.vLoading)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.loadingChapters) }, null, null);
    __VLS_39.slots.default;
    for (const [chapter] of __VLS_getVForSourceType((__VLS_ctx.chapters))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.canUseWorkspace))
                        return;
                    if (!!(__VLS_ctx.chapters.length === 0 && !__VLS_ctx.loadingChapters))
                        return;
                    __VLS_ctx.selectedChapterId = chapter.id;
                } },
            key: (chapter.id),
            ...{ class: "chapter-item" },
            ...{ class: ({ active: chapter.id === __VLS_ctx.selectedChapterId }) },
            type: "button",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "chapter-title" },
        });
        (chapter.chapterNumber);
        (chapter.title);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "chapter-meta" },
        });
        const __VLS_40 = {}.ElTag;
        /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
        // @ts-ignore
        const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
            size: "small",
            type: (__VLS_ctx.statusType(chapter.status)),
            effect: "plain",
        }));
        const __VLS_42 = __VLS_41({
            size: "small",
            type: (__VLS_ctx.statusType(chapter.status)),
            effect: "plain",
        }, ...__VLS_functionalComponentArgsRest(__VLS_41));
        __VLS_43.slots.default;
        (chapter.status || 'unknown');
        var __VLS_43;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (chapter.wordCount || 0);
    }
    var __VLS_39;
}
var __VLS_23;
const __VLS_44 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
    shadow: "never",
    ...{ class: "writing-panel" },
}));
const __VLS_46 = __VLS_45({
    shadow: "never",
    ...{ class: "writing-panel" },
}, ...__VLS_functionalComponentArgsRest(__VLS_45));
__VLS_asFunctionalDirective(__VLS_directives.vLoading)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.loadingChapter) }, null, null);
__VLS_47.slots.default;
{
    const { header: __VLS_thisSlot } = __VLS_47.slots;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "panel-head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.currentTitle);
    if (__VLS_ctx.selectedChapter) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
        (__VLS_ctx.formatTime(__VLS_ctx.selectedChapter.updatedAt));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "chapter-stats" },
    });
    if (__VLS_ctx.hasUnsavedChanges) {
        const __VLS_48 = {}.ElTag;
        /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
        // @ts-ignore
        const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
            size: "small",
            type: "warning",
        }));
        const __VLS_50 = __VLS_49({
            size: "small",
            type: "warning",
        }, ...__VLS_functionalComponentArgsRest(__VLS_49));
        __VLS_51.slots.default;
        var __VLS_51;
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.currentWordCount);
}
if (!__VLS_ctx.selectedChapter) {
    const __VLS_52 = {}.ElEmpty;
    /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
    // @ts-ignore
    const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
        description: "请选择一个章节开始编辑",
    }));
    const __VLS_54 = __VLS_53({
        description: "请选择一个章节开始编辑",
    }, ...__VLS_functionalComponentArgsRest(__VLS_53));
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "writer-wrap" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "search-replace-bar" },
    });
    const __VLS_56 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
        ...{ 'onKeyup': {} },
        modelValue: (__VLS_ctx.searchText),
        ...{ class: "search-input" },
        clearable: true,
        placeholder: "搜索当前章节",
    }));
    const __VLS_58 = __VLS_57({
        ...{ 'onKeyup': {} },
        modelValue: (__VLS_ctx.searchText),
        ...{ class: "search-input" },
        clearable: true,
        placeholder: "搜索当前章节",
    }, ...__VLS_functionalComponentArgsRest(__VLS_57));
    let __VLS_60;
    let __VLS_61;
    let __VLS_62;
    const __VLS_63 = {
        onKeyup: (...[$event]) => {
            if (!!(!__VLS_ctx.selectedChapter))
                return;
            __VLS_ctx.findNextMatch(1);
        }
    };
    var __VLS_59;
    const __VLS_64 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
        ...{ 'onKeyup': {} },
        modelValue: (__VLS_ctx.replaceText),
        ...{ class: "search-input" },
        clearable: true,
        placeholder: "替换为",
    }));
    const __VLS_66 = __VLS_65({
        ...{ 'onKeyup': {} },
        modelValue: (__VLS_ctx.replaceText),
        ...{ class: "search-input" },
        clearable: true,
        placeholder: "替换为",
    }, ...__VLS_functionalComponentArgsRest(__VLS_65));
    let __VLS_68;
    let __VLS_69;
    let __VLS_70;
    const __VLS_71 = {
        onKeyup: (__VLS_ctx.replaceCurrentMatch)
    };
    var __VLS_67;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "search-status" },
    });
    (__VLS_ctx.activeMatchLabel);
    const __VLS_72 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
        ...{ 'onClick': {} },
        disabled: (!__VLS_ctx.searchText),
    }));
    const __VLS_74 = __VLS_73({
        ...{ 'onClick': {} },
        disabled: (!__VLS_ctx.searchText),
    }, ...__VLS_functionalComponentArgsRest(__VLS_73));
    let __VLS_76;
    let __VLS_77;
    let __VLS_78;
    const __VLS_79 = {
        onClick: (...[$event]) => {
            if (!!(!__VLS_ctx.selectedChapter))
                return;
            __VLS_ctx.findNextMatch(-1);
        }
    };
    __VLS_75.slots.default;
    var __VLS_75;
    const __VLS_80 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
        ...{ 'onClick': {} },
        disabled: (!__VLS_ctx.searchText),
    }));
    const __VLS_82 = __VLS_81({
        ...{ 'onClick': {} },
        disabled: (!__VLS_ctx.searchText),
    }, ...__VLS_functionalComponentArgsRest(__VLS_81));
    let __VLS_84;
    let __VLS_85;
    let __VLS_86;
    const __VLS_87 = {
        onClick: (...[$event]) => {
            if (!!(!__VLS_ctx.selectedChapter))
                return;
            __VLS_ctx.findNextMatch(1);
        }
    };
    __VLS_83.slots.default;
    var __VLS_83;
    const __VLS_88 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
        ...{ 'onClick': {} },
        disabled: (!__VLS_ctx.searchText),
    }));
    const __VLS_90 = __VLS_89({
        ...{ 'onClick': {} },
        disabled: (!__VLS_ctx.searchText),
    }, ...__VLS_functionalComponentArgsRest(__VLS_89));
    let __VLS_92;
    let __VLS_93;
    let __VLS_94;
    const __VLS_95 = {
        onClick: (__VLS_ctx.replaceCurrentMatch)
    };
    __VLS_91.slots.default;
    var __VLS_91;
    const __VLS_96 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
        ...{ 'onClick': {} },
        type: "primary",
        plain: true,
        disabled: (!__VLS_ctx.searchText),
    }));
    const __VLS_98 = __VLS_97({
        ...{ 'onClick': {} },
        type: "primary",
        plain: true,
        disabled: (!__VLS_ctx.searchText),
    }, ...__VLS_functionalComponentArgsRest(__VLS_97));
    let __VLS_100;
    let __VLS_101;
    let __VLS_102;
    const __VLS_103 = {
        onClick: (__VLS_ctx.replaceAllMatches)
    };
    __VLS_99.slots.default;
    var __VLS_99;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "writer-surface" },
        ...{ class: (`mode-${__VLS_ctx.previewMode}`) },
    });
    if (__VLS_ctx.previewMode !== 'preview') {
        const __VLS_104 = {}.ElInput;
        /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
        // @ts-ignore
        const __VLS_105 = __VLS_asFunctionalComponent(__VLS_104, new __VLS_104({
            ref: "editorInputRef",
            modelValue: (__VLS_ctx.editorContent),
            ...{ class: "markdown-editor" },
            type: "textarea",
            resize: "none",
            placeholder: "在这里编辑 Markdown 正文。",
        }));
        const __VLS_106 = __VLS_105({
            ref: "editorInputRef",
            modelValue: (__VLS_ctx.editorContent),
            ...{ class: "markdown-editor" },
            type: "textarea",
            resize: "none",
            placeholder: "在这里编辑 Markdown 正文。",
        }, ...__VLS_functionalComponentArgsRest(__VLS_105));
        /** @type {typeof __VLS_ctx.editorInputRef} */ ;
        var __VLS_108 = {};
        var __VLS_107;
    }
    if (__VLS_ctx.previewMode !== 'edit') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.article, __VLS_intrinsicElements.article)({
            ...{ class: "markdown-preview" },
        });
        __VLS_asFunctionalDirective(__VLS_directives.vHtml)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.markdownHtml) }, null, null);
    }
}
var __VLS_47;
__VLS_asFunctionalElement(__VLS_intrinsicElements.aside, __VLS_intrinsicElements.aside)({
    ...{ class: "side-stack" },
});
const __VLS_110 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_111 = __VLS_asFunctionalComponent(__VLS_110, new __VLS_110({
    shadow: "never",
    ...{ class: "index-panel" },
}));
const __VLS_112 = __VLS_111({
    shadow: "never",
    ...{ class: "index-panel" },
}, ...__VLS_functionalComponentArgsRest(__VLS_111));
__VLS_113.slots.default;
{
    const { header: __VLS_thisSlot } = __VLS_113.slots;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "panel-head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    const __VLS_114 = {}.ElTag;
    /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
    // @ts-ignore
    const __VLS_115 = __VLS_asFunctionalComponent(__VLS_114, new __VLS_114({
        size: "small",
        type: (__VLS_ctx.indexStatusType),
    }));
    const __VLS_116 = __VLS_115({
        size: "small",
        type: (__VLS_ctx.indexStatusType),
    }, ...__VLS_functionalComponentArgsRest(__VLS_115));
    __VLS_117.slots.default;
    (__VLS_ctx.indexStatus?.status || 'unknown');
    var __VLS_117;
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "index-metrics" },
});
__VLS_asFunctionalDirective(__VLS_directives.vLoading)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.loadingIndexStatus) }, null, null);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
(__VLS_ctx.indexProgressLabel);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
(__VLS_ctx.indexStatus?.keywordCount ?? '-');
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
(__VLS_ctx.indexStatus?.staleChapterCount ?? 0);
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "index-updated" },
});
(__VLS_ctx.formatTime(__VLS_ctx.indexStatus?.lastBuiltAt || ''));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "index-actions" },
});
const __VLS_118 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_119 = __VLS_asFunctionalComponent(__VLS_118, new __VLS_118({
    ...{ 'onClick': {} },
    icon: (__VLS_ctx.Refresh),
    loading: (__VLS_ctx.loadingIndexStatus),
}));
const __VLS_120 = __VLS_119({
    ...{ 'onClick': {} },
    icon: (__VLS_ctx.Refresh),
    loading: (__VLS_ctx.loadingIndexStatus),
}, ...__VLS_functionalComponentArgsRest(__VLS_119));
let __VLS_122;
let __VLS_123;
let __VLS_124;
const __VLS_125 = {
    onClick: (...[$event]) => {
        __VLS_ctx.refreshIndexStatus();
    }
};
__VLS_121.slots.default;
var __VLS_121;
const __VLS_126 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_127 = __VLS_asFunctionalComponent(__VLS_126, new __VLS_126({
    ...{ 'onClick': {} },
    type: "primary",
    plain: true,
    loading: (__VLS_ctx.rebuildingIndex),
    disabled: (!__VLS_ctx.workContext.selectedProjectId),
}));
const __VLS_128 = __VLS_127({
    ...{ 'onClick': {} },
    type: "primary",
    plain: true,
    loading: (__VLS_ctx.rebuildingIndex),
    disabled: (!__VLS_ctx.workContext.selectedProjectId),
}, ...__VLS_functionalComponentArgsRest(__VLS_127));
let __VLS_130;
let __VLS_131;
let __VLS_132;
const __VLS_133 = {
    onClick: (__VLS_ctx.rebuildIndex)
};
__VLS_129.slots.default;
var __VLS_129;
var __VLS_113;
const __VLS_134 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_135 = __VLS_asFunctionalComponent(__VLS_134, new __VLS_134({
    shadow: "never",
    ...{ class: "version-panel" },
}));
const __VLS_136 = __VLS_135({
    shadow: "never",
    ...{ class: "version-panel" },
}, ...__VLS_functionalComponentArgsRest(__VLS_135));
__VLS_137.slots.default;
{
    const { header: __VLS_thisSlot } = __VLS_137.slots;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "panel-head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    const __VLS_138 = {}.ElTag;
    /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
    // @ts-ignore
    const __VLS_139 = __VLS_asFunctionalComponent(__VLS_138, new __VLS_138({
        size: "small",
        type: (__VLS_ctx.hasUnsavedChanges ? 'warning' : 'success'),
    }));
    const __VLS_140 = __VLS_139({
        size: "small",
        type: (__VLS_ctx.hasUnsavedChanges ? 'warning' : 'success'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_139));
    __VLS_141.slots.default;
    (__VLS_ctx.hasUnsavedChanges ? '有改动' : '同步');
    var __VLS_141;
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "diff-metrics" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
(__VLS_ctx.diffStats.deltaChars >= 0 ? '+' : '');
(__VLS_ctx.diffStats.deltaChars);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
(__VLS_ctx.diffStats.beforeChars);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
(__VLS_ctx.diffStats.afterChars);
const __VLS_142 = {}.ElDivider;
/** @type {[typeof __VLS_components.ElDivider, typeof __VLS_components.elDivider, ]} */ ;
// @ts-ignore
const __VLS_143 = __VLS_asFunctionalComponent(__VLS_142, new __VLS_142({}));
const __VLS_144 = __VLS_143({}, ...__VLS_functionalComponentArgsRest(__VLS_143));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "version-list" },
});
for (const [version] of __VLS_getVForSourceType((__VLS_ctx.versionSnapshots))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        key: (version.id),
        ...{ class: "version-item" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "version-title" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (version.label);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
    (__VLS_ctx.formatTime(version.savedAt));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.pre, __VLS_intrinsicElements.pre)({});
    (version.content.slice(0, 420) || '空内容');
}
var __VLS_137;
const __VLS_146 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_147 = __VLS_asFunctionalComponent(__VLS_146, new __VLS_146({
    shadow: "never",
    ...{ class: "recall-panel" },
}));
const __VLS_148 = __VLS_147({
    shadow: "never",
    ...{ class: "recall-panel" },
}, ...__VLS_functionalComponentArgsRest(__VLS_147));
__VLS_149.slots.default;
{
    const { header: __VLS_thisSlot } = __VLS_149.slots;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "panel-head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    const __VLS_150 = {}.ElTag;
    /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
    // @ts-ignore
    const __VLS_151 = __VLS_asFunctionalComponent(__VLS_150, new __VLS_150({
        size: "small",
        type: "success",
    }));
    const __VLS_152 = __VLS_151({
        size: "small",
        type: "success",
    }, ...__VLS_functionalComponentArgsRest(__VLS_151));
    __VLS_153.slots.default;
    var __VLS_153;
}
const __VLS_154 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_155 = __VLS_asFunctionalComponent(__VLS_154, new __VLS_154({
    modelValue: (__VLS_ctx.recallQuery),
    type: "textarea",
    rows: (3),
    placeholder: "输入人物、地点、伏笔或设定关键词",
}));
const __VLS_156 = __VLS_155({
    modelValue: (__VLS_ctx.recallQuery),
    type: "textarea",
    rows: (3),
    placeholder: "输入人物、地点、伏笔或设定关键词",
}, ...__VLS_functionalComponentArgsRest(__VLS_155));
const __VLS_158 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_159 = __VLS_asFunctionalComponent(__VLS_158, new __VLS_158({
    ...{ 'onClick': {} },
    ...{ class: "recall-button" },
    icon: (__VLS_ctx.Search),
    loading: (__VLS_ctx.searchingRecall),
    disabled: (!__VLS_ctx.workContext.selectedProjectId),
}));
const __VLS_160 = __VLS_159({
    ...{ 'onClick': {} },
    ...{ class: "recall-button" },
    icon: (__VLS_ctx.Search),
    loading: (__VLS_ctx.searchingRecall),
    disabled: (!__VLS_ctx.workContext.selectedProjectId),
}, ...__VLS_functionalComponentArgsRest(__VLS_159));
let __VLS_162;
let __VLS_163;
let __VLS_164;
const __VLS_165 = {
    onClick: (__VLS_ctx.runVectorRecall)
};
__VLS_161.slots.default;
var __VLS_161;
if (__VLS_ctx.recallResults.length === 0) {
    const __VLS_166 = {}.ElEmpty;
    /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
    // @ts-ignore
    const __VLS_167 = __VLS_asFunctionalComponent(__VLS_166, new __VLS_166({
        description: "输入关键词搜索项目章节上下文",
    }));
    const __VLS_168 = __VLS_167({
        description: "输入关键词搜索项目章节上下文",
    }, ...__VLS_functionalComponentArgsRest(__VLS_167));
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "recall-results" },
    });
    __VLS_asFunctionalDirective(__VLS_directives.vLoading)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.loadingAssist) }, null, null);
    for (const [item] of __VLS_getVForSourceType((__VLS_ctx.recallResults))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            key: (item.id),
            ...{ class: "recall-item" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "recall-title-row" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
        (item.title);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (item.source);
        (item.score.toFixed(2));
        const __VLS_170 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_171 = __VLS_asFunctionalComponent(__VLS_170, new __VLS_170({
            ...{ 'onClick': {} },
            size: "small",
            icon: (__VLS_ctx.Position),
            disabled: (!__VLS_ctx.selectedChapter),
        }));
        const __VLS_172 = __VLS_171({
            ...{ 'onClick': {} },
            size: "small",
            icon: (__VLS_ctx.Position),
            disabled: (!__VLS_ctx.selectedChapter),
        }, ...__VLS_functionalComponentArgsRest(__VLS_171));
        let __VLS_174;
        let __VLS_175;
        let __VLS_176;
        const __VLS_177 = {
            onClick: (...[$event]) => {
                if (!!(__VLS_ctx.recallResults.length === 0))
                    return;
                __VLS_ctx.insertRecallResult(item);
            }
        };
        __VLS_173.slots.default;
        var __VLS_173;
        if (item.matchedKeywords?.length) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "recall-keywords" },
            });
            for (const [keyword] of __VLS_getVForSourceType((item.matchedKeywords))) {
                const __VLS_178 = {}.ElTag;
                /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
                // @ts-ignore
                const __VLS_179 = __VLS_asFunctionalComponent(__VLS_178, new __VLS_178({
                    key: (keyword),
                    size: "small",
                    effect: "plain",
                }));
                const __VLS_180 = __VLS_179({
                    key: (keyword),
                    size: "small",
                    effect: "plain",
                }, ...__VLS_functionalComponentArgsRest(__VLS_179));
                __VLS_181.slots.default;
                (keyword);
                var __VLS_181;
            }
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
        (item.excerpt);
    }
}
var __VLS_149;
/** @type {__VLS_StyleScopedClasses['editor-page']} */ ;
/** @type {__VLS_StyleScopedClasses['editor-toolbar']} */ ;
/** @type {__VLS_StyleScopedClasses['eyebrow']} */ ;
/** @type {__VLS_StyleScopedClasses['subtitle']} */ ;
/** @type {__VLS_StyleScopedClasses['toolbar-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['editor-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['chapter-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-head']} */ ;
/** @type {__VLS_StyleScopedClasses['chapter-scroll']} */ ;
/** @type {__VLS_StyleScopedClasses['chapter-item']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['chapter-title']} */ ;
/** @type {__VLS_StyleScopedClasses['chapter-meta']} */ ;
/** @type {__VLS_StyleScopedClasses['writing-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-head']} */ ;
/** @type {__VLS_StyleScopedClasses['chapter-stats']} */ ;
/** @type {__VLS_StyleScopedClasses['writer-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['search-replace-bar']} */ ;
/** @type {__VLS_StyleScopedClasses['search-input']} */ ;
/** @type {__VLS_StyleScopedClasses['search-input']} */ ;
/** @type {__VLS_StyleScopedClasses['search-status']} */ ;
/** @type {__VLS_StyleScopedClasses['writer-surface']} */ ;
/** @type {__VLS_StyleScopedClasses['markdown-editor']} */ ;
/** @type {__VLS_StyleScopedClasses['markdown-preview']} */ ;
/** @type {__VLS_StyleScopedClasses['side-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['index-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-head']} */ ;
/** @type {__VLS_StyleScopedClasses['index-metrics']} */ ;
/** @type {__VLS_StyleScopedClasses['index-updated']} */ ;
/** @type {__VLS_StyleScopedClasses['index-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['version-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-head']} */ ;
/** @type {__VLS_StyleScopedClasses['diff-metrics']} */ ;
/** @type {__VLS_StyleScopedClasses['version-list']} */ ;
/** @type {__VLS_StyleScopedClasses['version-item']} */ ;
/** @type {__VLS_StyleScopedClasses['version-title']} */ ;
/** @type {__VLS_StyleScopedClasses['recall-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-head']} */ ;
/** @type {__VLS_StyleScopedClasses['recall-button']} */ ;
/** @type {__VLS_StyleScopedClasses['recall-results']} */ ;
/** @type {__VLS_StyleScopedClasses['recall-item']} */ ;
/** @type {__VLS_StyleScopedClasses['recall-title-row']} */ ;
/** @type {__VLS_StyleScopedClasses['recall-keywords']} */ ;
// @ts-ignore
var __VLS_109 = __VLS_108;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            DocumentChecked: DocumentChecked,
            Position: Position,
            Refresh: Refresh,
            Search: Search,
            workContext: workContext,
            chapters: chapters,
            selectedChapterId: selectedChapterId,
            selectedChapter: selectedChapter,
            editorContent: editorContent,
            loadingChapters: loadingChapters,
            loadingChapter: loadingChapter,
            saving: saving,
            previewMode: previewMode,
            editorInputRef: editorInputRef,
            searchText: searchText,
            replaceText: replaceText,
            recallQuery: recallQuery,
            recallResults: recallResults,
            searchingRecall: searchingRecall,
            loadingAssist: loadingAssist,
            indexStatus: indexStatus,
            loadingIndexStatus: loadingIndexStatus,
            rebuildingIndex: rebuildingIndex,
            canUseWorkspace: canUseWorkspace,
            currentWordCount: currentWordCount,
            hasUnsavedChanges: hasUnsavedChanges,
            currentTitle: currentTitle,
            versionSnapshots: versionSnapshots,
            diffStats: diffStats,
            markdownHtml: markdownHtml,
            activeMatchLabel: activeMatchLabel,
            indexProgressLabel: indexProgressLabel,
            indexStatusType: indexStatusType,
            formatTime: formatTime,
            statusType: statusType,
            findNextMatch: findNextMatch,
            replaceCurrentMatch: replaceCurrentMatch,
            replaceAllMatches: replaceAllMatches,
            insertRecallResult: insertRecallResult,
            refreshIndexStatus: refreshIndexStatus,
            rebuildIndex: rebuildIndex,
            refreshChapters: refreshChapters,
            saveContent: saveContent,
            runVectorRecall: runVectorRecall,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
