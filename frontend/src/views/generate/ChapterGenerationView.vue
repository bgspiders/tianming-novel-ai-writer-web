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
  cancelChapterBatchGeneration,
  createChapter,
  deleteChapter,
  generateChapterDraft,
  getChapterBatchGenerationStatus,
  getChapter,
  listChapters,
  listChapterBatchGenerationJobs,
  queueChapterBatchGeneration,
  saveChapterContent,
  type Chapter,
  type ChapterBatchGenerationStatus
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
  stopOnFailure: true
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
    return
  }
  try {
    selectedChapter.value = await getChapter(selectedChapterId.value)
    output.value = selectedChapter.value.content ?? ''
    buildPromptFromChapter()
  } catch (err) {
    ElMessage.error((err as Error).message || t('chapterGeneration.messages.loadChapterDetailsFailed'))
  }
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

async function generateBatchDrafts() {
  if (autoGenerating.value) return
  if (!validateGenerationSettings(false)) return
  if (autoForm.count < 1) {
    ElMessage.warning(t('chapterGeneration.batch.countRequired'))
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
      stopOnFailure: autoForm.stopOnFailure,
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
      rerunValidationAfterSave: rerunValidationAfterSave.value
    })
    autoJobId.value = accepted.jobId
    autoGenerating.value = true
    appendAutoLog(t('chapterGeneration.batch.queued', { id: accepted.jobId }))
    await refreshAutoJobStatus()
    startAutoPolling()
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
              <el-button type="primary" size="small" :icon="VideoPlay" :loading="generating" :disabled="!selectedChapter" @click="generateDraft">
                {{ t('chapterGeneration.actions.generateDraft') }}
              </el-button>
            </div>
          </div>
        </template>

        <div class="batch-console">
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
                :icon="VideoPlay"
                :disabled="!workContext.selectedProjectId || !workContext.selectedVolumeId || generating"
                @click="generateBatchDrafts"
              >
                {{ t('chapterGeneration.batch.start') }}
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
                  <el-checkbox v-model="autoForm.stopOnFailure" :disabled="autoGenerating">
                    {{ t('chapterGeneration.batch.stopOnFailure') }}
                  </el-checkbox>
                </div>
              </el-form-item>
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
.batch-console {
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 14px;
  background: var(--el-fill-color-extra-light);
}
.batch-console__head,
.batch-progress__meta {
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
  flex-shrink: 0;
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
  .batch-controls {
    grid-template-columns: 1fr;
  }
  .batch-console__head,
  .batch-progress__meta {
    flex-direction: column;
  }
}
</style>
