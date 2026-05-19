import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Edit, Delete, Refresh, FolderAdd, Search } from '@element-plus/icons-vue';
import { DESIGN_MODULES, worldRulesApi, characterRulesApi, factionRulesApi, locationRulesApi, plotRulesApi, creativeMaterialsApi, bookAnalysesApi } from '@/api/modules/design';
import { getCategoryTree, createCategory, updateCategory, deleteCategory } from '@/api/modules/categories';
import { listSourceBooks, createSourceBook } from '@/api/modules/sourceBooks';
import DesignFormField from '@/components/design/DesignFormField.vue';
import { MODULE_SCHEMAS, buildEmptyForm } from '@/components/design/moduleSchemas';
const route = useRoute();
const router = useRouter();
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
    book_analyses: bookAnalysesApi
};
const activeApi = computed(() => apiMap[moduleKey.value]);
// --- SourceBook 切换 ---
const sourceBooks = ref([]);
const selectedSourceBookId = ref('');
async function refreshSourceBooks() {
    try {
        sourceBooks.value = await listSourceBooks();
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
// --- Category 树 ---
const categoryTree = ref([]);
const loadingCategories = ref(false);
const selectedCategoryId = ref(null);
const treeRef = ref();
async function refreshCategories() {
    loadingCategories.value = true;
    try {
        categoryTree.value = await getCategoryTree(moduleKey.value, moduleMeta.value.hasSourceBookScope ? selectedSourceBookId.value || null : null);
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
    sourceBookId: null
});
function openCreateCategory(parent) {
    categoryDialogMode.value = 'create';
    categoryEditId.value = '';
    categoryForm.value = {
        moduleType: moduleKey.value,
        name: '',
        parentId: parent?.id ?? null,
        sortOrder: 0,
        isEnabled: true,
        sourceBookId: moduleMeta.value.hasSourceBookScope ? (selectedSourceBookId.value || null) : null
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
        sourceBookId: node.sourceBookId
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
// --- 数据列表 ---
const items = ref([]);
const loadingItems = ref(false);
const keyword = ref('');
async function refreshItems() {
    loadingItems.value = true;
    try {
        items.value = (await activeApi.value.list({
            categoryId: selectedCategoryId.value,
            sourceBookId: moduleMeta.value.hasSourceBookScope ? (selectedSourceBookId.value || null) : null,
            keyword: keyword.value || null
        }));
    }
    catch (err) {
        ElMessage.error(err.message ?? '加载列表失败');
    }
    finally {
        loadingItems.value = false;
    }
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
    editorTab.value = schema.value.tabs[0]?.key ?? '';
    editorVisible.value = true;
}
async function openEdit(row) {
    editorMode.value = 'edit';
    editorId.value = row.id;
    try {
        const detail = (await activeApi.value.get(row.id));
        editorForm.value = { ...buildEmptyForm(moduleKey.value), ...detail };
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
    await refreshCategories();
    await refreshItems();
});
watch(selectedSourceBookId, async () => {
    selectedCategoryId.value = null;
    await refreshCategories();
    await refreshItems();
});
watch(selectedCategoryId, refreshItems);
onMounted(async () => {
    await refreshSourceBooks();
    await refreshCategories();
    await refreshItems();
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
}
var __VLS_3;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "main-layout" },
});
const __VLS_24 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
    shadow: "never",
    ...{ class: "tree-panel" },
}));
const __VLS_26 = __VLS_25({
    shadow: "never",
    ...{ class: "tree-panel" },
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
__VLS_27.slots.default;
{
    const { header: __VLS_thisSlot } = __VLS_27.slots;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "panel-head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.moduleMeta.label);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    const __VLS_28 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
        ...{ 'onClick': {} },
        text: true,
        size: "small",
        icon: (__VLS_ctx.Refresh),
    }));
    const __VLS_30 = __VLS_29({
        ...{ 'onClick': {} },
        text: true,
        size: "small",
        icon: (__VLS_ctx.Refresh),
    }, ...__VLS_functionalComponentArgsRest(__VLS_29));
    let __VLS_32;
    let __VLS_33;
    let __VLS_34;
    const __VLS_35 = {
        onClick: (__VLS_ctx.refreshCategories)
    };
    var __VLS_31;
    const __VLS_36 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
        ...{ 'onClick': {} },
        text: true,
        size: "small",
        icon: (__VLS_ctx.FolderAdd),
    }));
    const __VLS_38 = __VLS_37({
        ...{ 'onClick': {} },
        text: true,
        size: "small",
        icon: (__VLS_ctx.FolderAdd),
    }, ...__VLS_functionalComponentArgsRest(__VLS_37));
    let __VLS_40;
    let __VLS_41;
    let __VLS_42;
    const __VLS_43 = {
        onClick: (...[$event]) => {
            __VLS_ctx.openCreateCategory();
        }
    };
    var __VLS_39;
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
const __VLS_44 = {}.ElTree;
/** @type {[typeof __VLS_components.ElTree, typeof __VLS_components.elTree, typeof __VLS_components.ElTree, typeof __VLS_components.elTree, ]} */ ;
// @ts-ignore
const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
    ref: "treeRef",
    data: (__VLS_ctx.categoryTree),
    nodeKey: "id",
    defaultExpandAll: (true),
    expandOnClickNode: (false),
    highlightCurrent: (true),
    emptyText: "暂无分类",
}));
const __VLS_46 = __VLS_45({
    ref: "treeRef",
    data: (__VLS_ctx.categoryTree),
    nodeKey: "id",
    defaultExpandAll: (true),
    expandOnClickNode: (false),
    highlightCurrent: (true),
    emptyText: "暂无分类",
}, ...__VLS_functionalComponentArgsRest(__VLS_45));
/** @type {typeof __VLS_ctx.treeRef} */ ;
var __VLS_48 = {};
__VLS_47.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_47.slots;
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
        const __VLS_50 = {}.ElTag;
        /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
        // @ts-ignore
        const __VLS_51 = __VLS_asFunctionalComponent(__VLS_50, new __VLS_50({
            size: "small",
            type: "info",
            effect: "plain",
        }));
        const __VLS_52 = __VLS_51({
            size: "small",
            type: "info",
            effect: "plain",
        }, ...__VLS_functionalComponentArgsRest(__VLS_51));
        __VLS_53.slots.default;
        var __VLS_53;
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "cat-count" },
    });
    (data.itemCount);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "cat-actions" },
    });
    const __VLS_54 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_55 = __VLS_asFunctionalComponent(__VLS_54, new __VLS_54({
        ...{ 'onClick': {} },
        text: true,
        size: "small",
        icon: (__VLS_ctx.Plus),
    }));
    const __VLS_56 = __VLS_55({
        ...{ 'onClick': {} },
        text: true,
        size: "small",
        icon: (__VLS_ctx.Plus),
    }, ...__VLS_functionalComponentArgsRest(__VLS_55));
    let __VLS_58;
    let __VLS_59;
    let __VLS_60;
    const __VLS_61 = {
        onClick: (...[$event]) => {
            __VLS_ctx.openCreateCategory(data);
        }
    };
    var __VLS_57;
    const __VLS_62 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_63 = __VLS_asFunctionalComponent(__VLS_62, new __VLS_62({
        ...{ 'onClick': {} },
        text: true,
        size: "small",
        icon: (__VLS_ctx.Edit),
    }));
    const __VLS_64 = __VLS_63({
        ...{ 'onClick': {} },
        text: true,
        size: "small",
        icon: (__VLS_ctx.Edit),
    }, ...__VLS_functionalComponentArgsRest(__VLS_63));
    let __VLS_66;
    let __VLS_67;
    let __VLS_68;
    const __VLS_69 = {
        onClick: (...[$event]) => {
            __VLS_ctx.openEditCategory(data);
        }
    };
    var __VLS_65;
    if (!data.isBuiltIn) {
        const __VLS_70 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_71 = __VLS_asFunctionalComponent(__VLS_70, new __VLS_70({
            ...{ 'onClick': {} },
            text: true,
            size: "small",
            icon: (__VLS_ctx.Delete),
            type: "danger",
        }));
        const __VLS_72 = __VLS_71({
            ...{ 'onClick': {} },
            text: true,
            size: "small",
            icon: (__VLS_ctx.Delete),
            type: "danger",
        }, ...__VLS_functionalComponentArgsRest(__VLS_71));
        let __VLS_74;
        let __VLS_75;
        let __VLS_76;
        const __VLS_77 = {
            onClick: (...[$event]) => {
                if (!(!data.isBuiltIn))
                    return;
                __VLS_ctx.removeCategory(data);
            }
        };
        var __VLS_73;
    }
}
var __VLS_47;
var __VLS_27;
const __VLS_78 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_79 = __VLS_asFunctionalComponent(__VLS_78, new __VLS_78({
    shadow: "never",
    ...{ class: "list-panel" },
}));
const __VLS_80 = __VLS_79({
    shadow: "never",
    ...{ class: "list-panel" },
}, ...__VLS_functionalComponentArgsRest(__VLS_79));
__VLS_81.slots.default;
{
    const { header: __VLS_thisSlot } = __VLS_81.slots;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "panel-head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.moduleMeta.label);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "head-actions" },
    });
    const __VLS_82 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_83 = __VLS_asFunctionalComponent(__VLS_82, new __VLS_82({
        ...{ 'onChange': {} },
        modelValue: (__VLS_ctx.keyword),
        placeholder: "名称关键字",
        clearable: true,
        size: "small",
        ...{ style: {} },
        prefixIcon: (__VLS_ctx.Search),
    }));
    const __VLS_84 = __VLS_83({
        ...{ 'onChange': {} },
        modelValue: (__VLS_ctx.keyword),
        placeholder: "名称关键字",
        clearable: true,
        size: "small",
        ...{ style: {} },
        prefixIcon: (__VLS_ctx.Search),
    }, ...__VLS_functionalComponentArgsRest(__VLS_83));
    let __VLS_86;
    let __VLS_87;
    let __VLS_88;
    const __VLS_89 = {
        onChange: (__VLS_ctx.refreshItems)
    };
    var __VLS_85;
    const __VLS_90 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_91 = __VLS_asFunctionalComponent(__VLS_90, new __VLS_90({
        ...{ 'onClick': {} },
        size: "small",
        icon: (__VLS_ctx.Refresh),
    }));
    const __VLS_92 = __VLS_91({
        ...{ 'onClick': {} },
        size: "small",
        icon: (__VLS_ctx.Refresh),
    }, ...__VLS_functionalComponentArgsRest(__VLS_91));
    let __VLS_94;
    let __VLS_95;
    let __VLS_96;
    const __VLS_97 = {
        onClick: (__VLS_ctx.refreshItems)
    };
    var __VLS_93;
    const __VLS_98 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_99 = __VLS_asFunctionalComponent(__VLS_98, new __VLS_98({
        ...{ 'onClick': {} },
        type: "primary",
        size: "small",
        icon: (__VLS_ctx.Plus),
    }));
    const __VLS_100 = __VLS_99({
        ...{ 'onClick': {} },
        type: "primary",
        size: "small",
        icon: (__VLS_ctx.Plus),
    }, ...__VLS_functionalComponentArgsRest(__VLS_99));
    let __VLS_102;
    let __VLS_103;
    let __VLS_104;
    const __VLS_105 = {
        onClick: (__VLS_ctx.openCreate)
    };
    __VLS_101.slots.default;
    var __VLS_101;
}
const __VLS_106 = {}.ElTable;
/** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
// @ts-ignore
const __VLS_107 = __VLS_asFunctionalComponent(__VLS_106, new __VLS_106({
    ...{ 'onRowDblclick': {} },
    data: (__VLS_ctx.items),
    stripe: true,
    size: "small",
}));
const __VLS_108 = __VLS_107({
    ...{ 'onRowDblclick': {} },
    data: (__VLS_ctx.items),
    stripe: true,
    size: "small",
}, ...__VLS_functionalComponentArgsRest(__VLS_107));
let __VLS_110;
let __VLS_111;
let __VLS_112;
const __VLS_113 = {
    onRowDblclick: (__VLS_ctx.openEdit)
};
__VLS_asFunctionalDirective(__VLS_directives.vLoading)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.loadingItems) }, null, null);
__VLS_109.slots.default;
const __VLS_114 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_115 = __VLS_asFunctionalComponent(__VLS_114, new __VLS_114({
    prop: "name",
    label: "名称",
    minWidth: "200",
}));
const __VLS_116 = __VLS_115({
    prop: "name",
    label: "名称",
    minWidth: "200",
}, ...__VLS_functionalComponentArgsRest(__VLS_115));
const __VLS_118 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_119 = __VLS_asFunctionalComponent(__VLS_118, new __VLS_118({
    prop: "category",
    label: "分类",
    width: "120",
}));
const __VLS_120 = __VLS_119({
    prop: "category",
    label: "分类",
    width: "120",
}, ...__VLS_functionalComponentArgsRest(__VLS_119));
for (const [col] of __VLS_getVForSourceType((__VLS_ctx.schema.listColumns ?? []))) {
    const __VLS_122 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_123 = __VLS_asFunctionalComponent(__VLS_122, new __VLS_122({
        key: (col.key),
        label: (col.label),
        width: (col.width),
    }));
    const __VLS_124 = __VLS_123({
        key: (col.key),
        label: (col.label),
        width: (col.width),
    }, ...__VLS_functionalComponentArgsRest(__VLS_123));
    __VLS_125.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_125.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.formatCellValue(row, col));
    }
    var __VLS_125;
}
const __VLS_126 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_127 = __VLS_asFunctionalComponent(__VLS_126, new __VLS_126({
    label: "状态",
    width: "70",
}));
const __VLS_128 = __VLS_127({
    label: "状态",
    width: "70",
}, ...__VLS_functionalComponentArgsRest(__VLS_127));
__VLS_129.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_129.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    const __VLS_130 = {}.ElTag;
    /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
    // @ts-ignore
    const __VLS_131 = __VLS_asFunctionalComponent(__VLS_130, new __VLS_130({
        type: (row.isEnabled ? 'success' : 'info'),
        size: "small",
    }));
    const __VLS_132 = __VLS_131({
        type: (row.isEnabled ? 'success' : 'info'),
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_131));
    __VLS_133.slots.default;
    (row.isEnabled ? '启用' : '禁用');
    var __VLS_133;
}
var __VLS_129;
const __VLS_134 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_135 = __VLS_asFunctionalComponent(__VLS_134, new __VLS_134({
    label: "更新时间",
    width: "160",
}));
const __VLS_136 = __VLS_135({
    label: "更新时间",
    width: "160",
}, ...__VLS_functionalComponentArgsRest(__VLS_135));
__VLS_137.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_137.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "muted" },
    });
    (new Date(row.updatedAt).toLocaleString());
}
var __VLS_137;
const __VLS_138 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_139 = __VLS_asFunctionalComponent(__VLS_138, new __VLS_138({
    label: "操作",
    width: "140",
    align: "center",
    fixed: "right",
}));
const __VLS_140 = __VLS_139({
    label: "操作",
    width: "140",
    align: "center",
    fixed: "right",
}, ...__VLS_functionalComponentArgsRest(__VLS_139));
__VLS_141.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_141.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    const __VLS_142 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_143 = __VLS_asFunctionalComponent(__VLS_142, new __VLS_142({
        ...{ 'onClick': {} },
        text: true,
        size: "small",
        icon: (__VLS_ctx.Edit),
    }));
    const __VLS_144 = __VLS_143({
        ...{ 'onClick': {} },
        text: true,
        size: "small",
        icon: (__VLS_ctx.Edit),
    }, ...__VLS_functionalComponentArgsRest(__VLS_143));
    let __VLS_146;
    let __VLS_147;
    let __VLS_148;
    const __VLS_149 = {
        onClick: (...[$event]) => {
            __VLS_ctx.openEdit(row);
        }
    };
    __VLS_145.slots.default;
    var __VLS_145;
    const __VLS_150 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_151 = __VLS_asFunctionalComponent(__VLS_150, new __VLS_150({
        ...{ 'onClick': {} },
        text: true,
        size: "small",
        icon: (__VLS_ctx.Delete),
        type: "danger",
    }));
    const __VLS_152 = __VLS_151({
        ...{ 'onClick': {} },
        text: true,
        size: "small",
        icon: (__VLS_ctx.Delete),
        type: "danger",
    }, ...__VLS_functionalComponentArgsRest(__VLS_151));
    let __VLS_154;
    let __VLS_155;
    let __VLS_156;
    const __VLS_157 = {
        onClick: (...[$event]) => {
            __VLS_ctx.removeItem(row);
        }
    };
    __VLS_153.slots.default;
    var __VLS_153;
}
var __VLS_141;
{
    const { empty: __VLS_thisSlot } = __VLS_109.slots;
    const __VLS_158 = {}.ElEmpty;
    /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
    // @ts-ignore
    const __VLS_159 = __VLS_asFunctionalComponent(__VLS_158, new __VLS_158({
        description: (`暂无数据,点 「新建」 添加 ${__VLS_ctx.moduleMeta.label}`),
    }));
    const __VLS_160 = __VLS_159({
        description: (`暂无数据,点 「新建」 添加 ${__VLS_ctx.moduleMeta.label}`),
    }, ...__VLS_functionalComponentArgsRest(__VLS_159));
}
var __VLS_109;
var __VLS_81;
const __VLS_162 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_163 = __VLS_asFunctionalComponent(__VLS_162, new __VLS_162({
    modelValue: (__VLS_ctx.categoryDialogVisible),
    title: (__VLS_ctx.categoryDialogMode === 'create' ? '新建分类' : '编辑分类'),
    width: "460px",
}));
const __VLS_164 = __VLS_163({
    modelValue: (__VLS_ctx.categoryDialogVisible),
    title: (__VLS_ctx.categoryDialogMode === 'create' ? '新建分类' : '编辑分类'),
    width: "460px",
}, ...__VLS_functionalComponentArgsRest(__VLS_163));
__VLS_165.slots.default;
const __VLS_166 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_167 = __VLS_asFunctionalComponent(__VLS_166, new __VLS_166({
    model: (__VLS_ctx.categoryForm),
    labelWidth: "100px",
    labelPosition: "right",
}));
const __VLS_168 = __VLS_167({
    model: (__VLS_ctx.categoryForm),
    labelWidth: "100px",
    labelPosition: "right",
}, ...__VLS_functionalComponentArgsRest(__VLS_167));
__VLS_169.slots.default;
const __VLS_170 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_171 = __VLS_asFunctionalComponent(__VLS_170, new __VLS_170({
    label: "名称",
    required: true,
}));
const __VLS_172 = __VLS_171({
    label: "名称",
    required: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_171));
__VLS_173.slots.default;
const __VLS_174 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_175 = __VLS_asFunctionalComponent(__VLS_174, new __VLS_174({
    modelValue: (__VLS_ctx.categoryForm.name),
}));
const __VLS_176 = __VLS_175({
    modelValue: (__VLS_ctx.categoryForm.name),
}, ...__VLS_functionalComponentArgsRest(__VLS_175));
var __VLS_173;
const __VLS_178 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_179 = __VLS_asFunctionalComponent(__VLS_178, new __VLS_178({
    label: "父分类",
}));
const __VLS_180 = __VLS_179({
    label: "父分类",
}, ...__VLS_functionalComponentArgsRest(__VLS_179));
__VLS_181.slots.default;
const __VLS_182 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_183 = __VLS_asFunctionalComponent(__VLS_182, new __VLS_182({
    modelValue: (__VLS_ctx.categoryForm.parentId),
    placeholder: "留空为根分类(暂无 picker)",
}));
const __VLS_184 = __VLS_183({
    modelValue: (__VLS_ctx.categoryForm.parentId),
    placeholder: "留空为根分类(暂无 picker)",
}, ...__VLS_functionalComponentArgsRest(__VLS_183));
var __VLS_181;
const __VLS_186 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_187 = __VLS_asFunctionalComponent(__VLS_186, new __VLS_186({
    label: "排序",
}));
const __VLS_188 = __VLS_187({
    label: "排序",
}, ...__VLS_functionalComponentArgsRest(__VLS_187));
__VLS_189.slots.default;
const __VLS_190 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_191 = __VLS_asFunctionalComponent(__VLS_190, new __VLS_190({
    modelValue: (__VLS_ctx.categoryForm.sortOrder),
    min: (0),
}));
const __VLS_192 = __VLS_191({
    modelValue: (__VLS_ctx.categoryForm.sortOrder),
    min: (0),
}, ...__VLS_functionalComponentArgsRest(__VLS_191));
var __VLS_189;
const __VLS_194 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_195 = __VLS_asFunctionalComponent(__VLS_194, new __VLS_194({
    label: "启用",
}));
const __VLS_196 = __VLS_195({
    label: "启用",
}, ...__VLS_functionalComponentArgsRest(__VLS_195));
__VLS_197.slots.default;
const __VLS_198 = {}.ElSwitch;
/** @type {[typeof __VLS_components.ElSwitch, typeof __VLS_components.elSwitch, ]} */ ;
// @ts-ignore
const __VLS_199 = __VLS_asFunctionalComponent(__VLS_198, new __VLS_198({
    modelValue: (__VLS_ctx.categoryForm.isEnabled),
}));
const __VLS_200 = __VLS_199({
    modelValue: (__VLS_ctx.categoryForm.isEnabled),
}, ...__VLS_functionalComponentArgsRest(__VLS_199));
var __VLS_197;
var __VLS_169;
{
    const { footer: __VLS_thisSlot } = __VLS_165.slots;
    const __VLS_202 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_203 = __VLS_asFunctionalComponent(__VLS_202, new __VLS_202({
        ...{ 'onClick': {} },
    }));
    const __VLS_204 = __VLS_203({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_203));
    let __VLS_206;
    let __VLS_207;
    let __VLS_208;
    const __VLS_209 = {
        onClick: (...[$event]) => {
            __VLS_ctx.categoryDialogVisible = false;
        }
    };
    __VLS_205.slots.default;
    var __VLS_205;
    const __VLS_210 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_211 = __VLS_asFunctionalComponent(__VLS_210, new __VLS_210({
        ...{ 'onClick': {} },
        type: "primary",
    }));
    const __VLS_212 = __VLS_211({
        ...{ 'onClick': {} },
        type: "primary",
    }, ...__VLS_functionalComponentArgsRest(__VLS_211));
    let __VLS_214;
    let __VLS_215;
    let __VLS_216;
    const __VLS_217 = {
        onClick: (__VLS_ctx.saveCategory)
    };
    __VLS_213.slots.default;
    var __VLS_213;
}
var __VLS_165;
const __VLS_218 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_219 = __VLS_asFunctionalComponent(__VLS_218, new __VLS_218({
    modelValue: (__VLS_ctx.editorVisible),
    title: (`${__VLS_ctx.editorMode === 'create' ? '新建' : '编辑'} ${__VLS_ctx.moduleMeta.label}`),
    width: (780),
    closeOnClickModal: (false),
}));
const __VLS_220 = __VLS_219({
    modelValue: (__VLS_ctx.editorVisible),
    title: (`${__VLS_ctx.editorMode === 'create' ? '新建' : '编辑'} ${__VLS_ctx.moduleMeta.label}`),
    width: (780),
    closeOnClickModal: (false),
}, ...__VLS_functionalComponentArgsRest(__VLS_219));
__VLS_221.slots.default;
const __VLS_222 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_223 = __VLS_asFunctionalComponent(__VLS_222, new __VLS_222({
    model: (__VLS_ctx.editorForm),
    labelWidth: "130px",
    labelPosition: "right",
}));
const __VLS_224 = __VLS_223({
    model: (__VLS_ctx.editorForm),
    labelWidth: "130px",
    labelPosition: "right",
}, ...__VLS_functionalComponentArgsRest(__VLS_223));
__VLS_225.slots.default;
for (const [f] of __VLS_getVForSourceType((__VLS_ctx.schema.commonFields))) {
    /** @type {[typeof DesignFormField, ]} */ ;
    // @ts-ignore
    const __VLS_226 = __VLS_asFunctionalComponent(DesignFormField, new DesignFormField({
        key: (f.key),
        field: (f),
        modelValue: (__VLS_ctx.editorForm[f.key]),
    }));
    const __VLS_227 = __VLS_226({
        key: (f.key),
        field: (f),
        modelValue: (__VLS_ctx.editorForm[f.key]),
    }, ...__VLS_functionalComponentArgsRest(__VLS_226));
}
const __VLS_229 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_230 = __VLS_asFunctionalComponent(__VLS_229, new __VLS_229({
    label: "分类",
}));
const __VLS_231 = __VLS_230({
    label: "分类",
}, ...__VLS_functionalComponentArgsRest(__VLS_230));
__VLS_232.slots.default;
if (__VLS_ctx.editorForm.categoryId) {
    const __VLS_233 = {}.ElTag;
    /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
    // @ts-ignore
    const __VLS_234 = __VLS_asFunctionalComponent(__VLS_233, new __VLS_233({
        type: "info",
    }));
    const __VLS_235 = __VLS_234({
        type: "info",
    }, ...__VLS_functionalComponentArgsRest(__VLS_234));
    __VLS_236.slots.default;
    (__VLS_ctx.editorForm.categoryId);
    var __VLS_236;
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "muted" },
    });
}
var __VLS_232;
if (__VLS_ctx.moduleMeta.hasSourceBookScope) {
    const __VLS_237 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_238 = __VLS_asFunctionalComponent(__VLS_237, new __VLS_237({
        label: "源书 ID",
    }));
    const __VLS_239 = __VLS_238({
        label: "源书 ID",
    }, ...__VLS_functionalComponentArgsRest(__VLS_238));
    __VLS_240.slots.default;
    if (__VLS_ctx.editorForm.sourceBookId) {
        const __VLS_241 = {}.ElTag;
        /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
        // @ts-ignore
        const __VLS_242 = __VLS_asFunctionalComponent(__VLS_241, new __VLS_241({
            type: "info",
        }));
        const __VLS_243 = __VLS_242({
            type: "info",
        }, ...__VLS_functionalComponentArgsRest(__VLS_242));
        __VLS_244.slots.default;
        (__VLS_ctx.editorForm.sourceBookId);
        var __VLS_244;
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "muted" },
        });
    }
    var __VLS_240;
}
const __VLS_245 = {}.ElTabs;
/** @type {[typeof __VLS_components.ElTabs, typeof __VLS_components.elTabs, typeof __VLS_components.ElTabs, typeof __VLS_components.elTabs, ]} */ ;
// @ts-ignore
const __VLS_246 = __VLS_asFunctionalComponent(__VLS_245, new __VLS_245({
    modelValue: (__VLS_ctx.editorTab),
    ...{ class: "editor-tabs" },
}));
const __VLS_247 = __VLS_246({
    modelValue: (__VLS_ctx.editorTab),
    ...{ class: "editor-tabs" },
}, ...__VLS_functionalComponentArgsRest(__VLS_246));
__VLS_248.slots.default;
for (const [t] of __VLS_getVForSourceType((__VLS_ctx.schema.tabs))) {
    const __VLS_249 = {}.ElTabPane;
    /** @type {[typeof __VLS_components.ElTabPane, typeof __VLS_components.elTabPane, typeof __VLS_components.ElTabPane, typeof __VLS_components.elTabPane, ]} */ ;
    // @ts-ignore
    const __VLS_250 = __VLS_asFunctionalComponent(__VLS_249, new __VLS_249({
        key: (t.key),
        name: (t.key),
        label: (t.label),
    }));
    const __VLS_251 = __VLS_250({
        key: (t.key),
        name: (t.key),
        label: (t.label),
    }, ...__VLS_functionalComponentArgsRest(__VLS_250));
    __VLS_252.slots.default;
    for (const [f] of __VLS_getVForSourceType((t.fields))) {
        /** @type {[typeof DesignFormField, ]} */ ;
        // @ts-ignore
        const __VLS_253 = __VLS_asFunctionalComponent(DesignFormField, new DesignFormField({
            key: (f.key),
            field: (f),
            modelValue: (__VLS_ctx.editorForm[f.key]),
        }));
        const __VLS_254 = __VLS_253({
            key: (f.key),
            field: (f),
            modelValue: (__VLS_ctx.editorForm[f.key]),
        }, ...__VLS_functionalComponentArgsRest(__VLS_253));
    }
    var __VLS_252;
}
var __VLS_248;
var __VLS_225;
{
    const { footer: __VLS_thisSlot } = __VLS_221.slots;
    const __VLS_256 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_257 = __VLS_asFunctionalComponent(__VLS_256, new __VLS_256({
        ...{ 'onClick': {} },
    }));
    const __VLS_258 = __VLS_257({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_257));
    let __VLS_260;
    let __VLS_261;
    let __VLS_262;
    const __VLS_263 = {
        onClick: (...[$event]) => {
            __VLS_ctx.editorVisible = false;
        }
    };
    __VLS_259.slots.default;
    var __VLS_259;
    const __VLS_264 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_265 = __VLS_asFunctionalComponent(__VLS_264, new __VLS_264({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.saving),
    }));
    const __VLS_266 = __VLS_265({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.saving),
    }, ...__VLS_functionalComponentArgsRest(__VLS_265));
    let __VLS_268;
    let __VLS_269;
    let __VLS_270;
    const __VLS_271 = {
        onClick: (__VLS_ctx.saveEditor)
    };
    __VLS_267.slots.default;
    var __VLS_267;
}
var __VLS_221;
const __VLS_272 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_273 = __VLS_asFunctionalComponent(__VLS_272, new __VLS_272({
    modelValue: (__VLS_ctx.newSourceBookVisible),
    title: "新建源书",
    width: "400px",
}));
const __VLS_274 = __VLS_273({
    modelValue: (__VLS_ctx.newSourceBookVisible),
    title: "新建源书",
    width: "400px",
}, ...__VLS_functionalComponentArgsRest(__VLS_273));
__VLS_275.slots.default;
const __VLS_276 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_277 = __VLS_asFunctionalComponent(__VLS_276, new __VLS_276({}));
const __VLS_278 = __VLS_277({}, ...__VLS_functionalComponentArgsRest(__VLS_277));
__VLS_279.slots.default;
const __VLS_280 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_281 = __VLS_asFunctionalComponent(__VLS_280, new __VLS_280({
    label: "名称",
    required: true,
}));
const __VLS_282 = __VLS_281({
    label: "名称",
    required: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_281));
__VLS_283.slots.default;
const __VLS_284 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_285 = __VLS_asFunctionalComponent(__VLS_284, new __VLS_284({
    ...{ 'onKeyup': {} },
    modelValue: (__VLS_ctx.newSourceBookName),
}));
const __VLS_286 = __VLS_285({
    ...{ 'onKeyup': {} },
    modelValue: (__VLS_ctx.newSourceBookName),
}, ...__VLS_functionalComponentArgsRest(__VLS_285));
let __VLS_288;
let __VLS_289;
let __VLS_290;
const __VLS_291 = {
    onKeyup: (__VLS_ctx.quickCreateSourceBook)
};
var __VLS_287;
var __VLS_283;
var __VLS_279;
{
    const { footer: __VLS_thisSlot } = __VLS_275.slots;
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
            __VLS_ctx.newSourceBookVisible = false;
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
    }));
    const __VLS_302 = __VLS_301({
        ...{ 'onClick': {} },
        type: "primary",
    }, ...__VLS_functionalComponentArgsRest(__VLS_301));
    let __VLS_304;
    let __VLS_305;
    let __VLS_306;
    const __VLS_307 = {
        onClick: (__VLS_ctx.quickCreateSourceBook)
    };
    __VLS_303.slots.default;
    var __VLS_303;
}
var __VLS_275;
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
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['editor-tabs']} */ ;
// @ts-ignore
var __VLS_49 = __VLS_48;
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
            moduleKey: moduleKey,
            moduleMeta: moduleMeta,
            schema: schema,
            sourceBooks: sourceBooks,
            selectedSourceBookId: selectedSourceBookId,
            newSourceBookName: newSourceBookName,
            newSourceBookVisible: newSourceBookVisible,
            quickCreateSourceBook: quickCreateSourceBook,
            categoryTree: categoryTree,
            loadingCategories: loadingCategories,
            selectedCategoryId: selectedCategoryId,
            treeRef: treeRef,
            refreshCategories: refreshCategories,
            categoryDialogVisible: categoryDialogVisible,
            categoryDialogMode: categoryDialogMode,
            categoryForm: categoryForm,
            openCreateCategory: openCreateCategory,
            openEditCategory: openEditCategory,
            saveCategory: saveCategory,
            removeCategory: removeCategory,
            items: items,
            loadingItems: loadingItems,
            keyword: keyword,
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
