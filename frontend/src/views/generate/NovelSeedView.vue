<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { MagicStick, Notebook, Cpu, DocumentAdd, CollectionTag } from '@element-plus/icons-vue'
import { storeToRefs } from 'pinia'
import { listProviderConfigs, type AiProviderConfig } from '@/api/modules/ai'
import {
  confirmNovelSeedWorkflowStep,
  createNovelSeedWorkflow,
  deleteNovelSeedWorkflow,
  getNovelSeedWorkflow,
  listNovelSeedWorkflows,
  previewNovelSeedWorkflowStep,
  rewriteNovelSeedWorkflowStepFragment,
  runNovelSeedWorkflowStep,
  updateNovelSeedWorkflowRequest,
  type NovelSeedWorkflow,
  type NovelSeedWorkflowPreviewItem,
  type NovelSeedWorkflowStepPreview
} from '@/api/modules/novelSeed'
import { chatHub, type RunEvent } from '@/signalr/chat'
import { useAiTestStore } from '@/stores/aiTest'

const aiStore = useAiTestStore()
const { form: aiForm } = storeToRefs(aiStore)

const configs = ref<AiProviderConfig[]>([])
const selectedConfigId = ref('')
const loadingConfigs = ref(false)
const workflow = ref<NovelSeedWorkflow | null>(null)
const workflows = ref<NovelSeedWorkflow[]>([])
const currentRunId = ref('')
const streamText = ref('')
const streamStatus = ref('idle')
const streamError = ref('')
const runEvents = ref<RunEvent[]>([])
const workflowCreating = ref(false)
const workflowStepRunning = ref('')
const workflowUpdating = ref(false)
const loadingWorkflows = ref(false)
const previewLoading = ref(false)
const previewDrawer = ref(false)
const stepPreview = ref<NovelSeedWorkflowStepPreview | null>(null)
const rewriteDialog = ref(false)
const rewriteLoading = ref(false)
const rewriteTarget = ref<NovelSeedWorkflowPreviewItem | null>(null)
const rewriteInstruction = ref('')
const autoPreviewStepKey = ref('')
const agentPrompt = ref('')
const agentMessages = ref<Array<{ role: 'user' | 'agent'; content: string }>>([])

const form = reactive({
  description: '',
  genre: '',
  tone: '商业化、节奏清晰、可连续生成长篇',
  targetAudience: '网络小说读者',
  volumeCount: 3,
  chaptersPerVolume: 12,
  initialChapterPlanCount: 120,
  estimatedWordsPerChapter: 4000,
  createChapters: false,
  createDesignData: true,
  temperature: 0.7,
  maxTokens: 7000
})

const selectedConfig = computed(() =>
  configs.value.find((item) => item.providerId === selectedConfigId.value) ?? null
)

const totalChapters = computed(() => form.volumeCount * form.chaptersPerVolume)
const estimatedTotalWords = computed(() => totalChapters.value * form.estimatedWordsPerChapter)
const finalizeProgress = computed(() => {
  let current = workflowStepRunning.value === 'finalize' ? 1 : 0
  let total = 5
  for (const event of runEvents.value) {
    const data = event.data as { step?: number; total?: number } | undefined
    if (typeof data?.step === 'number') current = Math.max(current, data.step)
    if (typeof data?.total === 'number') total = Math.max(total, data.total)
  }
  return Math.min(100, Math.round((current / total) * 100))
})
const hasLiveProgress = computed(() => streamText.value || streamError.value || runEvents.value.length > 0 || workflowStepRunning.value === 'finalize')

function stepOutputLength(stepKey: string) {
  const step = findWorkflowStep(stepKey)
  return step?.output?.trim().length ?? 0
}

function nextRunnableStepTitle(stepKey: string) {
  if (!workflow.value) return ''
  const current = workflow.value.steps.find((item) => item.stepKey === stepKey)
  if (!current) return ''
  return workflow.value.steps.find((item) => item.sortOrder > current.sortOrder && item.status !== 'completed')?.title ?? ''
}

async function loadConfigs() {
  loadingConfigs.value = true
  try {
    configs.value = await listProviderConfigs()
    if (!selectedConfigId.value && configs.value.length > 0) {
      selectedConfigId.value = configs.value[0].providerId
      applySelectedConfig()
    }
  } catch (err) {
    ElMessage.error((err as Error).message || '加载 AI 配置失败。')
  } finally {
    loadingConfigs.value = false
  }
}

async function loadWorkflows() {
  loadingWorkflows.value = true
  try {
    workflows.value = await listNovelSeedWorkflows(20)
    if (workflow.value && !workflows.value.some((item) => item.id === workflow.value?.id)) {
      workflow.value = null
    }
  } catch (err) {
    ElMessage.error((err as Error).message || '加载分步工作流失败。')
  } finally {
    loadingWorkflows.value = false
  }
}

function applySelectedConfig() {
  const config = selectedConfig.value
  if (!config) return
  if (config.defaultEndpoint) aiForm.value.endpoint = config.defaultEndpoint
  if (config.modelCode) aiForm.value.model = config.modelCode
}

function validateAgentForm() {
  if (!form.description.trim()) {
    ElMessage.warning('请先输入小说描述。')
    return false
  }
  if (!aiForm.value.endpoint || !aiForm.value.model) {
    ElMessage.warning('请填写 Endpoint 和模型。')
    return false
  }
  if (!selectedConfigId.value && !aiForm.value.apiKey) {
    ElMessage.warning('请选择已保存配置，或填写临时 API Key。')
    return false
  }

  return true
}

async function submit() {
  await startAgent()
}

async function startAgent() {
  if (workflowCreating.value || workflowStepRunning.value) return
  if (!validateAgentForm()) return

  streamText.value = ''
  streamError.value = ''
  streamStatus.value = 'agent'
  workflowCreating.value = true

  try {
    workflow.value = await createNovelSeedWorkflow({
      request: buildNovelSeedRequest(null)
    })
    await loadWorkflows()
    aiStore.saveToStorage()
    ElMessage.success('已启动开书 Agent，正在生成第一步产物。')
    await runWorkflowStep('story', { preview: true })
  } catch (err) {
    ElMessage.error((err as Error).message || '启动开书 Agent 失败。')
  } finally {
    workflowCreating.value = false
  }
}

function buildNovelSeedRequest(runId?: string | null) {
  return {
      runId: runId ?? '',
      description: form.description.trim(),
      genre: form.genre.trim() || null,
      tone: form.tone.trim() || null,
      targetAudience: form.targetAudience.trim() || null,
      volumeCount: form.volumeCount,
      chaptersPerVolume: form.chaptersPerVolume,
      initialChapterPlanCount: form.initialChapterPlanCount,
      estimatedWordsPerChapter: form.estimatedWordsPerChapter,
      createChapters: form.createChapters,
      createDesignData: form.createDesignData,
      configId: selectedConfigId.value || null,
      providerId: selectedConfigId.value || null,
      apiKeyId: null,
      apiKey: aiForm.value.apiKey,
      endpoint: aiForm.value.endpoint,
      model: aiForm.value.model,
      temperature: form.temperature,
      maxTokens: form.maxTokens
    }
}

function syncFormFromWorkflow(item: NovelSeedWorkflow) {
  const request = item.request
  form.description = request.description || ''
  form.genre = request.genre || ''
  form.tone = request.tone || ''
  form.targetAudience = request.targetAudience || ''
  form.volumeCount = request.volumeCount
  form.chaptersPerVolume = request.chaptersPerVolume
  form.initialChapterPlanCount = request.initialChapterPlanCount
  form.estimatedWordsPerChapter = request.estimatedWordsPerChapter
  form.createChapters = request.createChapters
  form.createDesignData = request.createDesignData
  form.temperature = request.temperature ?? form.temperature
  form.maxTokens = request.maxTokens ?? form.maxTokens
  selectedConfigId.value = request.providerId || request.configId || selectedConfigId.value
  if (request.endpoint) aiForm.value.endpoint = request.endpoint
  if (request.model) aiForm.value.model = request.model
}

async function updateWorkflowRequest() {
  if (!workflow.value || workflowUpdating.value) return
  if (!validateAgentForm()) return

  workflowUpdating.value = true
  try {
    workflow.value = await updateNovelSeedWorkflowRequest(workflow.value.id, {
      request: buildNovelSeedRequest(null)
    })
    await loadWorkflows()
    aiStore.saveToStorage()
    ElMessage.success('已更新 Agent 参数，并重置步骤产物。')
  } catch (err) {
    ElMessage.error((err as Error).message || '更新 Agent 参数失败。')
  } finally {
    workflowUpdating.value = false
  }
}

function applyAgentInstruction(text: string) {
  const normalized = text.replace(/\s+/g, '')
  const totalMatch = normalized.match(/(?:总章数|目标章数|生成|写|规划)(\d+)章/)
  if (totalMatch) {
    const total = Math.max(1, Number(totalMatch[1]))
    form.chaptersPerVolume = Math.max(1, Math.ceil(total / Math.max(1, form.volumeCount)))
    form.initialChapterPlanCount = Math.min(500, Math.max(1, total))
  }

  const volumeMatch = normalized.match(/(?:卷数|分成|分为)(\d+)卷/)
  if (volumeMatch) {
    form.volumeCount = Math.min(200, Math.max(1, Number(volumeMatch[1])))
  }

  const chaptersPerVolumeMatch = normalized.match(/(?:每卷|单卷)(\d+)章/)
  if (chaptersPerVolumeMatch) {
    form.chaptersPerVolume = Math.min(500, Math.max(1, Number(chaptersPerVolumeMatch[1])))
  }

  const firstBatchMatch = normalized.match(/(?:首批|先规划|先生成)(\d+)章/)
  if (firstBatchMatch) {
    form.initialChapterPlanCount = Math.min(500, Math.max(1, Number(firstBatchMatch[1])))
  }

  const wordsMatch = normalized.match(/(?:每章|章均)(\d+)(?:字|词)/)
  if (wordsMatch) {
    form.estimatedWordsPerChapter = Math.min(20000, Math.max(1000, Number(wordsMatch[1])))
  }

  const tokenMatch = normalized.match(/(?:tokens|token|规划tokens|规划token)(\d+)/i)
  if (tokenMatch) {
    form.maxTokens = Math.min(30000, Math.max(1500, Number(tokenMatch[1])))
  }

  form.description = `${form.description.trim()}\n\nAgent 追加要求：${text}`.trim()
}

async function submitAgentPrompt() {
  const text = agentPrompt.value.trim()
  if (!text) return
  agentMessages.value.push({ role: 'user', content: text })
  applyAgentInstruction(text)
  agentPrompt.value = ''

  if (workflow.value) {
    await updateWorkflowRequest()
    agentMessages.value.push({
      role: 'agent',
      content: `已更新当前 Agent：目标 ${totalChapters.value} 章，首批规划 ${form.initialChapterPlanCount} 章，章均 ${form.estimatedWordsPerChapter} 字。步骤产物已重置，请重新运行。`
    })
  } else {
    agentMessages.value.push({
      role: 'agent',
      content: `已写入开书要求：目标 ${totalChapters.value} 章，首批规划 ${form.initialChapterPlanCount} 章。点击“启动开书 Agent”开始生成。`
    })
  }
}

async function runWorkflowStep(stepKey: string, options: { preview?: boolean } = {}) {
  if (!workflow.value) return
  workflowStepRunning.value = stepKey
  const runId = workflow.value.request.runId?.trim() || `seed_${workflow.value.id}_${stepKey}`
  currentRunId.value = runId
  streamText.value = ''
  streamError.value = ''
  runEvents.value = []
  streamStatus.value = 'connecting'
  try {
    await chatHub.joinRun(runId)
    await runNovelSeedWorkflowStep(workflow.value.id, stepKey)
    workflow.value = await getNovelSeedWorkflow(workflow.value.id)
    await loadWorkflows()
    const step = workflow.value.steps.find((item) => item.stepKey === stepKey)
    if (step?.output) {
      const nextTitle = nextRunnableStepTitle(stepKey)
      agentMessages.value.push({
        role: 'agent',
        content: stepKey === 'finalize'
          ? `已完成「${step.title}」，正式项目数据已经写入数据库。章节计划、章节蓝图、伏笔账本和时间线已经生成，可以去“叙事追踪”查看伏笔和时间线。`
          : `已自动保存到「${step.title}」步骤产物，当前 ${step.output.trim().length} 字。${nextTitle ? `下一步可以运行「${nextTitle}」。` : '全部步骤已完成，最后运行「落库生成项目」即可创建正式项目数据。'}`
      })
    }
    ElMessage.success(`${step?.title ?? stepKey} 已完成。`)
    if (options.preview || stepKey !== 'finalize') {
      autoPreviewStepKey.value = stepKey
      await openStepPreview(stepKey)
    }
  } catch (err) {
    ElMessage.error((err as Error).message || '运行工作流步骤失败。')
    if (workflow.value) {
      workflow.value = await getNovelSeedWorkflow(workflow.value.id)
      await loadWorkflows()
    }
  } finally {
    workflowStepRunning.value = ''
    if (workflow.value) {
      workflow.value = await getNovelSeedWorkflow(workflow.value.id)
      await loadWorkflows()
    }
    await chatHub.leaveRun(runId)
    currentRunId.value = ''
  }
}

async function confirmWorkflowStep(stepKey: string, confirmed: boolean) {
  if (!workflow.value) return
  try {
    await confirmNovelSeedWorkflowStep(workflow.value.id, stepKey, confirmed)
    workflow.value = await getNovelSeedWorkflow(workflow.value.id)
    await loadWorkflows()
    ElMessage.success(confirmed ? '步骤产物已确认。' : '已取消确认。')
  } catch (err) {
    ElMessage.error((err as Error).message || '确认步骤失败。')
  }
}

function findWorkflowStep(stepKey: string) {
  return workflow.value?.steps.find((item) => item.stepKey === stepKey) ?? null
}

async function toggleWorkflowStepConfirmation(stepKey: string) {
  const step = findWorkflowStep(stepKey)
  if (!step) return
  if (!step.output) {
    ElMessage.warning('当前步骤还没有产物，请先点击“运行”。')
    return
  }
  if (step.status === 'running') {
    ElMessage.warning('当前步骤还在运行中，请等待完成后再确认。')
    return
  }
  await confirmWorkflowStep(stepKey, !step.isConfirmed)
}

async function openStepPreview(stepKey: string) {
  if (!workflow.value) return
  previewLoading.value = true
  previewDrawer.value = true
  try {
    stepPreview.value = await previewNovelSeedWorkflowStep(workflow.value.id, stepKey)
  } catch (err) {
    ElMessage.error((err as Error).message || '加载结构化预览失败。')
  } finally {
    previewLoading.value = false
  }
}

async function previewWorkflowStep(stepKey: string) {
  const step = findWorkflowStep(stepKey)
  if (!step) return
  if (!step.output) {
    ElMessage.warning('当前步骤还没有产物，请先点击“运行”。')
    return
  }
  await openStepPreview(stepKey)
}

function openRewriteDialog(item: NovelSeedWorkflowPreviewItem) {
  rewriteTarget.value = item
  rewriteInstruction.value = ''
  rewriteDialog.value = true
}

async function submitRewriteFragment() {
  if (!workflow.value || !stepPreview.value || !rewriteTarget.value) return
  if (!rewriteInstruction.value.trim()) {
    ElMessage.warning('请输入重写要求。')
    return
  }

  rewriteLoading.value = true
  try {
    await rewriteNovelSeedWorkflowStepFragment(
      workflow.value.id,
      stepPreview.value.stepKey,
      rewriteTarget.value.key,
      rewriteInstruction.value.trim()
    )
    workflow.value = await getNovelSeedWorkflow(workflow.value.id)
    stepPreview.value = await previewNovelSeedWorkflowStep(workflow.value.id, stepPreview.value.stepKey)
    await loadWorkflows()
    rewriteDialog.value = false
    ElMessage.success('片段已重写，步骤确认状态已重置。')
  } catch (err) {
    ElMessage.error((err as Error).message || '重写片段失败。')
  } finally {
    rewriteLoading.value = false
  }
}

async function openWorkflow(item: NovelSeedWorkflow) {
  workflow.value = await getNovelSeedWorkflow(item.id)
  syncFormFromWorkflow(workflow.value)
}

async function removeWorkflow(item: NovelSeedWorkflow) {
  try {
    await deleteNovelSeedWorkflow(item.id)
    if (workflow.value?.id === item.id) workflow.value = null
    await loadWorkflows()
    ElMessage.success('已删除分步开书记录。')
  } catch (err) {
    ElMessage.error((err as Error).message || '删除分步工作流失败。')
  }
}

function onToken(token: string) {
  if (!currentRunId.value) return
  streamText.value += token
}

function onStatus(status: string) {
  if (!currentRunId.value) return
  streamStatus.value = status
}

function onCompleted(reason: string) {
  if (!currentRunId.value) return
  streamStatus.value = `completed (${reason})`
}

function onError(message: string) {
  if (!currentRunId.value) return
  streamError.value = message
  streamStatus.value = 'error'
}

function onRunEvent(event: RunEvent) {
  if (!currentRunId.value) return
  runEvents.value.push(event)
  streamStatus.value = event.message || event.type
}

onMounted(() => {
  chatHub.onToken(onToken)
  chatHub.onStatus(onStatus)
  chatHub.onCompleted(onCompleted)
  chatHub.onError(onError)
  chatHub.onRunEvent(onRunEvent)
  void loadConfigs()
  void loadWorkflows()
})

onBeforeUnmount(async () => {
  chatHub.offToken(onToken)
  chatHub.offStatus(onStatus)
  chatHub.offCompleted(onCompleted)
  chatHub.offError(onError)
  chatHub.offRunEvent(onRunEvent)
  if (currentRunId.value) await chatHub.leaveRun(currentRunId.value)
})
</script>

<template>
  <main class="novel-seed">
    <header class="page-head">
      <div>
        <p class="eyebrow">AI 开书规划</p>
        <h1>用描述生成一整套小说骨架</h1>
        <p class="summary">输入题材和大方向，先创建开书素材、世界观、人物、势力、地点、大纲、卷设计、章节计划和章节蓝图。</p>
      </div>
      <div class="agent-actions">
        <el-button type="primary" :icon="MagicStick" :loading="workflowCreating" @click="startAgent">
          {{ workflowCreating ? 'Agent 启动中' : '启动开书 Agent' }}
        </el-button>
        <el-button :icon="DocumentAdd" :disabled="!workflow" :loading="workflowUpdating" @click="updateWorkflowRequest">
          更新当前 Agent 参数
        </el-button>
      </div>
    </header>

    <section class="seed-grid">
      <div class="panel main-panel">
        <div class="panel-title">
          <el-icon><Notebook /></el-icon>
          <span>小说描述</span>
        </div>
        <el-form label-position="top">
          <el-form-item label="一句话或详细描述">
            <el-input
              v-model="form.description"
              type="textarea"
              :rows="8"
              placeholder="例如：一个被流放的机械祭司，在潮汐都市里追查旧神引擎失控真相，逐步建立自己的地下秩序。"
              @keydown.enter.exact.prevent="submit"
            />
          </el-form-item>
          <div class="form-row">
            <el-form-item label="题材">
              <el-input v-model="form.genre" placeholder="都市异能 / 玄幻 / 科幻悬疑" />
            </el-form-item>
            <el-form-item label="目标读者">
              <el-input v-model="form.targetAudience" />
            </el-form-item>
          </div>
          <el-form-item label="风格">
            <el-input v-model="form.tone" />
          </el-form-item>
        </el-form>
      </div>

      <div class="panel">
        <div class="panel-title">
          <el-icon><CollectionTag /></el-icon>
          <span>规模</span>
        </div>
        <el-form label-position="top">
          <div class="number-grid">
            <el-form-item label="卷数">
              <el-input-number v-model="form.volumeCount" :min="1" :max="200" />
            </el-form-item>
            <el-form-item label="每卷章节">
              <el-input-number v-model="form.chaptersPerVolume" :min="1" :max="500" />
            </el-form-item>
            <el-form-item label="每章字数">
              <el-input-number v-model="form.estimatedWordsPerChapter" :min="1000" :max="20000" :step="500" />
            </el-form-item>
            <el-form-item label="首批章节计划">
              <el-input-number v-model="form.initialChapterPlanCount" :min="0" :max="500" :step="10" />
            </el-form-item>
            <el-form-item label="规划 Tokens">
              <el-input-number v-model="form.maxTokens" :min="1500" :max="30000" :step="500" />
            </el-form-item>
          </div>
          <div class="metrics">
            <div><strong>{{ totalChapters }}</strong><span>章节</span></div>
            <div><strong>{{ estimatedTotalWords.toLocaleString() }}</strong><span>预计字数</span></div>
          </div>
          <el-checkbox v-model="form.createDesignData">创建开书素材与规划数据</el-checkbox>
          <el-checkbox v-model="form.createChapters">同时创建真实章节条目</el-checkbox>
        </el-form>
      </div>

      <div class="panel">
        <div class="panel-title">
          <el-icon><Cpu /></el-icon>
          <span>AI 配置</span>
        </div>
        <el-form label-position="top">
          <el-form-item label="已保存配置">
            <el-select
              v-model="selectedConfigId"
              filterable
              clearable
              :loading="loadingConfigs"
              placeholder="选择配置"
              @change="applySelectedConfig"
            >
              <el-option
                v-for="item in configs"
                :key="item.providerId"
                :label="item.name"
                :value="item.providerId"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="Endpoint">
            <el-input v-model="aiForm.endpoint" placeholder="https://api.openai.com/v1" />
          </el-form-item>
          <el-form-item label="模型">
            <el-input v-model="aiForm.model" placeholder="gpt-4o / deepseek-chat / ..." />
          </el-form-item>
          <el-form-item label="临时 API Key">
            <el-input v-model="aiForm.apiKey" type="password" show-password placeholder="已保存配置可不填" />
          </el-form-item>
          <el-form-item label="温度">
            <el-input-number v-model="form.temperature" :min="0" :max="2" :step="0.1" />
          </el-form-item>
        </el-form>
      </div>
    </section>

    <section class="panel open-book-board">
      <div class="board-head">
        <div class="panel-title">
          <el-icon><DocumentAdd /></el-icon>
          <span>开书 Agent</span>
          <small>{{ workflow?.status ?? '未选择' }}</small>
        </div>
      </div>

      <div class="workflow-layout">
        <aside class="workflow-list" v-loading="loadingWorkflows">
          <button
            v-for="item in workflows"
            :key="item.id"
            type="button"
            class="workflow-list__item"
            :class="{ active: item.id === workflow?.id }"
            @click="openWorkflow(item)"
          >
            <strong>{{ item.request.description || '未命名开书计划' }}</strong>
            <span>{{ item.status }} / {{ new Date(item.createdAt).toLocaleString() }}</span>
          </button>
          <el-empty v-if="!loadingWorkflows && workflows.length === 0" description="还没有开书 Agent 记录。" :image-size="76" />
        </aside>
        <div v-if="workflow" class="workflow-steps">
          <div class="workflow-actions">
            <span>当前 Agent：{{ workflow.id.slice(0, 8) }}</span>
            <div>
              <el-button size="small" :loading="workflowUpdating" @click="updateWorkflowRequest">保存上方参数</el-button>
              <el-button size="small" type="danger" plain @click="removeWorkflow(workflow)">删除记录</el-button>
            </div>
          </div>
          <div class="agent-summary">
            <div><strong>{{ workflow.request.volumeCount * workflow.request.chaptersPerVolume }}</strong><span>目标章数</span></div>
            <div><strong>{{ workflow.request.initialChapterPlanCount }}</strong><span>首批计划</span></div>
            <div><strong>{{ workflow.request.estimatedWordsPerChapter }}</strong><span>章均字数</span></div>
            <div><strong>{{ workflow.request.maxTokens ?? 0 }}</strong><span>规划 Tokens</span></div>
          </div>
          <div class="workflow-save-note">
            <strong>保存方式</strong>
            <span>每步运行完成会自动保存到步骤产物；“伏笔账本与时间线”会单独生成并可预览；最后运行“落库生成项目”才会创建正式项目、素材、章节计划、章节蓝图、伏笔和时间线。</span>
          </div>
          <section class="agent-chat">
            <div class="agent-chat__messages">
              <p v-if="agentMessages.length === 0">可以直接输入：改成 300 章、分成 10 卷、每章 3000 字、首批先规划 50 章。</p>
              <div v-for="(message, index) in agentMessages" :key="index" :class="['agent-chat__message', message.role]">
                {{ message.content }}
              </div>
            </div>
            <div class="agent-chat__input">
              <el-input
                v-model="agentPrompt"
                type="textarea"
                :rows="2"
                placeholder="和开书 Agent 对话：例如“改成 300 章，10 卷，每章 3000 字，主线更偏末世科技爽文”。"
                @keydown.enter.exact.prevent="submitAgentPrompt"
              />
              <el-button type="primary" :loading="workflowUpdating" @click="submitAgentPrompt">发送修改</el-button>
            </div>
          </section>
          <article v-for="step in workflow.steps" :key="step.id" class="workflow-step">
            <div class="workflow-step__head">
              <div>
                <strong>{{ step.title }}</strong>
                <span>{{ step.stepKey }} / {{ step.status }} / {{ step.isConfirmed ? '已确认' : '待确认' }}</span>
                <small v-if="step.output" class="workflow-step__saved">
                  已自动保存 {{ stepOutputLength(step.stepKey) }} 字到步骤产物 · {{ new Date(step.updatedAt).toLocaleString() }}
                </small>
                <small v-else class="workflow-step__saved muted">尚未保存产物，点击运行后会自动写入此步骤。</small>
                <small v-if="step.stepKey === 'finalize'" class="workflow-step__finalize">
                  这一步会把已确认的开书产物写入正式项目数据。
                </small>
                <small v-if="step.stepKey === 'tracking'" class="workflow-step__finalize">
                  这一步会生成伏笔账本和章节时间线，落库后可在“叙事追踪”查看。
                </small>
              </div>
              <div class="workflow-step__actions">
                <el-button
                  size="small"
                  type="success"
                  plain
                  :disabled="step.status === 'running'"
                  @click="toggleWorkflowStepConfirmation(step.stepKey)"
                >
                  {{ step.isConfirmed ? '取消锁定' : '确认并锁定' }}
                </el-button>
                <el-button
                  size="small"
                  plain
                  @click="previewWorkflowStep(step.stepKey)"
                >
                  结构化预览
                </el-button>
                <el-button
                  size="small"
                  type="primary"
                  :loading="workflowStepRunning === step.stepKey"
                  :disabled="workflowStepRunning !== '' || step.status === 'pending'"
                  @click="runWorkflowStep(step.stepKey, { preview: step.stepKey !== 'finalize' })"
                >
                  {{ step.stepKey === 'finalize' ? (step.status === 'completed' ? '重新生成项目数据' : '落库生成项目') : (step.status === 'completed' ? '重新运行' : '运行') }}
                </el-button>
              </div>
            </div>
            <pre v-if="step.output" class="workflow-output">{{ step.output }}</pre>
            <p v-if="step.error" class="workflow-error">{{ step.error }}</p>
          </article>
        </div>
        <el-empty v-else class="workflow-empty" description="选择历史记录，或点击顶部“启动开书 Agent”。" :image-size="86" />
      </div>
    </section>

    <section v-if="hasLiveProgress" class="panel stream-panel">
      <div class="panel-title">
        <el-icon><MagicStick /></el-icon>
        <span>{{ workflowStepRunning === 'finalize' ? '落库执行日志' : 'AI 实时规划' }}</span>
        <small>{{ streamStatus }}</small>
      </div>
      <div v-if="workflowStepRunning === 'finalize' || runEvents.length > 0" class="run-progress">
        <el-progress :percentage="finalizeProgress" :stroke-width="10" striped striped-flow />
        <div class="run-events">
          <div v-for="(event, index) in runEvents" :key="`${event.at}-${index}`" class="run-event">
            <span>{{ new Date(event.at).toLocaleTimeString() }}</span>
            <strong>{{ event.message }}</strong>
            <small>{{ event.type }}</small>
          </div>
          <div v-if="runEvents.length === 0" class="run-event muted">
            <span>等待</span>
            <strong>正在连接落库执行日志...</strong>
            <small>workflow.finalize</small>
          </div>
        </div>
      </div>
      <pre v-if="streamText || (!runEvents.length && workflowStepRunning !== 'finalize')" class="stream-output">{{ streamText || '等待 AI 返回规划 JSON...' }}</pre>
      <p v-if="streamError" class="stream-error">{{ streamError }}</p>
    </section>

    <el-drawer v-model="previewDrawer" title="步骤结构化预览" size="56%">
      <div v-loading="previewLoading" class="step-preview">
        <el-empty v-if="!stepPreview || stepPreview.items.length === 0" description="当前步骤暂无可解析片段。" :image-size="80" />
        <article v-for="item in stepPreview?.items ?? []" :key="item.key" class="preview-item">
          <div class="preview-item__head">
            <div>
              <strong>{{ item.title }}</strong>
              <span>{{ item.key }}</span>
            </div>
            <el-button size="small" type="primary" plain @click="openRewriteDialog(item)">重写片段</el-button>
          </div>
          <p>{{ item.summary || '暂无简介' }}</p>
          <pre>{{ item.rawJson }}</pre>
        </article>
      </div>
    </el-drawer>

    <el-dialog v-model="rewriteDialog" title="重写结构化片段" width="560px">
      <div class="rewrite-box">
        <strong>{{ rewriteTarget?.title }}</strong>
        <p>{{ rewriteTarget?.summary }}</p>
        <el-input
          v-model="rewriteInstruction"
          type="textarea"
          :rows="5"
          placeholder="例如：把这一章改成潜入线更明确，增加沈栀与潮汐财团的直接冲突。"
        />
      </div>
      <template #footer>
        <el-button @click="rewriteDialog = false">取消</el-button>
        <el-button type="primary" :loading="rewriteLoading" @click="submitRewriteFragment">提交重写</el-button>
      </template>
    </el-dialog>
  </main>
</template>

<style scoped>
.novel-seed {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 22px;
}

.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
}

.eyebrow {
  margin: 0 0 6px;
  color: var(--tm-primary);
  font-size: 13px;
  font-weight: 700;
}

h1 {
  margin: 0;
  color: var(--tm-fg);
  font-size: 24px;
  font-weight: 750;
}

.summary {
  max-width: 720px;
  margin: 8px 0 0;
  color: var(--tm-fg-secondary);
  line-height: 1.7;
}

.agent-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

.seed-grid {
  display: grid;
  grid-template-columns: minmax(420px, 1.4fr) minmax(300px, 0.8fr) minmax(320px, 0.9fr);
  gap: 16px;
}

.panel {
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface);
  padding: 18px;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  color: var(--tm-fg);
  font-size: 16px;
  font-weight: 700;
}

.panel-title small {
  margin-left: auto;
  color: var(--tm-fg-secondary);
  font-size: 12px;
  font-weight: 500;
}

.board-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.board-head .panel-title {
  margin-bottom: 0;
}

.workflow-layout {
  display: grid;
  grid-template-columns: minmax(260px, 360px) minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}

.workflow-list {
  display: grid;
  align-content: start;
  gap: 8px;
  min-height: 120px;
  min-width: 0;
}

.workflow-list__item {
  width: 100%;
  min-width: 0;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-bg);
  color: var(--tm-fg);
  padding: 10px;
  text-align: left;
  cursor: pointer;
}

.workflow-list__item.active {
  border-color: var(--tm-primary);
  background: color-mix(in srgb, var(--tm-primary) 8%, var(--tm-bg));
}

.workflow-list__item strong,
.workflow-list__item span {
  display: block;
  max-width: 100%;
  min-width: 0;
}

.workflow-list__item strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workflow-list__item span {
  margin-top: 5px;
  color: var(--tm-fg-secondary);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workflow-steps {
  display: grid;
  gap: 10px;
  min-width: 0;
}

.workflow-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--tm-fg-secondary);
  font-size: 12px;
  min-width: 0;
}

.workflow-actions span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workflow-actions > div {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  flex-shrink: 0;
}

.agent-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.agent-summary div {
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-bg);
  padding: 10px;
}

.agent-summary strong,
.agent-summary span {
  display: block;
}

.agent-summary strong {
  color: var(--tm-fg);
  font-size: 18px;
}

.agent-summary span {
  margin-top: 4px;
  color: var(--tm-fg-secondary);
  font-size: 12px;
}

.agent-chat {
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-bg);
  padding: 12px;
}

.agent-chat__messages {
  display: grid;
  gap: 8px;
  max-height: 160px;
  overflow: auto;
  margin-bottom: 10px;
}

.agent-chat__messages p {
  margin: 0;
  color: var(--tm-fg-secondary);
  font-size: 13px;
  line-height: 1.7;
}

.agent-chat__message {
  border-radius: 8px;
  padding: 9px 10px;
  font-size: 13px;
  line-height: 1.6;
  word-break: break-word;
}

.agent-chat__message.user {
  justify-self: end;
  max-width: 86%;
  background: color-mix(in srgb, var(--tm-primary) 12%, var(--tm-bg));
  color: var(--tm-fg);
}

.agent-chat__message.agent {
  justify-self: start;
  max-width: 92%;
  background: var(--tm-surface);
  color: var(--tm-fg-secondary);
}

.agent-chat__input {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: stretch;
}

.agent-chat__input .el-button {
  height: auto;
}

.workflow-empty {
  min-height: 160px;
}

.workflow-save-note {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--el-color-primary) 28%, var(--tm-border));
  border-radius: 8px;
  background: color-mix(in srgb, var(--el-color-primary) 8%, var(--tm-bg));
  color: var(--tm-fg-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.workflow-save-note strong {
  flex-shrink: 0;
  color: var(--tm-fg);
}

.workflow-save-note span {
  min-width: 0;
}

.workflow-step {
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-bg);
  padding: 12px;
}

.workflow-step__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.workflow-step__head > div:first-child {
  min-width: 0;
}

.workflow-step__head strong,
.workflow-step__head span {
  display: block;
  max-width: 100%;
}

.workflow-step__head span {
  margin-top: 4px;
  color: var(--tm-fg-secondary);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workflow-step__saved {
  display: block;
  margin-top: 6px;
  color: var(--el-color-success);
  font-size: 12px;
  line-height: 1.5;
}

.workflow-step__saved.muted {
  color: var(--tm-fg-secondary);
}

.workflow-step__finalize {
  display: block;
  margin-top: 4px;
  color: var(--el-color-warning);
  font-size: 12px;
  line-height: 1.5;
}

.workflow-step__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  flex-shrink: 0;
}

.workflow-output {
  max-height: 220px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 10px 0 0;
  border-radius: 6px;
  background: var(--tm-surface);
  color: var(--tm-fg);
  padding: 10px;
  font-size: 12px;
  line-height: 1.7;
}

.workflow-error {
  color: var(--el-color-danger);
  margin: 8px 0 0;
}

.open-book-board {
  padding-bottom: 16px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.number-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin: 6px 0 14px;
}

.metrics div {
  border: 1px solid var(--tm-border);
  border-radius: 6px;
  padding: 12px;
  background: var(--tm-bg);
}

.metrics strong {
  display: block;
  color: var(--tm-fg);
  font-size: 20px;
}

.metrics span {
  color: var(--tm-fg-secondary);
  font-size: 12px;
}

.stream-panel small {
  color: var(--tm-fg-secondary);
  font-size: 12px;
  font-weight: 500;
}

.stream-output {
  max-height: 320px;
  margin: 0;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  border: 1px solid var(--tm-border);
  border-radius: 6px;
  background: var(--tm-bg);
  color: var(--tm-fg);
  padding: 12px;
  font-size: 13px;
  line-height: 1.7;
}

.run-progress {
  display: grid;
  gap: 12px;
}

.run-events {
  display: grid;
  gap: 8px;
  max-height: 260px;
  overflow: auto;
  border: 1px solid var(--tm-border);
  border-radius: 6px;
  background: var(--tm-bg);
  padding: 10px;
}

.run-event {
  display: grid;
  grid-template-columns: 86px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  min-width: 0;
  border-radius: 6px;
  background: var(--tm-surface);
  padding: 8px 10px;
  color: var(--tm-fg);
  font-size: 13px;
}

.run-event span,
.run-event small {
  color: var(--tm-fg-secondary);
  font-size: 12px;
}

.run-event strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.run-event.muted {
  color: var(--tm-fg-secondary);
}

.stream-error {
  margin: 10px 0 0;
  color: var(--tm-danger, #d03050);
}

.step-preview {
  display: grid;
  gap: 12px;
}

.preview-item {
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-bg);
  padding: 12px;
}

.preview-item__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.preview-item__head strong,
.preview-item__head span {
  display: block;
}

.preview-item__head span,
.preview-item p {
  color: var(--tm-fg-secondary);
  font-size: 12px;
}

.preview-item p {
  line-height: 1.6;
}

.preview-item pre {
  max-height: 220px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  border-radius: 6px;
  background: var(--tm-surface);
  padding: 10px;
  color: var(--tm-fg);
}

.rewrite-box {
  display: grid;
  gap: 10px;
}

.rewrite-box p {
  margin: 0;
  color: var(--tm-fg-secondary);
  line-height: 1.6;
}

@media (max-width: 1200px) {
  .board-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .agent-actions {
    width: 100%;
    justify-content: stretch;
  }

  .agent-actions .el-button {
    flex: 1;
  }

  .workflow-layout,
  .seed-grid {
    grid-template-columns: 1fr;
  }

  .agent-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .agent-chat__input {
    grid-template-columns: 1fr;
  }

  .run-event {
    grid-template-columns: 1fr;
    gap: 4px;
  }

  .run-event strong {
    white-space: normal;
  }

}
</style>
