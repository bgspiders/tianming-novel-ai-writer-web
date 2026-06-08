<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Edit, FolderAdd, MagicStick, Plus, Refresh, Search } from '@element-plus/icons-vue'
import { useI18n } from '@/composables/useI18n'
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
import { listProviderConfigs, type AiProviderConfig } from '@/api/modules/ai'
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
type PickerRow = any
type DesignRecord = any

interface DesignApi {
  list: (p?: DesignListParams) => Promise<any[]>
  listPaged: (p: DesignListParams) => Promise<{ items: any[]; total: number; page: number; pageSize: number }>
  get: (id: string) => Promise<any>
  create: (input: any) => Promise<DesignRecord>
  update: (id: string, input: any) => Promise<DesignRecord>
  remove: (id: string) => Promise<void>
}

const route = useRoute()
const router = useRouter()
const workContext = useWorkContextStore()
const { t } = useI18n()

const moduleKey = computed<DesignModuleKey>(() => {
  const raw = route.params.module as string
  return (DESIGN_MODULES.find((item) => item.key === raw)?.key ?? 'world_rules') as DesignModuleKey
})

const moduleMeta = computed(() => DESIGN_MODULES.find((item) => item.key === moduleKey.value)!)
const schema = computed(() => MODULE_SCHEMAS[moduleKey.value])
const localizedModuleLabel = computed(() => t(`design.modules.${moduleKey.value}`))
const canRegenerateFromNovelSeed = computed(() => moduleKey.value === 'chapter_plans' || moduleKey.value === 'chapter_blueprints')

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
    return t('layout.volumeOption', { number: row.volumeNumber ?? '', title: row.title ?? '' })
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
    characters,
    factions,
    locations,
    volumes: workContext.volumes as any[]
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
    return missing.length ? t('design.messages.missingReferences', { value: missing.join(', ') }) : ''
  }

  return hasPickerOption(options, currentValue)
    ? ''
    : t('design.messages.currentValueMissing', { value: String(currentValue) })
}

function clearInvalidReferences(field: FieldDef) {
  if (!field.pickerSource) return

  const currentValue = editorForm.value[field.key]
  const options = optionsFor(field)

  if (Array.isArray(currentValue)) {
    const validValues = currentValue.filter((value) => hasPickerOption(options, value))
    const removedCount = currentValue.length - validValues.length
    editorForm.value[field.key] = validValues
    if (removedCount > 0) ElMessage.success(t('design.messages.removedInvalidReferences', { count: removedCount }))
    return
  }

  if (currentValue !== null && currentValue !== undefined && currentValue !== '' && !hasPickerOption(options, currentValue)) {
    editorForm.value[field.key] = field.type === 'select' ? null : ''
    ElMessage.success(t('design.messages.invalidReferenceCleared'))
  }
}

async function rematchReferences(field: FieldDef) {
  if (!field.pickerSource) return
  try {
    await refreshPickers()
    const message = invalidReferenceMessage(field, editorForm.value[field.key])
    if (message) {
      ElMessage.warning(t('design.messages.referencesStillInvalid'))
    } else {
      ElMessage.success(t('design.messages.referencesRefreshed'))
    }
  } catch (err) {
    ElMessage.error((err as Error).message ?? t('design.messages.refreshReferencesFailed'))
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
    ElMessage.error((err as Error).message ?? t('design.messages.loadSourceBooksFailed'))
  }
}

async function quickCreateSourceBook() {
  if (!newSourceBookName.value.trim()) {
    ElMessage.warning(t('design.messages.sourceBookNameRequired'))
    return
  }

  try {
    const sourceBook = await createSourceBook({ name: newSourceBookName.value.trim() })
    sourceBooks.value = [sourceBook, ...sourceBooks.value]
    selectedSourceBookId.value = sourceBook.id
    newSourceBookVisible.value = false
    newSourceBookName.value = ''
    ElMessage.success(t('design.messages.sourceBookCreated'))
  } catch (err) {
    ElMessage.error((err as Error).message ?? t('design.messages.createSourceBookFailed'))
  }
}

async function bindSourceBookToProject() {
  if (!workContext.selectedProjectId) {
    ElMessage.warning(t('design.messages.selectProjectFirst'))
    return
  }

  try {
    await workContext.updateSelectedProjectSourceBook(selectedSourceBookId.value || null)
    ElMessage.success(t('design.messages.bindSourceBookSuccess'))
  } catch (err) {
    ElMessage.error((err as Error).message ?? t('design.messages.bindSourceBookFailed'))
  }
}

function goNovelSeedRegenerate() {
  router.push('/generate/novel-seed')
}

async function rewriteChapterPlanSummaries() {
  try {
    await ElMessageBox.confirm(
      '将按当前项目、源书、分类和筛选条件批量重写章节计划标题与简介，并自动处理重复标题/同质简介。是否继续？',
      t('layout.dialogs.confirm'),
      { type: 'warning' }
    )
  } catch {
    return
  }

  rewritingChapterPlanSummaries.value = true
  try {
    const result = await chapterPlansApi.rewriteSummaries(buildListParams())
    ElMessage.success(`已重写 ${result.updatedCount} 条章节计划标题/简介`)
    await refreshItems()
  } catch (err) {
    ElMessage.error((err as Error).message ?? '批量重写章节计划标题/简介失败')
  } finally {
    rewritingChapterPlanSummaries.value = false
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
    ElMessage.error((err as Error).message ?? t('design.messages.loadCategoriesFailed'))
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
      ElMessage.success(t('design.messages.categoryCreated'))
    } else {
      await updateCategory(categoryEditId.value, categoryForm.value)
      ElMessage.success(t('design.messages.categoryUpdated'))
    }
    categoryDialogVisible.value = false
    await refreshCategories()
  } catch (err) {
    ElMessage.error((err as Error).message ?? t('design.messages.saveCategoryFailed'))
  }
}

async function removeCategory(node: CategoryTreeNode) {
  if (node.isBuiltIn) {
    ElMessage.warning(t('design.messages.builtInCategoriesCannotDelete'))
    return
  }

  try {
    await ElMessageBox.confirm(
      t('design.messages.deleteCategoryConfirm', { name: node.name }),
      t('layout.dialogs.confirm'),
      { type: 'warning' }
    )
  } catch {
    return
  }

  try {
    await deleteCategory(node.id)
    if (selectedCategoryId.value === node.id) selectedCategoryId.value = null
    ElMessage.success(t('design.messages.categoryDeleted'))
    await refreshCategories()
  } catch (err) {
    ElMessage.error((err as Error).message ?? t('design.messages.deleteCategoryFailed'))
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
    ElMessage.error((err as Error).message ?? t('design.messages.saveCategoryOrderFailed'))
    await refreshCategories()
  }
}

const items = ref<DesignRecord[]>([])
const loadingItems = ref(false)
const backgroundAnalyzingId = ref('')
const generatingCreativeMaterialId = ref('')
const buildingSkeletonId = ref('')
const rewritingChapterPlanSummaries = ref(false)
const keyword = ref('')
const isEnabledFilter = ref<'all' | 'enabled' | 'disabled'>('all')
const includeUncategorized = ref(false)
const updatedRange = ref<[string, string] | []>([])
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
let backgroundAiPollTimer: number | null = null

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
    ElMessage.error((err as Error).message ?? t('design.messages.loadRecordsFailed'))
  } finally {
    loadingItems.value = false
  }
}

function stopBackgroundAiPolling() {
  if (backgroundAiPollTimer !== null) {
    window.clearInterval(backgroundAiPollTimer)
    backgroundAiPollTimer = null
  }
}

function startBackgroundAiPolling() {
  if (backgroundAiPollTimer !== null || moduleKey.value !== 'book_analyses') {
    return
  }

  backgroundAiPollTimer = window.setInterval(() => {
    const hasBusyItem = items.value.some((row) => row.backgroundAiStatus === 'queued' || row.backgroundAiStatus === 'running')
    if (!hasBusyItem) {
      stopBackgroundAiPolling()
      return
    }
    void refreshItems()
  }, 15000)
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
    ElMessage.error((err as Error).message ?? t('design.messages.loadRecordDetailFailed'))
  }
}

async function saveEditor() {
  if (!editorForm.value.name) {
    ElMessage.warning(t('design.messages.nameRequired'))
    return
  }

  saving.value = true
  try {
    if (editorMode.value === 'create') {
      await activeApi.value.create(editorForm.value)
      ElMessage.success(t('design.messages.recordCreated'))
    } else {
      await activeApi.value.update(editorId.value, editorForm.value)
      ElMessage.success(t('design.messages.recordUpdated'))
    }
    editorVisible.value = false
    await refreshItems()
    await refreshCategories()
    await refreshPickers()
  } catch (err) {
    ElMessage.error((err as Error).message ?? t('design.messages.saveRecordFailed'))
  } finally {
    saving.value = false
  }
}

async function removeItem(row: DesignRecord) {
  try {
    await ElMessageBox.confirm(
      t('design.messages.deleteRecordConfirm', { name: row.name }),
      t('layout.dialogs.confirm'),
      { type: 'warning' }
    )
  } catch {
    return
  }

  try {
    await activeApi.value.remove(String(row.id))
    ElMessage.success(t('design.messages.recordDeleted'))
    await refreshItems()
    await refreshCategories()
    await refreshPickers()
  } catch (err) {
    ElMessage.error((err as Error).message ?? t('design.messages.deleteRecordFailed'))
  }
}

function isBackgroundAiBusy(row: DesignRecord) {
  return backgroundAnalyzingId.value === String(row.id) || row.backgroundAiStatus === 'queued' || row.backgroundAiStatus === 'running'
}

function getBackgroundAiStatusTagType(status: string) {
  switch (status) {
    case 'completed':
      return 'success'
    case 'failed':
      return 'danger'
    case 'queued':
      return 'warning'
    case 'running':
      return ''
    default:
      return 'info'
  }
}

function getBackgroundAiStatusLabel(status: string) {
  switch (status) {
    case 'queued':
      return t('design.labels.aiQueued')
    case 'running':
      return t('design.labels.aiRunning')
    case 'completed':
      return t('design.labels.aiCompleted')
    case 'failed':
      return t('design.labels.aiFailed')
    default:
      return t('design.labels.aiIdle')
  }
}

function getBackgroundAiFailureReason(row: DesignRecord) {
  if (row?.backgroundAiStatus !== 'failed') return ''
  const message = String(row?.backgroundAiMessage ?? '').trim()
  if (!message) return t('design.labels.aiFailureUnknown')
  return message
}

async function queueBookAnalysisBackgroundAi(row: DesignRecord) {
  if (moduleKey.value !== 'book_analyses') return
  if (isBackgroundAiBusy(row)) {
    ElMessage.warning(t('design.messages.backgroundAiAlreadyRunning'))
    return
  }
  if (!bookAnalysisAiConfigId.value || !bookAnalysisAiEndpoint.value || !bookAnalysisAiModel.value) {
    ElMessage.warning(t('design.messages.aiConfigRequired'))
    return
  }

  backgroundAnalyzingId.value = String(row.id)
  try {
    await bookAnalysesApi.queueAiAnalyze(String(row.id), {
      providerId: bookAnalysisAiConfigId.value,
      apiKeyId: null,
      endpoint: bookAnalysisAiEndpoint.value,
      model: bookAnalysisAiModel.value,
      maxTokens: 3600
    })
    ElMessage.success(t('design.messages.backgroundAiQueued'))
    await refreshItems()
  } catch (err) {
    ElMessage.error((err as Error).message ?? t('design.messages.backgroundAiQueueFailed'))
  } finally {
    backgroundAnalyzingId.value = ''
  }
}

async function createCreativeMaterialFromBookAnalysis(row: DesignRecord) {
  if (moduleKey.value !== 'book_analyses') return

  generatingCreativeMaterialId.value = String(row.id)
  try {
    const created = await creativeMaterialsApi.createFromBookAnalysis(String(row.id))
    ElMessage.success(t('design.messages.creativeMaterialCreatedFromBookAnalysis', { name: created.name }))
    await router.push({
      path: '/design/creative_materials',
      query: created.sourceBookId ? { sourceBookId: created.sourceBookId } : {}
    })
  } catch (err) {
    ElMessage.error((err as Error).message ?? t('design.messages.createCreativeMaterialFromBookAnalysisFailed'))
  } finally {
    generatingCreativeMaterialId.value = ''
  }
}

async function buildSkeletonFromCreativeMaterial(row: DesignRecord) {
  if (moduleKey.value !== 'creative_materials') return

  buildingSkeletonId.value = String(row.id)
  try {
    const result = await creativeMaterialsApi.buildSkeleton(String(row.id))
    ElMessage.success(
      t('design.messages.skeletonBuilt', {
        rules: result.ruleCount,
        outlines: result.outlineCount,
        volumes: result.volumeDesignCount,
        chapters: result.chapterPlanCount,
        blueprints: result.chapterBlueprintCount
      })
    )
    await router.push({
      path: '/generate/outlines',
      query: result.sourceBookId ? { sourceBookId: result.sourceBookId } : {}
    })
  } catch (err) {
    ElMessage.error((err as Error).message ?? t('design.messages.skeletonBuildFailed'))
  } finally {
    buildingSkeletonId.value = ''
  }
}

function syncSourceBookSelectionFromRoute() {
  if (!moduleMeta.value.hasSourceBookScope) return
  const routeSourceBookId = route.query.sourceBookId
  if (typeof routeSourceBookId === 'string') {
    selectedSourceBookId.value = routeSourceBookId
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
const bookAnalysisImportFileInput = ref<HTMLInputElement | null>(null)
const analyzingBookAnalysis = ref(false)
const bookAnalysisAiConfigs = ref<AiProviderConfig[]>([])
const bookAnalysisAiConfigId = ref('')
const bookAnalysisAiModel = ref('')
const bookAnalysisAiEndpoint = ref('')
const selectedBookAnalysisAiConfig = computed(() =>
  bookAnalysisAiConfigs.value.find((item) => item.providerId === bookAnalysisAiConfigId.value) ?? null
)

function openBookAnalysisImport() {
  bookAnalysisImportUrl.value = ''
  bookAnalysisImportPreview.value = null
  bookAnalysisImportVisible.value = true
}

async function previewBookAnalysisImport() {
  if (!bookAnalysisImportUrl.value.trim()) {
    ElMessage.warning(t('design.messages.sourceUrlRequired'))
    return
  }

  importingBookAnalysis.value = true
  try {
    bookAnalysisImportPreview.value = await bookAnalysesApi.crawlPreview({
      url: bookAnalysisImportUrl.value.trim(),
      maxChapters: 12,
      includeContent: true
    })
    ElMessage.success(t('design.messages.previewLoaded'))
  } catch (err) {
    ElMessage.error((err as Error).message ?? t('design.messages.crawlPreviewFailed'))
  } finally {
    importingBookAnalysis.value = false
  }
}

function openBookAnalysisTxtPicker() {
  bookAnalysisImportFileInput.value?.click()
}

async function importBookAnalysisTxt(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  importingBookAnalysis.value = true
  try {
    const text = await readTextFile(file)
    bookAnalysisImportPreview.value = buildBookAnalysisPreviewFromText(file, text)
    ElMessage.success(t('design.messages.txtImportLoaded'))
  } catch (err) {
    ElMessage.error((err as Error).message ?? t('design.messages.txtImportFailed'))
  } finally {
    importingBookAnalysis.value = false
  }
}

async function readTextFile(file: File) {
  const buffer = await file.arrayBuffer()
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    try {
      return new TextDecoder('gb18030').decode(buffer)
    } catch {
      return file.text()
    }
  }
}

function buildBookAnalysisPreviewFromText(file: File, text: string): BookAnalysisCrawlPreview {
  const title = file.name.replace(/\.[^.]+$/, '') || t('design.labels.localTxtBook')
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  const chapters = splitTxtChapters(normalized)
  const sampleChapters = chapters.slice(0, 12).map((chapter, index) => ({
    index: index + 1,
    title: chapter.title,
    url: `local://${file.name}#${index + 1}`,
    summary: chapter.content.slice(0, 240),
    wordCount: countTextWords(chapter.content),
    content: chapter.content
  }))
  const totalWordCount = countTextWords(normalized)
  const summary = normalized.slice(0, 900)
  const importedAt = new Date().toISOString()

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
  }
}

function splitTxtChapters(text: string) {
  const chapterTitlePattern =
    /^(?:\s*)(第[零〇一二三四五六七八九十百千万两\d]+[章节卷集回][^\n]{0,80}|Chapter\s+\d+[^\n]{0,80}|\d+[\.、]\s*[^\n]{1,80})\s*$/i
  const lines = text.split('\n')
  const chapters: Array<{ title: string; content: string }> = []
  let currentTitle = t('design.labels.fullText')
  let currentLines: string[] = []

  for (const line of lines) {
    if (chapterTitlePattern.test(line.trim())) {
      if (currentLines.join('').trim()) {
        chapters.push({ title: currentTitle, content: currentLines.join('\n').trim() })
      }
      currentTitle = line.trim()
      currentLines = []
      continue
    }
    currentLines.push(line)
  }

  if (currentLines.join('').trim()) {
    chapters.push({ title: currentTitle, content: currentLines.join('\n').trim() })
  }

  return chapters.length > 0 ? chapters : [{ title: currentTitle, content: text }]
}

function countTextWords(text: string) {
  return text.replace(/\s+/g, '').length
}

async function refreshBookAnalysisAiConfig() {
  bookAnalysisAiConfigs.value = (await listProviderConfigs()).filter((item) => item.isEnabled)
  if (!bookAnalysisAiConfigs.value.some((item) => item.providerId === bookAnalysisAiConfigId.value)) {
    bookAnalysisAiConfigId.value = bookAnalysisAiConfigs.value[0]?.providerId ?? ''
  }
  refreshBookAnalysisAiProviderAssets()
}

function refreshBookAnalysisAiProviderAssets() {
  if (!bookAnalysisAiConfigId.value) {
    bookAnalysisAiEndpoint.value = ''
    bookAnalysisAiModel.value = ''
    return
  }

  const config = selectedBookAnalysisAiConfig.value
  bookAnalysisAiEndpoint.value = config?.defaultEndpoint || ''
  bookAnalysisAiModel.value = config?.modelCode || ''
}

function compactBookAnalysisPreviewForAi(preview: BookAnalysisCrawlPreview): BookAnalysisCrawlPreview {
  return {
    ...preview,
    summary: preview.summary?.slice(0, 3000) ?? '',
    chapters: preview.chapters.slice(0, 12).map((chapter) => ({
      ...chapter,
      summary: chapter.summary?.slice(0, 1000) ?? '',
      content: chapter.content?.slice(0, 2500) ?? ''
    }))
  }
}

async function analyzeBookAnalysisWithAi() {
  if (!bookAnalysisImportPreview.value) {
    ElMessage.warning(t('design.messages.previewRequiredForAi'))
    return
  }
  if (!bookAnalysisAiConfigId.value || !bookAnalysisAiEndpoint.value || !bookAnalysisAiModel.value) {
    ElMessage.warning(t('design.messages.aiConfigRequired'))
    return
  }

  analyzingBookAnalysis.value = true
  try {
    bookAnalysisImportPreview.value = await bookAnalysesApi.aiAnalyze({
      providerId: bookAnalysisAiConfigId.value,
      apiKeyId: null,
      endpoint: bookAnalysisAiEndpoint.value,
      model: bookAnalysisAiModel.value,
      preview: compactBookAnalysisPreviewForAi(bookAnalysisImportPreview.value),
      maxTokens: 3600
    })
    ElMessage.success(t('design.messages.aiAnalysisCompleted'))
  } catch (err) {
    ElMessage.error((err as Error).message ?? t('design.messages.aiAnalysisFailed'))
  } finally {
    analyzingBookAnalysis.value = false
  }
}

function toBookAnalysisDraft(preview: BookAnalysisCrawlPreview): DesignRecord {
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
  ElMessage.success(t('design.messages.previewApplied'))
}

function switchModule(key: DesignModuleKey) {
  if (route.path.startsWith('/generate/')) {
    router.push(`/generate/${key}`)
    return
  }
  router.push(`/design/${key}`)
}

watch(moduleKey, async () => {
  stopBackgroundAiPolling()
  selectedCategoryId.value = null
  page.value = 1
  syncSourceBookSelectionFromRoute()
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
    syncSourceBookSelectionFromRoute()
    page.value = 1
    await refreshWorkspaceData()
  }
)

watch(
  () => route.query.sourceBookId,
  (value) => {
    if (!moduleMeta.value.hasSourceBookScope) return
    selectedSourceBookId.value = typeof value === 'string' ? value : ''
  }
)

watch(() => workContext.selectedVolumeId, () => {
  void refreshPickers()
})

watch(bookAnalysisAiConfigId, refreshBookAnalysisAiProviderAssets)

watch(
  () => workContext.volumes,
  () => {
    void refreshPickers()
  },
  { deep: true }
)

watch(
  () => items.value.map((row) => row.backgroundAiStatus).join('|'),
  () => {
    const hasBusyItem = moduleKey.value === 'book_analyses'
      && items.value.some((row) => row.backgroundAiStatus === 'queued' || row.backgroundAiStatus === 'running')
    if (hasBusyItem) {
      startBackgroundAiPolling()
    } else {
      stopBackgroundAiPolling()
    }
  }
)

onMounted(async () => {
  await workContext.init()
  await Promise.all([refreshSourceBooks(), refreshBookAnalysisAiConfig()])
  syncSourceBookSelectionFromRoute()
  await refreshWorkspaceData()
})

onBeforeUnmount(() => {
  stopBackgroundAiPolling()
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
            <span>{{ t(`design.modules.${moduleItem.key}`) }}</span>
          </button>
        </div>

        <div v-if="moduleMeta.hasSourceBookScope" class="sourcebook-area">
          <span class="label">{{ t('design.labels.sourceBook') }}</span>
          <el-select v-model="selectedSourceBookId" clearable size="small" style="width: 220px">
            <el-option :label="t('design.labels.all')" value="" />
            <el-option v-for="book in sourceBooks" :key="book.id" :label="book.name" :value="book.id" />
          </el-select>
          <el-button size="small" :icon="Plus" @click="newSourceBookVisible = true">{{ t('design.labels.new') }}</el-button>
          <el-button size="small" :disabled="!workContext.selectedProjectId" @click="bindSourceBookToProject">
            {{ t('design.labels.setProjectDefault') }}
          </el-button>
        </div>
      </div>
    </el-card>

    <div class="main-layout">
      <el-card shadow="never" class="tree-panel">
        <template #header>
          <div class="panel-head">
            <span>{{ t('design.labels.categories', { module: localizedModuleLabel }) }}</span>
            <div class="head-actions">
              <el-button text size="small" :icon="Refresh" @click="refreshCategories" />
              <el-button text size="small" :icon="FolderAdd" @click="openCreateCategory()" />
            </div>
          </div>
        </template>

        <div v-loading="loadingCategories" class="tree-body">
          <div :class="['cat-item', 'all', { active: !selectedCategoryId }]" @click="selectedCategoryId = null">
            {{ t('design.labels.allUncategorized') }}
          </div>

          <el-tree
            :data="categoryTree"
            node-key="id"
            draggable
            :default-expand-all="true"
            :expand-on-click-node="false"
            :highlight-current="true"
            :empty-text="t('design.labels.noCategories')"
            @node-drop="saveCategoryOrder"
          >
            <template #default="{ data }">
              <div :class="['cat-node', { active: selectedCategoryId === data.id }]" @click.stop="selectedCategoryId = data.id">
                <span class="cat-name">{{ data.name }}</span>
                <el-tag v-if="data.isBuiltIn" size="small" type="info" effect="plain">{{ t('design.labels.builtIn') }}</el-tag>
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
            <span>{{ t('design.labels.records', { module: localizedModuleLabel }) }}</span>
            <div class="head-actions">
              <el-button v-if="moduleKey === 'book_analyses'" size="small" @click="openBookAnalysisImport">
                {{ t('design.labels.crawlImport') }}
              </el-button>
              <el-button
                v-if="canRegenerateFromNovelSeed"
                size="small"
                type="primary"
                plain
                :icon="MagicStick"
                @click="goNovelSeedRegenerate"
              >
                去 AI 开书重新生成
              </el-button>
              <el-button
                v-if="moduleKey === 'chapter_plans'"
                size="small"
                type="warning"
                plain
                :icon="MagicStick"
                :loading="rewritingChapterPlanSummaries"
                @click="rewriteChapterPlanSummaries"
              >
                批量重写标题/简介
              </el-button>
              <el-input
                v-model="keyword"
                :placeholder="t('design.labels.searchByName')"
                clearable
                size="small"
                style="width: 200px"
                :prefix-icon="Search"
                @change="page = 1; refreshItems()"
              />
              <el-select v-model="isEnabledFilter" size="small" style="width: 110px">
                <el-option :label="t('design.labels.all')" value="all" />
                <el-option :label="t('design.labels.enabled')" value="enabled" />
                <el-option :label="t('design.labels.disabled')" value="disabled" />
              </el-select>
              <el-date-picker
                v-model="updatedRange"
                type="datetimerange"
                :start-placeholder="t('design.labels.updatedFrom')"
                :end-placeholder="t('design.labels.updatedTo')"
                value-format="YYYY-MM-DDTHH:mm:ss"
                size="small"
                style="width: 320px"
              />
              <el-checkbox v-model="includeUncategorized" size="small">{{ t('design.labels.onlyUncategorized') }}</el-checkbox>
              <el-button size="small" :icon="Refresh" @click="refreshItems" />
              <el-button type="primary" size="small" :icon="Plus" @click="openCreate">{{ t('design.labels.new') }}</el-button>
            </div>
          </div>
        </template>

        <el-table v-loading="loadingItems" :data="items" stripe size="small" @row-dblclick="openEdit">
          <el-table-column prop="name" :label="t('design.labels.name')" min-width="200" />
          <el-table-column prop="category" :label="t('design.labels.category')" width="120" />
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
          <el-table-column :label="t('design.labels.status')" width="80">
            <template #default="{ row }">
              <el-tag :type="row.isEnabled ? 'success' : 'info'" size="small">
                {{ row.isEnabled ? t('design.labels.on') : t('design.labels.off') }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column :label="t('design.labels.updated')" width="170">
            <template #default="{ row }">
              <span class="muted">{{ new Date(row.updatedAt).toLocaleString() }}</span>
            </template>
          </el-table-column>
        <el-table-column v-if="moduleKey === 'book_analyses'" :label="t('design.labels.aiStatus')" width="120" align="center">
            <template #default="{ row }">
              <el-tag :type="getBackgroundAiStatusTagType(row.backgroundAiStatus)" size="small" effect="plain">
                {{ getBackgroundAiStatusLabel(row.backgroundAiStatus) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column v-if="moduleKey === 'book_analyses'" :label="t('design.labels.aiFailureReason')" min-width="240">
            <template #default="{ row }">
              <span v-if="row.backgroundAiStatus === 'failed'" class="failure-reason" :title="getBackgroundAiFailureReason(row)">
                {{ getBackgroundAiFailureReason(row) }}
              </span>
              <span v-else class="muted">--</span>
            </template>
          </el-table-column>
          <el-table-column :label="t('design.labels.actions')" width="320" align="center" fixed="right">
            <template #default="{ row }">
              <el-button
                v-if="moduleKey === 'book_analyses'"
                text
                size="small"
                type="primary"
                :loading="backgroundAnalyzingId === String(row.id)"
                :disabled="isBackgroundAiBusy(row)"
                @click="queueBookAnalysisBackgroundAi(row)"
              >
                {{ t('design.labels.runAiAnalysis') }}
              </el-button>
              <el-button
                v-if="moduleKey === 'book_analyses'"
                text
                size="small"
                type="success"
                :loading="generatingCreativeMaterialId === String(row.id)"
                @click="createCreativeMaterialFromBookAnalysis(row)"
              >
                {{ t('design.labels.generateCreativeMaterial') }}
              </el-button>
              <el-button
                v-if="moduleKey === 'creative_materials'"
                text
                size="small"
                type="warning"
                :loading="buildingSkeletonId === String(row.id)"
                @click="buildSkeletonFromCreativeMaterial(row)"
              >
                {{ t('design.labels.buildSkeleton') }}
              </el-button>
              <el-button text size="small" :icon="Edit" @click="openEdit(row)">{{ t('design.labels.edit') }}</el-button>
              <el-button text size="small" :icon="Delete" type="danger" @click="removeItem(row)">{{ t('design.labels.delete') }}</el-button>
            </template>
          </el-table-column>
          <template #empty>
            <el-empty :description="t('design.labels.noRecordsInModule', { module: localizedModuleLabel })" />
          </template>
        </el-table>

        <div class="pager-row">
          <span class="muted">{{ t('design.labels.total', { count: total }) }}</span>
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
      :title="categoryDialogMode === 'create' ? t('design.labels.newCategory') : t('design.labels.editCategory')"
      width="460px"
    >
      <el-form :model="categoryForm" label-width="100px" label-position="right">
        <el-form-item :label="t('design.labels.name')" required>
          <el-input v-model="categoryForm.name" />
        </el-form-item>
        <el-form-item :label="t('design.labels.parent')">
          <el-select v-model="categoryForm.parentId" clearable filterable style="width: 100%" :placeholder="t('design.labels.rootCategory')">
            <el-option v-for="option in categoryParentOptions" :key="option.value" :label="option.label" :value="option.value" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('design.labels.sort')">
          <el-input-number v-model="categoryForm.sortOrder" :min="0" />
        </el-form-item>
        <el-form-item :label="t('design.labels.enabled')">
          <el-switch v-model="categoryForm.isEnabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="categoryDialogVisible = false">{{ t('design.labels.cancel') }}</el-button>
        <el-button type="primary" @click="saveCategory">{{ t('design.labels.save') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="editorVisible"
      :title="`${editorMode === 'create' ? t('design.labels.new') : t('design.labels.edit')} ${localizedModuleLabel}`"
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

        <el-form-item :label="t('design.labels.categoryId')">
          <el-tag v-if="editorForm.categoryId" type="info">{{ editorForm.categoryId }}</el-tag>
          <span v-else class="muted">{{ t('design.labels.notBound') }}</span>
        </el-form-item>

        <el-form-item v-if="moduleMeta.hasSourceBookScope" :label="t('design.labels.sourceBookId')">
          <el-tag v-if="editorForm.sourceBookId" type="info">{{ editorForm.sourceBookId }}</el-tag>
          <span v-else class="muted">{{ t('design.labels.globalScope') }}</span>
        </el-form-item>

        <el-form-item
          v-if="moduleKey === 'book_analyses' && editorForm.backgroundAiStatus === 'failed'"
          :label="t('design.labels.aiFailureReason')"
        >
          <el-alert
            type="error"
            :closable="false"
            show-icon
            class="editor-ai-failure"
            :title="getBackgroundAiFailureReason(editorForm)"
          />
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
        <el-button @click="editorVisible = false">{{ t('design.labels.cancel') }}</el-button>
        <el-button type="primary" :loading="saving" @click="saveEditor">{{ t('design.labels.save') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="newSourceBookVisible" :title="t('design.labels.newSourceBook')" width="400px">
      <el-form>
        <el-form-item :label="t('design.labels.name')" required>
          <el-input v-model="newSourceBookName" @keyup.enter="quickCreateSourceBook" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="newSourceBookVisible = false">{{ t('design.labels.cancel') }}</el-button>
        <el-button type="primary" @click="quickCreateSourceBook">{{ t('design.labels.create') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="bookAnalysisImportVisible"
      :title="t('design.labels.crawlImportTitle')"
      width="760px"
      :close-on-click-modal="false"
    >
      <div class="import-panel">
        <div class="import-input-row">
          <el-input
            v-model="bookAnalysisImportUrl"
            :placeholder="t('design.labels.bookDetailUrl')"
            clearable
            @keyup.enter="previewBookAnalysisImport"
          />
          <el-button type="primary" :loading="importingBookAnalysis" @click="previewBookAnalysisImport">
            {{ t('design.labels.preview') }}
          </el-button>
        </div>
        <div class="import-file-row">
          <input
            ref="bookAnalysisImportFileInput"
            class="hidden-file-input"
            type="file"
            accept=".txt,text/plain"
            @change="importBookAnalysisTxt"
          />
          <el-button :loading="importingBookAnalysis" @click="openBookAnalysisTxtPicker">
            {{ t('design.labels.uploadTxt') }}
          </el-button>
          <span class="muted">{{ t('design.labels.uploadTxtHint') }}</span>
        </div>
        <div class="ai-analysis-box">
          <div class="ai-analysis-title">{{ t('design.labels.aiAnalysis') }}</div>
          <div class="ai-config-grid">
            <el-select
              v-model="bookAnalysisAiConfigId"
              :placeholder="t('design.labels.aiProviderConfig')"
              filterable
              size="small"
            >
              <el-option
                v-for="config in bookAnalysisAiConfigs"
                :key="config.providerId"
                :label="`${config.name} / ${config.modelCode || '--'}`"
                :value="config.providerId"
              />
            </el-select>
            <el-input :model-value="bookAnalysisAiModel" :placeholder="t('design.labels.aiModel')" size="small" readonly />
            <el-input
              v-model="bookAnalysisAiEndpoint"
              :placeholder="t('design.labels.aiEndpoint')"
              size="small"
              readonly
            />
            <el-input
              :model-value="selectedBookAnalysisAiConfig?.apiKeyMaskedTail || t('design.labels.aiKeyAuto')"
              :placeholder="t('design.labels.aiKeyAuto')"
              size="small"
              readonly
            />
            <el-button
              type="primary"
              :loading="analyzingBookAnalysis"
              :disabled="!bookAnalysisImportPreview || importingBookAnalysis"
              @click="analyzeBookAnalysisWithAi"
            >
              {{ t('design.labels.runAiAnalysis') }}
            </el-button>
          </div>
          <div class="muted">{{ t('design.labels.aiAnalysisHint') }}</div>
        </div>

        <el-empty
          v-if="!bookAnalysisImportPreview"
          :description="t('design.labels.enterUrlPreviewApply')"
        />

        <template v-else>
          <div class="preview-meta">
            <div class="preview-meta-item">
              <span class="preview-label">{{ t('design.labels.sourceUrl') }}</span>
              <span class="preview-value">{{ bookAnalysisImportPreview.sourceUrl }}</span>
            </div>
            <div class="preview-meta-item">
              <span class="preview-label">{{ t('design.labels.title') }}</span>
              <span class="preview-value">{{ bookAnalysisImportPreview.title || t('design.labels.na') }}</span>
            </div>
            <div class="preview-meta-item">
              <span class="preview-label">{{ t('design.labels.site') }}</span>
              <span class="preview-value">{{ bookAnalysisImportPreview.sourceSite || t('design.labels.na') }}</span>
            </div>
            <div class="preview-meta-item">
              <span class="preview-label">{{ t('design.labels.author') }}</span>
              <span class="preview-value">{{ bookAnalysisImportPreview.author || t('design.labels.na') }}</span>
            </div>
          </div>

          <el-alert type="info" show-icon :closable="false" class="import-warning">
            <template #title>{{ t('design.labels.previewSummary') }}</template>
            <div class="warning-list">
              <div>{{ t('design.labels.sampleChapters', { count: bookAnalysisImportPreview.chapters.length }) }}</div>
              <div>{{ t('design.labels.chapterCount', { count: bookAnalysisImportPreview.chapterCount }) }}</div>
              <div>{{ t('design.labels.totalWords', { count: bookAnalysisImportPreview.totalWordCount }) }}</div>
            </div>
          </el-alert>

          <div class="preview-block">
            <div class="preview-block-title">{{ t('design.labels.summary') }}</div>
            <div class="preview-excerpt">{{ bookAnalysisImportPreview.summary || t('design.labels.noSummary') }}</div>
          </div>

          <div class="preview-block">
            <div class="preview-block-title">{{ t('design.labels.mappedDraftFields') }}</div>
            <el-descriptions :column="2" border size="small">
              <el-descriptions-item :label="t('design.labels.name')">
                {{ toBookAnalysisDraft(bookAnalysisImportPreview).name }}
              </el-descriptions-item>
              <el-descriptions-item :label="t('design.labels.sourceUrl')">
                {{ toBookAnalysisDraft(bookAnalysisImportPreview).sourceUrl || t('design.labels.na') }}
              </el-descriptions-item>
              <el-descriptions-item :label="t('design.labels.title')">
                {{ toBookAnalysisDraft(bookAnalysisImportPreview).sourceBookTitle || t('design.labels.na') }}
              </el-descriptions-item>
              <el-descriptions-item :label="t('design.labels.author')">
                {{ toBookAnalysisDraft(bookAnalysisImportPreview).sourceAuthor || t('design.labels.na') }}
              </el-descriptions-item>
              <el-descriptions-item :label="t('design.labels.genre')">
                {{ toBookAnalysisDraft(bookAnalysisImportPreview).sourceGenre || t('design.labels.na') }}
              </el-descriptions-item>
              <el-descriptions-item :label="t('design.labels.chapterCount', { count: '' })">
                {{ toBookAnalysisDraft(bookAnalysisImportPreview).chapterCount ?? 0 }}
              </el-descriptions-item>
            </el-descriptions>
          </div>
        </template>
      </div>

      <template #footer>
        <el-button @click="bookAnalysisImportVisible = false">{{ t('design.labels.close') }}</el-button>
        <el-button type="primary" plain :disabled="!bookAnalysisImportPreview" @click="applyImportedBookAnalysis('current')">
          {{ t('design.labels.applyToCurrent') }}
        </el-button>
        <el-button type="primary" :disabled="!bookAnalysisImportPreview" @click="applyImportedBookAnalysis('new')">
          {{ t('design.labels.newDraft') }}
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

.failure-reason {
  display: inline-block;
  max-width: 100%;
  color: var(--el-color-danger);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.editor-ai-failure {
  width: 100%;
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

.import-file-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.hidden-file-input {
  display: none;
}

.ai-analysis-box {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid #dfe8e5;
  border-radius: 12px;
  background: #fbfaf4;
}

.ai-analysis-title {
  font-weight: 700;
  color: #2c4a45;
}

.ai-config-grid {
  display: grid;
  grid-template-columns: 160px 160px 180px minmax(180px, 1fr) auto;
  gap: 10px;
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

  .ai-config-grid {
    grid-template-columns: 1fr;
  }
}
</style>
