import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Edit, Delete, Refresh, FolderAdd, Search } from '@element-plus/icons-vue';
import { useWorkContextStore } from '@/stores/workContext';
import { DESIGN_MODULES, worldRulesApi, characterRulesApi, factionRulesApi, locationRulesApi, plotRulesApi, creativeMaterialsApi, bookAnalysesApi, outlinesApi, volumeDesignsApi, chapterPlansApi, chapterBlueprintsApi } from '@/api/modules/design';
import { getCategoryTree, createCategory, updateCategory, reorderCategories, deleteCategory } from '@/api/modules/categories';
import { listSourceBooks, createSourceBook } from '@/api/modules/sourceBooks';
import DesignFormField from '@/components/design/DesignFormField.vue';
import { MODULE_SCHEMAS, buildEmptyForm } from '@/components/design/moduleSchemas';
const route = useRoute();
const router = useRouter();
const workContext = useWorkContextStore();
// --- 路由模块 ---
const moduleKey = computed(() => {
    const k = route.params.module;
    const valid = DESIGN_MODULES.find((m) => m.key === k);
    return (valid?.key ?? 'world_rules');
});
const moduleMeta = computed(() => DESIGN_MODULES.find((m) => m.key === moduleKey.value));
const schema = computed(() => MODULE_SCHEMAS[moduleKey.value]);
// --- API 选择 ---
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
        case 'id': return row.id;
        case 'volumeNumber': return row.volumeNumber;
        case 'title': return (row.title ?? row.volumeTitle ?? row.name ?? '');
        case 'name':
        default: return (row.name ?? row.title ?? '');
    }
}
function getPickerLabel(row, source) {
    if (source === 'volumes') {
        return `第 ${row.volumeNumber} 卷 · ${row.title}`;
    }
    return String(row.name ?? row.title ?? row.id ?? '');
}
async function refreshPickers() {
    const scoped = moduleMeta.value.hasSourceBookScope ? selectedSourceBookId.value || null : null;
    const projectId = workContext.selectedProjectId || null;
    const [characters, factions, locations] = await Promise.all([
        characterRulesApi.list({ sourceBookId: scoped, projectId, isEnabled: true }),
        factionRulesApi.list({ sourceBookId: scoped, projectId, isEnabled: true }),
        locationRulesApi.list({ sourceBookId: scoped, projectId, isEnabled: true })
    ]);
    pickerRows.value = {
        characters: characters,
        factions: factions,
        locations: locations,
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
        .filter((o) => o.value !== '');
}
function invalidReferenceMessage(field, currentValue) {
    if (!field.pickerSource || currentValue === null || currentValue === undefined || currentValue === '')
        return '';
    const options = optionsFor(field);
    if (Array.isArray(currentValue)) {
        const missing = currentValue.filter((v) => !options.some((o) => o.value === v));
        return missing.length ? `当前有 ${missing.length} 个引用不在候选项中: ${missing.join('、')}` : '';
    }
    return options.some((o) => o.value === currentValue)
        ? ''
        : `当前值 "${String(currentValue)}" 不在候选项中,请确认是否已删除或切换了源书。`;
}
function hasPickerOption(options, value) {
    return options.some((o) => o.value === value);
}
function clearInvalidReferences(field) {
    if (!field.pickerSource)
        return;
    const currentValue = editorForm.value[field.key];
    const options = optionsFor(field);
    if (Array.isArray(currentValue)) {
        const validValues = currentValue.filter((v) => hasPickerOption(options, v));
        const removedCount = currentValue.length - validValues.length;
        editorForm.value[field.key] = validValues;
        if (removedCount > 0) {
            ElMessage.success(`已清理 ${removedCount} 个失效引用`);
        }
        return;
    }
    if (currentValue !== null && currentValue !== undefined && currentValue !== '' && !hasPickerOption(options, currentValue)) {
        editorForm.value[field.key] = field.type === 'select' ? null : '';
        ElMessage.success('已清理失效引用');
    }
}
async function rematchReferences(field) {
    if (!field.pickerSource)
        return;
    try {
        await refreshPickers();
        const message = invalidReferenceMessage(field, editorForm.value[field.key]);
        if (message) {
            ElMessage.warning('已重新匹配候选项,仍有引用失效');
        }
        else {
            ElMessage.success('已重新匹配引用');
        }
    }
    catch (err) {
        ElMessage.error(err.message ?? '重新匹配失败');
    }
}
// --- SourceBook 切换 ---
const sourceBooks = ref([]);
const selectedSourceBookId = ref('');
async function refreshSourceBooks() {
    try {
        sourceBooks.value = await listSourceBooks();
        if (!selectedSourceBookId.value && workContext.selectedProject?.currentSourceBookId) {
            selectedSourceBookId.value = workContext.selectedProject.currentSourceBookId;
        }
    }
    catch (err) {
        ElMessage.error(err.message ?? '加载源书失败');
    }
}
const newSourceBookName = ref('');
const newSourceBookVisible = ref(false);
async function quickCreateSourceBook() {
    if (!newSourceBookName.value.trim()) {
        ElMessage.warning('请输入源书名称');
        return;
    }
    try {
        const sb = await createSourceBook({ name: newSourceBookName.value.trim() });
        sourceBooks.value = [sb, ...sourceBooks.value];
        selectedSourceBookId.value = sb.id;
        newSourceBookVisible.value = false;
        newSourceBookName.value = '';
        ElMessage.success('源书已创建');
    }
    catch (err) {
        ElMessage.error(err.message ?? '创建失败');
    }
}
async function bindSourceBookToProject() {
    if (!workContext.selectedProjectId) {
        ElMessage.warning('请先选择项目');
        return;
    }
    try {
        await workContext.updateSelectedProjectSourceBook(selectedSourceBookId.value || null);
        ElMessage.success('已设为当前项目默认源书');
    }
    catch (err) {
        ElMessage.error(err.message ?? '绑定失败');
    }
}
// --- Category 树 ---
const categoryTree = ref([]);
const loadingCategories = ref(false);
const selectedCategoryId = ref(null);
const treeRef = ref();
async function refreshCategories() {
    loadingCategories.value = true;
    try {
        categoryTree.value = await getCategoryTree(moduleKey.value, moduleMeta.value.hasSourceBookScope ? selectedSourceBookId.value || null : null, workContext.selectedProjectId || null);
    }
    catch (err) {
        ElMessage.error(err.message ?? '加载分类失败');
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
        { label: `${'　'.repeat(depth)}${node.name}`, value: node.id },
        ...flattenCategories(node.children ?? [], depth + 1)
    ]);
}
const categoryParentOptions = computed(() => flattenCategories(categoryTree.value).filter((o) => o.value !== categoryEditId.value));
function openCreateCategory(parent) {
    categoryDialogMode.value = 'create';
    categoryEditId.value = '';
    categoryForm.value = {
        moduleType: moduleKey.value,
        name: '',
        parentId: parent?.id ?? null,
        sortOrder: 0,
        isEnabled: true,
        sourceBookId: moduleMeta.value.hasSourceBookScope ? (selectedSourceBookId.value || null) : null,
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
            ElMessage.success('分类已创建');
        }
        else {
            await updateCategory(categoryEditId.value, categoryForm.value);
            ElMessage.success('分类已更新');
        }
        categoryDialogVisible.value = false;
        await refreshCategories();
    }
    catch (err) {
        ElMessage.error(err.message ?? '保存失败');
    }
}
async function removeCategory(node) {
    if (node.isBuiltIn) {
        ElMessage.warning('内置分类不可删除');
        return;
    }
    try {
        await ElMessageBox.confirm(`删除分类 "${node.name}"?`, '确认', { type: 'warning' });
    }
    catch {
        return;
    }
    try {
        await deleteCategory(node.id);
        ElMessage.success('已删除');
        if (selectedCategoryId.value === node.id)
            selectedCategoryId.value = null;
        await refreshCategories();
    }
    catch (err) {
        ElMessage.error(err.message ?? '删除失败');
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
            sourceBookId: moduleMeta.value.hasSourceBookScope ? (selectedSourceBookId.value || null) : null,
            projectId: workContext.selectedProjectId || null,
            items: flattenCategoryOrder(categoryTree.value)
        });
        await refreshCategories();
    }
    catch (err) {
        ElMessage.error(err.message ?? '分类排序保存失败');
        await refreshCategories();
    }
}
// --- 数据列表 ---
const items = ref([]);
const loadingItems = ref(false);
const keyword = ref('');
const isEnabledFilter = ref('all');
const includeUncategorized = ref(false);
const updatedRange = ref([]);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
function buildListParams() {
    return {
        categoryId: includeUncategorized.value ? null : selectedCategoryId.value,
        sourceBookId: moduleMeta.value.hasSourceBookScope ? (selectedSourceBookId.value || null) : null,
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
        ElMessage.error(err.message ?? '加载列表失败');
    }
    finally {
        loadingItems.value = false;
    }
}
async function refreshWorkspaceData() {
    await Promise.all([
        refreshCategories(),
        refreshItems(),
        refreshPickers()
    ]);
}
// --- 编辑器 ---
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
    editorForm.value.sourceBookId = moduleMeta.value.hasSourceBookScope ? (selectedSourceBookId.value || null) : null;
    editorForm.value.projectId = workContext.selectedProjectId || null;
    editorTab.value = schema.value.tabs[0]?.key ?? '';
    editorVisible.value = true;
}
async function openEdit(row) {
    editorMode.value = 'edit';
    editorId.value = row.id;
    try {
        const detail = (await activeApi.value.get(row.id));
        editorForm.value = { ...buildEmptyForm(moduleKey.value), ...detail };
        editorForm.value.projectId = workContext.selectedProjectId || null;
        editorTab.value = schema.value.tabs[0]?.key ?? '';
        editorVisible.value = true;
    }
    catch (err) {
        ElMessage.error(err.message ?? '加载详情失败');
    }
}
async function saveEditor() {
    if (!editorForm.value.name) {
        ElMessage.warning('名称必填');
        return;
    }
    saving.value = true;
    try {
        if (editorMode.value === 'create') {
            await activeApi.value.create(editorForm.value);
            ElMessage.success('已创建');
        }
        else {
            await activeApi.value.update(editorId.value, editorForm.value);
            ElMessage.success('已更新');
        }
        editorVisible.value = false;
        await refreshItems();
        await refreshCategories(); // 刷新计数
    }
    catch (err) {
        ElMessage.error(err.message ?? '保存失败');
    }
    finally {
        saving.value = false;
    }
}
async function removeItem(row) {
    try {
        await ElMessageBox.confirm(`删除 "${row.name}"?`, '确认', { type: 'warning' });
    }
    catch {
        return;
    }
    try {
        await activeApi.value.remove(row.id);
        ElMessage.success('已删除');
        await refreshItems();
        await refreshCategories();
    }
    catch (err) {
        ElMessage.error(err.message ?? '删除失败');
    }
}
// --- 字段渲染辅助 ---
function getField(key) {
    for (const f of schema.value.commonFields)
        if (f.key === key)
            return f;
    for (const t of schema.value.tabs)
        for (const f of t.fields)
            if (f.key === key)
                return f;
    return undefined;
}
function formatCellValue(row, col) {
    const v = row[col.key];
    if (v === null || v === undefined)
        return '—';
    if (Array.isArray(v))
        return v.join('、');
    const s = String(v);
    return s.length > 60 ? s.slice(0, 60) + '…' : s;
}
// --- 模块/源书切换 ---
function switchModule(key) {
    router.push({ name: 'design-module', params: { module: key } });
}
watch(moduleKey, async () => {
    selectedCategoryId.value = null;
    page.value = 1;
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
    refreshItems();
});
watch([isEnabledFilter, includeUncategorized, updatedRange], () => {
    page.value = 1;
    refreshItems();
});
watch(() => workContext.selectedProjectId, async () => {
    selectedSourceBookId.value = workContext.selectedProject?.currentSourceBookId ?? '';
    page.value = 1;
    await refreshWorkspaceData();
});
watch(() => workContext.selectedVolumeId, refreshPickers);
watch(() => workContext.volumes, refreshPickers, { deep: true });
onMounted(async () => {
    await workContext.init();
    await refreshSourceBooks();
    await refreshWorkspaceData();
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
for (const [m] of __VLS_getVForSourceType((__VLS_ctx.DESIGN_MODULES))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.switchModule(m.key);
            } },
        key: (m.key),
        ...{ class: (['module-tab', { active: m.key === __VLS_ctx.moduleKey }]) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "icon" },
    });
    (m.icon);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (m.label);
}
if (__VLS_ctx.moduleMeta.hasSourceBookScope) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "sourcebook-area" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "label" },
    });
    const __VLS_4 = {}.ElSelect;
    /** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
    // @ts-ignore
    const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
        modelValue: (__VLS_ctx.selectedSourceBookId),
        placeholder: "全部",
        clearable: true,
        size: "small",
        ...{ style: {} },
    }));
    const __VLS_6 = __VLS_5({
        modelValue: (__VLS_ctx.selectedSourceBookId),
        placeholder: "全部",
        clearable: true,
        size: "small",
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_5));
    __VLS_7.slots.default;
    const __VLS_8 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
        label: "(全局共享)",
        value: "",
    }));
    const __VLS_10 = __VLS_9({
        label: "(全局共享)",
        value: "",
    }, ...__VLS_functionalComponentArgsRest(__VLS_9));
    for (const [sb] of __VLS_getVForSourceType((__VLS_ctx.sourceBooks))) {
        const __VLS_12 = {}.ElOption;
        /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
        // @ts-ignore
        const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
            key: (sb.id),
            label: (sb.name),
            value: (sb.id),
        }));
        const __VLS_14 = __VLS_13({
            key: (sb.id),
            label: (sb.name),
            value: (sb.id),
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
    (__VLS_ctx.moduleMeta.label);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
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
    ...{ class: (['cat-item all', { active: !__VLS_ctx.selectedCategoryId }]) },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
const __VLS_52 = {}.ElTree;
/** @type {[typeof __VLS_components.ElTree, typeof __VLS_components.elTree, typeof __VLS_components.ElTree, typeof __VLS_components.elTree, ]} */ ;
// @ts-ignore
const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
    ...{ 'onNodeDrop': {} },
    ref: "treeRef",
    data: (__VLS_ctx.categoryTree),
    nodeKey: "id",
    draggable: true,
    defaultExpandAll: (true),
    expandOnClickNode: (false),
    highlightCurrent: (true),
    emptyText: "暂无分类",
}));
const __VLS_54 = __VLS_53({
    ...{ 'onNodeDrop': {} },
    ref: "treeRef",
    data: (__VLS_ctx.categoryTree),
    nodeKey: "id",
    draggable: true,
    defaultExpandAll: (true),
    expandOnClickNode: (false),
    highlightCurrent: (true),
    emptyText: "暂无分类",
}, ...__VLS_functionalComponentArgsRest(__VLS_53));
let __VLS_56;
let __VLS_57;
let __VLS_58;
const __VLS_59 = {
    onNodeDrop: (__VLS_ctx.saveCategoryOrder)
};
/** @type {typeof __VLS_ctx.treeRef} */ ;
var __VLS_60 = {};
__VLS_55.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_55.slots;
    const [{ node, data }] = __VLS_getSlotParams(__VLS_thisSlot);
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
        const __VLS_62 = {}.ElTag;
        /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
        // @ts-ignore
        const __VLS_63 = __VLS_asFunctionalComponent(__VLS_62, new __VLS_62({
            size: "small",
            type: "info",
            effect: "plain",
        }));
        const __VLS_64 = __VLS_63({
            size: "small",
            type: "info",
            effect: "plain",
        }, ...__VLS_functionalComponentArgsRest(__VLS_63));
        __VLS_65.slots.default;
        var __VLS_65;
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "cat-count" },
    });
    (data.itemCount);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "cat-actions" },
    });
    const __VLS_66 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_67 = __VLS_asFunctionalComponent(__VLS_66, new __VLS_66({
        ...{ 'onClick': {} },
        text: true,
        size: "small",
        icon: (__VLS_ctx.Plus),
    }));
    const __VLS_68 = __VLS_67({
        ...{ 'onClick': {} },
        text: true,
        size: "small",
        icon: (__VLS_ctx.Plus),
    }, ...__VLS_functionalComponentArgsRest(__VLS_67));
    let __VLS_70;
    let __VLS_71;
    let __VLS_72;
    const __VLS_73 = {
        onClick: (...[$event]) => {
            __VLS_ctx.openCreateCategory(data);
        }
    };
    var __VLS_69;
    const __VLS_74 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_75 = __VLS_asFunctionalComponent(__VLS_74, new __VLS_74({
        ...{ 'onClick': {} },
        text: true,
        size: "small",
        icon: (__VLS_ctx.Edit),
    }));
    const __VLS_76 = __VLS_75({
        ...{ 'onClick': {} },
        text: true,
        size: "small",
        icon: (__VLS_ctx.Edit),
    }, ...__VLS_functionalComponentArgsRest(__VLS_75));
    let __VLS_78;
    let __VLS_79;
    let __VLS_80;
    const __VLS_81 = {
        onClick: (...[$event]) => {
            __VLS_ctx.openEditCategory(data);
        }
    };
    var __VLS_77;
    if (!data.isBuiltIn) {
        const __VLS_82 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_83 = __VLS_asFunctionalComponent(__VLS_82, new __VLS_82({
            ...{ 'onClick': {} },
            text: true,
            size: "small",
            icon: (__VLS_ctx.Delete),
            type: "danger",
        }));
        const __VLS_84 = __VLS_83({
            ...{ 'onClick': {} },
            text: true,
            size: "small",
            icon: (__VLS_ctx.Delete),
            type: "danger",
        }, ...__VLS_functionalComponentArgsRest(__VLS_83));
        let __VLS_86;
        let __VLS_87;
        let __VLS_88;
        const __VLS_89 = {
            onClick: (...[$event]) => {
                if (!(!data.isBuiltIn))
                    return;
                __VLS_ctx.removeCategory(data);
            }
        };
        var __VLS_85;
    }
}
var __VLS_55;
var __VLS_35;
const __VLS_90 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_91 = __VLS_asFunctionalComponent(__VLS_90, new __VLS_90({
    shadow: "never",
    ...{ class: "list-panel" },
}));
const __VLS_92 = __VLS_91({
    shadow: "never",
    ...{ class: "list-panel" },
}, ...__VLS_functionalComponentArgsRest(__VLS_91));
__VLS_93.slots.default;
{
    const { header: __VLS_thisSlot } = __VLS_93.slots;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "panel-head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.moduleMeta.label);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "head-actions" },
    });
    const __VLS_94 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_95 = __VLS_asFunctionalComponent(__VLS_94, new __VLS_94({
        ...{ 'onChange': {} },
        modelValue: (__VLS_ctx.keyword),
        placeholder: "名称关键字",
        clearable: true,
        size: "small",
        ...{ style: {} },
        prefixIcon: (__VLS_ctx.Search),
    }));
    const __VLS_96 = __VLS_95({
        ...{ 'onChange': {} },
        modelValue: (__VLS_ctx.keyword),
        placeholder: "名称关键字",
        clearable: true,
        size: "small",
        ...{ style: {} },
        prefixIcon: (__VLS_ctx.Search),
    }, ...__VLS_functionalComponentArgsRest(__VLS_95));
    let __VLS_98;
    let __VLS_99;
    let __VLS_100;
    const __VLS_101 = {
        onChange: (...[$event]) => {
            __VLS_ctx.page = 1;
            __VLS_ctx.refreshItems();
        }
    };
    var __VLS_97;
    const __VLS_102 = {}.ElSelect;
    /** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
    // @ts-ignore
    const __VLS_103 = __VLS_asFunctionalComponent(__VLS_102, new __VLS_102({
        modelValue: (__VLS_ctx.isEnabledFilter),
        size: "small",
        ...{ style: {} },
    }));
    const __VLS_104 = __VLS_103({
        modelValue: (__VLS_ctx.isEnabledFilter),
        size: "small",
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_103));
    __VLS_105.slots.default;
    const __VLS_106 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_107 = __VLS_asFunctionalComponent(__VLS_106, new __VLS_106({
        label: "全部状态",
        value: "all",
    }));
    const __VLS_108 = __VLS_107({
        label: "全部状态",
        value: "all",
    }, ...__VLS_functionalComponentArgsRest(__VLS_107));
    const __VLS_110 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_111 = __VLS_asFunctionalComponent(__VLS_110, new __VLS_110({
        label: "启用",
        value: "enabled",
    }));
    const __VLS_112 = __VLS_111({
        label: "启用",
        value: "enabled",
    }, ...__VLS_functionalComponentArgsRest(__VLS_111));
    const __VLS_114 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_115 = __VLS_asFunctionalComponent(__VLS_114, new __VLS_114({
        label: "禁用",
        value: "disabled",
    }));
    const __VLS_116 = __VLS_115({
        label: "禁用",
        value: "disabled",
    }, ...__VLS_functionalComponentArgsRest(__VLS_115));
    var __VLS_105;
    const __VLS_118 = {}.ElDatePicker;
    /** @type {[typeof __VLS_components.ElDatePicker, typeof __VLS_components.elDatePicker, ]} */ ;
    // @ts-ignore
    const __VLS_119 = __VLS_asFunctionalComponent(__VLS_118, new __VLS_118({
        modelValue: (__VLS_ctx.updatedRange),
        type: "datetimerange",
        startPlaceholder: "更新起",
        endPlaceholder: "更新止",
        valueFormat: "YYYY-MM-DDTHH:mm:ss",
        size: "small",
        ...{ style: {} },
    }));
    const __VLS_120 = __VLS_119({
        modelValue: (__VLS_ctx.updatedRange),
        type: "datetimerange",
        startPlaceholder: "更新起",
        endPlaceholder: "更新止",
        valueFormat: "YYYY-MM-DDTHH:mm:ss",
        size: "small",
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_119));
    const __VLS_122 = {}.ElCheckbox;
    /** @type {[typeof __VLS_components.ElCheckbox, typeof __VLS_components.elCheckbox, typeof __VLS_components.ElCheckbox, typeof __VLS_components.elCheckbox, ]} */ ;
    // @ts-ignore
    const __VLS_123 = __VLS_asFunctionalComponent(__VLS_122, new __VLS_122({
        modelValue: (__VLS_ctx.includeUncategorized),
        size: "small",
    }));
    const __VLS_124 = __VLS_123({
        modelValue: (__VLS_ctx.includeUncategorized),
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_123));
    __VLS_125.slots.default;
    var __VLS_125;
    const __VLS_126 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_127 = __VLS_asFunctionalComponent(__VLS_126, new __VLS_126({
        ...{ 'onClick': {} },
        size: "small",
        icon: (__VLS_ctx.Refresh),
    }));
    const __VLS_128 = __VLS_127({
        ...{ 'onClick': {} },
        size: "small",
        icon: (__VLS_ctx.Refresh),
    }, ...__VLS_functionalComponentArgsRest(__VLS_127));
    let __VLS_130;
    let __VLS_131;
    let __VLS_132;
    const __VLS_133 = {
        onClick: (__VLS_ctx.refreshItems)
    };
    var __VLS_129;
    const __VLS_134 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_135 = __VLS_asFunctionalComponent(__VLS_134, new __VLS_134({
        ...{ 'onClick': {} },
        type: "primary",
        size: "small",
        icon: (__VLS_ctx.Plus),
    }));
    const __VLS_136 = __VLS_135({
        ...{ 'onClick': {} },
        type: "primary",
        size: "small",
        icon: (__VLS_ctx.Plus),
    }, ...__VLS_functionalComponentArgsRest(__VLS_135));
    let __VLS_138;
    let __VLS_139;
    let __VLS_140;
    const __VLS_141 = {
        onClick: (__VLS_ctx.openCreate)
    };
    __VLS_137.slots.default;
    var __VLS_137;
}
const __VLS_142 = {}.ElTable;
/** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
// @ts-ignore
const __VLS_143 = __VLS_asFunctionalComponent(__VLS_142, new __VLS_142({
    ...{ 'onRowDblclick': {} },
    data: (__VLS_ctx.items),
    stripe: true,
    size: "small",
}));
const __VLS_144 = __VLS_143({
    ...{ 'onRowDblclick': {} },
    data: (__VLS_ctx.items),
    stripe: true,
    size: "small",
}, ...__VLS_functionalComponentArgsRest(__VLS_143));
let __VLS_146;
let __VLS_147;
let __VLS_148;
const __VLS_149 = {
    onRowDblclick: (__VLS_ctx.openEdit)
};
__VLS_asFunctionalDirective(__VLS_directives.vLoading)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.loadingItems) }, null, null);
__VLS_145.slots.default;
const __VLS_150 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_151 = __VLS_asFunctionalComponent(__VLS_150, new __VLS_150({
    prop: "name",
    label: "名称",
    minWidth: "200",
}));
const __VLS_152 = __VLS_151({
    prop: "name",
    label: "名称",
    minWidth: "200",
}, ...__VLS_functionalComponentArgsRest(__VLS_151));
const __VLS_154 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_155 = __VLS_asFunctionalComponent(__VLS_154, new __VLS_154({
    prop: "category",
    label: "分类",
    width: "120",
}));
const __VLS_156 = __VLS_155({
    prop: "category",
    label: "分类",
    width: "120",
}, ...__VLS_functionalComponentArgsRest(__VLS_155));
for (const [col] of __VLS_getVForSourceType((__VLS_ctx.schema.listColumns ?? []))) {
    const __VLS_158 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_159 = __VLS_asFunctionalComponent(__VLS_158, new __VLS_158({
        key: (col.key),
        label: (col.label),
        width: (col.width),
    }));
    const __VLS_160 = __VLS_159({
        key: (col.key),
        label: (col.label),
        width: (col.width),
    }, ...__VLS_functionalComponentArgsRest(__VLS_159));
    __VLS_161.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_161.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.formatCellValue(row, col));
    }
    var __VLS_161;
}
const __VLS_162 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_163 = __VLS_asFunctionalComponent(__VLS_162, new __VLS_162({
    label: "状态",
    width: "70",
}));
const __VLS_164 = __VLS_163({
    label: "状态",
    width: "70",
}, ...__VLS_functionalComponentArgsRest(__VLS_163));
__VLS_165.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_165.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    const __VLS_166 = {}.ElTag;
    /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
    // @ts-ignore
    const __VLS_167 = __VLS_asFunctionalComponent(__VLS_166, new __VLS_166({
        type: (row.isEnabled ? 'success' : 'info'),
        size: "small",
    }));
    const __VLS_168 = __VLS_167({
        type: (row.isEnabled ? 'success' : 'info'),
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_167));
    __VLS_169.slots.default;
    (row.isEnabled ? '启用' : '禁用');
    var __VLS_169;
}
var __VLS_165;
const __VLS_170 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_171 = __VLS_asFunctionalComponent(__VLS_170, new __VLS_170({
    label: "更新时间",
    width: "160",
}));
const __VLS_172 = __VLS_171({
    label: "更新时间",
    width: "160",
}, ...__VLS_functionalComponentArgsRest(__VLS_171));
__VLS_173.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_173.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "muted" },
    });
    (new Date(row.updatedAt).toLocaleString());
}
var __VLS_173;
const __VLS_174 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_175 = __VLS_asFunctionalComponent(__VLS_174, new __VLS_174({
    label: "操作",
    width: "140",
    align: "center",
    fixed: "right",
}));
const __VLS_176 = __VLS_175({
    label: "操作",
    width: "140",
    align: "center",
    fixed: "right",
}, ...__VLS_functionalComponentArgsRest(__VLS_175));
__VLS_177.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_177.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    const __VLS_178 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_179 = __VLS_asFunctionalComponent(__VLS_178, new __VLS_178({
        ...{ 'onClick': {} },
        text: true,
        size: "small",
        icon: (__VLS_ctx.Edit),
    }));
    const __VLS_180 = __VLS_179({
        ...{ 'onClick': {} },
        text: true,
        size: "small",
        icon: (__VLS_ctx.Edit),
    }, ...__VLS_functionalComponentArgsRest(__VLS_179));
    let __VLS_182;
    let __VLS_183;
    let __VLS_184;
    const __VLS_185 = {
        onClick: (...[$event]) => {
            __VLS_ctx.openEdit(row);
        }
    };
    __VLS_181.slots.default;
    var __VLS_181;
    const __VLS_186 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_187 = __VLS_asFunctionalComponent(__VLS_186, new __VLS_186({
        ...{ 'onClick': {} },
        text: true,
        size: "small",
        icon: (__VLS_ctx.Delete),
        type: "danger",
    }));
    const __VLS_188 = __VLS_187({
        ...{ 'onClick': {} },
        text: true,
        size: "small",
        icon: (__VLS_ctx.Delete),
        type: "danger",
    }, ...__VLS_functionalComponentArgsRest(__VLS_187));
    let __VLS_190;
    let __VLS_191;
    let __VLS_192;
    const __VLS_193 = {
        onClick: (...[$event]) => {
            __VLS_ctx.removeItem(row);
        }
    };
    __VLS_189.slots.default;
    var __VLS_189;
}
var __VLS_177;
{
    const { empty: __VLS_thisSlot } = __VLS_145.slots;
    const __VLS_194 = {}.ElEmpty;
    /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
    // @ts-ignore
    const __VLS_195 = __VLS_asFunctionalComponent(__VLS_194, new __VLS_194({
        description: (`暂无数据,点 「新建」 添加 ${__VLS_ctx.moduleMeta.label}`),
    }));
    const __VLS_196 = __VLS_195({
        description: (`暂无数据,点 「新建」 添加 ${__VLS_ctx.moduleMeta.label}`),
    }, ...__VLS_functionalComponentArgsRest(__VLS_195));
}
var __VLS_145;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "pager-row" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "muted" },
});
(__VLS_ctx.total);
const __VLS_198 = {}.ElPagination;
/** @type {[typeof __VLS_components.ElPagination, typeof __VLS_components.elPagination, ]} */ ;
// @ts-ignore
const __VLS_199 = __VLS_asFunctionalComponent(__VLS_198, new __VLS_198({
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
const __VLS_200 = __VLS_199({
    ...{ 'onCurrentChange': {} },
    ...{ 'onSizeChange': {} },
    currentPage: (__VLS_ctx.page),
    pageSize: (__VLS_ctx.pageSize),
    layout: "sizes, prev, pager, next",
    total: (__VLS_ctx.total),
    pageSizes: ([10, 20, 50, 100]),
    small: true,
    background: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_199));
let __VLS_202;
let __VLS_203;
let __VLS_204;
const __VLS_205 = {
    onCurrentChange: (__VLS_ctx.refreshItems)
};
const __VLS_206 = {
    onSizeChange: (...[$event]) => {
        __VLS_ctx.page = 1;
        __VLS_ctx.refreshItems();
    }
};
var __VLS_201;
var __VLS_93;
const __VLS_207 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_208 = __VLS_asFunctionalComponent(__VLS_207, new __VLS_207({
    modelValue: (__VLS_ctx.categoryDialogVisible),
    title: (__VLS_ctx.categoryDialogMode === 'create' ? '新建分类' : '编辑分类'),
    width: "460px",
}));
const __VLS_209 = __VLS_208({
    modelValue: (__VLS_ctx.categoryDialogVisible),
    title: (__VLS_ctx.categoryDialogMode === 'create' ? '新建分类' : '编辑分类'),
    width: "460px",
}, ...__VLS_functionalComponentArgsRest(__VLS_208));
__VLS_210.slots.default;
const __VLS_211 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_212 = __VLS_asFunctionalComponent(__VLS_211, new __VLS_211({
    model: (__VLS_ctx.categoryForm),
    labelWidth: "100px",
    labelPosition: "right",
}));
const __VLS_213 = __VLS_212({
    model: (__VLS_ctx.categoryForm),
    labelWidth: "100px",
    labelPosition: "right",
}, ...__VLS_functionalComponentArgsRest(__VLS_212));
__VLS_214.slots.default;
const __VLS_215 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_216 = __VLS_asFunctionalComponent(__VLS_215, new __VLS_215({
    label: "名称",
    required: true,
}));
const __VLS_217 = __VLS_216({
    label: "名称",
    required: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_216));
__VLS_218.slots.default;
const __VLS_219 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_220 = __VLS_asFunctionalComponent(__VLS_219, new __VLS_219({
    modelValue: (__VLS_ctx.categoryForm.name),
}));
const __VLS_221 = __VLS_220({
    modelValue: (__VLS_ctx.categoryForm.name),
}, ...__VLS_functionalComponentArgsRest(__VLS_220));
var __VLS_218;
const __VLS_223 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_224 = __VLS_asFunctionalComponent(__VLS_223, new __VLS_223({
    label: "父分类",
}));
const __VLS_225 = __VLS_224({
    label: "父分类",
}, ...__VLS_functionalComponentArgsRest(__VLS_224));
__VLS_226.slots.default;
const __VLS_227 = {}.ElTreeSelect;
/** @type {[typeof __VLS_components.ElTreeSelect, typeof __VLS_components.elTreeSelect, ]} */ ;
// @ts-ignore
const __VLS_228 = __VLS_asFunctionalComponent(__VLS_227, new __VLS_227({
    modelValue: (__VLS_ctx.categoryForm.parentId),
    data: (__VLS_ctx.categoryParentOptions),
    checkStrictly: true,
    clearable: true,
    filterable: true,
    placeholder: "留空为根分类",
    ...{ style: {} },
}));
const __VLS_229 = __VLS_228({
    modelValue: (__VLS_ctx.categoryForm.parentId),
    data: (__VLS_ctx.categoryParentOptions),
    checkStrictly: true,
    clearable: true,
    filterable: true,
    placeholder: "留空为根分类",
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_228));
var __VLS_226;
const __VLS_231 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_232 = __VLS_asFunctionalComponent(__VLS_231, new __VLS_231({
    label: "排序",
}));
const __VLS_233 = __VLS_232({
    label: "排序",
}, ...__VLS_functionalComponentArgsRest(__VLS_232));
__VLS_234.slots.default;
const __VLS_235 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_236 = __VLS_asFunctionalComponent(__VLS_235, new __VLS_235({
    modelValue: (__VLS_ctx.categoryForm.sortOrder),
    min: (0),
}));
const __VLS_237 = __VLS_236({
    modelValue: (__VLS_ctx.categoryForm.sortOrder),
    min: (0),
}, ...__VLS_functionalComponentArgsRest(__VLS_236));
var __VLS_234;
const __VLS_239 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_240 = __VLS_asFunctionalComponent(__VLS_239, new __VLS_239({
    label: "启用",
}));
const __VLS_241 = __VLS_240({
    label: "启用",
}, ...__VLS_functionalComponentArgsRest(__VLS_240));
__VLS_242.slots.default;
const __VLS_243 = {}.ElSwitch;
/** @type {[typeof __VLS_components.ElSwitch, typeof __VLS_components.elSwitch, ]} */ ;
// @ts-ignore
const __VLS_244 = __VLS_asFunctionalComponent(__VLS_243, new __VLS_243({
    modelValue: (__VLS_ctx.categoryForm.isEnabled),
}));
const __VLS_245 = __VLS_244({
    modelValue: (__VLS_ctx.categoryForm.isEnabled),
}, ...__VLS_functionalComponentArgsRest(__VLS_244));
var __VLS_242;
var __VLS_214;
{
    const { footer: __VLS_thisSlot } = __VLS_210.slots;
    const __VLS_247 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_248 = __VLS_asFunctionalComponent(__VLS_247, new __VLS_247({
        ...{ 'onClick': {} },
    }));
    const __VLS_249 = __VLS_248({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_248));
    let __VLS_251;
    let __VLS_252;
    let __VLS_253;
    const __VLS_254 = {
        onClick: (...[$event]) => {
            __VLS_ctx.categoryDialogVisible = false;
        }
    };
    __VLS_250.slots.default;
    var __VLS_250;
    const __VLS_255 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_256 = __VLS_asFunctionalComponent(__VLS_255, new __VLS_255({
        ...{ 'onClick': {} },
        type: "primary",
    }));
    const __VLS_257 = __VLS_256({
        ...{ 'onClick': {} },
        type: "primary",
    }, ...__VLS_functionalComponentArgsRest(__VLS_256));
    let __VLS_259;
    let __VLS_260;
    let __VLS_261;
    const __VLS_262 = {
        onClick: (__VLS_ctx.saveCategory)
    };
    __VLS_258.slots.default;
    var __VLS_258;
}
var __VLS_210;
const __VLS_263 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_264 = __VLS_asFunctionalComponent(__VLS_263, new __VLS_263({
    modelValue: (__VLS_ctx.editorVisible),
    title: (`${__VLS_ctx.editorMode === 'create' ? '新建' : '编辑'} ${__VLS_ctx.moduleMeta.label}`),
    width: (780),
    closeOnClickModal: (false),
}));
const __VLS_265 = __VLS_264({
    modelValue: (__VLS_ctx.editorVisible),
    title: (`${__VLS_ctx.editorMode === 'create' ? '新建' : '编辑'} ${__VLS_ctx.moduleMeta.label}`),
    width: (780),
    closeOnClickModal: (false),
}, ...__VLS_functionalComponentArgsRest(__VLS_264));
__VLS_266.slots.default;
const __VLS_267 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_268 = __VLS_asFunctionalComponent(__VLS_267, new __VLS_267({
    model: (__VLS_ctx.editorForm),
    labelWidth: "130px",
    labelPosition: "right",
}));
const __VLS_269 = __VLS_268({
    model: (__VLS_ctx.editorForm),
    labelWidth: "130px",
    labelPosition: "right",
}, ...__VLS_functionalComponentArgsRest(__VLS_268));
__VLS_270.slots.default;
for (const [f] of __VLS_getVForSourceType((__VLS_ctx.schema.commonFields))) {
    /** @type {[typeof DesignFormField, ]} */ ;
    // @ts-ignore
    const __VLS_271 = __VLS_asFunctionalComponent(DesignFormField, new DesignFormField({
        ...{ 'onClearInvalidReferences': {} },
        ...{ 'onRematchReferences': {} },
        key: (f.key),
        field: (f),
        pickerOptions: (__VLS_ctx.optionsFor(f)),
        invalidMessage: (__VLS_ctx.invalidReferenceMessage(f, __VLS_ctx.editorForm[f.key])),
        modelValue: (__VLS_ctx.editorForm[f.key]),
    }));
    const __VLS_272 = __VLS_271({
        ...{ 'onClearInvalidReferences': {} },
        ...{ 'onRematchReferences': {} },
        key: (f.key),
        field: (f),
        pickerOptions: (__VLS_ctx.optionsFor(f)),
        invalidMessage: (__VLS_ctx.invalidReferenceMessage(f, __VLS_ctx.editorForm[f.key])),
        modelValue: (__VLS_ctx.editorForm[f.key]),
    }, ...__VLS_functionalComponentArgsRest(__VLS_271));
    let __VLS_274;
    let __VLS_275;
    let __VLS_276;
    const __VLS_277 = {
        onClearInvalidReferences: (...[$event]) => {
            __VLS_ctx.clearInvalidReferences(f);
        }
    };
    const __VLS_278 = {
        onRematchReferences: (...[$event]) => {
            __VLS_ctx.rematchReferences(f);
        }
    };
    var __VLS_273;
}
const __VLS_279 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_280 = __VLS_asFunctionalComponent(__VLS_279, new __VLS_279({
    label: "分类",
}));
const __VLS_281 = __VLS_280({
    label: "分类",
}, ...__VLS_functionalComponentArgsRest(__VLS_280));
__VLS_282.slots.default;
if (__VLS_ctx.editorForm.categoryId) {
    const __VLS_283 = {}.ElTag;
    /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
    // @ts-ignore
    const __VLS_284 = __VLS_asFunctionalComponent(__VLS_283, new __VLS_283({
        type: "info",
    }));
    const __VLS_285 = __VLS_284({
        type: "info",
    }, ...__VLS_functionalComponentArgsRest(__VLS_284));
    __VLS_286.slots.default;
    (__VLS_ctx.editorForm.categoryId);
    var __VLS_286;
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "muted" },
    });
}
var __VLS_282;
if (__VLS_ctx.moduleMeta.hasSourceBookScope) {
    const __VLS_287 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_288 = __VLS_asFunctionalComponent(__VLS_287, new __VLS_287({
        label: "源书 ID",
    }));
    const __VLS_289 = __VLS_288({
        label: "源书 ID",
    }, ...__VLS_functionalComponentArgsRest(__VLS_288));
    __VLS_290.slots.default;
    if (__VLS_ctx.editorForm.sourceBookId) {
        const __VLS_291 = {}.ElTag;
        /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
        // @ts-ignore
        const __VLS_292 = __VLS_asFunctionalComponent(__VLS_291, new __VLS_291({
            type: "info",
        }));
        const __VLS_293 = __VLS_292({
            type: "info",
        }, ...__VLS_functionalComponentArgsRest(__VLS_292));
        __VLS_294.slots.default;
        (__VLS_ctx.editorForm.sourceBookId);
        var __VLS_294;
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "muted" },
        });
    }
    var __VLS_290;
}
const __VLS_295 = {}.ElTabs;
/** @type {[typeof __VLS_components.ElTabs, typeof __VLS_components.elTabs, typeof __VLS_components.ElTabs, typeof __VLS_components.elTabs, ]} */ ;
// @ts-ignore
const __VLS_296 = __VLS_asFunctionalComponent(__VLS_295, new __VLS_295({
    modelValue: (__VLS_ctx.editorTab),
    ...{ class: "editor-tabs" },
}));
const __VLS_297 = __VLS_296({
    modelValue: (__VLS_ctx.editorTab),
    ...{ class: "editor-tabs" },
}, ...__VLS_functionalComponentArgsRest(__VLS_296));
__VLS_298.slots.default;
for (const [t] of __VLS_getVForSourceType((__VLS_ctx.schema.tabs))) {
    const __VLS_299 = {}.ElTabPane;
    /** @type {[typeof __VLS_components.ElTabPane, typeof __VLS_components.elTabPane, typeof __VLS_components.ElTabPane, typeof __VLS_components.elTabPane, ]} */ ;
    // @ts-ignore
    const __VLS_300 = __VLS_asFunctionalComponent(__VLS_299, new __VLS_299({
        key: (t.key),
        name: (t.key),
        label: (t.label),
    }));
    const __VLS_301 = __VLS_300({
        key: (t.key),
        name: (t.key),
        label: (t.label),
    }, ...__VLS_functionalComponentArgsRest(__VLS_300));
    __VLS_302.slots.default;
    for (const [f] of __VLS_getVForSourceType((t.fields))) {
        /** @type {[typeof DesignFormField, ]} */ ;
        // @ts-ignore
        const __VLS_303 = __VLS_asFunctionalComponent(DesignFormField, new DesignFormField({
            ...{ 'onClearInvalidReferences': {} },
            ...{ 'onRematchReferences': {} },
            key: (f.key),
            field: (f),
            pickerOptions: (__VLS_ctx.optionsFor(f)),
            invalidMessage: (__VLS_ctx.invalidReferenceMessage(f, __VLS_ctx.editorForm[f.key])),
            modelValue: (__VLS_ctx.editorForm[f.key]),
        }));
        const __VLS_304 = __VLS_303({
            ...{ 'onClearInvalidReferences': {} },
            ...{ 'onRematchReferences': {} },
            key: (f.key),
            field: (f),
            pickerOptions: (__VLS_ctx.optionsFor(f)),
            invalidMessage: (__VLS_ctx.invalidReferenceMessage(f, __VLS_ctx.editorForm[f.key])),
            modelValue: (__VLS_ctx.editorForm[f.key]),
        }, ...__VLS_functionalComponentArgsRest(__VLS_303));
        let __VLS_306;
        let __VLS_307;
        let __VLS_308;
        const __VLS_309 = {
            onClearInvalidReferences: (...[$event]) => {
                __VLS_ctx.clearInvalidReferences(f);
            }
        };
        const __VLS_310 = {
            onRematchReferences: (...[$event]) => {
                __VLS_ctx.rematchReferences(f);
            }
        };
        var __VLS_305;
    }
    var __VLS_302;
}
var __VLS_298;
var __VLS_270;
{
    const { footer: __VLS_thisSlot } = __VLS_266.slots;
    const __VLS_311 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_312 = __VLS_asFunctionalComponent(__VLS_311, new __VLS_311({
        ...{ 'onClick': {} },
    }));
    const __VLS_313 = __VLS_312({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_312));
    let __VLS_315;
    let __VLS_316;
    let __VLS_317;
    const __VLS_318 = {
        onClick: (...[$event]) => {
            __VLS_ctx.editorVisible = false;
        }
    };
    __VLS_314.slots.default;
    var __VLS_314;
    const __VLS_319 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_320 = __VLS_asFunctionalComponent(__VLS_319, new __VLS_319({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.saving),
    }));
    const __VLS_321 = __VLS_320({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.saving),
    }, ...__VLS_functionalComponentArgsRest(__VLS_320));
    let __VLS_323;
    let __VLS_324;
    let __VLS_325;
    const __VLS_326 = {
        onClick: (__VLS_ctx.saveEditor)
    };
    __VLS_322.slots.default;
    var __VLS_322;
}
var __VLS_266;
const __VLS_327 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_328 = __VLS_asFunctionalComponent(__VLS_327, new __VLS_327({
    modelValue: (__VLS_ctx.newSourceBookVisible),
    title: "新建源书",
    width: "400px",
}));
const __VLS_329 = __VLS_328({
    modelValue: (__VLS_ctx.newSourceBookVisible),
    title: "新建源书",
    width: "400px",
}, ...__VLS_functionalComponentArgsRest(__VLS_328));
__VLS_330.slots.default;
const __VLS_331 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_332 = __VLS_asFunctionalComponent(__VLS_331, new __VLS_331({}));
const __VLS_333 = __VLS_332({}, ...__VLS_functionalComponentArgsRest(__VLS_332));
__VLS_334.slots.default;
const __VLS_335 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_336 = __VLS_asFunctionalComponent(__VLS_335, new __VLS_335({
    label: "名称",
    required: true,
}));
const __VLS_337 = __VLS_336({
    label: "名称",
    required: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_336));
__VLS_338.slots.default;
const __VLS_339 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_340 = __VLS_asFunctionalComponent(__VLS_339, new __VLS_339({
    ...{ 'onKeyup': {} },
    modelValue: (__VLS_ctx.newSourceBookName),
}));
const __VLS_341 = __VLS_340({
    ...{ 'onKeyup': {} },
    modelValue: (__VLS_ctx.newSourceBookName),
}, ...__VLS_functionalComponentArgsRest(__VLS_340));
let __VLS_343;
let __VLS_344;
let __VLS_345;
const __VLS_346 = {
    onKeyup: (__VLS_ctx.quickCreateSourceBook)
};
var __VLS_342;
var __VLS_338;
var __VLS_334;
{
    const { footer: __VLS_thisSlot } = __VLS_330.slots;
    const __VLS_347 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_348 = __VLS_asFunctionalComponent(__VLS_347, new __VLS_347({
        ...{ 'onClick': {} },
    }));
    const __VLS_349 = __VLS_348({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_348));
    let __VLS_351;
    let __VLS_352;
    let __VLS_353;
    const __VLS_354 = {
        onClick: (...[$event]) => {
            __VLS_ctx.newSourceBookVisible = false;
        }
    };
    __VLS_350.slots.default;
    var __VLS_350;
    const __VLS_355 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_356 = __VLS_asFunctionalComponent(__VLS_355, new __VLS_355({
        ...{ 'onClick': {} },
        type: "primary",
    }));
    const __VLS_357 = __VLS_356({
        ...{ 'onClick': {} },
        type: "primary",
    }, ...__VLS_functionalComponentArgsRest(__VLS_356));
    let __VLS_359;
    let __VLS_360;
    let __VLS_361;
    const __VLS_362 = {
        onClick: (__VLS_ctx.quickCreateSourceBook)
    };
    __VLS_358.slots.default;
    var __VLS_358;
}
var __VLS_330;
/** @type {__VLS_StyleScopedClasses['design-view']} */ ;
/** @type {__VLS_StyleScopedClasses['header-card']} */ ;
/** @type {__VLS_StyleScopedClasses['header-row']} */ ;
/** @type {__VLS_StyleScopedClasses['module-tabs']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['module-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['icon']} */ ;
/** @type {__VLS_StyleScopedClasses['sourcebook-area']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['main-layout']} */ ;
/** @type {__VLS_StyleScopedClasses['tree-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-head']} */ ;
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
/** @type {__VLS_StyleScopedClasses['pager-row']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['editor-tabs']} */ ;
// @ts-ignore
var __VLS_61 = __VLS_60;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Plus: Plus,
            Edit: Edit,
            Delete: Delete,
            Refresh: Refresh,
            FolderAdd: FolderAdd,
            Search: Search,
            DESIGN_MODULES: DESIGN_MODULES,
            DesignFormField: DesignFormField,
            workContext: workContext,
            moduleKey: moduleKey,
            moduleMeta: moduleMeta,
            schema: schema,
            optionsFor: optionsFor,
            invalidReferenceMessage: invalidReferenceMessage,
            clearInvalidReferences: clearInvalidReferences,
            rematchReferences: rematchReferences,
            sourceBooks: sourceBooks,
            selectedSourceBookId: selectedSourceBookId,
            newSourceBookName: newSourceBookName,
            newSourceBookVisible: newSourceBookVisible,
            quickCreateSourceBook: quickCreateSourceBook,
            bindSourceBookToProject: bindSourceBookToProject,
            categoryTree: categoryTree,
            loadingCategories: loadingCategories,
            selectedCategoryId: selectedCategoryId,
            treeRef: treeRef,
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
            formatCellValue: formatCellValue,
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
