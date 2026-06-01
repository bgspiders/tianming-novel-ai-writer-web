import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { DocumentChecked, Position, Refresh, Search } from '@element-plus/icons-vue';
import { useI18n } from '@/composables/useI18n';
import { useWorkContextStore } from '@/stores/workContext';
import { getEditorIndexStatus, getEditorChapterAssist, listEditorChapters, rebuildEditorIndex, saveEditorChapterContent, searchVectorRecall } from '@/api/modules/editor';
const workContext = useWorkContextStore();
const { t } = useI18n();
const chapters = ref([]);
const selectedChapterId = ref('');
const selectedChapter = ref(null);
const editorContent = ref('');
const baselineContent = ref('');
const loadingChapters = ref(false);
const loadingChapter = ref(false);
const saving = ref(false);
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
const editorInputRef = ref(null);
const canUseWorkspace = computed(() => !!workContext.selectedProjectId);
const hasUnsavedChanges = computed(() => editorContent.value !== baselineContent.value);
const currentWordCount = computed(() => editorContent.value.trim().length);
const currentTitle = computed(() => {
    if (!selectedChapter.value)
        return t('editorWorkspace.labels.noProjectSelected');
    return t('editorWorkspace.labels.chapterTitle', {
        number: selectedChapter.value.chapterNumber,
        title: selectedChapter.value.title
    });
});
const indexStatusType = computed(() => {
    const status = indexStatus.value?.status;
    if (status === 'ready')
        return 'success';
    if (status === 'stale')
        return 'warning';
    if (status === 'failed')
        return 'danger';
    return 'info';
});
const searchMatches = computed(() => {
    if (!searchText.value)
        return [];
    const source = editorContent.value.toLowerCase();
    const target = searchText.value.toLowerCase();
    const matches = [];
    let index = source.indexOf(target);
    while (index !== -1) {
        matches.push({ start: index, end: index + target.length });
        index = source.indexOf(target, index + target.length);
    }
    return matches;
});
const activeMatchLabel = computed(() => {
    if (!searchText.value)
        return t('editorWorkspace.labels.noQuery');
    if (searchMatches.value.length === 0)
        return '0 / 0';
    return `${currentSearchIndex.value + 1} / ${searchMatches.value.length}`;
});
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
function statusLabel(status) {
    if (!status)
        return t('editorWorkspace.labels.unknown');
    const key = `editorWorkspace.labels.status.${status}`;
    const label = t(key);
    return label === key ? status : label;
}
function getEditorTextarea() {
    return editorInputRef.value?.textarea ?? null;
}
async function focusEditorRange(start, end = start) {
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
async function goToSearchMatch(index) {
    currentSearchIndex.value = normalizeSearchIndex(index);
    const match = searchMatches.value[currentSearchIndex.value];
    if (!match)
        return;
    await focusEditorRange(match.start, match.end);
}
async function findNextMatch(step = 1) {
    if (!searchText.value) {
        ElMessage.warning(t('editorWorkspace.messages.enterSearchText'));
        return;
    }
    if (searchMatches.value.length === 0) {
        ElMessage.info(t('editorWorkspace.messages.noMatchesFound'));
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
    await nextTick();
    await goToSearchMatch(currentSearchIndex.value);
}
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function replaceAllMatches() {
    if (!searchText.value) {
        ElMessage.warning(t('editorWorkspace.messages.enterSearchText'));
        return;
    }
    const total = searchMatches.value.length;
    if (total === 0) {
        ElMessage.info(t('editorWorkspace.messages.noMatchesToReplace'));
        return;
    }
    editorContent.value = editorContent.value.replace(new RegExp(escapeRegExp(searchText.value), 'gi'), replaceText.value);
    currentSearchIndex.value = -1;
    ElMessage.success(t('editorWorkspace.messages.replacedMatches', { count: total }));
}
async function insertTextAtCursor(text) {
    const textarea = getEditorTextarea();
    const start = textarea?.selectionStart ?? editorContent.value.length;
    const end = textarea?.selectionEnd ?? editorContent.value.length;
    editorContent.value = `${editorContent.value.slice(0, start)}${text}${editorContent.value.slice(end)}`;
    await focusEditorRange(start + text.length);
}
async function insertRecallResult(item) {
    await insertTextAtCursor(`\n> ${item.source} / ${item.title}\n${item.excerpt}\n`);
    ElMessage.success(t('editorWorkspace.messages.recallSnippetInserted'));
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
            ElMessage.error(err.message || t('editorWorkspace.messages.loadIndexStatusFailed'));
    }
    finally {
        loadingIndexStatus.value = false;
    }
}
async function rebuildIndex() {
    if (!workContext.selectedProjectId) {
        ElMessage.warning(t('editorWorkspace.messages.selectProjectFirst'));
        return;
    }
    rebuildingIndex.value = true;
    try {
        indexStatus.value = await rebuildEditorIndex(workContext.selectedProjectId);
        ElMessage.success(t('editorWorkspace.messages.indexRebuilt'));
    }
    catch (err) {
        ElMessage.error(err.message || t('editorWorkspace.messages.rebuildIndexFailed'));
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
        ElMessage.error(err.message || t('editorWorkspace.messages.loadChaptersFailed'));
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
        recallResults.value = assist.related;
    }
    catch (err) {
        ElMessage.error(err.message || t('editorWorkspace.messages.loadChapterDetailsFailed'));
    }
    finally {
        loadingChapter.value = false;
        loadingAssist.value = false;
    }
}
async function saveContent() {
    if (!selectedChapter.value) {
        ElMessage.warning(t('editorWorkspace.messages.selectChapterFirst'));
        return;
    }
    saving.value = true;
    try {
        const chapter = await saveEditorChapterContent(selectedChapter.value.id, editorContent.value, 'drafted');
        selectedChapter.value = chapter;
        baselineContent.value = chapter.content ?? '';
        editorContent.value = chapter.content ?? '';
        chapters.value = chapters.value.map((item) => (item.id === chapter.id ? chapter : item));
        await refreshIndexStatus(true);
        ElMessage.success(t('editorWorkspace.messages.contentSaved'));
    }
    catch (err) {
        ElMessage.error(err.message || t('editorWorkspace.messages.saveContentFailed'));
    }
    finally {
        saving.value = false;
    }
}
async function runVectorRecall() {
    if (!workContext.selectedProjectId) {
        ElMessage.warning(t('editorWorkspace.messages.selectProjectFirst'));
        return;
    }
    if (!recallQuery.value.trim()) {
        ElMessage.warning(t('editorWorkspace.messages.enterRecallKeywords'));
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
            ElMessage.info(t('editorWorkspace.messages.noRelatedContextFound'));
        }
    }
    catch (err) {
        ElMessage.error(err.message || t('editorWorkspace.messages.vectorRecallFailed'));
    }
    finally {
        searchingRecall.value = false;
    }
}
watch(() => [workContext.selectedProjectId, workContext.selectedVolumeId], refreshChapters);
watch(selectedChapterId, loadSelectedChapter);
watch(() => workContext.selectedProjectId, () => refreshIndexStatus(true));
watch(searchMatches, (matches) => {
    if (matches.length === 0)
        currentSearchIndex.value = -1;
    else if (currentSearchIndex.value >= matches.length)
        currentSearchIndex.value = matches.length - 1;
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
/** @type {__VLS_StyleScopedClasses['markdown-editor']} */ ;
/** @type {__VLS_StyleScopedClasses['index-metrics']} */ ;
/** @type {__VLS_StyleScopedClasses['index-metrics']} */ ;
/** @type {__VLS_StyleScopedClasses['index-metrics']} */ ;
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
(__VLS_ctx.t('editorWorkspace.eyebrow'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({});
(__VLS_ctx.t('editorWorkspace.title'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "subtitle" },
});
(__VLS_ctx.workContext.selectedProject?.name || __VLS_ctx.t('editorWorkspace.labels.noProjectSelected'));
if (__VLS_ctx.workContext.selectedVolume) {
    (__VLS_ctx.t('editorWorkspace.labels.volume', { number: __VLS_ctx.workContext.selectedVolume.volumeNumber }));
    (__VLS_ctx.workContext.selectedVolume.title);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "toolbar-actions" },
});
const __VLS_0 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ 'onClick': {} },
    icon: (__VLS_ctx.Refresh),
    loading: (__VLS_ctx.loadingChapters),
}));
const __VLS_2 = __VLS_1({
    ...{ 'onClick': {} },
    icon: (__VLS_ctx.Refresh),
    loading: (__VLS_ctx.loadingChapters),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
let __VLS_4;
let __VLS_5;
let __VLS_6;
const __VLS_7 = {
    onClick: (__VLS_ctx.refreshChapters)
};
__VLS_3.slots.default;
(__VLS_ctx.t('editorWorkspace.labels.refresh'));
var __VLS_3;
const __VLS_8 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    ...{ 'onClick': {} },
    type: "primary",
    icon: (__VLS_ctx.DocumentChecked),
    loading: (__VLS_ctx.saving),
    disabled: (!__VLS_ctx.selectedChapter),
}));
const __VLS_10 = __VLS_9({
    ...{ 'onClick': {} },
    type: "primary",
    icon: (__VLS_ctx.DocumentChecked),
    loading: (__VLS_ctx.saving),
    disabled: (!__VLS_ctx.selectedChapter),
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
let __VLS_12;
let __VLS_13;
let __VLS_14;
const __VLS_15 = {
    onClick: (__VLS_ctx.saveContent)
};
__VLS_11.slots.default;
(__VLS_ctx.t('editorWorkspace.labels.save'));
var __VLS_11;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "editor-grid" },
});
const __VLS_16 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
    shadow: "never",
    ...{ class: "chapter-panel" },
}));
const __VLS_18 = __VLS_17({
    shadow: "never",
    ...{ class: "chapter-panel" },
}, ...__VLS_functionalComponentArgsRest(__VLS_17));
__VLS_19.slots.default;
{
    const { header: __VLS_thisSlot } = __VLS_19.slots;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "panel-head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.t('editorWorkspace.labels.chapters'));
    const __VLS_20 = {}.ElTag;
    /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
    // @ts-ignore
    const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
        size: "small",
        type: "info",
    }));
    const __VLS_22 = __VLS_21({
        size: "small",
        type: "info",
    }, ...__VLS_functionalComponentArgsRest(__VLS_21));
    __VLS_23.slots.default;
    (__VLS_ctx.chapters.length);
    var __VLS_23;
}
if (!__VLS_ctx.canUseWorkspace) {
    const __VLS_24 = {}.ElEmpty;
    /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
    // @ts-ignore
    const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
        description: (__VLS_ctx.t('editorWorkspace.empty.selectProjectFirst')),
    }));
    const __VLS_26 = __VLS_25({
        description: (__VLS_ctx.t('editorWorkspace.empty.selectProjectFirst')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_25));
}
else if (__VLS_ctx.chapters.length === 0 && !__VLS_ctx.loadingChapters) {
    const __VLS_28 = {}.ElEmpty;
    /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
    // @ts-ignore
    const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
        description: (__VLS_ctx.t('editorWorkspace.empty.noChapters')),
    }));
    const __VLS_30 = __VLS_29({
        description: (__VLS_ctx.t('editorWorkspace.empty.noChapters')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_29));
}
else {
    const __VLS_32 = {}.ElScrollbar;
    /** @type {[typeof __VLS_components.ElScrollbar, typeof __VLS_components.elScrollbar, typeof __VLS_components.ElScrollbar, typeof __VLS_components.elScrollbar, ]} */ ;
    // @ts-ignore
    const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
        ...{ class: "chapter-scroll" },
    }));
    const __VLS_34 = __VLS_33({
        ...{ class: "chapter-scroll" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_33));
    __VLS_asFunctionalDirective(__VLS_directives.vLoading)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.loadingChapters) }, null, null);
    __VLS_35.slots.default;
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
        (__VLS_ctx.t('editorWorkspace.labels.chapterTitle', { number: chapter.chapterNumber, title: chapter.title }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "chapter-meta" },
        });
        const __VLS_36 = {}.ElTag;
        /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
        // @ts-ignore
        const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
            size: "small",
            type: (__VLS_ctx.statusType(chapter.status)),
            effect: "plain",
        }));
        const __VLS_38 = __VLS_37({
            size: "small",
            type: (__VLS_ctx.statusType(chapter.status)),
            effect: "plain",
        }, ...__VLS_functionalComponentArgsRest(__VLS_37));
        __VLS_39.slots.default;
        (__VLS_ctx.statusLabel(chapter.status));
        var __VLS_39;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.t('editorWorkspace.labels.chars', { count: chapter.wordCount || 0 }));
    }
    var __VLS_35;
}
var __VLS_19;
const __VLS_40 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
    shadow: "never",
    ...{ class: "writing-panel" },
}));
const __VLS_42 = __VLS_41({
    shadow: "never",
    ...{ class: "writing-panel" },
}, ...__VLS_functionalComponentArgsRest(__VLS_41));
__VLS_asFunctionalDirective(__VLS_directives.vLoading)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.loadingChapter) }, null, null);
__VLS_43.slots.default;
{
    const { header: __VLS_thisSlot } = __VLS_43.slots;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "panel-head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.currentTitle);
    if (__VLS_ctx.selectedChapter) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
        (__VLS_ctx.t('editorWorkspace.labels.updatedAt', { time: __VLS_ctx.formatTime(__VLS_ctx.selectedChapter.updatedAt) }));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "chapter-stats" },
    });
    if (__VLS_ctx.hasUnsavedChanges) {
        const __VLS_44 = {}.ElTag;
        /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
        // @ts-ignore
        const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
            size: "small",
            type: "warning",
        }));
        const __VLS_46 = __VLS_45({
            size: "small",
            type: "warning",
        }, ...__VLS_functionalComponentArgsRest(__VLS_45));
        __VLS_47.slots.default;
        (__VLS_ctx.t('editorWorkspace.labels.unsaved'));
        var __VLS_47;
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.t('editorWorkspace.labels.chars', { count: __VLS_ctx.currentWordCount }));
}
if (!__VLS_ctx.selectedChapter) {
    const __VLS_48 = {}.ElEmpty;
    /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
    // @ts-ignore
    const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
        description: (__VLS_ctx.t('editorWorkspace.empty.selectChapterToEdit')),
    }));
    const __VLS_50 = __VLS_49({
        description: (__VLS_ctx.t('editorWorkspace.empty.selectChapterToEdit')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_49));
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "writer-wrap" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "search-replace-bar" },
    });
    const __VLS_52 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
        ...{ 'onKeyup': {} },
        modelValue: (__VLS_ctx.searchText),
        ...{ class: "search-input" },
        clearable: true,
        placeholder: (__VLS_ctx.t('editorWorkspace.placeholders.searchCurrentChapter')),
    }));
    const __VLS_54 = __VLS_53({
        ...{ 'onKeyup': {} },
        modelValue: (__VLS_ctx.searchText),
        ...{ class: "search-input" },
        clearable: true,
        placeholder: (__VLS_ctx.t('editorWorkspace.placeholders.searchCurrentChapter')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_53));
    let __VLS_56;
    let __VLS_57;
    let __VLS_58;
    const __VLS_59 = {
        onKeyup: (...[$event]) => {
            if (!!(!__VLS_ctx.selectedChapter))
                return;
            __VLS_ctx.findNextMatch(1);
        }
    };
    var __VLS_55;
    const __VLS_60 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
        ...{ 'onKeyup': {} },
        modelValue: (__VLS_ctx.replaceText),
        ...{ class: "search-input" },
        clearable: true,
        placeholder: (__VLS_ctx.t('editorWorkspace.placeholders.replacementText')),
    }));
    const __VLS_62 = __VLS_61({
        ...{ 'onKeyup': {} },
        modelValue: (__VLS_ctx.replaceText),
        ...{ class: "search-input" },
        clearable: true,
        placeholder: (__VLS_ctx.t('editorWorkspace.placeholders.replacementText')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_61));
    let __VLS_64;
    let __VLS_65;
    let __VLS_66;
    const __VLS_67 = {
        onKeyup: (__VLS_ctx.replaceCurrentMatch)
    };
    var __VLS_63;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "search-status" },
    });
    (__VLS_ctx.activeMatchLabel);
    const __VLS_68 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
        ...{ 'onClick': {} },
        disabled: (!__VLS_ctx.searchText),
    }));
    const __VLS_70 = __VLS_69({
        ...{ 'onClick': {} },
        disabled: (!__VLS_ctx.searchText),
    }, ...__VLS_functionalComponentArgsRest(__VLS_69));
    let __VLS_72;
    let __VLS_73;
    let __VLS_74;
    const __VLS_75 = {
        onClick: (...[$event]) => {
            if (!!(!__VLS_ctx.selectedChapter))
                return;
            __VLS_ctx.findNextMatch(-1);
        }
    };
    __VLS_71.slots.default;
    (__VLS_ctx.t('editorWorkspace.actions.prev'));
    var __VLS_71;
    const __VLS_76 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({
        ...{ 'onClick': {} },
        disabled: (!__VLS_ctx.searchText),
    }));
    const __VLS_78 = __VLS_77({
        ...{ 'onClick': {} },
        disabled: (!__VLS_ctx.searchText),
    }, ...__VLS_functionalComponentArgsRest(__VLS_77));
    let __VLS_80;
    let __VLS_81;
    let __VLS_82;
    const __VLS_83 = {
        onClick: (...[$event]) => {
            if (!!(!__VLS_ctx.selectedChapter))
                return;
            __VLS_ctx.findNextMatch(1);
        }
    };
    __VLS_79.slots.default;
    (__VLS_ctx.t('editorWorkspace.actions.next'));
    var __VLS_79;
    const __VLS_84 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({
        ...{ 'onClick': {} },
        disabled: (!__VLS_ctx.searchText),
    }));
    const __VLS_86 = __VLS_85({
        ...{ 'onClick': {} },
        disabled: (!__VLS_ctx.searchText),
    }, ...__VLS_functionalComponentArgsRest(__VLS_85));
    let __VLS_88;
    let __VLS_89;
    let __VLS_90;
    const __VLS_91 = {
        onClick: (__VLS_ctx.replaceCurrentMatch)
    };
    __VLS_87.slots.default;
    (__VLS_ctx.t('editorWorkspace.actions.replace'));
    var __VLS_87;
    const __VLS_92 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({
        ...{ 'onClick': {} },
        type: "primary",
        plain: true,
        disabled: (!__VLS_ctx.searchText),
    }));
    const __VLS_94 = __VLS_93({
        ...{ 'onClick': {} },
        type: "primary",
        plain: true,
        disabled: (!__VLS_ctx.searchText),
    }, ...__VLS_functionalComponentArgsRest(__VLS_93));
    let __VLS_96;
    let __VLS_97;
    let __VLS_98;
    const __VLS_99 = {
        onClick: (__VLS_ctx.replaceAllMatches)
    };
    __VLS_95.slots.default;
    (__VLS_ctx.t('editorWorkspace.actions.replaceAll'));
    var __VLS_95;
    const __VLS_100 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_101 = __VLS_asFunctionalComponent(__VLS_100, new __VLS_100({
        ref: "editorInputRef",
        modelValue: (__VLS_ctx.editorContent),
        ...{ class: "markdown-editor" },
        type: "textarea",
        resize: "none",
        placeholder: (__VLS_ctx.t('editorWorkspace.placeholders.editorContent')),
    }));
    const __VLS_102 = __VLS_101({
        ref: "editorInputRef",
        modelValue: (__VLS_ctx.editorContent),
        ...{ class: "markdown-editor" },
        type: "textarea",
        resize: "none",
        placeholder: (__VLS_ctx.t('editorWorkspace.placeholders.editorContent')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_101));
    /** @type {typeof __VLS_ctx.editorInputRef} */ ;
    var __VLS_104 = {};
    var __VLS_103;
}
var __VLS_43;
__VLS_asFunctionalElement(__VLS_intrinsicElements.aside, __VLS_intrinsicElements.aside)({
    ...{ class: "side-stack" },
});
const __VLS_106 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_107 = __VLS_asFunctionalComponent(__VLS_106, new __VLS_106({
    shadow: "never",
    ...{ class: "index-panel" },
}));
const __VLS_108 = __VLS_107({
    shadow: "never",
    ...{ class: "index-panel" },
}, ...__VLS_functionalComponentArgsRest(__VLS_107));
__VLS_109.slots.default;
{
    const { header: __VLS_thisSlot } = __VLS_109.slots;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "panel-head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.t('editorWorkspace.labels.editorIndex'));
    const __VLS_110 = {}.ElTag;
    /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
    // @ts-ignore
    const __VLS_111 = __VLS_asFunctionalComponent(__VLS_110, new __VLS_110({
        size: "small",
        type: (__VLS_ctx.indexStatusType),
    }));
    const __VLS_112 = __VLS_111({
        size: "small",
        type: (__VLS_ctx.indexStatusType),
    }, ...__VLS_functionalComponentArgsRest(__VLS_111));
    __VLS_113.slots.default;
    (__VLS_ctx.statusLabel(__VLS_ctx.indexStatus?.status));
    var __VLS_113;
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "index-metrics" },
});
__VLS_asFunctionalDirective(__VLS_directives.vLoading)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.loadingIndexStatus) }, null, null);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.t('editorWorkspace.labels.indexedChapters'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
(__VLS_ctx.indexStatus ? `${__VLS_ctx.indexStatus.indexedChapterCount}/${__VLS_ctx.indexStatus.totalChapterCount}` : '-');
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.t('editorWorkspace.labels.keywords'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
(__VLS_ctx.indexStatus?.keywordCount ?? '-');
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.t('editorWorkspace.labels.staleChapters'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
(__VLS_ctx.indexStatus?.staleChapterCount ?? 0);
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "index-updated" },
});
(__VLS_ctx.t('editorWorkspace.labels.lastBuilt', { time: __VLS_ctx.formatTime(__VLS_ctx.indexStatus?.lastBuiltAt) }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "index-actions" },
});
const __VLS_114 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_115 = __VLS_asFunctionalComponent(__VLS_114, new __VLS_114({
    ...{ 'onClick': {} },
    icon: (__VLS_ctx.Refresh),
    loading: (__VLS_ctx.loadingIndexStatus),
}));
const __VLS_116 = __VLS_115({
    ...{ 'onClick': {} },
    icon: (__VLS_ctx.Refresh),
    loading: (__VLS_ctx.loadingIndexStatus),
}, ...__VLS_functionalComponentArgsRest(__VLS_115));
let __VLS_118;
let __VLS_119;
let __VLS_120;
const __VLS_121 = {
    onClick: (...[$event]) => {
        __VLS_ctx.refreshIndexStatus();
    }
};
__VLS_117.slots.default;
(__VLS_ctx.t('editorWorkspace.labels.refreshStatus'));
var __VLS_117;
const __VLS_122 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_123 = __VLS_asFunctionalComponent(__VLS_122, new __VLS_122({
    ...{ 'onClick': {} },
    type: "primary",
    plain: true,
    loading: (__VLS_ctx.rebuildingIndex),
    disabled: (!__VLS_ctx.workContext.selectedProjectId),
}));
const __VLS_124 = __VLS_123({
    ...{ 'onClick': {} },
    type: "primary",
    plain: true,
    loading: (__VLS_ctx.rebuildingIndex),
    disabled: (!__VLS_ctx.workContext.selectedProjectId),
}, ...__VLS_functionalComponentArgsRest(__VLS_123));
let __VLS_126;
let __VLS_127;
let __VLS_128;
const __VLS_129 = {
    onClick: (__VLS_ctx.rebuildIndex)
};
__VLS_125.slots.default;
(__VLS_ctx.t('editorWorkspace.labels.rebuildIndex'));
var __VLS_125;
var __VLS_109;
const __VLS_130 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_131 = __VLS_asFunctionalComponent(__VLS_130, new __VLS_130({
    shadow: "never",
    ...{ class: "recall-panel" },
}));
const __VLS_132 = __VLS_131({
    shadow: "never",
    ...{ class: "recall-panel" },
}, ...__VLS_functionalComponentArgsRest(__VLS_131));
__VLS_133.slots.default;
{
    const { header: __VLS_thisSlot } = __VLS_133.slots;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "panel-head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.t('editorWorkspace.labels.vectorRecall'));
    const __VLS_134 = {}.ElTag;
    /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
    // @ts-ignore
    const __VLS_135 = __VLS_asFunctionalComponent(__VLS_134, new __VLS_134({
        size: "small",
        type: "success",
    }));
    const __VLS_136 = __VLS_135({
        size: "small",
        type: "success",
    }, ...__VLS_functionalComponentArgsRest(__VLS_135));
    __VLS_137.slots.default;
    (__VLS_ctx.t('editorWorkspace.labels.context'));
    var __VLS_137;
}
const __VLS_138 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_139 = __VLS_asFunctionalComponent(__VLS_138, new __VLS_138({
    modelValue: (__VLS_ctx.recallQuery),
    type: "textarea",
    rows: (3),
    placeholder: (__VLS_ctx.t('editorWorkspace.placeholders.recallQuery')),
}));
const __VLS_140 = __VLS_139({
    modelValue: (__VLS_ctx.recallQuery),
    type: "textarea",
    rows: (3),
    placeholder: (__VLS_ctx.t('editorWorkspace.placeholders.recallQuery')),
}, ...__VLS_functionalComponentArgsRest(__VLS_139));
const __VLS_142 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_143 = __VLS_asFunctionalComponent(__VLS_142, new __VLS_142({
    ...{ 'onClick': {} },
    ...{ class: "recall-button" },
    icon: (__VLS_ctx.Search),
    loading: (__VLS_ctx.searchingRecall),
    disabled: (!__VLS_ctx.workContext.selectedProjectId),
}));
const __VLS_144 = __VLS_143({
    ...{ 'onClick': {} },
    ...{ class: "recall-button" },
    icon: (__VLS_ctx.Search),
    loading: (__VLS_ctx.searchingRecall),
    disabled: (!__VLS_ctx.workContext.selectedProjectId),
}, ...__VLS_functionalComponentArgsRest(__VLS_143));
let __VLS_146;
let __VLS_147;
let __VLS_148;
const __VLS_149 = {
    onClick: (__VLS_ctx.runVectorRecall)
};
__VLS_145.slots.default;
(__VLS_ctx.t('editorWorkspace.actions.searchRecall'));
var __VLS_145;
if (__VLS_ctx.recallResults.length === 0) {
    const __VLS_150 = {}.ElEmpty;
    /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
    // @ts-ignore
    const __VLS_151 = __VLS_asFunctionalComponent(__VLS_150, new __VLS_150({
        description: (__VLS_ctx.t('editorWorkspace.empty.noRelatedContext')),
    }));
    const __VLS_152 = __VLS_151({
        description: (__VLS_ctx.t('editorWorkspace.empty.noRelatedContext')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_151));
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
        const __VLS_154 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_155 = __VLS_asFunctionalComponent(__VLS_154, new __VLS_154({
            ...{ 'onClick': {} },
            size: "small",
            icon: (__VLS_ctx.Position),
            disabled: (!__VLS_ctx.selectedChapter),
        }));
        const __VLS_156 = __VLS_155({
            ...{ 'onClick': {} },
            size: "small",
            icon: (__VLS_ctx.Position),
            disabled: (!__VLS_ctx.selectedChapter),
        }, ...__VLS_functionalComponentArgsRest(__VLS_155));
        let __VLS_158;
        let __VLS_159;
        let __VLS_160;
        const __VLS_161 = {
            onClick: (...[$event]) => {
                if (!!(__VLS_ctx.recallResults.length === 0))
                    return;
                __VLS_ctx.insertRecallResult(item);
            }
        };
        __VLS_157.slots.default;
        (__VLS_ctx.t('editorWorkspace.labels.insert'));
        var __VLS_157;
        if (item.matchedKeywords?.length) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "recall-keywords" },
            });
            for (const [keyword] of __VLS_getVForSourceType((item.matchedKeywords))) {
                const __VLS_162 = {}.ElTag;
                /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
                // @ts-ignore
                const __VLS_163 = __VLS_asFunctionalComponent(__VLS_162, new __VLS_162({
                    key: (keyword),
                    size: "small",
                    effect: "plain",
                }));
                const __VLS_164 = __VLS_163({
                    key: (keyword),
                    size: "small",
                    effect: "plain",
                }, ...__VLS_functionalComponentArgsRest(__VLS_163));
                __VLS_165.slots.default;
                (keyword);
                var __VLS_165;
            }
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
        (item.excerpt);
    }
}
var __VLS_133;
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
/** @type {__VLS_StyleScopedClasses['markdown-editor']} */ ;
/** @type {__VLS_StyleScopedClasses['side-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['index-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-head']} */ ;
/** @type {__VLS_StyleScopedClasses['index-metrics']} */ ;
/** @type {__VLS_StyleScopedClasses['index-updated']} */ ;
/** @type {__VLS_StyleScopedClasses['index-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['recall-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-head']} */ ;
/** @type {__VLS_StyleScopedClasses['recall-button']} */ ;
/** @type {__VLS_StyleScopedClasses['recall-results']} */ ;
/** @type {__VLS_StyleScopedClasses['recall-item']} */ ;
/** @type {__VLS_StyleScopedClasses['recall-title-row']} */ ;
/** @type {__VLS_StyleScopedClasses['recall-keywords']} */ ;
// @ts-ignore
var __VLS_105 = __VLS_104;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            DocumentChecked: DocumentChecked,
            Position: Position,
            Refresh: Refresh,
            Search: Search,
            workContext: workContext,
            t: t,
            chapters: chapters,
            selectedChapterId: selectedChapterId,
            selectedChapter: selectedChapter,
            editorContent: editorContent,
            loadingChapters: loadingChapters,
            loadingChapter: loadingChapter,
            saving: saving,
            searchText: searchText,
            replaceText: replaceText,
            recallQuery: recallQuery,
            recallResults: recallResults,
            searchingRecall: searchingRecall,
            loadingAssist: loadingAssist,
            indexStatus: indexStatus,
            loadingIndexStatus: loadingIndexStatus,
            rebuildingIndex: rebuildingIndex,
            editorInputRef: editorInputRef,
            canUseWorkspace: canUseWorkspace,
            hasUnsavedChanges: hasUnsavedChanges,
            currentWordCount: currentWordCount,
            currentTitle: currentTitle,
            indexStatusType: indexStatusType,
            activeMatchLabel: activeMatchLabel,
            formatTime: formatTime,
            statusType: statusType,
            statusLabel: statusLabel,
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
