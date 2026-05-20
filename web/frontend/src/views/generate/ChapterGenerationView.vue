<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Refresh, Delete, VideoPlay, DocumentChecked } from '@element-plus/icons-vue'
import { storeToRefs } from 'pinia'
import { useWorkContextStore } from '@/stores/workContext'
import { useAiTestStore } from '@/stores/aiTest'
import { chatHub } from '@/signalr/chat'
import { listKeys, listModels, listProviders, type AiApiKey, type AiModel, type AiProvider } from '@/api/modules/ai'
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
const aiStore = useAiTestStore()
const { form: aiForm } = storeToRefs(aiStore)

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
const providers = ref<AiProvider[]>([])
const models = ref<AiModel[]>([])
const apiKeys = ref<AiApiKey[]>([])
const selectedProviderId = ref('')
const selectedModelCode = ref('')
const selectedApiKeyId = ref('')
const useSavedApiKey = ref(true)

const chapterForm = reactive({
  chapterNumber: 1,
  title: '',
  summary: ''
})

const promptForm = reactive({
  systemPrompt: 'You are a professional web novel writer. Return only the chapter draft.',
  prompt: '',
  temperature: 0.8,
  maxTokens: 4096,
  maxRewriteAttempts: 2
})

function onToken(token: string) {
  output.value += token
}

function onStatus(next: string) {
  status.value = next
}

function onCompleted(reason: string) {
  status.value = `completed (${reason})`
}

function onError(message: string) {
  error.value = message
  status.value = 'error'
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
    if (!chapters.value.some((item) => item.id === selectedChapterId.value)) {
      selectedChapterId.value = chapters.value[0]?.id ?? ''
    }
    await loadSelectedChapter()
  } catch (err) {
    ElMessage.error((err as Error).message || 'Failed to load chapters.')
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
    ElMessage.error((err as Error).message || 'Failed to load chapter details.')
  }
}

function resetChapterForm() {
  chapterForm.chapterNumber = (chapters.value.at(-1)?.chapterNumber ?? 0) + 1
  chapterForm.title = ''
  chapterForm.summary = ''
}

async function quickCreateChapter() {
  if (!workContext.selectedProjectId || !workContext.selectedVolumeId) {
    ElMessage.warning('Select a project and a volume first.')
    return
  }
  if (!chapterForm.title.trim()) {
    ElMessage.warning('Chapter title is required.')
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
    ElMessage.success('Chapter created.')
  } catch (err) {
    ElMessage.error((err as Error).message || 'Failed to create chapter.')
  } finally {
    creatingChapter.value = false
  }
}

async function removeChapter(row: Chapter) {
  try {
    await ElMessageBox.confirm(`Delete Chapter ${row.chapterNumber} / ${row.title}?`, 'Confirm', { type: 'warning' })
  } catch {
    return
  }

  try {
    await deleteChapter(row.id)
    ElMessage.success('Chapter deleted.')
    await refreshChapters()
  } catch (err) {
    ElMessage.error((err as Error).message || 'Failed to delete chapter.')
  }
}

function buildPromptFromChapter() {
  const chapter = selectedChapter.value
  const volume = workContext.selectedVolume
  if (!chapter) return

  promptForm.prompt = [
    `Project: ${workContext.selectedProject?.name ?? chapter.projectId}`,
    `Volume: ${volume ? `Volume ${volume.volumeNumber} / ${volume.title}` : chapter.volumeId}`,
    `Chapter: ${chapter.chapterNumber} / ${chapter.title}`,
    chapter.summary ? `Summary: ${chapter.summary}` : '',
    '',
    'Write the chapter draft directly. Keep the narrative continuous and clear.'
  ].filter(Boolean).join('\n')
}

async function refreshAiConfig() {
  loadingAiConfig.value = true
  try {
    providers.value = (await listProviders()).filter((item) => item.isEnabled)
    if (!providers.value.some((item) => item.id === selectedProviderId.value)) {
      selectedProviderId.value = providers.value[0]?.id ?? ''
    }
    await refreshProviderAssets()
  } catch (err) {
    ElMessage.error((err as Error).message || 'Failed to load AI configuration.')
  } finally {
    loadingAiConfig.value = false
  }
}

async function refreshProviderAssets() {
  if (!selectedProviderId.value) {
    models.value = []
    apiKeys.value = []
    return
  }

  const [nextModels, nextKeys] = await Promise.all([
    listModels(selectedProviderId.value),
    listKeys(selectedProviderId.value)
  ])
  models.value = nextModels
  apiKeys.value = nextKeys

  const provider = providers.value.find((item) => item.id === selectedProviderId.value)
  if (provider?.defaultEndpoint) {
    aiForm.value.endpoint = provider.defaultEndpoint
  }

  const enabledModels = models.value.filter((item) => item.isEnabled)
  const enabledKeys = apiKeys.value.filter((item) => item.isEnabled)
  if (!enabledModels.some((item) => item.code === selectedModelCode.value)) {
    selectedModelCode.value = enabledModels[0]?.code ?? aiForm.value.model ?? ''
  }
  if (selectedModelCode.value) {
    aiForm.value.model = selectedModelCode.value
  }
  if (!enabledKeys.some((item) => item.id === selectedApiKeyId.value)) {
    selectedApiKeyId.value = ''
  }
}

async function generateDraft() {
  if (!selectedChapter.value) {
    ElMessage.warning('Select or create a chapter first.')
    return
  }
  if (!aiForm.value.endpoint || !aiForm.value.model) {
    ElMessage.warning('Endpoint and model are required.')
    return
  }
  if (useSavedApiKey.value && !selectedProviderId.value) {
    ElMessage.warning('Select a provider first.')
    return
  }
  if (!useSavedApiKey.value && !aiForm.value.apiKey) {
    ElMessage.warning('Enter a temporary API key.')
    return
  }
  if (!promptForm.prompt.trim()) {
    ElMessage.warning('Prompt is required.')
    return
  }

  output.value = ''
  error.value = ''
  status.value = 'starting'
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
      endpoint: aiForm.value.endpoint,
      providerId: useSavedApiKey.value ? selectedProviderId.value : null,
      apiKeyId: useSavedApiKey.value ? (selectedApiKeyId.value || null) : null,
      apiKey: useSavedApiKey.value ? '' : aiForm.value.apiKey,
      model: aiForm.value.model,
      systemPrompt: promptForm.systemPrompt,
      prompt: promptForm.prompt,
      temperature: promptForm.temperature,
      maxTokens: promptForm.maxTokens,
      maxRewriteAttempts: promptForm.maxRewriteAttempts,
      saveToChapter: true
    })
    lastGenerationRecordId.value = result.generationRecordId ?? ''
    selectedChapter.value = await getChapter(selectedChapter.value.id)
    output.value = selectedChapter.value.content ?? ''
    chapters.value = chapters.value.map((item) => (item.id === selectedChapter.value!.id ? selectedChapter.value! : item))
    aiStore.saveToStorage()
    ElMessage.success('Draft generated and saved to the chapter.')
  } catch (err) {
    error.value = (err as Error).message || 'Generation failed.'
    ElMessage.error(error.value)
  } finally {
    generating.value = false
    await chatHub.leaveRun(runId)
    currentRunId.value = ''
  }
}

async function saveDraft() {
  if (!selectedChapter.value) return
  savingContent.value = true
  try {
    selectedChapter.value = await saveChapterContent(selectedChapter.value.id, output.value, 'drafted')
    chapters.value = chapters.value.map((item) => (item.id === selectedChapter.value!.id ? selectedChapter.value! : item))
    ElMessage.success('Draft saved.')
  } catch (err) {
    ElMessage.error((err as Error).message || 'Failed to save draft.')
  } finally {
    savingContent.value = false
  }
}

watch(() => [workContext.selectedProjectId, workContext.selectedVolumeId], refreshChapters)
watch(selectedChapterId, loadSelectedChapter)
watch(selectedProviderId, refreshProviderAssets)
watch(selectedModelCode, (code) => {
  if (code) aiForm.value.model = code
})

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
            <span>Chapters</span>
            <el-button size="small" :icon="Refresh" @click="refreshChapters">Refresh</el-button>
          </div>
        </template>

        <el-empty
          v-if="!workContext.selectedProjectId || !workContext.selectedVolumeId"
          description="Select a project and volume first."
        />

        <template v-else>
          <el-form :model="chapterForm" label-width="96px" size="small" class="create-form">
            <el-form-item label="Chapter No.">
              <el-input-number v-model="chapterForm.chapterNumber" :min="1" controls-position="right" />
            </el-form-item>
            <el-form-item label="Title">
              <el-input v-model="chapterForm.title" placeholder="Chapter title" />
            </el-form-item>
            <el-form-item label="Summary">
              <el-input v-model="chapterForm.summary" type="textarea" :rows="2" placeholder="Chapter goal or summary" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :icon="Plus" :loading="creatingChapter" @click="quickCreateChapter">
                Create Chapter
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
            <el-table-column label="Title" prop="title" min-width="140" />
            <el-table-column label="Status" prop="status" width="100" />
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
            <span>{{ selectedChapter ? `Chapter ${selectedChapter.chapterNumber} / ${selectedChapter.title}` : 'Chapter Draft' }}</span>
            <div class="head-actions">
              <el-tag size="small" type="info">{{ status }}</el-tag>
              <el-tag v-if="lastGenerationRecordId" size="small" type="success">Record {{ lastGenerationRecordId.slice(0, 8) }}</el-tag>
              <el-button size="small" :icon="DocumentChecked" :loading="savingContent" :disabled="!selectedChapter" @click="saveDraft">
                Save Draft
              </el-button>
              <el-button type="primary" size="small" :icon="VideoPlay" :loading="generating" :disabled="!selectedChapter" @click="generateDraft">
                Generate Draft
              </el-button>
            </div>
          </div>
        </template>

        <el-form label-width="110px" class="ai-form" :disabled="generating">
          <div class="ai-source-bar">
            <el-switch
              v-model="useSavedApiKey"
              active-text="Saved key"
              inactive-text="Temporary key"
            />
            <el-button size="small" :icon="Refresh" :loading="loadingAiConfig" @click="refreshAiConfig">
              Refresh AI Config
            </el-button>
          </div>

          <template v-if="useSavedApiKey">
            <el-form-item label="Provider">
              <el-select v-model="selectedProviderId" placeholder="Select provider" filterable>
                <el-option
                  v-for="provider in providers"
                  :key="provider.id"
                  :label="`${provider.name} (${provider.keyCount} keys)`"
                  :value="provider.id"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="API Key">
              <el-select
                v-model="selectedApiKeyId"
                placeholder="Optional explicit key"
                filterable
                clearable
              >
                <el-option
                  v-for="key in apiKeys.filter((item) => item.isEnabled)"
                  :key="key.id"
                  :label="`${key.name}${key.maskedTail ? ` / ${key.maskedTail}` : ''}`"
                  :value="key.id"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="Model">
              <el-select v-model="selectedModelCode" placeholder="Select model" filterable allow-create>
                <el-option
                  v-for="model in models.filter((item) => item.isEnabled)"
                  :key="model.id"
                  :label="`${model.name} (${model.code})`"
                  :value="model.code"
                />
              </el-select>
            </el-form-item>
          </template>

          <template v-else>
            <el-form-item label="API Key">
              <el-input v-model="aiForm.apiKey" type="password" show-password placeholder="sk-..." />
            </el-form-item>
            <el-form-item label="Model">
              <el-input v-model="aiForm.model" placeholder="gpt-4o-mini / deepseek-chat / ..." />
            </el-form-item>
          </template>

          <el-form-item label="Endpoint">
            <el-input v-model="aiForm.endpoint" placeholder="https://api.openai.com/v1" />
          </el-form-item>
          <el-form-item label="System Prompt">
            <el-input v-model="promptForm.systemPrompt" type="textarea" :rows="2" />
          </el-form-item>
          <el-form-item label="Prompt">
            <el-input v-model="promptForm.prompt" type="textarea" :rows="5" />
          </el-form-item>
          <div class="inline-controls">
            <el-form-item label="Temperature">
              <el-input-number v-model="promptForm.temperature" :min="0" :max="2" :step="0.1" />
            </el-form-item>
            <el-form-item label="Max Tokens">
              <el-input-number v-model="promptForm.maxTokens" :min="256" :max="12000" :step="256" />
            </el-form-item>
            <el-form-item label="Max Rewrites">
              <el-input-number v-model="promptForm.maxRewriteAttempts" :min="0" :max="3" :step="1" />
            </el-form-item>
          </div>
        </el-form>

        <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" />
        <el-input
          v-model="output"
          type="textarea"
          :rows="18"
          class="draft-output"
          placeholder="Generated draft content will stream here."
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
