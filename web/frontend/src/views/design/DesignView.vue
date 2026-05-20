<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Edit, Delete, Refresh, FolderAdd, Search } from '@element-plus/icons-vue'

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
  type BookAnalysisCrawlPreview,
  outlinesApi,
  volumeDesignsApi,
  chapterPlansApi,
  chapterBlueprintsApi
} from '@/api/modules/design'
import {
  getCategoryTree,
  createCategory,
  updateCategory,
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
import { MODULE_SCHEMAS, buildEmptyForm } from '@/components/design/moduleSchemas'

const route = useRoute()
const router = useRouter()

const moduleKey = computed<DesignModuleKey>(() => {
  const key = route.params.module as string
  return (DESIGN_MODULES.find((item) => item.key === key)?.key ?? 'world_rules') as DesignModuleKey
})

const moduleMeta = computed(() => DESIGN_MODULES.find((item) => item.key === moduleKey.value)!)
const schema = computed(() => MODULE_SCHEMAS[moduleKey.value])

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

const sourceBooks = ref<SourceBook[]>([])
const selectedSourceBookId = ref('')
const newSourceBookVisible = ref(false)
const newSourceBookName = ref('')

const categoryTree = ref<CategoryTreeNode[]>([])
const loadingCategories = ref(false)
const selectedCategoryId = ref<string | null>(null)
const categoryDialogVisible = ref(false)
const categoryDialogMode = ref<'create' | 'edit'>('create')
const categoryEditId = ref('')
const categoryForm = ref<CategoryUpsert>({
  moduleType: '',
  name: '',
  parentId: null,
  sortOrder: 0,
  isEnabled: true,
  sourceBookId: null
})

const items = ref<Record<string, unknown>[]>([])
const loadingItems = ref(false)
const keyword = ref('')

const editorVisible = ref(false)
const editorMode = ref<'create' | 'edit'>('create')
const editorId = ref('')
const editorForm = ref<Record<string, unknown>>({})
const editorTab = ref('')
const saving = ref(false)

const bookAnalysisImportVisible = ref(false)
const importingBookAnalysis = ref(false)
const bookAnalysisImportUrl = ref('')
const bookAnalysisImportPreview = ref<BookAnalysisCrawlPreview | null>(null)

async function refreshSourceBooks() {
  try {
    sourceBooks.value = await listSourceBooks()
  } catch (error) {
    ElMessage.error((error as Error).message ?? 'Failed to load source books')
  }
}

async function quickCreateSourceBook() {
  if (!newSourceBookName.value.trim()) {
    ElMessage.warning('Enter source book name')
    return
  }

  try {
    const sourceBook = await createSourceBook({ name: newSourceBookName.value.trim() })
    sourceBooks.value = [sourceBook, ...sourceBooks.value]
    selectedSourceBookId.value = sourceBook.id
    newSourceBookVisible.value = false
    newSourceBookName.value = ''
    ElMessage.success('Source book created')
  } catch (error) {
    ElMessage.error((error as Error).message ?? 'Failed to create source book')
  }
}

async function refreshCategories() {
  loadingCategories.value = true
  try {
    categoryTree.value = await getCategoryTree(
      moduleKey.value,
      moduleMeta.value.hasSourceBookScope ? (selectedSourceBookId.value || null) : null
    )
  } catch (error) {
    ElMessage.error((error as Error).message ?? 'Failed to load categories')
  } finally {
    loadingCategories.value = false
  }
}

function openCreateCategory(parent?: CategoryTreeNode) {
  categoryDialogMode.value = 'create'
  categoryEditId.value = ''
  categoryForm.value = {
    moduleType: moduleKey.value,
    name: '',
    parentId: parent?.id ?? null,
    sortOrder: 0,
    isEnabled: true,
    sourceBookId: moduleMeta.value.hasSourceBookScope ? (selectedSourceBookId.value || null) : null
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
    sourceBookId: node.sourceBookId
  }
  categoryDialogVisible.value = true
}

async function saveCategory() {
  try {
    if (categoryDialogMode.value === 'create') {
      await createCategory(categoryForm.value)
      ElMessage.success('Category created')
    } else {
      await updateCategory(categoryEditId.value, categoryForm.value)
      ElMessage.success('Category updated')
    }

    categoryDialogVisible.value = false
    await refreshCategories()
  } catch (error) {
    ElMessage.error((error as Error).message ?? 'Failed to save category')
  }
}

async function removeCategory(node: CategoryTreeNode) {
  if (node.isBuiltIn) {
    ElMessage.warning('Built-in category cannot be deleted')
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
    ElMessage.success('Category deleted')
    await refreshCategories()
  } catch (error) {
    ElMessage.error((error as Error).message ?? 'Failed to delete category')
  }
}

async function refreshItems() {
  loadingItems.value = true
  try {
    items.value = (await activeApi.value.list({
      categoryId: selectedCategoryId.value,
      sourceBookId: moduleMeta.value.hasSourceBookScope ? (selectedSourceBookId.value || null) : null,
      keyword: keyword.value || null
    })) as unknown as Record<string, unknown>[]
  } catch (error) {
    ElMessage.error((error as Error).message ?? 'Failed to load list')
  } finally {
    loadingItems.value = false
  }
}

function openCreate() {
  editorMode.value = 'create'
  editorId.value = ''
  editorForm.value = buildEmptyForm(moduleKey.value)
  editorForm.value.categoryId = selectedCategoryId.value
  editorForm.value.sourceBookId = moduleMeta.value.hasSourceBookScope ? (selectedSourceBookId.value || null) : null
  editorTab.value = schema.value.tabs[0]?.key ?? ''
  editorVisible.value = true
}

async function openEdit(row: Record<string, unknown>) {
  editorMode.value = 'edit'
  editorId.value = row.id as string
  try {
    const detail = (await activeApi.value.get(row.id as string)) as unknown as Record<string, unknown>
    editorForm.value = { ...buildEmptyForm(moduleKey.value), ...detail }
    editorTab.value = schema.value.tabs[0]?.key ?? ''
    editorVisible.value = true
  } catch (error) {
    ElMessage.error((error as Error).message ?? 'Failed to load detail')
  }
}

async function saveEditor() {
  if (!editorForm.value.name) {
    ElMessage.warning('Name is required')
    return
  }

  saving.value = true
  try {
    if (editorMode.value === 'create') {
      await activeApi.value.create(editorForm.value as never)
      ElMessage.success('Created')
    } else {
      await activeApi.value.update(editorId.value, editorForm.value as never)
      ElMessage.success('Updated')
    }

    editorVisible.value = false
    await refreshItems()
    await refreshCategories()
  } catch (error) {
    ElMessage.error((error as Error).message ?? 'Failed to save')
  } finally {
    saving.value = false
  }
}

async function removeItem(row: Record<string, unknown>) {
  try {
    await ElMessageBox.confirm(`Delete "${row.name}"?`, 'Confirm', { type: 'warning' })
  } catch {
    return
  }

  try {
    await activeApi.value.remove(row.id as string)
    ElMessage.success('Deleted')
    await refreshItems()
    await refreshCategories()
  } catch (error) {
    ElMessage.error((error as Error).message ?? 'Failed to delete')
  }
}

function openBookAnalysisImport() {
  bookAnalysisImportUrl.value = ''
  bookAnalysisImportPreview.value = null
  bookAnalysisImportVisible.value = true
}

async function previewBookAnalysisImport() {
  if (!bookAnalysisImportUrl.value.trim()) {
    ElMessage.warning('Enter page URL')
    return
  }

  importingBookAnalysis.value = true
  try {
    bookAnalysisImportPreview.value = await bookAnalysesApi.crawlPreview({
      url: bookAnalysisImportUrl.value.trim(),
      maxChapters: 12,
      includeContent: true
    })
    ElMessage.success('Preview ready')
  } catch (error) {
    ElMessage.error((error as Error).message ?? 'Failed to crawl preview')
  } finally {
    importingBookAnalysis.value = false
  }
}

function toBookAnalysisDraft(preview: BookAnalysisCrawlPreview) {
  return {
    ...buildEmptyForm('book_analyses'),
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
  const preview = bookAnalysisImportPreview.value
  if (!preview) {
    ElMessage.warning('Run preview first')
    return
  }

  const draft = toBookAnalysisDraft(preview)

  if (mode === 'new') {
    editorMode.value = 'create'
    editorId.value = ''
    editorForm.value = buildEmptyForm('book_analyses')
    editorForm.value.categoryId = selectedCategoryId.value
    editorForm.value.sourceBookId = null
  } else if (!editorVisible.value || moduleKey.value !== 'book_analyses') {
    ElMessage.warning('No open book analysis form to fill')
    return
  }

  const currentName =
    mode === 'current' && typeof editorForm.value.name === 'string'
      ? editorForm.value.name.trim()
      : ''

  editorForm.value = {
    ...buildEmptyForm('book_analyses'),
    ...editorForm.value,
    ...draft,
    name: currentName || draft.name,
    categoryId: editorForm.value.categoryId ?? selectedCategoryId.value,
    sourceBookId: editorForm.value.sourceBookId ?? null
  }

  editorTab.value = MODULE_SCHEMAS.book_analyses.tabs[0]?.key ?? ''
  editorVisible.value = true
  bookAnalysisImportVisible.value = false
  ElMessage.success(mode === 'new' ? 'Applied to new form' : 'Applied to current form')
}

function formatCellValue(row: Record<string, unknown>, col: { key: string }) {
  const value = row[col.key]
  if (value === null || value === undefined || value === '') return '-'
  if (Array.isArray(value)) return value.join(', ')
  const text = String(value)
  return text.length > 60 ? `${text.slice(0, 60)}...` : text
}

function switchModule(key: DesignModuleKey) {
  router.push({ name: 'design-module', params: { module: key } })
}

watch(moduleKey, async () => {
  selectedCategoryId.value = null
  await refreshCategories()
  await refreshItems()
})

watch(selectedSourceBookId, async () => {
  selectedCategoryId.value = null
  await refreshCategories()
  await refreshItems()
})

watch(selectedCategoryId, refreshItems)

onMounted(async () => {
  await refreshSourceBooks()
  await refreshCategories()
  await refreshItems()
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
            :class="['module-tab', { active: moduleItem.key === moduleKey }]"
            @click="switchModule(moduleItem.key)"
          >
            <span class="icon">{{ moduleItem.icon }}</span>
            <span>{{ moduleItem.label }}</span>
          </button>
        </div>

        <div v-if="moduleMeta.hasSourceBookScope" class="sourcebook-area">
          <span class="label">Source Book</span>
          <el-select v-model="selectedSourceBookId" clearable size="small" style="width: 200px">
            <el-option label="All" value="" />
            <el-option v-for="book in sourceBooks" :key="book.id" :label="book.name" :value="book.id" />
          </el-select>
          <el-button size="small" :icon="Plus" @click="newSourceBookVisible = true">New Source</el-button>
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
          <div :class="['cat-item all', { active: !selectedCategoryId }]" @click="selectedCategoryId = null">
            All / Uncategorized
          </div>

          <el-tree
            :data="categoryTree"
            node-key="id"
            :default-expand-all="true"
            :expand-on-click-node="false"
            :highlight-current="true"
            empty-text="No categories"
          >
            <template #default="{ data }">
              <div :class="['cat-node', { active: selectedCategoryId === data.id }]" @click.stop="selectedCategoryId = data.id">
                <span class="cat-name">{{ data.name }}</span>
                <el-tag v-if="data.isBuiltIn" size="small" type="info" effect="plain">Built-in</el-tag>
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
                @change="refreshItems"
              />
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
      </el-card>
    </div>

    <el-dialog v-model="categoryDialogVisible" :title="categoryDialogMode === 'create' ? 'New Category' : 'Edit Category'" width="460px">
      <el-form :model="categoryForm" label-width="100px" label-position="right">
        <el-form-item label="Name" required>
          <el-input v-model="categoryForm.name" />
        </el-form-item>
        <el-form-item label="Parent">
          <el-input v-model="categoryForm.parentId" placeholder="Empty for root category" />
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
            v-for="tab in schema.tabs"
            :key="tab.key"
            :name="tab.key"
            :label="tab.label"
          >
            <DesignFormField
              v-for="field in tab.fields"
              :key="field.key"
              v-model="editorForm[field.key]"
              :field="field"
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

.import-warning {
  margin-top: -4px;
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
