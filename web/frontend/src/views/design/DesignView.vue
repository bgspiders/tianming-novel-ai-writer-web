<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Edit, FolderAdd, Plus, Refresh, Search } from '@element-plus/icons-vue'
import { useWorkContextStore } from '@/stores/workContext'
import {
  DESIGN_MODULES,
  type BookAnalysisCrawlPreview,
  type DesignBase,
  type DesignListParams,
  type DesignModuleKey,
  bookAnalysesApi,
  chapterBlueprintsApi,
  chapterPlansApi,
  characterRulesApi,
  creativeMaterialsApi,
  factionRulesApi,
  locationRulesApi,
  outlinesApi,
  plotRulesApi,
  volumeDesignsApi,
  worldRulesApi
} from '@/api/modules/design'
import {
  createCategory,
  deleteCategory,
  getCategoryTree,
  reorderCategories,
  updateCategory,
  type CategoryTreeNode,
  type CategoryUpsert
} from '@/api/modules/categories'
import { createSourceBook, listSourceBooks, type SourceBook } from '@/api/modules/sourceBooks'
import DesignFormField from '@/components/design/DesignFormField.vue'
import {
  MODULE_SCHEMAS,
  buildEmptyForm,
  type FieldDef,
  type PickerSource
} from '@/components/design/moduleSchemas'

type PickerOption = { label: string; value: string | number }
type PickerRow = Record<string, unknown>
type DesignRecord = Record<string, unknown>

interface DesignApi {
  list: (p?: DesignListParams) => Promise<unknown[]>
  listPaged: (p: DesignListParams) => Promise<{ items: unknown[]; total: number; page: number; pageSize: number }>
  get: (id: string) => Promise<unknown>
  create: (input: unknown) => Promise<unknown>
  update: (id: string, input: unknown) => Promise<unknown>
  remove: (id: string) => Promise<void>
}

const route = useRoute()
const router = useRouter()
const workContext = useWorkContextStore()

const moduleKey = computed<DesignModuleKey>(() => {
  const raw = route.params.module as string
  return (DESIGN_MODULES.find((item) => item.key === raw)?.key ?? 'world_rules') as DesignModuleKey
})

const moduleMeta = computed(() => DESIGN_MODULES.find((item) => item.key === moduleKey.value)!)
const schema = computed(() => MODULE_SCHEMAS[moduleKey.value])

const apiMap: Record<DesignModuleKey, DesignApi> = {
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
}

const activeApi = computed(() => apiMap[moduleKey.value])

const pickerRows = ref<Record<PickerSource, PickerRow[]>>({
  characters: [],
  factions: [],
  locations: [],
  volumes: []
})

function getPickerValue(row: PickerRow, field: FieldDef): string | number {
  switch (field.pickerValue) {
    case 'id':
      return String(row.id ?? '')
    case 'volumeNumber':
      return Number(row.volumeNumber ?? 0)
    case 'title':
      return String(row.title ?? row.volumeTitle ?? row.name ?? '')
    case 'name':
    default:
      return String(row.name ?? row.title ?? '')
  }
}

function getPickerLabel(row: PickerRow, source: PickerSource): string {
  if (source === 'volumes') {
    return `Vol ${row.volumeNumber ?? ''} | ${row.title ?? ''}`
  }
  return String(row.name ?? row.title ?? row.id ?? '')
}

async function refreshPickers() {
  const scopedSourceBookId = moduleMeta.value.hasSourceBookScope ? selectedSourceBookId.value || null : null
  const projectId = workContext.selectedProjectId || null
  const [characters, factions, locations] = await Promise.all([
    characterRulesApi.list({ sourceBookId: scopedSourceBookId, projectId, isEnabled: true }),
    factionRulesApi.list({ sourceBookId: scopedSourceBookId, projectId, isEnabled: true }),
    locationRulesApi.list({ sourceBookId: scopedSourceBookId, projectId, isEnabled: true })
  ])

  pickerRows.value = {
    characters: characters as PickerRow[],
    factions: factions as PickerRow[],
    locations: locations as PickerRow[],
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
    .filter((item) => item.value !== '')
}

function hasPickerOption(options: PickerOption[], value: unknown): boolean {
  return options.some((option) => option.value === value)
}

function invalidReferenceMessage(field: FieldDef, currentValue: unknown): string {
  if (!field.pickerSource || currentValue === null || currentValue === undefined || currentValue === '') return ''
  const options = optionsFor(field)

  if (Array.isArray(currentValue)) {
    const missing = currentValue.filter((value) => !hasPickerOption(options, value))
    return missing.length ? `Missing references: ${missing.join(', ')}` : ''
  }

  return hasPickerOption(options, currentValue)
    ? ''
    : `Current value "${String(currentValue)}" does not exist in the available options.`
}

function clearInvalidReferences(field: FieldDef) {
  if (!field.pickerSource) return

  const currentValue = editorForm.value[field.key]
  const options = optionsFor(field)

  if (Array.isArray(currentValue)) {
    const validValues = currentValue.filter((value) => hasPickerOption(options, value))
    const removedCount = currentValue.length - validValues.length
    editorForm.value[field.key] = validValues
    if (removedCount > 0) ElMessage.success(`Removed ${removedCount} invalid references.`)
    return
  }

  if (currentValue !== null && currentValue !== undefined && currentValue !== '' && !hasPickerOption(options, currentValue)) {
    editorForm.value[field.key] = field.type === 'select' ? null : ''
    ElMessage.success('Invalid reference cleared.')
  }
}

async function rematchReferences(field: FieldDef) {
  if (!field.pickerSource) return
  try {
    await refreshPickers()
    const message = invalidReferenceMessage(field, editorForm.value[field.key])
    if (message) {
      ElMessage.warning('References refreshed, but some values are still invalid.')
    } else {
      ElMessage.success('References refreshed.')
    }
  } catch (err) {
    ElMessage.error((err as Error).message ?? 'Failed to refresh references.')
  }
}

const sourceBooks = ref<SourceBook[]>([])
const selectedSourceBookId = ref('')
const newSourceBookVisible = ref(false)
const newSourceBookName = ref('')

async function refreshSourceBooks() {
  try {
    sourceBooks.value = await listSourceBooks()
    if (!selectedSourceBookId.value && workContext.selectedProject?.currentSourceBookId) {
      selectedSourceBookId.value = workContext.selectedProject.currentSourceBookId
    }
  } catch (err) {
    ElMessage.error((err as Error).message ?? 'Failed to load source books.')
  }
}

async function quickCreateSourceBook() {
  if (!newSourceBookName.value.trim()) {
    ElMessage.warning('Source book name is required.')
    return
  }

  try {
    const sourceBook = await createSourceBook({ name: newSourceBookName.value.trim() })
    sourceBooks.value = [sourceBook, ...sourceBooks.value]
    selectedSourceBookId.value = sourceBook.id
    newSourceBookVisible.value = false
    newSourceBookName.value = ''
    ElMessage.success('Source book created.')
  } catch (err) {
    ElMessage.error((err as Error).message ?? 'Failed to create source book.')
  }
}

async function bindSourceBookToProject() {
  if (!workContext.selectedProjectId) {
    ElMessage.warning('Select a project first.')
    return
  }

  try {
    await workContext.updateSelectedProjectSourceBook(selectedSourceBookId.value || null)
    ElMessage.success('Project default source book updated.')
  } catch (err) {
    ElMessage.error((err as Error).message ?? 'Failed to bind source book.')
  }
}

const categoryTree = ref<CategoryTreeNode[]>([])
const loadingCategories = ref(false)
const selectedCategoryId = ref<string | null>(null)

async function refreshCategories() {
  loadingCategories.value = true
  try {
    categoryTree.value = await getCategoryTree(
      moduleKey.value,
      moduleMeta.value.hasSourceBookScope ? selectedSourceBookId.value || null : null,
      workContext.selectedProjectId || null
    )
  } catch (err) {
    ElMessage.error((err as Error).message ?? 'Failed to load categories.')
  } finally {
    loadingCategories.value = false
  }
}

const categoryDialogVisible = ref(false)
const categoryDialogMode = ref<'create' | 'edit'>('create')
const categoryEditId = ref('')
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
    { label: `${'  '.repeat(depth)}${node.name}`, value: node.id },
    ...flattenCategories(node.children ?? [], depth + 1)
  ])
}

const categoryParentOptions = computed(() =>
  flattenCategories(categoryTree.value).filter((option) => option.value !== categoryEditId.value)
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
    sourceBookId: moduleMeta.value.hasSourceBookScope ? selectedSourceBookId.value || null : null,
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
      ElMessage.success('Category created.')
    } else {
      await updateCategory(categoryEditId.value, categoryForm.value)
      ElMessage.success('Category updated.')
    }
    categoryDialogVisible.value = false
    await refreshCategories()
  } catch (err) {
    ElMessage.error((err as Error).message ?? 'Failed to save category.')
  }
}

async function removeCategory(node: CategoryTreeNode) {
  if (node.isBuiltIn) {
    ElMessage.warning('Built-in categories cannot be deleted.')
    return
  }

  try {
    await ElMessageBox.confirm(`Delete category "${node.name}"?`, 'Confirm', { type: 'warning' })
  } catch {
    return
  }

  try {
    await deleteCategory(node.id)
    if (selectedCategoryId.value === node.id) selectedCategoryId.value = null
    ElMessage.success('Category deleted.')
    await refreshCategories()
  } catch (err) {
    ElMessage.error((err as Error).message ?? 'Failed to delete category.')
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
      sourceBookId: moduleMeta.value.hasSourceBookScope ? selectedSourceBookId.value || null : null,
      projectId: workContext.selectedProjectId || null,
      items: flattenCategoryOrder(categoryTree.value)
    })
    await refreshCategories()
  } catch (err) {
    ElMessage.error((err as Error).message ?? 'Failed to save category order.')
    await refreshCategories()
  }
}

const items = ref<DesignRecord[]>([])
const loadingItems = ref(false)
const keyword = ref('')
const isEnabledFilter = ref<'all' | 'enabled' | 'disabled'>('all')
const includeUncategorized = ref(false)
const updatedRange = ref<[string, string] | []>([])
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

function buildListParams(): DesignListParams {
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
  }
}

async function refreshItems() {
  loadingItems.value = true
  try {
    const result = await activeApi.value.listPaged(buildListParams())
    items.value = result.items as DesignRecord[]
    total.value = result.total
    page.value = result.page
    pageSize.value = result.pageSize
  } catch (err) {
    ElMessage.error((err as Error).message ?? 'Failed to load records.')
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

const editorVisible = ref(false)
const editorMode = ref<'create' | 'edit'>('create')
const editorId = ref('')
const editorForm = ref<DesignRecord>({})
const editorTab = ref('')
const saving = ref(false)

function openCreate() {
  editorMode.value = 'create'
  editorId.value = ''
  editorForm.value = buildEmptyForm(moduleKey.value)
  editorForm.value.categoryId = selectedCategoryId.value
  editorForm.value.sourceBookId = moduleMeta.value.hasSourceBookScope ? selectedSourceBookId.value || null : null
  editorForm.value.projectId = workContext.selectedProjectId || null
  editorTab.value = schema.value.tabs[0]?.key ?? ''
  editorVisible.value = true
}

async function openEdit(row: DesignRecord) {
  editorMode.value = 'edit'
  editorId.value = String(row.id)
  try {
    const detail = await activeApi.value.get(String(row.id))
    editorForm.value = { ...buildEmptyForm(moduleKey.value), ...(detail as DesignRecord) }
    editorForm.value.projectId = workContext.selectedProjectId || null
    editorTab.value = schema.value.tabs[0]?.key ?? ''
    editorVisible.value = true
  } catch (err) {
    ElMessage.error((err as Error).message ?? 'Failed to load record detail.')
  }
}

async function saveEditor() {
  if (!editorForm.value.name) {
    ElMessage.warning('Name is required.')
    return
  }

  saving.value = true
  try {
    if (editorMode.value === 'create') {
      await activeApi.value.create(editorForm.value)
      ElMessage.success('Record created.')
    } else {
      await activeApi.value.update(editorId.value, editorForm.value)
      ElMessage.success('Record updated.')
    }
    editorVisible.value = false
    await refreshItems()
    await refreshCategories()
    await refreshPickers()
  } catch (err) {
    ElMessage.error((err as Error).message ?? 'Failed to save record.')
  } finally {
    saving.value = false
  }
}

async function removeItem(row: DesignRecord) {
  try {
    await ElMessageBox.confirm(`Delete "${row.name}"?`, 'Confirm', { type: 'warning' })
  } catch {
    return
  }

  try {
    await activeApi.value.remove(String(row.id))
    ElMessage.success('Record deleted.')
    await refreshItems()
    await refreshCategories()
    await refreshPickers()
  } catch (err) {
    ElMessage.error((err as Error).message ?? 'Failed to delete record.')
  }
}

function formatCellValue(row: DesignRecord, col: { key: string }) {
  const value = row[col.key]
  if (value === null || value === undefined) return '--'
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  const text = String(value)
  return text.length > 60 ? `${text.slice(0, 60)}...` : text
}

const bookAnalysisImportVisible = ref(false)
const importingBookAnalysis = ref(false)
const bookAnalysisImportUrl = ref('')
const bookAnalysisImportPreview = ref<BookAnalysisCrawlPreview | null>(null)

function openBookAnalysisImport() {
  bookAnalysisImportUrl.value = ''
  bookAnalysisImportPreview.value = null
  bookAnalysisImportVisible.value = true
}

async function previewBookAnalysisImport() {
  if (!bookAnalysisImportUrl.value.trim()) {
    ElMessage.warning('A source URL is required.')
    return
  }

  importingBookAnalysis.value = true
  try {
    bookAnalysisImportPreview.value = await bookAnalysesApi.crawlPreview({
      url: bookAnalysisImportUrl.value.trim(),
      maxChapters: 12,
      includeContent: true
    })
    ElMessage.success('Preview loaded.')
  } catch (err) {
    ElMessage.error((err as Error).message ?? 'Failed to crawl preview.')
  } finally {
    importingBookAnalysis.value = false
  }
}

function toBookAnalysisDraft(preview: BookAnalysisCrawlPreview): DesignRecord {
  return {
    ...buildEmptyForm('book_analyses'),
    categoryId: selectedCategoryId.value,
    projectId: workContext.selectedProjectId || null,
    name: preview.suggestedName || preview.title || 'Web Book Analysis',
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
  }
}

function applyImportedBookAnalysis(mode: 'current' | 'new') {
  if (!bookAnalysisImportPreview.value) return

  const draft = toBookAnalysisDraft(bookAnalysisImportPreview.value)

  if (mode === 'current' && editorVisible.value && moduleKey.value === 'book_analyses') {
    editorForm.value = { ...editorForm.value, ...draft }
  } else {
    editorMode.value = 'create'
    editorId.value = ''
    editorForm.value = draft
    editorTab.value = MODULE_SCHEMAS.book_analyses.tabs[0]?.key ?? ''
    editorVisible.value = true
  }

  bookAnalysisImportVisible.value = false
  ElMessage.success('Preview applied to the form.')
}

function switchModule(key: DesignModuleKey) {
  if (route.path.startsWith('/generate/')) {
    router.push(`/generate/${key}`)
    return
  }
  router.push(`/design/${key}`)
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
  void refreshItems()
})

watch([isEnabledFilter, includeUncategorized, updatedRange], () => {
  page.value = 1
  void refreshItems()
})

watch(
  () => workContext.selectedProjectId,
  async () => {
    selectedSourceBookId.value = workContext.selectedProject?.currentSourceBookId ?? ''
    page.value = 1
    await refreshWorkspaceData()
  }
)

watch(() => workContext.selectedVolumeId, () => {
  void refreshPickers()
})

watch(
  () => workContext.volumes,
  () => {
    void refreshPickers()
  },
  { deep: true }
)

onMounted(async () => {
  await workContext.init()
  await refreshSourceBooks()
  await refreshWorkspaceData()
})
</script>

<template>
  <div class="design-view">
    <el-card shadow="never" class="header-card">
      <div class="header-row">
        <div class="module-tabs">
          <button
            v-for="moduleItem in DESIGN_MODULES"
            :key="moduleItem.key"
            class="module-tab"
            :class="{ active: moduleItem.key === moduleKey }"
            type="button"
            @click="switchModule(moduleItem.key)"
          >
            <span class="icon">{{ moduleItem.icon }}</span>
            <span>{{ moduleItem.label }}</span>
          </button>
        </div>

        <div v-if="moduleMeta.hasSourceBookScope" class="sourcebook-area">
          <span class="label">Source Book</span>
          <el-select v-model="selectedSourceBookId" clearable size="small" style="width: 220px">
            <el-option label="All" value="" />
            <el-option v-for="book in sourceBooks" :key="book.id" :label="book.name" :value="book.id" />
          </el-select>
          <el-button size="small" :icon="Plus" @click="newSourceBookVisible = true">New</el-button>
          <el-button size="small" :disabled="!workContext.selectedProjectId" @click="bindSourceBookToProject">
            Set As Project Default
          </el-button>
        </div>
      </div>
    </el-card>

    <div class="main-layout">
      <el-card shadow="never" class="tree-panel">
        <template #header>
          <div class="panel-head">
            <span>{{ moduleMeta.label }} Categories</span>
            <div class="head-actions">
              <el-button text size="small" :icon="Refresh" @click="refreshCategories" />
              <el-button text size="small" :icon="FolderAdd" @click="openCreateCategory()" />
            </div>
          </div>
        </template>

        <div v-loading="loadingCategories" class="tree-body">
          <div :class="['cat-item', 'all', { active: !selectedCategoryId }]" @click="selectedCategoryId = null">
            All / Uncategorized
          </div>

          <el-tree
            :data="categoryTree"
            node-key="id"
            draggable
            :default-expand-all="true"
            :expand-on-click-node="false"
            :highlight-current="true"
            empty-text="No categories"
            @node-drop="saveCategoryOrder"
          >
            <template #default="{ data }">
              <div :class="['cat-node', { active: selectedCategoryId === data.id }]" @click.stop="selectedCategoryId = data.id">
                <span class="cat-name">{{ data.name }}</span>
                <el-tag v-if="data.isBuiltIn" size="small" type="info" effect="plain">Built-in</el-tag>
                <span class="cat-count">{{ data.itemCount }}</span>
                <span class="cat-actions">
                  <el-button text size="small" :icon="Plus" @click.stop="openCreateCategory(data)" />
                  <el-button text size="small" :icon="Edit" @click.stop="openEditCategory(data)" />
                  <el-button
                    v-if="!data.isBuiltIn"
                    text
                    size="small"
                    :icon="Delete"
                    type="danger"
                    @click.stop="removeCategory(data)"
                  />
                </span>
              </div>
            </template>
          </el-tree>
        </div>
      </el-card>

      <el-card shadow="never" class="list-panel">
        <template #header>
          <div class="panel-head">
            <span>{{ moduleMeta.label }} Records</span>
            <div class="head-actions">
              <el-button v-if="moduleKey === 'book_analyses'" size="small" @click="openBookAnalysisImport">
                Crawl Import
              </el-button>
              <el-input
                v-model="keyword"
                placeholder="Search by name"
                clearable
                size="small"
                style="width: 200px"
                :prefix-icon="Search"
                @change="page = 1; refreshItems()"
              />
              <el-select v-model="isEnabledFilter" size="small" style="width: 110px">
                <el-option label="All" value="all" />
                <el-option label="Enabled" value="enabled" />
                <el-option label="Disabled" value="disabled" />
              </el-select>
              <el-date-picker
                v-model="updatedRange"
                type="datetimerange"
                start-placeholder="Updated From"
                end-placeholder="Updated To"
                value-format="YYYY-MM-DDTHH:mm:ss"
                size="small"
                style="width: 320px"
              />
              <el-checkbox v-model="includeUncategorized" size="small">Only Uncategorized</el-checkbox>
              <el-button size="small" :icon="Refresh" @click="refreshItems" />
              <el-button type="primary" size="small" :icon="Plus" @click="openCreate">New</el-button>
            </div>
          </div>
        </template>

        <el-table v-loading="loadingItems" :data="items" stripe size="small" @row-dblclick="openEdit">
          <el-table-column prop="name" label="Name" min-width="200" />
          <el-table-column prop="category" label="Category" width="120" />
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
          <el-table-column label="Status" width="80">
            <template #default="{ row }">
              <el-tag :type="row.isEnabled ? 'success' : 'info'" size="small">
                {{ row.isEnabled ? 'On' : 'Off' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="Updated" width="170">
            <template #default="{ row }">
              <span class="muted">{{ new Date(row.updatedAt).toLocaleString() }}</span>
            </template>
          </el-table-column>
          <el-table-column label="Actions" width="140" align="center" fixed="right">
            <template #default="{ row }">
              <el-button text size="small" :icon="Edit" @click="openEdit(row)">Edit</el-button>
              <el-button text size="small" :icon="Delete" type="danger" @click="removeItem(row)">Delete</el-button>
            </template>
          </el-table-column>
          <template #empty>
            <el-empty :description="`No records in ${moduleMeta.label}`" />
          </template>
        </el-table>

        <div class="pager-row">
          <span class="muted">Total {{ total }}</span>
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

    <el-dialog
      v-model="categoryDialogVisible"
      :title="categoryDialogMode === 'create' ? 'New Category' : 'Edit Category'"
      width="460px"
    >
      <el-form :model="categoryForm" label-width="100px" label-position="right">
        <el-form-item label="Name" required>
          <el-input v-model="categoryForm.name" />
        </el-form-item>
        <el-form-item label="Parent">
          <el-select v-model="categoryForm.parentId" clearable filterable style="width: 100%" placeholder="Root category">
            <el-option v-for="option in categoryParentOptions" :key="option.value" :label="option.label" :value="option.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="Sort">
          <el-input-number v-model="categoryForm.sortOrder" :min="0" />
        </el-form-item>
        <el-form-item label="Enabled">
          <el-switch v-model="categoryForm.isEnabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="categoryDialogVisible = false">Cancel</el-button>
        <el-button type="primary" @click="saveCategory">Save</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="editorVisible"
      :title="`${editorMode === 'create' ? 'New' : 'Edit'} ${moduleMeta.label}`"
      width="780px"
      :close-on-click-modal="false"
    >
      <el-form :model="editorForm" label-width="130px" label-position="right">
        <DesignFormField
          v-for="field in schema.commonFields"
          :key="field.key"
          v-model="editorForm[field.key]"
          :field="field"
          :picker-options="optionsFor(field)"
          :invalid-message="invalidReferenceMessage(field, editorForm[field.key])"
          @clear-invalid-references="clearInvalidReferences(field)"
          @rematch-references="rematchReferences(field)"
        />

        <el-form-item label="Category ID">
          <el-tag v-if="editorForm.categoryId" type="info">{{ editorForm.categoryId }}</el-tag>
          <span v-else class="muted">Not bound</span>
        </el-form-item>

        <el-form-item v-if="moduleMeta.hasSourceBookScope" label="Source Book ID">
          <el-tag v-if="editorForm.sourceBookId" type="info">{{ editorForm.sourceBookId }}</el-tag>
          <span v-else class="muted">Global scope</span>
        </el-form-item>

        <el-tabs v-model="editorTab" class="editor-tabs">
          <el-tab-pane
            v-for="tabItem in schema.tabs"
            :key="tabItem.key"
            :name="tabItem.key"
            :label="tabItem.label"
          >
            <DesignFormField
              v-for="field in tabItem.fields"
              :key="field.key"
              v-model="editorForm[field.key]"
              :field="field"
              :picker-options="optionsFor(field)"
              :invalid-message="invalidReferenceMessage(field, editorForm[field.key])"
              @clear-invalid-references="clearInvalidReferences(field)"
              @rematch-references="rematchReferences(field)"
            />
          </el-tab-pane>
        </el-tabs>
      </el-form>

      <template #footer>
        <el-button @click="editorVisible = false">Cancel</el-button>
        <el-button type="primary" :loading="saving" @click="saveEditor">Save</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="newSourceBookVisible" title="New Source Book" width="400px">
      <el-form>
        <el-form-item label="Name" required>
          <el-input v-model="newSourceBookName" @keyup.enter="quickCreateSourceBook" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="newSourceBookVisible = false">Cancel</el-button>
        <el-button type="primary" @click="quickCreateSourceBook">Create</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="bookAnalysisImportVisible"
      title="Crawl Import"
      width="760px"
      :close-on-click-modal="false"
    >
      <div class="import-panel">
        <div class="import-input-row">
          <el-input
            v-model="bookAnalysisImportUrl"
            placeholder="Book detail page URL"
            clearable
            @keyup.enter="previewBookAnalysisImport"
          />
          <el-button type="primary" :loading="importingBookAnalysis" @click="previewBookAnalysisImport">
            Preview
          </el-button>
        </div>

        <el-empty
          v-if="!bookAnalysisImportPreview"
          description="Enter a URL, preview the crawl result, then apply it to a form."
        />

        <template v-else>
          <div class="preview-meta">
            <div class="preview-meta-item">
              <span class="preview-label">Source URL</span>
              <span class="preview-value">{{ bookAnalysisImportPreview.sourceUrl }}</span>
            </div>
            <div class="preview-meta-item">
              <span class="preview-label">Title</span>
              <span class="preview-value">{{ bookAnalysisImportPreview.title || 'N/A' }}</span>
            </div>
            <div class="preview-meta-item">
              <span class="preview-label">Site</span>
              <span class="preview-value">{{ bookAnalysisImportPreview.sourceSite || 'N/A' }}</span>
            </div>
            <div class="preview-meta-item">
              <span class="preview-label">Author</span>
              <span class="preview-value">{{ bookAnalysisImportPreview.author || 'N/A' }}</span>
            </div>
          </div>

          <el-alert type="info" show-icon :closable="false" class="import-warning">
            <template #title>Preview Summary</template>
            <div class="warning-list">
              <div>Sample chapters: {{ bookAnalysisImportPreview.chapters.length }}</div>
              <div>Chapter count: {{ bookAnalysisImportPreview.chapterCount }}</div>
              <div>Total words: {{ bookAnalysisImportPreview.totalWordCount }}</div>
            </div>
          </el-alert>

          <div class="preview-block">
            <div class="preview-block-title">Summary</div>
            <div class="preview-excerpt">{{ bookAnalysisImportPreview.summary || 'No summary' }}</div>
          </div>

          <div class="preview-block">
            <div class="preview-block-title">Mapped Draft Fields</div>
            <el-descriptions :column="2" border size="small">
              <el-descriptions-item label="Name">
                {{ toBookAnalysisDraft(bookAnalysisImportPreview).name }}
              </el-descriptions-item>
              <el-descriptions-item label="Source URL">
                {{ toBookAnalysisDraft(bookAnalysisImportPreview).sourceUrl || 'N/A' }}
              </el-descriptions-item>
              <el-descriptions-item label="Book Title">
                {{ toBookAnalysisDraft(bookAnalysisImportPreview).sourceBookTitle || 'N/A' }}
              </el-descriptions-item>
              <el-descriptions-item label="Author">
                {{ toBookAnalysisDraft(bookAnalysisImportPreview).sourceAuthor || 'N/A' }}
              </el-descriptions-item>
              <el-descriptions-item label="Genre">
                {{ toBookAnalysisDraft(bookAnalysisImportPreview).sourceGenre || 'N/A' }}
              </el-descriptions-item>
              <el-descriptions-item label="Chapter Count">
                {{ toBookAnalysisDraft(bookAnalysisImportPreview).chapterCount ?? 0 }}
              </el-descriptions-item>
            </el-descriptions>
          </div>
        </template>
      </div>

      <template #footer>
        <el-button @click="bookAnalysisImportVisible = false">Close</el-button>
        <el-button type="primary" plain :disabled="!bookAnalysisImportPreview" @click="applyImportedBookAnalysis('current')">
          Apply To Current
        </el-button>
        <el-button type="primary" :disabled="!bookAnalysisImportPreview" @click="applyImportedBookAnalysis('new')">
          New Draft
        </el-button>
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

.import-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.import-input-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  align-items: center;
}

.preview-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.preview-meta-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-bg-elevated);
}

.preview-label {
  font-size: 12px;
  color: var(--tm-fg-secondary);
}

.preview-value {
  font-size: 13px;
  word-break: break-all;
}

.warning-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.preview-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.preview-block-title {
  font-size: 13px;
  font-weight: 600;
}

.preview-excerpt {
  padding: 12px;
  border-radius: 8px;
  background: var(--tm-bg-elevated);
  color: var(--tm-fg-primary);
  line-height: 1.7;
  white-space: pre-wrap;
}

@media (max-width: 1100px) {
  .main-layout {
    grid-template-columns: 1fr;
  }

  .preview-meta {
    grid-template-columns: 1fr;
  }

  .import-input-row {
    grid-template-columns: 1fr;
  }
}
</style>
