<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Refresh, Delete, VideoPlay, DocumentChecked } from '@element-plus/icons-vue'
import { storeToRefs } from 'pinia'
import { useI18n } from '@/composables/useI18n'
import { listProviderConfigs, type AiProviderConfig } from '@/api/modules/ai'
import { useWorkContextStore } from '@/stores/workContext'
import { useAiTestStore } from '@/stores/aiTest'
import { chatHub } from '@/signalr/chat'
import {
  createChapter,
  deleteChapter,
  generateChapterDraft,
  getChapter,
  listChapters,
  saveChapterContent,
  type Chapter
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

const selectedConfig = computed(() =>
  configs.value.find((item) => item.providerId === selectedConfigId.value) ?? null
)

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
  error.value = message
  status.value = t('aiAssistant.status.failed')
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
  chapterForm.chapterNumber = (chapters.value.at(-1)?.chapterNumber ?? 0) + 1
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
  const volume = workContext.selectedVolume
  if (!chapter) return

  promptForm.prompt = [
    `项目：${workContext.selectedProject?.name ?? chapter.projectId}`,
    `卷：${volume ? `第 ${volume.volumeNumber} 卷 / ${volume.title}` : chapter.volumeId}`,
    `章节：${chapter.chapterNumber} / ${chapter.title}`,
    chapter.summary ? `摘要：${chapter.summary}` : '',
    validationRepairSummary.value ? `本次修正重点：${validationRepairSummary.value}` : '',
    '',
    '请直接输出章节草稿，保持叙事连贯清晰。'
  ].filter(Boolean).join('\n')
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
  if (!selectedChapter.value) {
    ElMessage.warning(t('chapterGeneration.messages.selectChapterFirst'))
    return
  }
  if (!aiForm.value.endpoint || !aiForm.value.model) {
    ElMessage.warning(t('chapterGeneration.messages.endpointModelRequired'))
    return
  }
  if (!selectedConfigId.value && !aiForm.value.apiKey) {
    ElMessage.warning(t('chapterGeneration.messages.selectConfigOrKeyFirst'))
    return
  }
  if (!promptForm.prompt.trim()) {
    ElMessage.warning(t('chapterGeneration.messages.promptRequired'))
    return
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
      chapterId: selectedChapter.value.id,
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
    selectedChapter.value = await getChapter(selectedChapter.value.id)
    output.value = selectedChapter.value.content ?? ''
    chapters.value = chapters.value.map((item) => (item.id === selectedChapter.value!.id ? selectedChapter.value! : item))
    aiStore.saveToStorage()
    latestValidationSummary.value = rerunValidationAfterSave.value
      ? t('chapterGeneration.messages.validationRerunCompleted')
      : ''
    ElMessage.success(t('chapterGeneration.messages.draftGenerated'))
  } catch (err) {
    error.value = (err as Error).message || t('chapterGeneration.messages.generationFailed')
    ElMessage.error(error.value)
  } finally {
    generating.value = false
    await chatHub.leaveRun(runId)
    currentRunId.value = ''
  }
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
watch(selectedChapterId, loadSelectedChapter)
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
  syncChapterSelectionFromRoute()
})

onBeforeUnmount(async () => {
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
}
</style>
