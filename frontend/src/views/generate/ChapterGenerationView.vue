<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Refresh, Delete, VideoPlay, DocumentChecked, Close } from '@element-plus/icons-vue'
import { storeToRefs } from 'pinia'
import { useI18n } from '@/composables/useI18n'
import { listProviderConfigs, type AiProviderConfig } from '@/api/modules/ai'
import { useWorkContextStore } from '@/stores/workContext'
import { useAiTestStore } from '@/stores/aiTest'
import { chatHub } from '@/signalr/chat'
import {
  analyzeGeneratedChapter,
  cancelChapterBatchGeneration,
  composeSceneDrafts,
  confirmChapterGenerationPreview,
  createChapter,
  deleteChapter,
  generateChapterDraft,
  generateSceneDraft,
  getChapterBatchGenerationStatus,
  getChapter,
  ensureSceneBlueprints,
  listChapters,
  listChapterBatchGenerationJobs,
  previewChapterBatchGeneration,
  queueChapterBatchGeneration,
  runGenerationPreflight,
  saveChapterContent,
  type Chapter,
  type ChapterAnalysisResult,
  type ChapterBatchGenerationPreviewItem,
  type ChapterBatchGenerationStatus,
  type ConfirmChapterGenerationPreviewResult,
  type GenerationPreflightResult,
  type SceneDraftResult
} from '@/api/modules/chapters'

const workContext = useWorkContextStore()
const route = useRoute()
const aiStore = useAiTestStore()
const { form: aiForm } = storeToRefs(aiStore)
const { t } = useI18n()

const chapters = ref<Chapter[]>([])
const selectedChapterId = ref('')
const selectedChapter = ref<Chapter | null>(null)
const loadingChapters = ref(false)
const creatingChapter = ref(false)
const generating = ref(false)
const savingContent = ref(false)
const loadingAiConfig = ref(false)
const output = ref('')
const status = ref('idle')
const error = ref('')
const currentRunId = ref('')
const lastGenerationRecordId = ref('')
const creatingAndGenerating = ref(false)
const validationReportId = ref('')
const rerunValidationAfterSave = ref(false)
const validationRepairSummary = ref('')
const latestValidationSummary = ref('')
const configs = ref<AiProviderConfig[]>([])
const selectedConfigId = ref('')
const suppressChapterWatcher = ref(false)
const autoGenerating = ref(false)
const autoLog = ref<string[]>([])
const autoJobId = ref('')
const autoJobStatus = ref<ChapterBatchGenerationStatus | null>(null)
const autoPreviewing = ref(false)
const autoPreviewItems = ref<ChapterBatchGenerationPreviewItem[]>([])
const generationMode = ref<'single' | 'batch'>('batch')
const workflowLoading = ref(false)
const sceneGenerating = ref(false)
const sceneComposing = ref(false)
const analyzingChapter = ref(false)
const ensuringSceneBlueprints = ref(false)
const confirmingPreview = ref(false)
const loopRunning = ref(false)
const loopStage = ref('')
const loopLog = ref<string[]>([])
const confirmedPreview = ref<ConfirmChapterGenerationPreviewResult | null>(null)
const preflightResult = ref<GenerationPreflightResult | null>(null)
const sceneDraftResult = ref<SceneDraftResult | null>(null)
const chapterAnalysisResult = ref<ChapterAnalysisResult | null>(null)
let autoPollTimer: ReturnType<typeof window.setInterval> | null = null
const autoProgress = reactive({
  total: 0,
  completed: 0,
  failed: 0,
  skipped: 0,
  currentNumber: 0,
  currentTitle: ''
})

const chapterForm = reactive({
  chapterNumber: 1,
  title: '',
  summary: ''
})

const promptForm = reactive({
  systemPrompt: '你是一名专业网络小说作者。只返回章节草稿正文。',
  prompt: '',
  temperature: 0.8,
  maxTokens: 4096,
  maxRewriteAttempts: 2
})

const autoForm = reactive({
  startChapterNumber: 1,
  count: 3,
  createMissing: true,
  overwriteExisting: false,
  stopOnFailure: true,
  autoContinuityMode: true
})

const workflowForm = reactive({
  sceneNumber: 1,
  scenePrompt: '按当前章节蓝图生成这个场景正文，保持与上一场景连贯。',
  minWordCount: 2500
})

const selectedConfig = computed(() =>
  configs.value.find((item) => item.providerId === selectedConfigId.value) ?? null
)

const autoProgressPercent = computed(() => {
  if (!autoProgress.total) return 0
  return Math.round(((autoProgress.completed + autoProgress.failed + autoProgress.skipped) / autoProgress.total) * 100)
})

const autoJobStatusLabel = computed(() => {
  const statusValue = autoJobStatus.value?.status ?? (autoGenerating.value ? 'running' : 'idle')
  return t(`chapterGeneration.batch.status.${statusValue}`)
})

const selectedPreviewItem = computed(() => {
  if (!selectedChapter.value) return null
  return autoPreviewItems.value.find((item) => item.chapterNumber === selectedChapter.value?.chapterNumber)
    ?? (autoPreviewItems.value.length === 1 ? autoPreviewItems.value[0] : null)
})

const generationModeLabel = computed(() =>
  generationMode.value === 'single' ? '单章精写闭环' : '批量连续生成（推荐）'
)

const generationModeDescription = computed(() =>
  generationMode.value === 'single'
    ? '当前只处理选中的这一章：确认标题和场景蓝图后，按场景写正文、合成并分析。适合精修，不作为首屏默认流程。'
    : '推荐用于写正文：按章节号连续生成多章，预览确认后交给后台队列自动生成并保存；任务会后台运行，可关闭或切走前台，稍后回来查看进度。'
)

const generationModeToggleText = computed(() =>
  generationMode.value === 'single' ? '切换到批量连续生成' : '切换到单章精写闭环'
)

const canEnsureSceneBlueprints = computed(() =>
  Boolean(
    selectedChapter.value
    && workContext.selectedProjectId
    && preflightResult.value?.items.some((item) => item.code === 'missing_scene_blueprints')
  )
)

const canConfirmSelectedPreview = computed(() =>
  Boolean(selectedChapter.value && workContext.selectedProjectId && selectedPreviewItem.value)
)

const loopProgressPercent = computed(() => {
  const finished = loopSteps.value.filter((item) => item.status === 'success' || item.status === 'finish').length
  return Math.round((finished / loopSteps.value.length) * 100)
})

const loopActiveIndex = computed(() => {
  const index = loopSteps.value.findIndex((item) => item.status === 'process')
  return index < 0 ? 0 : index
})

const loopSteps = computed(() => {
  const previewReady = Boolean(selectedPreviewItem.value)
  const confirmed = Boolean(confirmedPreview.value)
  const preflightPassed = Boolean(preflightResult.value?.passed)
  const sceneReady = Boolean(sceneDraftResult.value?.success)
  const composed = Boolean(selectedChapter.value?.wordCount && selectedChapter.value.wordCount > 0)
  const analyzed = Boolean(chapterAnalysisResult.value)
  return [
    buildLoopStep('preview', '标题简介', previewReady),
    buildLoopStep('confirm', '确认蓝图', confirmed, previewReady),
    buildLoopStep('preflight', '预检', preflightPassed, confirmed),
    buildLoopStep('scene', '写正文', sceneReady, preflightPassed),
    buildLoopStep('compose', '合成正文', composed, sceneReady),
    buildLoopStep('analysis', '生成后分析', analyzed, composed)
  ]
})

function buildLoopStep(key: string, title: string, done: boolean, enabled = true) {
  return {
    key,
    title,
    status: done ? 'success' : loopStage.value === key ? 'process' : enabled ? 'wait' : 'wait'
  }
}

function onToken(token: string) {
  output.value += token
}

function onStatus(next: string) {
  status.value = next
}

function onCompleted(reason: string) {
  status.value = `${t('aiAssistant.status.completed')} (${reason})`
}

function onError(message: string) {
  error.value = normalizeGenerationError(message)
  status.value = t('aiAssistant.status.failed')
}

function normalizeGenerationError(message: string) {
  const hasPartialOutput = output.value.trim().length > 0
  if (message.includes('An error occurred while sending the request')) {
    return hasPartialOutput
      ? 'AI 上游连接在生成中途断开，已保留当前已返回正文。请降低最大 Tokens，或换用支持更长输出的模型后重试。'
      : 'AI 上游请求发送失败。请检查 Endpoint、API Key、代理/网络，以及模型是否支持当前最大 Tokens。'
  }

  return message
}

async function refreshChapters() {
  if (!workContext.selectedProjectId || !workContext.selectedVolumeId) {
    chapters.value = []
    selectedChapterId.value = ''
    selectedChapter.value = null
    return
  }

  loadingChapters.value = true
  try {
    chapters.value = await listChapters(workContext.selectedProjectId, workContext.selectedVolumeId)
    syncChapterSelectionFromRoute()
    if (!chapters.value.some((item) => item.id === selectedChapterId.value)) {
      selectedChapterId.value = chapters.value[0]?.id ?? ''
    }
    await loadSelectedChapter()
  } catch (err) {
    ElMessage.error((err as Error).message || t('chapterGeneration.messages.loadChaptersFailed'))
  } finally {
    loadingChapters.value = false
  }
}

async function loadSelectedChapter() {
  if (!selectedChapterId.value) {
    selectedChapter.value = null
    output.value = ''
    resetWorkflowState()
    return
  }
  try {
    resetWorkflowState()
    selectedChapter.value = await getChapter(selectedChapterId.value)
    output.value = selectedChapter.value.content ?? ''
    buildPromptFromChapter()
  } catch (err) {
    ElMessage.error((err as Error).message || t('chapterGeneration.messages.loadChapterDetailsFailed'))
  }
}

function resetWorkflowState() {
  if (loopRunning.value) return
  confirmedPreview.value = null
  preflightResult.value = null
  sceneDraftResult.value = null
  chapterAnalysisResult.value = null
  loopStage.value = ''
  loopLog.value = []
}

function syncChapterSelectionFromRoute() {
  const routeChapterId = route.query.chapterId
  if (typeof routeChapterId === 'string' && chapters.value.some((item) => item.id === routeChapterId)) {
    selectedChapterId.value = routeChapterId
  }

  const routeValidationReportId = route.query.validationReportId
  validationReportId.value = typeof routeValidationReportId === 'string' ? routeValidationReportId : ''
  const repairSummary = route.query.repairSummary
  validationRepairSummary.value = typeof repairSummary === 'string' ? repairSummary : ''

  const rewriteMode = route.query.rewriteMode
  rerunValidationAfterSave.value = rewriteMode === 'validation_fix'
}

function resetChapterForm() {
  const nextChapterNumber = (chapters.value.at(-1)?.chapterNumber ?? 0) + 1
  chapterForm.chapterNumber = nextChapterNumber
  if (!autoGenerating.value) {
    autoForm.startChapterNumber = selectedChapter.value?.chapterNumber ?? nextChapterNumber
  }
  chapterForm.title = ''
  chapterForm.summary = ''
}

async function quickCreateChapter() {
  if (!workContext.selectedProjectId || !workContext.selectedVolumeId) {
    ElMessage.warning(t('chapterGeneration.messages.selectProjectVolumeFirst'))
    return
  }
  if (!chapterForm.title.trim()) {
    ElMessage.warning(t('chapterGeneration.messages.chapterTitleRequired'))
    return
  }

  creatingChapter.value = true
  try {
    const chapter = await createChapter({
      projectId: workContext.selectedProjectId,
      volumeId: workContext.selectedVolumeId,
      chapterNumber: chapterForm.chapterNumber,
      title: chapterForm.title.trim(),
      summary: chapterForm.summary.trim(),
      status: 'planned'
    })
    chapters.value = [...chapters.value, chapter].sort((a, b) => a.chapterNumber - b.chapterNumber)
    selectedChapterId.value = chapter.id
    await loadSelectedChapter()
    resetChapterForm()
    ElMessage.success(t('chapterGeneration.messages.chapterCreated'))
  } catch (err) {
    ElMessage.error((err as Error).message || t('chapterGeneration.messages.createChapterFailed'))
  } finally {
    creatingChapter.value = false
  }
}

async function removeChapter(row: Chapter) {
  try {
    await ElMessageBox.confirm(
      t('chapterGeneration.messages.deleteConfirm', { number: row.chapterNumber, title: row.title }),
      t('layout.dialogs.confirm'),
      { type: 'warning' }
    )
  } catch {
    return
  }

  try {
    await deleteChapter(row.id)
    ElMessage.success(t('chapterGeneration.messages.chapterDeleted'))
    await refreshChapters()
  } catch (err) {
    ElMessage.error((err as Error).message || t('chapterGeneration.messages.deleteChapterFailed'))
  }
}

function buildPromptFromChapter() {
  const chapter = selectedChapter.value
  if (!chapter) return

  promptForm.prompt = buildPromptForChapter(chapter)
}

function buildPromptForChapter(chapter: Chapter) {
  const volume = workContext.selectedVolume

  return [
    `项目：${workContext.selectedProject?.name ?? chapter.projectId}`,
    `卷：${volume ? `第 ${volume.volumeNumber} 卷 / ${volume.title}` : chapter.volumeId}`,
    `章节：${chapter.chapterNumber} / ${chapter.title}`,
    chapter.summary ? `摘要：${chapter.summary}` : '',
    validationRepairSummary.value ? `本次修正重点：${validationRepairSummary.value}` : '',
    '',
    '请直接输出章节草稿，保持叙事连贯清晰。'
  ].filter(Boolean).join('\n')
}

function validateGenerationSettings(requireChapter: boolean) {
  if (requireChapter && !selectedChapter.value) {
    ElMessage.warning(t('chapterGeneration.messages.selectChapterFirst'))
    return false
  }
  if (!workContext.selectedProjectId || !workContext.selectedVolumeId) {
    ElMessage.warning(t('chapterGeneration.messages.selectProjectVolumeFirst'))
    return false
  }
  if (!aiForm.value.endpoint || !aiForm.value.model) {
    ElMessage.warning(t('chapterGeneration.messages.endpointModelRequired'))
    return false
  }
  if (!selectedConfigId.value && !aiForm.value.apiKey) {
    ElMessage.warning(t('chapterGeneration.messages.selectConfigOrKeyFirst'))
    return false
  }
  return true
}

function appendAutoLog(message: string) {
  autoLog.value = [message, ...autoLog.value].slice(0, 20)
}

function appendLoopLog(message: string) {
  loopLog.value = [`${new Date().toLocaleTimeString()} ${message}`, ...loopLog.value].slice(0, 30)
}

function toggleGenerationMode() {
  generationMode.value = generationMode.value === 'single' ? 'batch' : 'single'
}

function clearAutoPreview() {
  autoPreviewItems.value = []
  confirmedPreview.value = null
}

async function generateDraftForChapter(chapter: Chapter, silent = false) {
  if (!validateGenerationSettings(false)) return false

  const fullChapter = await getChapter(chapter.id)
  if (!promptForm.prompt.trim()) {
    ElMessage.warning(t('chapterGeneration.messages.promptRequired'))
    return false
  }

  output.value = ''
  error.value = ''
  status.value = t('aiAssistant.status.running')
  generating.value = true

  const runId = crypto.randomUUID()
  currentRunId.value = runId

  try {
    await chatHub.joinRun(runId)
    const result = await generateChapterDraft({
      runId,
      projectId: workContext.selectedProjectId!,
      volumeId: workContext.selectedVolumeId!,
      chapterId: fullChapter.id,
      configId: selectedConfigId.value || null,
      endpoint: aiForm.value.endpoint,
      providerId: selectedConfigId.value || null,
      apiKeyId: null,
      apiKey: aiForm.value.apiKey,
      model: aiForm.value.model,
      systemPrompt: promptForm.systemPrompt,
      prompt: promptForm.prompt,
      temperature: promptForm.temperature,
      maxTokens: promptForm.maxTokens,
      maxRewriteAttempts: promptForm.maxRewriteAttempts,
      validationReportId: validationReportId.value || null,
      rerunValidationAfterSave: rerunValidationAfterSave.value,
      saveToChapter: true
    })
    lastGenerationRecordId.value = result.generationRecordId ?? ''
    selectedChapter.value = await getChapter(fullChapter.id)
    output.value = selectedChapter.value.content ?? ''
    chapters.value = chapters.value.map((item) => (item.id === selectedChapter.value!.id ? selectedChapter.value! : item))
    aiStore.saveToStorage()
    latestValidationSummary.value = rerunValidationAfterSave.value
      ? t('chapterGeneration.messages.validationRerunCompleted')
      : ''
    if (!silent) {
      ElMessage.success(t('chapterGeneration.messages.draftGenerated'))
    }
    return true
  } catch (err) {
    error.value = normalizeGenerationError((err as Error).message || t('chapterGeneration.messages.generationFailed'))
    if (!silent) {
      ElMessage.error(error.value)
    }
    return false
  } finally {
    generating.value = false
    await chatHub.leaveRun(runId)
    currentRunId.value = ''
  }
}

async function runPreflightForSelectedChapter() {
  if (!selectedChapter.value || !workContext.selectedProjectId) {
    ElMessage.warning(t('chapterGeneration.messages.selectChapterFirst'))
    return false
  }

  workflowLoading.value = true
  loopStage.value = 'preflight'
  try {
    preflightResult.value = await runGenerationPreflight({
      projectId: workContext.selectedProjectId,
      volumeId: workContext.selectedVolumeId,
      chapterId: selectedChapter.value.id,
      requireChapterPlan: true,
      requireSceneBlueprints: true
    })
    if (preflightResult.value.passed) {
      appendLoopLog('预检通过，可以继续按场景蓝图写正文。')
      ElMessage.success('生成预检通过，可以按场景蓝图写正文。')
    } else {
      appendLoopLog(`预检未通过：${preflightResult.value.fatalCount} 个致命问题。`)
      ElMessage.warning(`生成预检未通过：${preflightResult.value.fatalCount} 个致命问题。`)
    }
    return preflightResult.value.passed
  } catch (err) {
    ElMessage.error((err as Error).message || '生成预检失败')
    return false
  } finally {
    workflowLoading.value = false
    if (!loopRunning.value) loopStage.value = ''
  }
}

async function previewSelectedChapterBlueprints() {
  if (!selectedChapter.value) {
    ElMessage.warning(t('chapterGeneration.messages.selectChapterFirst'))
    return false
  }
  autoForm.startChapterNumber = selectedChapter.value.chapterNumber
  autoForm.count = 1
  autoForm.createMissing = true
  loopStage.value = 'preview'
  const ok = await previewBatchDrafts()
  if (ok) appendLoopLog('已生成标题简介和场景蓝图预览。')
  if (!loopRunning.value) loopStage.value = ''
  return ok
}

async function confirmPreviewForSelectedChapter(rerunPreflight = true) {
  if (!selectedChapter.value || !workContext.selectedProjectId) {
    ElMessage.warning(t('chapterGeneration.messages.selectChapterFirst'))
    return false
  }
  if (!selectedPreviewItem.value) {
    ElMessage.warning('请先生成标题简介和场景蓝图。')
    return false
  }

  confirmingPreview.value = true
  loopStage.value = 'confirm'
  try {
    confirmedPreview.value = await confirmChapterGenerationPreview({
      projectId: workContext.selectedProjectId,
      chapterId: selectedChapter.value.id,
      preview: selectedPreviewItem.value
    })
    selectedChapter.value = await getChapter(selectedChapter.value.id)
    chapters.value = chapters.value.map((item) => (item.id === selectedChapter.value!.id ? selectedChapter.value! : item))
    appendLoopLog(`已确认《${confirmedPreview.value.title}》，落库 ${confirmedPreview.value.sceneCount} 个场景蓝图。`)
    ElMessage.success(`已确认标题和场景蓝图，并保存 ${confirmedPreview.value.sceneCount} 个场景。`)
    if (rerunPreflight) {
      await runPreflightForSelectedChapter()
    }
    return true
  } catch (err) {
    ElMessage.error((err as Error).message || '确认标题和场景蓝图失败')
    return false
  } finally {
    confirmingPreview.value = false
    if (!loopRunning.value) loopStage.value = ''
  }
}

async function ensureBlueprintsForSelectedChapter() {
  if (!selectedChapter.value || !workContext.selectedProjectId) {
    ElMessage.warning(t('chapterGeneration.messages.selectChapterFirst'))
    return
  }

  ensuringSceneBlueprints.value = true
  try {
    const result = await ensureSceneBlueprints({
      projectId: workContext.selectedProjectId,
      chapterId: selectedChapter.value.id
    })
    const message = result.createdCount > 0
      ? `已自动补齐 ${result.createdCount} 个场景蓝图。`
      : `当前章节已有 ${result.existingCount} 个场景蓝图。`
    ElMessage.success(message)
    await runPreflightForSelectedChapter()
  } catch (err) {
    ElMessage.error((err as Error).message || '自动补齐场景蓝图失败')
  } finally {
    ensuringSceneBlueprints.value = false
  }
}

async function generateSelectedSceneDraft() {
  if (!selectedChapter.value || !validateGenerationSettings(true) || !workContext.selectedProjectId) return false

  sceneGenerating.value = true
  loopStage.value = 'scene'
  error.value = ''
  try {
    const result = await generateSceneDraft({
      runId: crypto.randomUUID(),
      projectId: workContext.selectedProjectId,
      chapterId: selectedChapter.value.id,
      sceneNumber: workflowForm.sceneNumber,
      configId: selectedConfigId.value || null,
      endpoint: aiForm.value.endpoint,
      providerId: selectedConfigId.value || null,
      apiKeyId: null,
      apiKey: aiForm.value.apiKey,
      model: aiForm.value.model,
      systemPrompt: promptForm.systemPrompt,
      prompt: workflowForm.scenePrompt,
      temperature: promptForm.temperature,
      maxTokens: Math.min(promptForm.maxTokens || 4096, 4096)
    })
    sceneDraftResult.value = result
    if (result.success) {
      output.value = [output.value.trim(), result.content.trim()].filter(Boolean).join('\n\n')
      appendLoopLog(`场景 ${result.sceneNumber} 已生成：${result.sceneTitle || '未命名场景'}。`)
      ElMessage.success(`场景 ${result.sceneNumber} 已生成。`)
      return true
    } else {
      error.value = result.error || '场景生成失败'
      appendLoopLog(`场景 ${workflowForm.sceneNumber} 生成失败：${error.value}`)
      ElMessage.error(error.value)
      return false
    }
  } catch (err) {
    error.value = normalizeGenerationError((err as Error).message || '场景生成失败')
    ElMessage.error(error.value)
    return false
  } finally {
    sceneGenerating.value = false
    if (!loopRunning.value) loopStage.value = ''
  }
}

async function composeSelectedScenes() {
  if (!selectedChapter.value || !workContext.selectedProjectId) {
    ElMessage.warning(t('chapterGeneration.messages.selectChapterFirst'))
    return false
  }

  sceneComposing.value = true
  loopStage.value = 'compose'
  try {
    const result = await composeSceneDrafts({
      projectId: workContext.selectedProjectId,
      chapterId: selectedChapter.value.id,
      saveToChapter: true
    })
    output.value = result.content
    selectedChapter.value = await getChapter(selectedChapter.value.id)
    chapters.value = chapters.value.map((item) => (item.id === selectedChapter.value!.id ? selectedChapter.value! : item))
    appendLoopLog(`已合成 ${result.sceneCount} 个场景并保存正文，约 ${result.wordCount} 字。`)
    ElMessage.success(`已合成 ${result.sceneCount} 个场景并保存，约 ${result.wordCount} 字。`)
    return true
  } catch (err) {
    ElMessage.error((err as Error).message || '场景合成失败')
    return false
  } finally {
    sceneComposing.value = false
    if (!loopRunning.value) loopStage.value = ''
  }
}

async function analyzeSelectedChapter() {
  if (!selectedChapter.value || !workContext.selectedProjectId) {
    ElMessage.warning(t('chapterGeneration.messages.selectChapterFirst'))
    return false
  }

  analyzingChapter.value = true
  loopStage.value = 'analysis'
  try {
    chapterAnalysisResult.value = await analyzeGeneratedChapter({
      projectId: workContext.selectedProjectId,
      chapterId: selectedChapter.value.id,
      minWordCount: workflowForm.minWordCount,
      maxDuplicateTitleWindow: 5,
      updateChapterSummary: true
    })
    selectedChapter.value = await getChapter(selectedChapter.value.id)
    if (chapterAnalysisResult.value.passed) {
      appendLoopLog('生成后分析通过，章节闭环完成。')
      ElMessage.success('章节分析通过，批量生成可继续。')
    } else {
      appendLoopLog('生成后分析未通过，建议暂停并修正。')
      ElMessage.warning('章节分析未通过，建议暂停批量生成并修正。')
    }
    return chapterAnalysisResult.value.passed
  } catch (err) {
    ElMessage.error((err as Error).message || '章节分析失败')
    return false
  } finally {
    analyzingChapter.value = false
    if (!loopRunning.value) loopStage.value = ''
  }
}

async function runClosedLoopForSelectedChapter() {
  if (loopRunning.value) return
  if (!validateGenerationSettings(true)) return

  loopRunning.value = true
  loopLog.value = []
  try {
    appendLoopLog('开始单章闭环生成。')
    if (!selectedPreviewItem.value && !(await previewSelectedChapterBlueprints())) return
    if (!(await confirmPreviewForSelectedChapter(false))) return
    if (!(await runPreflightForSelectedChapter())) return

    const scenes = confirmedPreview.value?.scenes.length
      ? confirmedPreview.value.scenes
      : selectedPreviewItem.value?.scenes ?? []
    for (const scene of scenes) {
      workflowForm.sceneNumber = scene.sceneNumber
      if (!(await generateSelectedSceneDraft())) return
    }

    if (!(await composeSelectedScenes())) return
    await analyzeSelectedChapter()
  } finally {
    loopRunning.value = false
    loopStage.value = ''
  }
}

function applyAutoJobStatus(next: ChapterBatchGenerationStatus) {
  autoJobStatus.value = next
  autoJobId.value = next.jobId
  autoGenerating.value = next.status === 'queued' || next.status === 'running'
  autoLog.value = next.logs ?? []
  Object.assign(autoProgress, {
    total: next.total,
    completed: next.completed,
    failed: next.failed,
    skipped: next.skipped,
    currentNumber: next.currentChapterNumber,
    currentTitle: next.currentChapterTitle
  })
}

function stopAutoPolling() {
  if (!autoPollTimer) return
  window.clearInterval(autoPollTimer)
  autoPollTimer = null
}

async function refreshAutoJobStatus() {
  if (!autoJobId.value) return
  try {
    const next = await getChapterBatchGenerationStatus(autoJobId.value)
    applyAutoJobStatus(next)
    if (!autoGenerating.value) {
      stopAutoPolling()
      await refreshChapters()
    }
  } catch (err) {
    stopAutoPolling()
    autoGenerating.value = false
    ElMessage.error((err as Error).message || t('chapterGeneration.batch.loadJobFailed'))
  }
}

function startAutoPolling() {
  stopAutoPolling()
  autoPollTimer = window.setInterval(refreshAutoJobStatus, 3000)
}

async function requestStopAutoGeneration() {
  if (!autoJobId.value) return
  try {
    await cancelChapterBatchGeneration(autoJobId.value)
    ElMessage.warning(t('chapterGeneration.batch.stopRequested'))
    await refreshAutoJobStatus()
  } catch (err) {
    ElMessage.error((err as Error).message || t('chapterGeneration.batch.cancelFailed'))
  }
}

async function previewBatchDrafts() {
  if (autoGenerating.value) return false
  if (!workContext.selectedProjectId || !workContext.selectedVolumeId) {
    ElMessage.warning(t('chapterGeneration.messages.selectProjectVolumeFirst'))
    return false
  }
  if (autoForm.count < 1) {
    ElMessage.warning(t('chapterGeneration.batch.countRequired'))
    return false
  }

  autoPreviewing.value = true
  try {
    autoPreviewItems.value = await previewChapterBatchGeneration({
      projectId: workContext.selectedProjectId!,
      volumeId: workContext.selectedVolumeId!,
      startChapterNumber: autoForm.startChapterNumber,
      count: autoForm.count,
      createMissing: autoForm.createMissing
    })
    ElMessage.success(t('chapterGeneration.batch.previewReady'))
    return true
  } catch (err) {
    ElMessage.error((err as Error).message || t('chapterGeneration.batch.previewFailed'))
    return false
  } finally {
    autoPreviewing.value = false
  }
}

async function generateBatchDrafts() {
  if (autoGenerating.value) return
  if (!validateGenerationSettings(false)) return
  if (autoPreviewItems.value.length === 0) {
    ElMessage.warning(t('chapterGeneration.batch.previewRequired'))
    return
  }

  autoGenerating.value = false
  autoLog.value = []
  autoJobId.value = ''
  autoJobStatus.value = null
  Object.assign(autoProgress, {
    total: autoForm.count,
    completed: 0,
    failed: 0,
    skipped: 0,
    currentNumber: 0,
    currentTitle: ''
  })

  try {
    const accepted = await queueChapterBatchGeneration({
      projectId: workContext.selectedProjectId!,
      volumeId: workContext.selectedVolumeId!,
      startChapterNumber: autoForm.startChapterNumber,
      count: autoForm.count,
      createMissing: autoForm.createMissing,
      overwriteExisting: autoForm.overwriteExisting,
      stopOnFailure: autoForm.autoContinuityMode ? true : autoForm.stopOnFailure,
      autoContinuityMode: autoForm.autoContinuityMode,
      configId: selectedConfigId.value || null,
      endpoint: aiForm.value.endpoint,
      providerId: selectedConfigId.value || null,
      apiKeyId: null,
      apiKey: aiForm.value.apiKey,
      model: aiForm.value.model,
      systemPrompt: promptForm.systemPrompt,
      temperature: promptForm.temperature,
      maxTokens: promptForm.maxTokens,
      maxRewriteAttempts: promptForm.maxRewriteAttempts,
      validationReportId: validationReportId.value || null,
      rerunValidationAfterSave: autoForm.autoContinuityMode ? true : rerunValidationAfterSave.value,
      previewItems: autoPreviewItems.value.map((item) => ({
        ...item,
        title: item.title.trim(),
        summary: item.summary.trim(),
        scenes: (item.scenes ?? []).map((scene) => ({
          ...scene,
          title: scene.title.trim(),
          summary: scene.summary.trim(),
          goal: scene.goal.trim(),
          conflict: scene.conflict.trim(),
          hook: scene.hook.trim(),
          foreshadowingName: scene.foreshadowingName?.trim() ?? '',
          foreshadowingRole: scene.foreshadowingRole?.trim() ?? '',
          timeAnchor: scene.timeAnchor?.trim() ?? '',
          locationAnchor: scene.locationAnchor?.trim() ?? '',
          elapsedFromPrevious: scene.elapsedFromPrevious?.trim() ?? '',
          timelineEffect: scene.timelineEffect?.trim() ?? ''
        }))
      }))
    })
    autoJobId.value = accepted.jobId
    autoGenerating.value = true
    appendAutoLog(t('chapterGeneration.batch.queued', { id: accepted.jobId }))
    await refreshAutoJobStatus()
    startAutoPolling()
    clearAutoPreview()
    aiStore.saveToStorage()
    ElMessage.success(t('chapterGeneration.batch.queued', { id: accepted.jobId }))
  } catch (err) {
    autoGenerating.value = false
    ElMessage.error((err as Error).message || t('chapterGeneration.batch.queueFailed'))
  }
}

async function restoreLatestAutoJob() {
  if (!workContext.selectedProjectId) return
  try {
    const jobs = await listChapterBatchGenerationJobs(workContext.selectedProjectId)
    const runningJob = jobs.find((item) => item.status === 'queued' || item.status === 'running') ?? jobs[0]
    if (!runningJob) return
    applyAutoJobStatus(runningJob)
    if (autoGenerating.value) startAutoPolling()
  } catch {
    // Recent background jobs are best-effort UI state only.
  }
}

async function refreshAiConfig() {
  loadingAiConfig.value = true
  try {
    configs.value = (await listProviderConfigs()).filter((item) => item.isEnabled)
    if (!configs.value.some((item) => item.providerId === selectedConfigId.value)) {
      selectedConfigId.value = configs.value[0]?.providerId ?? ''
    }
    refreshConfigAssets()
  } catch (err) {
    ElMessage.error((err as Error).message || t('chapterGeneration.messages.loadAiConfigFailed'))
  } finally {
    loadingAiConfig.value = false
  }
}

function refreshConfigAssets() {
  if (!selectedConfigId.value) {
    return
  }

  const config = selectedConfig.value
  if (config?.defaultEndpoint) {
    aiForm.value.endpoint = config.defaultEndpoint
  }
  if (config?.modelCode) {
    aiForm.value.model = config.modelCode
  }
}

async function generateDraft() {
  if (!validateGenerationSettings(true) || !selectedChapter.value) return
  await generateDraftForChapter(selectedChapter.value)
}

async function createFirstChapterAndGenerate() {
  if (chapters.value.length > 0) {
    ElMessage.warning(t('chapterGeneration.messages.firstChapterAlreadyExists'))
    return
  }
  if (!workContext.selectedProjectId || !workContext.selectedVolumeId) {
    ElMessage.warning(t('chapterGeneration.messages.selectProjectVolumeFirst'))
    return
  }
  if (!chapterForm.title.trim()) {
    chapterForm.title = t('chapterGeneration.chapter.defaultFirstChapterTitle')
  }

  creatingAndGenerating.value = true
  try {
    await quickCreateChapter()
    await generateDraft()
  } finally {
    creatingAndGenerating.value = false
  }
}

async function saveDraft() {
  if (!selectedChapter.value) return
  savingContent.value = true
  try {
    selectedChapter.value = await saveChapterContent(selectedChapter.value.id, output.value, 'drafted')
    chapters.value = chapters.value.map((item) => (item.id === selectedChapter.value!.id ? selectedChapter.value! : item))
    ElMessage.success(t('chapterGeneration.messages.draftSaved'))
  } catch (err) {
    ElMessage.error((err as Error).message || t('chapterGeneration.messages.saveDraftFailed'))
  } finally {
    savingContent.value = false
  }
}

watch(() => [workContext.selectedProjectId, workContext.selectedVolumeId], refreshChapters)
watch(
  () => [autoForm.startChapterNumber, autoForm.count, autoForm.createMissing],
  clearAutoPreview
)
watch(selectedChapterId, async () => {
  if (suppressChapterWatcher.value) return
  await loadSelectedChapter()
})
watch(selectedConfigId, refreshConfigAssets)
watch(
  () => route.query,
  () => {
    syncChapterSelectionFromRoute()
    buildPromptFromChapter()
  }
)

onMounted(async () => {
  aiStore.loadFromStorage()
  resetChapterForm()
  chatHub.onToken(onToken)
  chatHub.onStatus(onStatus)
  chatHub.onCompleted(onCompleted)
  chatHub.onError(onError)
  await workContext.init()
  await refreshAiConfig()
  await refreshChapters()
  await restoreLatestAutoJob()
  syncChapterSelectionFromRoute()
})

onBeforeUnmount(async () => {
  stopAutoPolling()
  chatHub.offToken(onToken)
  chatHub.offStatus(onStatus)
  chatHub.offCompleted(onCompleted)
  chatHub.offError(onError)
  if (currentRunId.value) await chatHub.leaveRun(currentRunId.value)
})
</script>

<template>
  <div class="chapter-generation">
    <div class="workspace-grid">
      <el-card shadow="never" class="chapter-panel">
        <template #header>
          <div class="panel-head">
            <span>{{ t('chapterGeneration.chapter.panelTitle') }}</span>
            <el-button size="small" :icon="Refresh" @click="refreshChapters">{{ t('chapterGeneration.chapter.refresh') }}</el-button>
          </div>
        </template>

        <el-empty
          v-if="!workContext.selectedProjectId || !workContext.selectedVolumeId"
          :description="t('chapterGeneration.chapter.empty')"
        />

        <template v-else>
          <el-form :model="chapterForm" label-width="96px" size="small" class="create-form">
            <el-form-item :label="t('chapterGeneration.chapter.number')">
              <el-input-number v-model="chapterForm.chapterNumber" :min="1" controls-position="right" />
            </el-form-item>
            <el-form-item :label="t('chapterGeneration.chapter.title')">
              <el-input v-model="chapterForm.title" :placeholder="t('chapterGeneration.chapter.titlePlaceholder')" />
            </el-form-item>
            <el-form-item :label="t('chapterGeneration.chapter.summary')">
              <el-input
                v-model="chapterForm.summary"
                type="textarea"
                :rows="2"
                :placeholder="t('chapterGeneration.chapter.summaryPlaceholder')"
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :icon="Plus" :loading="creatingChapter" @click="quickCreateChapter">
                {{ t('chapterGeneration.chapter.create') }}
              </el-button>
            </el-form-item>
          </el-form>

          <el-table
            v-loading="loadingChapters"
            :data="chapters"
            size="small"
            highlight-current-row
            @row-click="(row: Chapter) => selectedChapterId = row.id"
          >
            <el-table-column label="#" prop="chapterNumber" width="56" />
            <el-table-column :label="t('chapterGeneration.chapter.tableTitle')" prop="title" min-width="140" />
            <el-table-column :label="t('chapterGeneration.chapter.tableStatus')" prop="status" width="100" />
            <el-table-column label="" width="52" align="center">
              <template #default="{ row }">
                <el-button text type="danger" :icon="Delete" @click.stop="removeChapter(row)" />
              </template>
            </el-table-column>
          </el-table>
        </template>
      </el-card>

      <el-card shadow="never" class="generator-panel">
        <template #header>
          <div class="panel-head">
            <span>
              {{
                selectedChapter
                  ? t('chapterGeneration.chapter.header', {
                      number: selectedChapter.chapterNumber,
                      title: selectedChapter.title
                    })
                  : t('chapterGeneration.chapter.draftFallback')
              }}
            </span>
            <div class="head-actions">
              <el-tag size="small" type="info">{{ status }}</el-tag>
              <el-tag v-if="lastGenerationRecordId" size="small" type="success">
                {{ t('chapterGeneration.status.record', { id: lastGenerationRecordId.slice(0, 8) }) }}
              </el-tag>
              <el-button size="small" :icon="DocumentChecked" :loading="savingContent" :disabled="!selectedChapter" @click="saveDraft">
                {{ t('chapterGeneration.actions.saveDraft') }}
              </el-button>
              <el-button
                size="small"
                type="warning"
                :loading="creatingAndGenerating"
                :disabled="!workContext.selectedProjectId || !workContext.selectedVolumeId || chapters.length > 0"
                @click="createFirstChapterAndGenerate"
              >
                {{ t('chapterGeneration.actions.generateFirstChapter') }}
              </el-button>
              <el-button
                v-if="generationMode === 'single'"
                type="primary"
                size="small"
                :icon="VideoPlay"
                :loading="generating"
                :disabled="!selectedChapter"
                @click="generateDraft"
              >
                {{ t('chapterGeneration.actions.generateDraft') }}
              </el-button>
            </div>
          </div>
        </template>

        <div class="generation-mode-panel">
          <div>
            <div class="generation-mode-panel__title">{{ generationModeLabel }}</div>
            <div class="generation-mode-panel__subtitle">{{ generationModeDescription }}</div>
          </div>
          <el-button size="small" :icon="Refresh" @click="toggleGenerationMode">
            {{ generationModeToggleText }}
          </el-button>
        </div>

        <div v-if="generationMode === 'batch'" class="batch-console">
          <div class="batch-console__head">
            <div>
              <div class="batch-console__title">{{ t('chapterGeneration.batch.title') }}</div>
              <div class="batch-console__subtitle">{{ t('chapterGeneration.batch.subtitle') }}</div>
              <div v-if="autoJobId" class="batch-console__job">
                <el-tag size="small" :type="autoGenerating ? 'warning' : 'success'">{{ autoJobStatusLabel }}</el-tag>
                <span>{{ t('chapterGeneration.batch.jobId', { id: autoJobId }) }}</span>
              </div>
            </div>
            <div class="batch-console__actions">
              <el-button
                v-if="autoGenerating"
                size="small"
                type="danger"
                :icon="Close"
                @click="requestStopAutoGeneration"
              >
                {{ t('chapterGeneration.batch.stop') }}
              </el-button>
              <el-button
                v-else
                size="small"
                type="primary"
                :icon="DocumentChecked"
                :loading="autoPreviewing"
                :disabled="!workContext.selectedProjectId || !workContext.selectedVolumeId || generating"
                @click="previewBatchDrafts"
              >
                {{ t('chapterGeneration.batch.preview') }}
              </el-button>
              <el-button
                v-if="!autoGenerating"
                size="small"
                type="success"
                :icon="VideoPlay"
                :disabled="!workContext.selectedProjectId || !workContext.selectedVolumeId || generating || autoPreviewItems.length === 0"
                @click="generateBatchDrafts"
              >
                {{ t('chapterGeneration.batch.confirmStart') }}
              </el-button>
            </div>
          </div>
          <el-form label-width="110px" class="batch-form">
            <div class="batch-controls">
              <el-form-item :label="t('chapterGeneration.batch.startNumber')">
                <el-input-number
                  v-model="autoForm.startChapterNumber"
                  :min="1"
                  :disabled="autoGenerating"
                  controls-position="right"
                />
              </el-form-item>
              <el-form-item :label="t('chapterGeneration.batch.count')">
                <el-input-number
                  v-model="autoForm.count"
                  :min="1"
                  :max="200"
                  :disabled="autoGenerating"
                  controls-position="right"
                />
              </el-form-item>
              <el-form-item :label="t('chapterGeneration.batch.options')">
                <div class="batch-options">
                  <el-checkbox v-model="autoForm.createMissing" :disabled="autoGenerating">
                    {{ t('chapterGeneration.batch.createMissing') }}
                  </el-checkbox>
                  <el-checkbox v-model="autoForm.overwriteExisting" :disabled="autoGenerating">
                    {{ t('chapterGeneration.batch.overwriteExisting') }}
                  </el-checkbox>
                  <el-checkbox v-model="autoForm.autoContinuityMode" :disabled="autoGenerating">
                    {{ t('chapterGeneration.batch.autoContinuityMode') }}
                  </el-checkbox>
                  <el-checkbox v-model="autoForm.stopOnFailure" :disabled="autoGenerating || autoForm.autoContinuityMode">
                    {{ t('chapterGeneration.batch.stopOnFailure') }}
                  </el-checkbox>
                  <span v-if="autoForm.autoContinuityMode" class="batch-option-hint">
                    {{ t('chapterGeneration.batch.autoContinuityHint') }}
                  </span>
                </div>
              </el-form-item>
            </div>
            <div v-if="autoPreviewItems.length" class="batch-preview">
              <div class="batch-preview__head">
                <div>
                  <div class="batch-preview__title">{{ t('chapterGeneration.batch.previewTitle') }}</div>
                  <div class="batch-preview__subtitle">{{ t('chapterGeneration.batch.previewSubtitle') }}</div>
                </div>
                <el-button size="small" text :icon="Refresh" :loading="autoPreviewing" @click="previewBatchDrafts">
                  {{ t('chapterGeneration.batch.refreshPreview') }}
                </el-button>
              </div>
              <el-table :data="autoPreviewItems" size="small" class="batch-preview__table">
                <el-table-column type="expand">
                  <template #default="{ row }">
                    <div class="batch-scenes">
                      <div class="batch-scenes__head">
                        <strong>场景蓝图</strong>
                        <span>自动生成正文时会按这些场景顺序写入 Prompt。</span>
                      </div>
                      <div v-for="scene in row.scenes ?? []" :key="scene.sceneNumber" class="batch-scene">
                        <div class="batch-scene__title">
                          <el-tag size="small" type="info">场景 {{ scene.sceneNumber }}</el-tag>
                          <el-input v-model="scene.title" size="small" placeholder="场景标题" />
                        </div>
                        <el-input v-model="scene.summary" size="small" type="textarea" :rows="2" placeholder="场景简介" />
                        <div class="batch-scene__grid">
                          <el-input v-model="scene.goal" size="small" placeholder="场景目标" />
                          <el-input v-model="scene.conflict" size="small" placeholder="场景冲突" />
                          <el-input v-model="scene.hook" size="small" placeholder="收束钩子" />
                        </div>
                        <div class="batch-scene__tracking-grid">
                          <el-input v-model="scene.foreshadowingName" size="small" placeholder="伏笔名称" />
                          <el-input v-model="scene.foreshadowingRole" size="small" placeholder="伏笔职责：埋设/推进/回收" />
                          <el-input v-model="scene.timeAnchor" size="small" placeholder="时间锚点" />
                          <el-input v-model="scene.locationAnchor" size="small" placeholder="地点锚点" />
                          <el-input v-model="scene.elapsedFromPrevious" size="small" placeholder="距上一场景/上一章经过" />
                          <el-input v-model="scene.timelineEffect" size="small" placeholder="时间线影响" />
                        </div>
                      </div>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column :label="t('chapterGeneration.batch.previewNumber')" prop="chapterNumber" width="72" />
                <el-table-column :label="t('chapterGeneration.batch.previewTitleColumn')" min-width="180">
                  <template #default="{ row }">
                    <el-input v-model="row.title" size="small" />
                  </template>
                </el-table-column>
                <el-table-column :label="t('chapterGeneration.batch.previewSummaryColumn')" min-width="320">
                  <template #default="{ row }">
                    <el-input v-model="row.summary" size="small" type="textarea" :rows="2" />
                  </template>
                </el-table-column>
                <el-table-column :label="t('chapterGeneration.batch.previewState')" width="120">
                  <template #default="{ row }">
                    <el-tag size="small" :type="row.hasContent ? 'warning' : row.exists ? 'info' : 'success'">
                      {{
                        row.hasContent
                          ? t('chapterGeneration.batch.previewHasContent')
                          : row.exists
                            ? t('chapterGeneration.batch.previewExists')
                            : t('chapterGeneration.batch.previewNew')
                      }}
                    </el-tag>
                  </template>
                </el-table-column>
              </el-table>
            </div>
            <div v-if="autoGenerating || autoProgress.total" class="batch-progress">
              <el-progress :percentage="autoProgressPercent" :stroke-width="8" />
              <div v-if="autoJobStatus?.message" class="batch-message">{{ autoJobStatus.message }}</div>
              <div class="batch-progress__meta">
                <span>
                  {{
                    t('chapterGeneration.batch.progress', {
                      completed: autoProgress.completed,
                      skipped: autoProgress.skipped,
                      failed: autoProgress.failed,
                      total: autoProgress.total
                    })
                  }}
                </span>
                <span v-if="autoProgress.currentNumber">
                  {{
                    t('chapterGeneration.batch.current', {
                      number: autoProgress.currentNumber,
                      title: autoProgress.currentTitle || '-'
                    })
                  }}
                </span>
              </div>
              <div v-if="autoLog.length" class="batch-log">
                <div v-for="(item, index) in autoLog" :key="index" class="batch-log__item">{{ item }}</div>
              </div>
            </div>
          </el-form>
        </div>

        <el-collapse v-else class="secondary-collapse">
          <el-collapse-item name="single-workflow">
            <template #title>
              <div class="collapse-title">
                <span>单章精写、场景生成与预检</span>
                <small>需要精修单章时再展开，标题简介、场景蓝图、预检、场景正文、合成和分析都保留在这里。</small>
              </div>
            </template>

            <div class="workflow-console">
              <div class="workflow-console__head">
                <div>
                  <div class="workflow-console__title">生成流程控制</div>
                  <div class="workflow-console__subtitle">标题简介、场景蓝图、预检、场景正文、合成和分析统一在这里闭环完成。</div>
                </div>
                <div class="workflow-console__actions">
              <el-button
                size="small"
                :icon="DocumentChecked"
                :loading="autoPreviewing && loopStage === 'preview'"
                :disabled="!selectedChapter || loopRunning || autoGenerating"
                @click="previewSelectedChapterBlueprints"
              >
                生成标题简介
              </el-button>
              <el-button
                size="small"
                type="primary"
                plain
                :loading="confirmingPreview"
                :disabled="!canConfirmSelectedPreview || loopRunning"
                @click="() => confirmPreviewForSelectedChapter()"
              >
                确认标题和场景蓝图
              </el-button>
              <el-button size="small" :loading="workflowLoading" :disabled="!selectedChapter" @click="runPreflightForSelectedChapter">
                生成前预检
              </el-button>
              <el-button
                v-if="canEnsureSceneBlueprints"
                size="small"
                type="primary"
                plain
                :loading="ensuringSceneBlueprints"
                :disabled="workflowLoading"
                @click="ensureBlueprintsForSelectedChapter"
              >
                自动补齐场景蓝图
              </el-button>
              <el-button
                size="small"
                type="primary"
                :loading="sceneGenerating"
                :disabled="!selectedChapter || generating || !preflightResult?.passed"
                @click="generateSelectedSceneDraft"
              >
                写当前场景正文
              </el-button>
              <el-button size="small" type="success" :loading="sceneComposing" :disabled="!selectedChapter" @click="composeSelectedScenes">
                合成正文
              </el-button>
              <el-button size="small" type="warning" :loading="analyzingChapter" :disabled="!selectedChapter" @click="analyzeSelectedChapter">
                生成后分析
              </el-button>
              <el-button
                size="small"
                type="danger"
                :icon="VideoPlay"
                :loading="loopRunning"
                :disabled="!selectedChapter || generating || autoGenerating"
                @click="runClosedLoopForSelectedChapter"
              >
                一键闭环生成
              </el-button>
                </div>
              </div>

              <div class="workflow-steps">
            <el-steps :active="loopActiveIndex" finish-status="success" simple>
              <el-step v-for="item in loopSteps" :key="item.key" :title="item.title" :status="item.status" />
            </el-steps>
            <el-progress v-if="loopRunning || loopLog.length" :percentage="loopProgressPercent" :stroke-width="8" />
              </div>

              <div v-if="selectedPreviewItem" class="single-preview">
            <div class="single-preview__head">
              <div>
                <strong>当前章节标题、简介和场景蓝图</strong>
                <span>确认后会保存到章节和章节蓝图，再进入正文生成。</span>
              </div>
              <el-tag size="small" type="info">第 {{ selectedPreviewItem.chapterNumber }} 章</el-tag>
            </div>
            <div class="single-preview__chapter">
              <el-input v-model="selectedPreviewItem.title" size="small" placeholder="章节标题" />
              <el-input v-model="selectedPreviewItem.summary" size="small" type="textarea" :rows="2" placeholder="章节简介" />
            </div>
            <div class="single-preview__scenes">
              <div v-for="scene in selectedPreviewItem.scenes ?? []" :key="scene.sceneNumber" class="single-preview-scene">
                <div class="single-preview-scene__title">
                  <el-tag size="small" type="info">场景 {{ scene.sceneNumber }}</el-tag>
                  <el-input v-model="scene.title" size="small" placeholder="场景标题" />
                </div>
                <el-input v-model="scene.summary" size="small" type="textarea" :rows="2" placeholder="场景简介" />
                <div class="single-preview-scene__grid">
                  <el-input v-model="scene.goal" size="small" placeholder="场景目标" />
                  <el-input v-model="scene.conflict" size="small" placeholder="场景冲突" />
                  <el-input v-model="scene.hook" size="small" placeholder="收束钩子" />
                </div>
                <div class="single-preview-scene__tracking-grid">
                  <el-input v-model="scene.foreshadowingName" size="small" placeholder="伏笔名称" />
                  <el-input v-model="scene.foreshadowingRole" size="small" placeholder="伏笔职责：埋设/推进/回收" />
                  <el-input v-model="scene.timeAnchor" size="small" placeholder="时间锚点" />
                  <el-input v-model="scene.locationAnchor" size="small" placeholder="地点锚点" />
                  <el-input v-model="scene.elapsedFromPrevious" size="small" placeholder="距上一场景/上一章经过" />
                  <el-input v-model="scene.timelineEffect" size="small" placeholder="时间线影响" />
                </div>
              </div>
            </div>
              </div>

              <div class="workflow-controls">
            <el-form-item label="场景序号">
              <el-input-number v-model="workflowForm.sceneNumber" :min="1" controls-position="right" />
            </el-form-item>
            <el-form-item label="最低字数">
              <el-input-number v-model="workflowForm.minWordCount" :min="100" :max="8000" :step="100" controls-position="right" />
            </el-form-item>
            <el-form-item label="场景要求" class="workflow-controls__prompt">
              <el-input v-model="workflowForm.scenePrompt" type="textarea" :rows="2" />
            </el-form-item>
              </div>

              <div v-if="selectedPreviewItem || confirmedPreview || preflightResult || sceneDraftResult || chapterAnalysisResult" class="workflow-results">
            <el-alert
              v-if="selectedPreviewItem"
              :title="`标题简介已生成：第 ${selectedPreviewItem.chapterNumber} 章《${selectedPreviewItem.title || '-'}》，场景 ${selectedPreviewItem.scenes?.length ?? 0} 个`"
              type="info"
              show-icon
              :closable="false"
            />
            <el-alert
              v-if="confirmedPreview"
              :title="`标题简介和场景蓝图已确认入库：${confirmedPreview.sceneCount} 个场景`"
              type="success"
              show-icon
              :closable="false"
            />
            <el-alert
              v-if="preflightResult"
              :title="preflightResult.passed ? '预检通过' : `预检未通过：${preflightResult.fatalCount} 个致命问题，${preflightResult.warningCount} 个警告`"
              :type="preflightResult.passed ? 'success' : 'warning'"
              show-icon
              :closable="false"
            />

            <el-alert
              v-if="sceneDraftResult"
              :title="sceneDraftResult.success ? `场景 ${sceneDraftResult.sceneNumber} 已生成：${sceneDraftResult.sceneTitle || '未命名场景'}` : `场景生成失败：${sceneDraftResult.error || '-'}`"
              :type="sceneDraftResult.success ? 'success' : 'error'"
              show-icon
              :closable="false"
            />

            <el-alert
              v-if="chapterAnalysisResult"
              :title="`分析结果：${chapterAnalysisResult.passed ? '通过' : '未通过'}，字数 ${chapterAnalysisResult.wordCount}，连贯 ${chapterAnalysisResult.coherenceScore}/10，质量 ${chapterAnalysisResult.qualityScore}/10`"
              :type="chapterAnalysisResult.passed ? 'success' : 'warning'"
              show-icon
              :closable="false"
            />

            <el-collapse
              v-if="preflightResult?.items.length || chapterAnalysisResult?.items.length"
              class="detail-collapse"
            >
              <el-collapse-item name="workflow-result-details">
                <template #title>
                  <div class="collapse-title">
                    <span>预检详情与分析明细</span>
                    <small>仅在需要定位问题、补齐蓝图或复盘质量时展开。</small>
                  </div>
                </template>

                <div v-if="preflightResult?.items.length" class="workflow-result-list">
                  <div v-for="item in preflightResult.items" :key="item.code" class="workflow-result-item">
                    <el-tag size="small" :type="item.severity === 'fatal' ? 'danger' : 'warning'">{{ item.severity }}</el-tag>
                    <span>{{ item.message }}</span>
                    <small>{{ item.suggestion }}</small>
                  </div>
                </div>

                <div v-if="chapterAnalysisResult?.items.length" class="workflow-result-list">
                  <div v-for="item in chapterAnalysisResult.items" :key="item.code" class="workflow-result-item">
                    <el-tag size="small" :type="item.severity === 'fatal' ? 'danger' : 'warning'">{{ item.severity }}</el-tag>
                    <span>{{ item.message }}</span>
                    <small>{{ item.suggestion }}</small>
                  </div>
                </div>
              </el-collapse-item>
            </el-collapse>
              </div>

              <div v-if="loopLog.length" class="workflow-log">
                <div v-for="(item, index) in loopLog" :key="index" class="workflow-log__item">{{ item }}</div>
              </div>
            </div>
          </el-collapse-item>
        </el-collapse>

        <el-collapse class="advanced-collapse">
          <el-collapse-item name="ai-advanced">
            <template #title>
              <div class="collapse-title">
                <span>高级 AI 参数</span>
                <small>模型、Endpoint、Prompt、温度和 Tokens 默认收起，首屏只保留生成主流程。</small>
              </div>
            </template>

            <el-form label-width="110px" class="ai-form" :disabled="generating">
              <div class="ai-source-bar">
            <el-switch
              v-model="rerunValidationAfterSave"
              :active-text="t('chapterGeneration.ai.autoRerunValidation')"
              :inactive-text="t('chapterGeneration.ai.manualValidation')"
            />
            <el-button size="small" :icon="Refresh" :loading="loadingAiConfig" @click="refreshAiConfig">
              {{ t('chapterGeneration.actions.refreshAiConfig') }}
            </el-button>
          </div>

          <el-form-item :label="t('chapterGeneration.ai.config')">
              <el-select v-model="selectedConfigId" :placeholder="t('chapterGeneration.ai.selectConfig')" filterable clearable>
                <el-option
                  v-for="config in configs"
                  :key="config.providerId"
                  :label="`${config.name} / ${config.modelCode || '--'}`"
                  :value="config.providerId"
                />
              </el-select>
          </el-form-item>
          <el-form-item :label="t('chapterGeneration.ai.apiKey')">
            <el-input v-model="aiForm.apiKey" type="password" show-password :placeholder="t('chapterGeneration.ai.apiKeyPlaceholder')" />
          </el-form-item>
          <el-form-item :label="t('chapterGeneration.ai.model')">
            <el-input v-model="aiForm.model" :placeholder="t('chapterGeneration.ai.modelPlaceholder')" />
          </el-form-item>

          <el-form-item :label="t('chapterGeneration.ai.endpoint')">
            <el-input v-model="aiForm.endpoint" :placeholder="t('chapterGeneration.ai.endpointPlaceholder')" />
          </el-form-item>
          <el-form-item :label="t('chapterGeneration.ai.systemPrompt')">
            <el-input v-model="promptForm.systemPrompt" type="textarea" :rows="2" />
          </el-form-item>
          <el-form-item :label="t('chapterGeneration.ai.prompt')">
            <el-input v-model="promptForm.prompt" type="textarea" :rows="5" />
          </el-form-item>
          <div class="inline-controls">
            <el-form-item :label="t('chapterGeneration.ai.temperature')">
              <el-input-number v-model="promptForm.temperature" :min="0" :max="2" :step="0.1" />
            </el-form-item>
            <el-form-item :label="t('chapterGeneration.ai.maxTokens')">
              <el-input-number v-model="promptForm.maxTokens" :min="256" :max="12000" :step="256" />
            </el-form-item>
            <el-form-item :label="t('chapterGeneration.ai.maxRewrites')">
              <el-input-number v-model="promptForm.maxRewriteAttempts" :min="0" :max="3" :step="1" />
            </el-form-item>
          </div>
            </el-form>
          </el-collapse-item>
        </el-collapse>

        <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" />
        <el-alert
          v-if="latestValidationSummary"
          :title="latestValidationSummary"
          type="success"
          show-icon
          :closable="false"
          style="margin-top: 8px"
        />
        <el-input
          v-model="output"
          type="textarea"
          :rows="18"
          class="draft-output"
          :placeholder="t('chapterGeneration.ai.outputPlaceholder')"
        />
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.chapter-generation {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.workspace-grid {
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 12px;
  min-height: calc(100vh - 156px);
}
.chapter-panel,
.generator-panel {
  min-height: 0;
}
.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.create-form {
  margin-bottom: 12px;
}
.ai-form {
  max-width: 980px;
}
.secondary-collapse,
.advanced-collapse {
  margin-bottom: 14px;
  border-top: 0;
  border-bottom: 0;
}
.secondary-collapse :deep(.el-collapse-item__wrap),
.advanced-collapse :deep(.el-collapse-item__wrap) {
  border-bottom: 0;
}
.secondary-collapse :deep(.el-collapse-item__header),
.advanced-collapse :deep(.el-collapse-item__header) {
  min-height: 48px;
  height: auto;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: var(--el-fill-color-extra-light);
  line-height: 1.35;
}
.secondary-collapse :deep(.el-collapse-item__content),
.advanced-collapse :deep(.el-collapse-item__content) {
  padding: 12px 0 0;
}
.collapse-title {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.collapse-title span {
  color: var(--el-text-color-primary);
  font-weight: 650;
  line-height: 20px;
}
.collapse-title small {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  white-space: normal;
}
.generation-mode-panel {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 12px;
  margin-bottom: 14px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: var(--el-fill-color-extra-light);
}
.generation-mode-panel__title {
  font-weight: 650;
  line-height: 22px;
}
.generation-mode-panel__subtitle {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 18px;
  margin-top: 2px;
}
.batch-console {
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 14px;
  background: var(--el-fill-color-extra-light);
}
.workflow-console {
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 14px;
  background: var(--el-bg-color);
}
.secondary-collapse .workflow-console {
  margin-bottom: 0;
}
.detail-collapse {
  margin-top: 2px;
  border-top: 0;
  border-bottom: 0;
}
.detail-collapse :deep(.el-collapse-item__header) {
  min-height: 42px;
  height: auto;
  padding: 8px 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-fill-color-extra-light);
  line-height: 1.35;
}
.detail-collapse :deep(.el-collapse-item__wrap) {
  border-bottom: 0;
}
.detail-collapse :deep(.el-collapse-item__content) {
  display: grid;
  gap: 8px;
  padding: 10px 0 0;
}
.batch-console__head,
.batch-progress__meta,
.workflow-console__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}
.batch-console__title {
  font-weight: 650;
  line-height: 22px;
}
.batch-console__subtitle {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 18px;
  margin-top: 2px;
}
.workflow-console__title {
  font-weight: 650;
  line-height: 22px;
}
.workflow-console__subtitle {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 18px;
  margin-top: 2px;
}
.batch-console__job {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 18px;
}
.batch-console__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.batch-console__actions :deep(.el-button + .el-button) {
  margin-left: 0;
}
.workflow-console__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
  flex-shrink: 0;
}
.workflow-steps {
  display: grid;
  gap: 10px;
  margin-top: 12px;
}
.workflow-steps :deep(.el-steps--simple) {
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}
.single-preview {
  display: grid;
  gap: 10px;
  margin-top: 12px;
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-fill-color-extra-light);
}
.single-preview__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.single-preview__head strong {
  color: var(--el-text-color-primary);
}
.single-preview__head span {
  display: block;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 18px;
  margin-top: 2px;
}
.single-preview__chapter,
.single-preview__scenes {
  display: grid;
  gap: 8px;
}
.single-preview-scene {
  display: grid;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-bg-color);
}
.single-preview-scene__title {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 8px;
  align-items: center;
}
.single-preview-scene__grid,
.single-preview-scene__tracking-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.workflow-controls {
  display: grid;
  grid-template-columns: minmax(140px, 180px) minmax(140px, 180px) minmax(280px, 1fr);
  gap: 12px;
  margin-top: 12px;
}
.workflow-controls :deep(.el-form-item) {
  margin-bottom: 0;
}
.workflow-results {
  display: grid;
  gap: 8px;
  margin-top: 12px;
}
.workflow-result-list {
  display: grid;
  gap: 6px;
}
.workflow-result-item {
  display: grid;
  grid-template-columns: 72px minmax(160px, 1fr) minmax(180px, 1fr);
  gap: 8px;
  align-items: center;
  color: var(--el-text-color-primary);
  font-size: 12px;
  line-height: 18px;
}
.workflow-result-item small {
  color: var(--el-text-color-secondary);
}
.workflow-log {
  display: grid;
  gap: 4px;
  max-height: 160px;
  overflow: auto;
  margin-top: 10px;
  padding: 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-fill-color-extra-light);
}
.workflow-log__item {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 18px;
}
.batch-controls {
  display: grid;
  grid-template-columns: minmax(160px, 1fr) minmax(160px, 1fr) minmax(260px, 2fr);
  gap: 12px;
  margin-top: 12px;
}
.batch-controls :deep(.el-form-item) {
  margin-bottom: 0;
}
.batch-options {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 14px;
  min-height: 32px;
}
.batch-options :deep(.el-checkbox) {
  margin-right: 0;
}
.batch-preview {
  margin-top: 12px;
  padding: 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-bg-color);
  overflow-x: auto;
}
.batch-preview__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 8px;
}
.batch-preview__title {
  font-weight: 650;
  line-height: 20px;
}
.batch-preview__subtitle {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 18px;
  margin-top: 2px;
}
.batch-preview__table :deep(.el-textarea__inner) {
  min-height: 48px !important;
  resize: vertical;
}
.batch-scenes {
  display: grid;
  gap: 10px;
  padding: 10px 12px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
}
.batch-scenes__head {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.batch-scenes__head strong {
  color: var(--el-text-color-primary);
}
.batch-scenes__head span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.batch-scene {
  display: grid;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-bg-color);
}
.batch-scene__title {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 8px;
  align-items: center;
}
.batch-scene__grid,
.batch-scene__tracking-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.batch-progress {
  margin-top: 12px;
}
.batch-message {
  margin-top: 8px;
  color: var(--el-text-color-primary);
  font-size: 12px;
  line-height: 18px;
}
.batch-progress__meta {
  margin-top: 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 18px;
}
.batch-log {
  display: grid;
  gap: 4px;
  margin-top: 8px;
  max-height: 108px;
  overflow: auto;
}
.batch-log__item {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 18px;
  padding: 4px 6px;
  border-radius: 4px;
  background: var(--el-fill-color);
}
.ai-source-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.inline-controls {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.draft-output {
  margin-top: 12px;
}
@media (max-width: 1080px) {
  .workspace-grid {
    grid-template-columns: 1fr;
  }
  .panel-head {
    align-items: stretch;
    flex-direction: column;
  }
  .head-actions {
    justify-content: flex-start;
  }
  .generation-mode-panel {
    flex-direction: column;
    align-items: stretch;
  }
  .generation-mode-panel :deep(.el-button),
  .head-actions :deep(.el-button),
  .batch-console__actions :deep(.el-button),
  .workflow-console__actions :deep(.el-button) {
    min-height: 32px;
    height: auto;
    white-space: normal;
  }
  .batch-controls {
    grid-template-columns: 1fr;
  }
  .batch-console__head,
  .batch-progress__meta,
  .workflow-console__head {
    flex-direction: column;
  }
  .batch-console__actions {
    flex-wrap: wrap;
    width: 100%;
  }
  .workflow-console__actions {
    justify-content: flex-start;
  }
  .batch-preview__head,
  .ai-source-bar {
    align-items: stretch;
    flex-direction: column;
  }
  .batch-preview__table {
    min-width: 720px;
  }
  .workflow-controls,
  .workflow-result-item,
  .single-preview-scene__grid,
  .single-preview-scene__tracking-grid,
  .batch-scene__grid,
  .batch-scene__tracking-grid,
  .inline-controls {
    grid-template-columns: 1fr;
  }
  .single-preview__head {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
