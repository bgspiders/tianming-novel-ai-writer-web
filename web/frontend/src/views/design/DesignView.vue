<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Edit, Delete, Refresh, FolderAdd, Search } from '@element-plus/icons-vue'
import { useWorkContextStore } from '@/stores/workContext'

import {
  DESIGN_MODULES,
  type DesignModuleKey,
  worldRulesApi,
  characterRulesApi,
  factionRulesApi,
  locationRulesApi,
  plotRulesApi,
  creativeMaterialsApi,
  bookAnalysesApi,
  outlinesApi,
  volumeDesignsApi,
  chapterPlansApi,
  chapterBlueprintsApi
} from '@/api/modules/design'
import {
  getCategoryTree,
  createCategory,
  updateCategory,
  reorderCategories,
  deleteCategory,
  type CategoryTreeNode,
  type CategoryUpsert
} from '@/api/modules/categories'
import {
  listSourceBooks,
  createSourceBook,
  type SourceBook
} from '@/api/modules/sourceBooks'

import DesignFormField from '@/components/design/DesignFormField.vue'
import { MODULE_SCHEMAS, buildEmptyForm, type FieldDef, type PickerSource } from '@/components/design/moduleSchemas'

const route = useRoute()
const router = useRouter()
const workContext = useWorkContextStore()

// --- 路由模块 ---
const moduleKey = computed<DesignModuleKey>(() => {
  const k = route.params.module as string
  const valid = DESIGN_MODULES.find((m) => m.key === k)
  return (valid?.key ?? 'world_rules') as DesignModuleKey
})

const moduleMeta = computed(() => DESIGN_MODULES.find((m) => m.key === moduleKey.value)!)
const schema = computed(() => MODULE_SCHEMAS[moduleKey.value])

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
} as const
const activeApi = computed(() => apiMap[moduleKey.value])

type PickerOption = { label: string; value: string | number }
type PickerRow = Record<string, unknown>

const pickerRows = ref<Record<PickerSource, PickerRow[]>>({
  characters: [],
  factions: [],
  locations: [],
  volumes: []
})

function getPickerValue(row: Record<string, unknown>, field: FieldDef): string | number {
  switch (field.pickerValue) {
    case 'id': return row.id as string
    case 'volumeNumber': return row.volumeNumber as number
    case 'title': return (row.title ?? row.volumeTitle ?? row.name ?? '') as string
    case 'name':
    default: return (row.name ?? row.title ?? '') as string
  }
}

function getPickerLabel(row: Record<string, unknown>, source: PickerSource): string {
  if (source === 'volumes') {
    return `第 ${row.volumeNumber} 卷 · ${row.title}`
  }
  return String(row.name ?? row.title ?? row.id ?? '')
}

async function refreshPickers() {
  const scoped = moduleMeta.value.hasSourceBookScope ? selectedSourceBookId.value || null : null
  const projectId = workContext.selectedProjectId || null
  const [characters, factions, locations] = await Promise.all([
    characterRulesApi.list({ sourceBookId: scoped, projectId, isEnabled: true }),
    factionRulesApi.list({ sourceBookId: scoped, projectId, isEnabled: true }),
    locationRulesApi.list({ sourceBookId: scoped, projectId, isEnabled: true })
  ])

  pickerRows.value = {
    characters: characters as unknown as PickerRow[],
    factions: factions as unknown as PickerRow[],
    locations: locations as unknown as PickerRow[],
    volumes: workContext.volumes as unknown as PickerRow[]
  }
}

function optionsFor(field: FieldDef): PickerOption[] {
  if (!field.pickerSource) return []
  return pickerRows.value[field.pickerSource]
    .map((row) => ({
      label: getPickerLabel(row, field.pickerSource!),
      value: getPickerValue(row, field)
    }))
    .filter((o) => o.value !== '')
}

function invalidReferenceMessage(field: FieldDef, currentValue: unknown): string {
  if (!field.pickerSource || currentValue === null || currentValue === undefined || currentValue === '') return ''
  const options = optionsFor(field)
  if (Array.isArray(currentValue)) {
    const missing = currentValue.filter((v) => !options.some((o) => o.value === v))
    return missing.length ? `当前有 ${missing.length} 个引用不在候选项中: ${missing.join('、')}` : ''
  }
  return options.some((o) => o.value === currentValue)
    ? ''
    : `当前值 "${String(currentValue)}" 不在候选项中,请确认是否已删除或切换了源书。`
}

function hasPickerOption(options: PickerOption[], value: unknown): boolean {
  return options.some((o) => o.value === value)
}

function clearInvalidReferences(field: FieldDef) {
  if (!field.pickerSource) return
  const currentValue = editorForm.value[field.key]
  const options = optionsFor(field)
  if (Array.isArray(currentValue)) {
    const validValues = currentValue.filter((v) => hasPickerOption(options, v))
    const removedCount = currentValue.length - validValues.length
    editorForm.value[field.key] = validValues
    if (removedCount > 0) {
      ElMessage.success(`已清理 ${removedCount} 个失效引用`)
    }
    return
  }
  if (currentValue !== null && currentValue !== undefined && currentValue !== '' && !hasPickerOption(options, currentValue)) {
    editorForm.value[field.key] = field.type === 'select' ? null : ''
    ElMessage.success('已清理失效引用')
  }
}

async function rematchReferences(field: FieldDef) {
  if (!field.pickerSource) return
  try {
    await refreshPickers()
    const message = invalidReferenceMessage(field, editorForm.value[field.key])
    if (message) {
      ElMessage.warning('已重新匹配候选项,仍有引用失效')
    } else {
      ElMessage.success('已重新匹配引用')
    }
  } catch (err) {
    ElMessage.error((err as Error).message ?? '重新匹配失败')
  }
}

// --- SourceBook 切换 ---
const sourceBooks = ref<SourceBook[]>([])
const selectedSourceBookId = ref<string>('')

async function refreshSourceBooks() {
  try {
    sourceBooks.value = await listSourceBooks()
    if (!selectedSourceBookId.value && workContext.selectedProject?.currentSourceBookId) {
      selectedSourceBookId.value = workContext.selectedProject.currentSourceBookId
    }
  } catch (err) {
    ElMessage.error((err as Error).message ?? '加载源书失败')
  }
}

const newSourceBookName = ref('')
const newSourceBookVisible = ref(false)
async function quickCreateSourceBook() {
  if (!newSourceBookName.value.trim()) {
    ElMessage.warning('请输入源书名称')
    return
  }
  try {
    const sb = await createSourceBook({ name: newSourceBookName.value.trim() })
    sourceBooks.value = [sb, ...sourceBooks.value]
    selectedSourceBookId.value = sb.id
    newSourceBookVisible.value = false
    newSourceBookName.value = ''
    ElMessage.success('源书已创建')
  } catch (err) {
    ElMessage.error((err as Error).message ?? '创建失败')
  }
}

async function bindSourceBookToProject() {
  if (!workContext.selectedProjectId) {
    ElMessage.warning('请先选择项目')
    return
  }
  try {
    await workContext.updateSelectedProjectSourceBook(selectedSourceBookId.value || null)
    ElMessage.success('已设为当前项目默认源书')
  } catch (err) {
    ElMessage.error((err as Error).message ?? '绑定失败')
  }
}

// --- Category 树 ---
const categoryTree = ref<CategoryTreeNode[]>([])
const loadingCategories = ref(false)
const selectedCategoryId = ref<string | null>(null)
const treeRef = ref()

async function refreshCategories() {
  loadingCategories.value = true
  try {
    categoryTree.value = await getCategoryTree(
      moduleKey.value,
      moduleMeta.value.hasSourceBookScope ? selectedSourceBookId.value || null : null,
      workContext.selectedProjectId || null
    )
  } catch (err) {
    ElMessage.error((err as Error).message ?? '加载分类失败')
  } finally {
    loadingCategories.value = false
  }
}

const categoryDialogVisible = ref(false)
const categoryDialogMode = ref<'create' | 'edit'>('create')
const categoryEditId = ref<string>('')
const categoryForm = ref<CategoryUpsert>({
  moduleType: '',
  name: '',
  parentId: null,
  sortOrder: 0,
  isEnabled: true,
  sourceBookId: null,
  projectId: null
})

function flattenCategories(nodes: CategoryTreeNode[], depth = 0): PickerOption[] {
  return nodes.flatMap((node) => [
    { label: `${'　'.repeat(depth)}${node.name}`, value: node.id },
    ...flattenCategories(node.children ?? [], depth + 1)
  ])
}

const categoryParentOptions = computed(() =>
  flattenCategories(categoryTree.value).filter((o) => o.value !== categoryEditId.value)
)

function openCreateCategory(parent?: CategoryTreeNode) {
  categoryDialogMode.value = 'create'
  categoryEditId.value = ''
  categoryForm.value = {
    moduleType: moduleKey.value,
    name: '',
    parentId: parent?.id ?? null,
    sortOrder: 0,
    isEnabled: true,
    sourceBookId: moduleMeta.value.hasSourceBookScope ? (selectedSourceBookId.value || null) : null,
    projectId: workContext.selectedProjectId || null
  }
  categoryDialogVisible.value = true
}

function openEditCategory(node: CategoryTreeNode) {
  categoryDialogMode.value = 'edit'
  categoryEditId.value = node.id
  categoryForm.value = {
    moduleType: node.moduleType,
    name: node.name,
    parentId: node.parentId,
    sortOrder: node.sortOrder,
    isEnabled: node.isEnabled,
    sourceBookId: node.sourceBookId,
    projectId: workContext.selectedProjectId || null
  }
  categoryDialogVisible.value = true
}

async function saveCategory() {
  try {
    if (categoryDialogMode.value === 'create') {
      await createCategory(categoryForm.value)
      ElMessage.success('分类已创建')
    } else {
      await updateCategory(categoryEditId.value, categoryForm.value)
      ElMessage.success('分类已更新')
    }
    categoryDialogVisible.value = false
    await refreshCategories()
  } catch (err) {
    ElMessage.error((err as Error).message ?? '保存失败')
  }
}

async function removeCategory(node: CategoryTreeNode) {
  if (node.isBuiltIn) {
    ElMessage.warning('内置分类不可删除')
    return
  }
  try {
    await ElMessageBox.confirm(`删除分类 "${node.name}"?`, '确认', { type: 'warning' })
  } catch { return }
  try {
    await deleteCategory(node.id)
    ElMessage.success('已删除')
    if (selectedCategoryId.value === node.id) selectedCategoryId.value = null
    await refreshCategories()
  } catch (err) {
    ElMessage.error((err as Error).message ?? '删除失败')
  }
}

function flattenCategoryOrder(
  nodes: CategoryTreeNode[],
  parentId: string | null = null
): { id: string; parentId: string | null; sortOrder: number }[] {
  return nodes.flatMap((node, index) => [
    { id: node.id, parentId, sortOrder: index * 10 },
    ...flattenCategoryOrder(node.children ?? [], node.id)
  ])
}

async function saveCategoryOrder() {
  try {
    await reorderCategories({
      moduleType: moduleKey.value,
      sourceBookId: moduleMeta.value.hasSourceBookScope ? (selectedSourceBookId.value || null) : null,
      projectId: workContext.selectedProjectId || null,
      items: flattenCategoryOrder(categoryTree.value)
    })
    await refreshCategories()
  } catch (err) {
    ElMessage.error((err as Error).message ?? '分类排序保存失败')
    await refreshCategories()
  }
}

// --- 数据列表 ---
const items = ref<Record<string, unknown>[]>([])
const loadingItems = ref(false)
const keyword = ref('')
const isEnabledFilter = ref<'all' | 'enabled' | 'disabled'>('all')
const includeUncategorized = ref(false)
const updatedRange = ref<[string, string] | []>([])
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

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
  }
}

async function refreshItems() {
  loadingItems.value = true
  try {
    const result = await activeApi.value.listPaged(buildListParams())
    items.value = result.items as unknown as Record<string, unknown>[]
    total.value = result.total
    page.value = result.page
    pageSize.value = result.pageSize
  } catch (err) {
    ElMessage.error((err as Error).message ?? '加载列表失败')
  } finally {
    loadingItems.value = false
  }
}

async function refreshWorkspaceData() {
  await Promise.all([
    refreshCategories(),
    refreshItems(),
    refreshPickers()
  ])
}

// --- 编辑器 ---
const editorVisible = ref(false)
const editorMode = ref<'create' | 'edit'>('create')
const editorId = ref<string>('')
const editorForm = ref<Record<string, unknown>>({})
const editorTab = ref<string>('')
const saving = ref(false)

function openCreate() {
  editorMode.value = 'create'
  editorId.value = ''
  editorForm.value = buildEmptyForm(moduleKey.value)
  editorForm.value.categoryId = selectedCategoryId.value
  editorForm.value.sourceBookId = moduleMeta.value.hasSourceBookScope ? (selectedSourceBookId.value || null) : null
  editorForm.value.projectId = workContext.selectedProjectId || null
  editorTab.value = schema.value.tabs[0]?.key ?? ''
  editorVisible.value = true
}

async function openEdit(row: Record<string, unknown>) {
  editorMode.value = 'edit'
  editorId.value = row.id as string
  try {
    const detail = (await activeApi.value.get(row.id as string)) as unknown as Record<string, unknown>
    editorForm.value = { ...buildEmptyForm(moduleKey.value), ...detail }
    editorForm.value.projectId = workContext.selectedProjectId || null
    editorTab.value = schema.value.tabs[0]?.key ?? ''
    editorVisible.value = true
  } catch (err) {
    ElMessage.error((err as Error).message ?? '加载详情失败')
  }
}

async function saveEditor() {
  if (!editorForm.value.name) {
    ElMessage.warning('名称必填')
    return
  }
  saving.value = true
  try {
    if (editorMode.value === 'create') {
      await activeApi.value.create(editorForm.value as never)
      ElMessage.success('已创建')
    } else {
      await activeApi.value.update(editorId.value, editorForm.value as never)
      ElMessage.success('已更新')
    }
    editorVisible.value = false
    await refreshItems()
    await refreshCategories() // 刷新计数
  } catch (err) {
    ElMessage.error((err as Error).message ?? '保存失败')
  } finally {
    saving.value = false
  }
}

async function removeItem(row: Record<string, unknown>) {
  try {
    await ElMessageBox.confirm(`删除 "${row.name}"?`, '确认', { type: 'warning' })
  } catch { return }
  try {
    await activeApi.value.remove(row.id as string)
    ElMessage.success('已删除')
    await refreshItems()
    await refreshCategories()
  } catch (err) {
    ElMessage.error((err as Error).message ?? '删除失败')
  }
}

// --- 字段渲染辅助 ---
function getField(key: string): FieldDef | undefined {
  for (const f of schema.value.commonFields) if (f.key === key) return f
  for (const t of schema.value.tabs) for (const f of t.fields) if (f.key === key) return f
  return undefined
}

function formatCellValue(row: Record<string, unknown>, col: { key: string }): string {
  const v = row[col.key]
  if (v === null || v === undefined) return '—'
  if (Array.isArray(v)) return v.join('、')
  const s = String(v)
  return s.length > 60 ? s.slice(0, 60) + '…' : s
}

// --- 模块/源书切换 ---
function switchModule(key: DesignModuleKey) {
  router.push({ name: 'design-module', params: { module: key } })
}

watch(moduleKey, async () => {
  selectedCategoryId.value = null
  page.value = 1
  await refreshWorkspaceData()
})

watch(selectedSourceBookId, async () => {
  selectedCategoryId.value = null
  page.value = 1
  await refreshWorkspaceData()
})

watch(selectedCategoryId, () => {
  includeUncategorized.value = false
  page.value = 1
  refreshItems()
})

watch([isEnabledFilter, includeUncategorized, updatedRange], () => {
  page.value = 1
  refreshItems()
})

watch(() => workContext.selectedProjectId, async () => {
  selectedSourceBookId.value = workContext.selectedProject?.currentSourceBookId ?? ''
  page.value = 1
  await refreshWorkspaceData()
})

watch(() => workContext.selectedVolumeId, refreshPickers)

watch(() => workContext.volumes, refreshPickers, { deep: true })

onMounted(async () => {
  await workContext.init()
  await refreshSourceBooks()
  await refreshWorkspaceData()
})
</script>

<template>
  <div class="design-view">
    <!-- 顶部模块切换 -->
    <el-card shadow="never" class="header-card">
      <div class="header-row">
        <div class="module-tabs">
          <button
            v-for="m in DESIGN_MODULES"
            :key="m.key"
            :class="['module-tab', { active: m.key === moduleKey }]"
            @click="switchModule(m.key)"
          >
            <span class="icon">{{ m.icon }}</span>
            <span>{{ m.label }}</span>
          </button>
        </div>

        <div v-if="moduleMeta.hasSourceBookScope" class="sourcebook-area">
          <span class="label">源书:</span>
          <el-select
            v-model="selectedSourceBookId"
            placeholder="全部"
            clearable
            size="small"
            style="width: 200px"
          >
            <el-option label="(全局共享)" value="" />
            <el-option
              v-for="sb in sourceBooks"
              :key="sb.id"
              :label="sb.name"
              :value="sb.id"
            />
          </el-select>
          <el-button size="small" :icon="Plus" @click="newSourceBookVisible = true">新建源书</el-button>
          <el-button
            size="small"
            :disabled="!workContext.selectedProjectId"
            @click="bindSourceBookToProject"
          >
            设为项目默认
          </el-button>
        </div>
      </div>
    </el-card>

    <div class="main-layout">
      <!-- 左侧分类树 -->
      <el-card shadow="never" class="tree-panel">
        <template #header>
          <div class="panel-head">
            <span>{{ moduleMeta.label }} · 分类</span>
            <div>
              <el-button text size="small" :icon="Refresh" @click="refreshCategories" />
              <el-button text size="small" :icon="FolderAdd" @click="openCreateCategory()" />
            </div>
          </div>
        </template>

        <div v-loading="loadingCategories" class="tree-body">
          <div
            :class="['cat-item all', { active: !selectedCategoryId }]"
            @click="selectedCategoryId = null"
          >
            <span>全部 / 未分类</span>
          </div>

          <el-tree
            ref="treeRef"
            :data="categoryTree"
            node-key="id"
            draggable
            :default-expand-all="true"
            :expand-on-click-node="false"
            :highlight-current="true"
            empty-text="暂无分类"
            @node-drop="saveCategoryOrder"
          >
            <template #default="{ node, data }">
              <div
                :class="['cat-node', { active: selectedCategoryId === data.id }]"
                @click.stop="selectedCategoryId = data.id"
              >
                <span class="cat-name">{{ data.name }}</span>
                <el-tag v-if="data.isBuiltIn" size="small" type="info" effect="plain">内置</el-tag>
                <span class="cat-count">{{ data.itemCount }}</span>
                <span class="cat-actions">
                  <el-button text size="small" :icon="Plus" @click.stop="openCreateCategory(data)" />
                  <el-button text size="small" :icon="Edit" @click.stop="openEditCategory(data)" />
                  <el-button v-if="!data.isBuiltIn" text size="small" :icon="Delete" type="danger" @click.stop="removeCategory(data)" />
                </span>
              </div>
            </template>
          </el-tree>
        </div>
      </el-card>

      <!-- 右侧列表 -->
      <el-card shadow="never" class="list-panel">
        <template #header>
          <div class="panel-head">
            <span>{{ moduleMeta.label }} · 数据</span>
            <div class="head-actions">
              <el-input
                v-model="keyword"
                placeholder="名称关键字"
                clearable
                size="small"
                style="width: 200px"
                :prefix-icon="Search"
                @change="page = 1; refreshItems()"
              />
              <el-select v-model="isEnabledFilter" size="small" style="width: 100px">
                <el-option label="全部状态" value="all" />
                <el-option label="启用" value="enabled" />
                <el-option label="禁用" value="disabled" />
              </el-select>
              <el-date-picker
                v-model="updatedRange"
                type="datetimerange"
                start-placeholder="更新起"
                end-placeholder="更新止"
                value-format="YYYY-MM-DDTHH:mm:ss"
                size="small"
                style="width: 310px"
              />
              <el-checkbox v-model="includeUncategorized" size="small">仅未分类</el-checkbox>
              <el-button size="small" :icon="Refresh" @click="refreshItems" />
              <el-button type="primary" size="small" :icon="Plus" @click="openCreate">新建</el-button>
            </div>
          </div>
        </template>

        <el-table v-loading="loadingItems" :data="items" stripe size="small" @row-dblclick="openEdit">
          <el-table-column prop="name" label="名称" min-width="200" />
          <el-table-column prop="category" label="分类" width="120" />
          <el-table-column
            v-for="col in schema.listColumns ?? []"
            :key="col.key"
            :label="col.label"
            :width="col.width"
          >
            <template #default="{ row }">
              <span>{{ formatCellValue(row, col) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="70">
            <template #default="{ row }">
              <el-tag :type="row.isEnabled ? 'success' : 'info'" size="small">
                {{ row.isEnabled ? '启用' : '禁用' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="更新时间" width="160">
            <template #default="{ row }">
              <span class="muted">{{ new Date(row.updatedAt).toLocaleString() }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="140" align="center" fixed="right">
            <template #default="{ row }">
              <el-button text size="small" :icon="Edit" @click="openEdit(row)">编辑</el-button>
              <el-button text size="small" :icon="Delete" type="danger" @click="removeItem(row)">删除</el-button>
            </template>
          </el-table-column>
          <template #empty>
            <el-empty :description="`暂无数据,点 「新建」 添加 ${moduleMeta.label}`" />
          </template>
        </el-table>

        <div class="pager-row">
          <span class="muted">共 {{ total }} 条</span>
          <el-pagination
            v-model:current-page="page"
            v-model:page-size="pageSize"
            layout="sizes, prev, pager, next"
            :total="total"
            :page-sizes="[10, 20, 50, 100]"
            small
            background
            @current-change="refreshItems"
            @size-change="page = 1; refreshItems()"
          />
        </div>
      </el-card>
    </div>

    <!-- 分类编辑对话框 -->
    <el-dialog v-model="categoryDialogVisible" :title="categoryDialogMode === 'create' ? '新建分类' : '编辑分类'" width="460px">
      <el-form :model="categoryForm" label-width="100px" label-position="right">
        <el-form-item label="名称" required>
          <el-input v-model="categoryForm.name" />
        </el-form-item>
        <el-form-item label="父分类">
          <el-tree-select
            v-model="categoryForm.parentId"
            :data="categoryParentOptions"
            check-strictly
            clearable
            filterable
            placeholder="留空为根分类"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="categoryForm.sortOrder" :min="0" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="categoryForm.isEnabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="categoryDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveCategory">保存</el-button>
      </template>
    </el-dialog>

    <!-- 数据编辑器 -->
    <el-dialog
      v-model="editorVisible"
      :title="`${editorMode === 'create' ? '新建' : '编辑'} ${moduleMeta.label}`"
      :width="780"
      :close-on-click-modal="false"
    >
      <el-form :model="editorForm" label-width="130px" label-position="right">
        <!-- 公共字段 -->
        <DesignFormField
          v-for="f in schema.commonFields"
          :key="f.key"
          :field="f"
          :picker-options="optionsFor(f)"
          :invalid-message="invalidReferenceMessage(f, editorForm[f.key])"
          v-model="editorForm[f.key]"
          @clear-invalid-references="clearInvalidReferences(f)"
          @rematch-references="rematchReferences(f)"
        />

        <!-- 分类 / 源书 ID(只读显示) -->
        <el-form-item label="分类">
          <el-tag v-if="editorForm.categoryId" type="info">{{ editorForm.categoryId }}</el-tag>
          <span v-else class="muted">未选择(左侧分类树点击可绑定)</span>
        </el-form-item>
        <el-form-item v-if="moduleMeta.hasSourceBookScope" label="源书 ID">
          <el-tag v-if="editorForm.sourceBookId" type="info">{{ editorForm.sourceBookId }}</el-tag>
          <span v-else class="muted">未选择 — 全局共享</span>
        </el-form-item>

        <!-- Tab 字段 -->
        <el-tabs v-model="editorTab" class="editor-tabs">
          <el-tab-pane
            v-for="t in schema.tabs"
            :key="t.key"
            :name="t.key"
            :label="t.label"
          >
            <DesignFormField
              v-for="f in t.fields"
              :key="f.key"
              :field="f"
              :picker-options="optionsFor(f)"
              :invalid-message="invalidReferenceMessage(f, editorForm[f.key])"
              v-model="editorForm[f.key]"
              @clear-invalid-references="clearInvalidReferences(f)"
              @rematch-references="rematchReferences(f)"
            />
          </el-tab-pane>
        </el-tabs>
      </el-form>

      <template #footer>
        <el-button @click="editorVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveEditor">保存</el-button>
      </template>
    </el-dialog>

    <!-- 快速新建源书 -->
    <el-dialog v-model="newSourceBookVisible" title="新建源书" width="400px">
      <el-form>
        <el-form-item label="名称" required>
          <el-input v-model="newSourceBookName" @keyup.enter="quickCreateSourceBook" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="newSourceBookVisible = false">取消</el-button>
        <el-button type="primary" @click="quickCreateSourceBook">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.design-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: calc(100vh - 92px);
}
.header-card :deep(.el-card__body) {
  padding: 10px 16px;
}
.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}
.module-tabs {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.module-tab {
  border: 1px solid var(--tm-border);
  background: var(--tm-bg-elevated);
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
  color: var(--tm-fg-primary);
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.15s;
}
.module-tab:hover {
  border-color: var(--tm-primary);
}
.module-tab.active {
  background: var(--tm-primary);
  color: #fff;
  border-color: var(--tm-primary);
}
.module-tab .icon {
  font-size: 14px;
}
.sourcebook-area {
  display: flex;
  align-items: center;
  gap: 6px;
}
.sourcebook-area .label {
  font-size: 12px;
  color: var(--tm-fg-secondary);
}
.main-layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 12px;
  flex: 1;
  min-height: 0;
}
.tree-panel,
.list-panel {
  display: flex;
  flex-direction: column;
}
.tree-panel :deep(.el-card__body),
.list-panel :deep(.el-card__body) {
  flex: 1;
  overflow: auto;
}
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 500;
}
.head-actions {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.tree-body {
  font-size: 13px;
}
.cat-item.all {
  padding: 6px 10px;
  border-radius: 4px;
  cursor: pointer;
  margin-bottom: 4px;
  color: var(--tm-fg-secondary);
}
.cat-item.all:hover,
.cat-item.all.active {
  background: var(--tm-bg-elevated);
  color: var(--tm-primary);
}
.cat-node {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 2px 0;
  font-size: 13px;
}
.cat-name {
  flex: 1;
  cursor: pointer;
}
.cat-count {
  color: var(--tm-fg-secondary);
  font-size: 12px;
}
.cat-actions {
  visibility: hidden;
  display: flex;
  gap: 0;
}
.cat-node:hover .cat-actions {
  visibility: visible;
}
.cat-node.active .cat-name {
  color: var(--tm-primary);
  font-weight: 500;
}
.muted {
  color: var(--tm-fg-secondary);
  font-size: 12px;
}
.editor-tabs {
  margin-top: 16px;
}
.pager-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 12px;
}
</style>
