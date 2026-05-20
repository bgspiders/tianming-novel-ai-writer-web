<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Refresh, Delete, VideoPlay, DocumentChecked } from '@element-plus/icons-vue'
import { storeToRefs } from 'pinia'
import { useWorkContextStore } from '@/stores/workContext'
import { useAiTestStore } from '@/stores/aiTest'
import { chatHub } from '@/signalr/chat'
import {
  listKeys,
  listModels,
  listProviders,
  type AiApiKey,
  type AiModel,
  type AiProvider
} from '@/api/modules/ai'
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
  systemPrompt: '你是专业网文作者,请严格按章节目标输出中文小说正文,不要解释创作过程。',
  prompt: '',
  temperature: 0.8,
  maxTokens: 4096,
  maxRewriteAttempts: 2
})

const canUseWorkspace = computed(() => !!workContext.selectedProjectId && !!workContext.selectedVolumeId)
const selectedProvider = computed(() => providers.value.find((p) => p.id === selectedProviderId.value) ?? null)
const enabledModels = computed(() => models.value.filter((m) => m.isEnabled))
const enabledApiKeys = computed(() => apiKeys.value.filter((k) => k.isEnabled))

function onToken(token: string) {
  output.value += token
}
function onStatus(s: string) {
  status.value = s
}
function onCompleted(reason: string) {
  status.value = `completed (${reason})`
}
function onError(msg: string) {
  error.value = msg
  status.value = 'error'
}

async function refreshChapters() {
  if (!canUseWorkspace.value) {
    chapters.value = []
    selectedChapterId.value = ''
    selectedChapter.value = null
    return
  }
  loadingChapters.value = true
  try {
    chapters.value = await listChapters(workContext.selectedProjectId, workContext.selectedVolumeId)
    if (!chapters.value.some((c) => c.id === selectedChapterId.value)) {
      selectedChapterId.value = chapters.value[0]?.id ?? ''
    }
    await loadSelectedChapter()
  } catch (err) {
    ElMessage.error((err as Error).message ?? '加载章节失败')
  } finally {
    loadingChapters.value = false
  }
}

async function refreshAiConfig() {
  loadingAiConfig.value = true
  try {
    providers.value = (await listProviders()).filter((p) => p.isEnabled)
    const previousProviderId = selectedProviderId.value
    if (!providers.value.some((p) => p.id === selectedProviderId.value)) {
      selectedProviderId.value = providers.value[0]?.id ?? ''
    }
    if (previousProviderId === selectedProviderId.value) {
      await refreshProviderAssets()
    }
  } catch (err) {
    ElMessage.error((err as Error).message ?? '加载 AI 配置失败')
  } finally {
    loadingAiConfig.value = false
  }
}

async function refreshProviderAssets() {
  if (!selectedProviderId.value) {
    models.value = []
    apiKeys.value = []
    selectedModelCode.value = ''
    selectedApiKeyId.value = ''
    return
  }

  const [nextModels, nextKeys] = await Promise.all([
    listModels(selectedProviderId.value),
    listKeys(selectedProviderId.value)
  ])
  models.value = nextModels
  apiKeys.value = nextKeys

  const provider = selectedProvider.value
  if (provider?.defaultEndpoint) {
    aiForm.value.endpoint = provider.defaultEndpoint
  }

  if (!enabledModels.value.some((m) => m.code === selectedModelCode.value)) {
    selectedModelCode.value = enabledModels.value[0]?.code ?? aiForm.value.model ?? ''
  }
  if (selectedModelCode.value) {
    aiForm.value.model = selectedModelCode.value
  }

  if (!enabledApiKeys.value.some((k) => k.id === selectedApiKeyId.value)) {
    selectedApiKeyId.value = ''
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
    ElMessage.error((err as Error).message ?? '加载章节详情失败')
  }
}

function resetChapterForm() {
  chapterForm.chapterNumber = (chapters.value.at(-1)?.chapterNumber ?? 0) + 1
  chapterForm.title = ''
  chapterForm.summary = ''
}

async function quickCreateChapter() {
  if (!canUseWorkspace.value) {
    ElMessage.warning('请先选择 Project 和 Volume')
    return
  }
  if (!chapterForm.title.trim()) {
    ElMessage.warning('章节标题必填')
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
    ElMessage.success('章节已创建')
  } catch (err) {
    ElMessage.error((err as Error).message ?? '创建章节失败')
  } finally {
    creatingChapter.value = false
  }
}

async function removeChapter(row: Chapter) {
  try {
    await ElMessageBox.confirm(`删除第 ${row.chapterNumber} 章「${row.title}」?`, '确认', { type: 'warning' })
  } catch { return }

  try {
    await deleteChapter(row.id)
    ElMessage.success('已删除')
    await refreshChapters()
  } catch (err) {
    ElMessage.error((err as Error).message ?? '删除章节失败')
  }
}

function buildPromptFromChapter() {
  const ch = selectedChapter.value
  const volume = workContext.selectedVolume
  if (!ch) return

  promptForm.prompt = [
    `项目: ${workContext.selectedProject?.name ?? ch.projectId}`,
    `分卷: ${volume ? `第 ${volume.volumeNumber} 卷《${volume.title}》` : ch.volumeId}`,
    `章节: 第 ${ch.chapterNumber} 章《${ch.title}》`,
    ch.summary ? `章节目标/摘要: ${ch.summary}` : '',
    '',
    '请直接输出本章正文,保持连贯叙事、人物行动清晰、场景可读。'
  ].filter(Boolean).join('\n')
}

async function generateDraft() {
  if (!selectedChapter.value) {
    ElMessage.warning('请先选择或创建章节')
    return
  }
  if (!aiForm.value.endpoint || !aiForm.value.model) {
    ElMessage.warning('请填写 Endpoint / Model')
    return
  }
  if (useSavedApiKey.value && !selectedProviderId.value) {
    ElMessage.warning('请选择 Provider')
    return
  }
  if (!useSavedApiKey.value && !aiForm.value.apiKey) {
    ElMessage.warning('请填写临时 API Key')
    return
  }
  if (!promptForm.prompt.trim()) {
    ElMessage.warning('请填写生成提示词')
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
      projectId: workContext.selectedProjectId,
      volumeId: workContext.selectedVolumeId,
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
    chapters.value = chapters.value.map((c) => c.id === selectedChapter.value!.id ? selectedChapter.value! : c)
    ElMessage.success('草稿已生成并由服务端保存')
    aiStore.saveToStorage()
  } catch (err) {
    error.value = (err as Error).message ?? '生成失败'
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
    chapters.value = chapters.value.map((c) => c.id === selectedChapter.value!.id ? selectedChapter.value! : c)
    ElMessage.success('草稿已保存')
  } catch (err) {
    ElMessage.error((err as Error).message ?? '保存草稿失败')
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
            <span>章节</span>
            <el-button size="small" :icon="Refresh" @click="refreshChapters">刷新</el-button>
          </div>
        </template>

        <el-empty v-if="!canUseWorkspace" description="请先在顶栏选择 Project 和 Volume" />

        <template v-else>
          <el-form :model="chapterForm" label-width="72px" size="small" class="create-form">
            <el-form-item label="章节号">
              <el-input-number v-model="chapterForm.chapterNumber" :min="1" controls-position="right" />
            </el-form-item>
            <el-form-item label="标题">
              <el-input v-model="chapterForm.title" placeholder="章节标题" />
            </el-form-item>
            <el-form-item label="目标">
              <el-input v-model="chapterForm.summary" type="textarea" :rows="2" placeholder="本章目标/摘要" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :icon="Plus" :loading="creatingChapter" @click="quickCreateChapter">
                新建章节
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
            <el-table-column label="标题" prop="title" min-width="140" />
            <el-table-column label="状态" prop="status" width="86" />
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
            <span>{{ selectedChapter ? `第 ${selectedChapter.chapterNumber} 章 · ${selectedChapter.title}` : '章节草稿' }}</span>
            <div class="head-actions">
              <el-tag size="small" type="info">{{ status }}</el-tag>
              <el-tag v-if="lastGenerationRecordId" size="small" type="success">记录 {{ lastGenerationRecordId.slice(0, 8) }}</el-tag>
              <el-button size="small" :icon="DocumentChecked" :loading="savingContent" :disabled="!selectedChapter" @click="saveDraft">
                保存草稿
              </el-button>
              <el-button type="primary" size="small" :icon="VideoPlay" :loading="generating" :disabled="!selectedChapter" @click="generateDraft">
                生成草稿
              </el-button>
            </div>
          </div>
        </template>

        <el-form label-width="96px" class="ai-form" :disabled="generating">
          <div class="ai-source-bar">
            <el-switch
              v-model="useSavedApiKey"
              active-text="使用已保存 Key"
              inactive-text="临时 Key"
            />
            <el-button size="small" :icon="Refresh" :loading="loadingAiConfig" @click="refreshAiConfig">
              刷新 AI 配置
            </el-button>
          </div>

          <template v-if="useSavedApiKey">
            <el-form-item label="Provider">
              <el-select v-model="selectedProviderId" placeholder="选择 Provider" filterable>
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
                placeholder="留空则按 Provider 自动轮换"
                filterable
                clearable
              >
                <el-option
                  v-for="key in enabledApiKeys"
                  :key="key.id"
                  :label="`${key.name}${key.maskedTail ? ` · ${key.maskedTail}` : ''}`"
                  :value="key.id"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="Model">
              <el-select v-model="selectedModelCode" placeholder="选择模型" filterable allow-create>
                <el-option
                  v-for="model in enabledModels"
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
          <el-form-item label="System">
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
            <el-form-item label="门禁重写">
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
          placeholder="生成内容会流式出现在这里,也可以手动编辑后保存。"
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
