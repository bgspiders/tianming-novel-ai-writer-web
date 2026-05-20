<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ChatLineRound, Delete, Plus, Promotion, Refresh } from '@element-plus/icons-vue'
import { useWorkContextStore } from '@/stores/workContext'
import { chatHub, type RunEvent } from '@/signalr/chat'
import {
  createChatSession,
  deleteChatSession,
  executeChatPlan,
  listChatMessages,
  listChatSessions,
  sendChatMessage,
  updateChatSession,
  type ChatToolPayload,
  type ChatMessage,
  type ChatMode,
  type ExecutionTraceSummaryPayload,
  type ChatSession,
  type ToolCallRecordPayload,
  type ToolCallStatus
} from '@/api/modules/chatAssistant'
import { listKeys, listModels, listProviders, type AiApiKey, type AiModel, type AiProvider } from '@/api/modules/ai'

const workContext = useWorkContextStore()

const sessions = ref<ChatSession[]>([])
const messages = ref<ChatMessage[]>([])
const selectedSessionId = ref('')
const providers = ref<AiProvider[]>([])
const models = ref<AiModel[]>([])
const keys = ref<AiApiKey[]>([])
const selectedProviderId = ref('')
const selectedModel = ref('')
const selectedKeyId = ref('')
const endpoint = ref('')
const tempKey = ref('')
const useSavedKey = ref(true)
const mode = ref<ChatMode>('agent')
const input = ref('')
const streamingRaw = ref('')
const streamingText = ref('')
const streamingThinking = ref('')
const errorMessage = ref('')
const status = ref('idle')
const loading = ref(false)
const sending = ref(false)
const savingSession = ref(false)
const executingMessageId = ref('')
const currentRunId = ref('')
const titleDraft = ref('')
const runEvents = ref<RunEvent[]>([])

interface ToolCallDisplay extends ToolCallRecordPayload {
  key: string
  fallbackTitle?: string
}

const selectedSession = computed(() => sessions.value.find((s) => s.id === selectedSessionId.value) ?? null)
const enabledModels = computed(() => models.value.filter((m) => m.isEnabled))
const enabledKeys = computed(() => keys.value.filter((k) => k.isEnabled))
const liveToolCalls = computed(() => {
  return runEvents.value.flatMap((event, eventIndex) => toolCallsFromRunEvent(event, eventIndex))
})
const liveTraceSummary = computed(() => {
  for (let index = runEvents.value.length - 1; index >= 0; index -= 1) {
    const summary = traceSummaryFromRunEvent(runEvents.value[index])
    if (summary) return summary
  }
  return summarizeToolCalls(liveToolCalls.value)
})
const hasLiveExecutionEvents = computed(() => runEvents.value.some((event) => isToolRunEvent(event)))
const visibleMessages = computed(() => {
  const rows = [...messages.value]
  if (streamingText.value) {
    rows.push({
      id: 'streaming',
      chatSessionId: selectedSessionId.value,
      role: 'assistant',
      content: streamingText.value,
      summary: streamingText.value,
      thinkingContent: streamingThinking.value || null,
      analysisBlocksJson: null,
      toolPayload: null,
      inputTokens: null,
      outputTokens: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
  }
  return rows
})

function modeLabel(value: string) {
  if (value === 'plan') return 'Plan'
  if (value === 'edit') return 'Edit'
  return 'Agent'
}

function formatTime(value: string) {
  return value ? new Date(value).toLocaleString() : '-'
}

function formatEventTime(value: string) {
  return value ? new Date(value).toLocaleTimeString() : ''
}

function parseToolPayload(value?: string | null) {
  if (!value) return null
  try {
    return JSON.parse(value) as ChatToolPayload
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function fieldValue(record: Record<string, unknown>, camel: string, pascal: string) {
  return record[camel] ?? record[pascal]
}

function asNullableString(value: unknown) {
  if (value == null) return null
  return typeof value === 'string' ? value : String(value)
}

function asNullableNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function asNullableStringList(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => asNullableString(item)).filter((item): item is string => !!item)
    : null
}

function statusFromRunEventType(type: string): ToolCallStatus | null {
  if (type === 'tool.started') return 'running'
  if (type === 'tool.completed') return 'completed'
  if (type === 'tool.failed') return 'failed'
  if (type === 'tool.cancelled') return 'cancelled'
  return null
}

function isToolRunEvent(event: RunEvent) {
  return statusFromRunEventType(event.type) !== null
}

function normalizeToolCall(
  value: unknown,
  key: string,
  fallbackTitle?: string,
  fallbackStatus?: ToolCallStatus | null
): ToolCallDisplay | null {
  if (!isRecord(value)) return null
  const hasToolFields = [
    ['stepIndex', 'StepIndex'],
    ['pluginName', 'PluginName'],
    ['functionName', 'FunctionName'],
    ['title', 'Title'],
    ['description', 'Description'],
    ['arguments', 'Arguments'],
    ['result', 'Result'],
    ['status', 'Status'],
    ['errorMessage', 'ErrorMessage'],
    ['durationSeconds', 'DurationSeconds'],
    ['durationMs', 'DurationMs']
  ].some(([camel, pascal]) => camel in value || pascal in value)
  if (!hasToolFields) return null

  return {
    stepIndex: asNullableNumber(fieldValue(value, 'stepIndex', 'StepIndex')),
    pluginName: asNullableString(fieldValue(value, 'pluginName', 'PluginName')),
    functionName: asNullableString(fieldValue(value, 'functionName', 'FunctionName')),
    title: asNullableString(fieldValue(value, 'title', 'Title')),
    description: asNullableString(fieldValue(value, 'description', 'Description')),
    arguments: fieldValue(value, 'arguments', 'Arguments') as ToolCallRecordPayload['arguments'],
    result: fieldValue(value, 'result', 'Result') as ToolCallRecordPayload['result'],
    status: (asNullableString(fieldValue(value, 'status', 'Status')) as ToolCallStatus | null) ?? fallbackStatus ?? null,
    startTime: asNullableString(fieldValue(value, 'startTime', 'StartTime')),
    endTime: asNullableString(fieldValue(value, 'endTime', 'EndTime')),
    durationSeconds: asNullableNumber(fieldValue(value, 'durationSeconds', 'DurationSeconds')),
    durationMs: asNullableNumber(fieldValue(value, 'durationMs', 'DurationMs')),
    errorMessage: asNullableString(fieldValue(value, 'errorMessage', 'ErrorMessage')),
    key,
    fallbackTitle
  }
}

function payloadToolCalls(message: ChatMessage) {
  const payload = parseToolPayload(message.toolPayload)
  const calls = [
    ...(payload?.executionTrace ?? []),
    ...(payload?.toolCalls ?? [])
  ]
  return calls
    .map((call, index) => normalizeToolCall(call, `${message.id}-tool-${index}`))
    .filter((call): call is ToolCallDisplay => !!call)
}

function payloadTraceSummary(message: ChatMessage) {
  return parseToolPayload(message.toolPayload)?.executionTraceSummary ?? null
}

function toolCallsFromRunEvent(event: RunEvent, eventIndex: number): ToolCallDisplay[] {
  const data = event.data
  const fallbackStatus = statusFromRunEventType(event.type)
  if (!isRecord(data)) return []

  const values: unknown[] = []
  for (const field of ['executionTrace', 'ExecutionTrace', 'toolCalls', 'ToolCalls']) {
    const value = data[field]
    if (Array.isArray(value)) values.push(...value)
  }
  for (const field of ['toolCall', 'ToolCall', 'call', 'Call', 'record', 'Record']) {
    if (isRecord(data[field])) values.push(data[field])
  }
  if (values.length === 0) values.push(data)

  return values
    .map((value, index) => normalizeToolCall(value, `run-${eventIndex}-tool-${index}`, event.message, fallbackStatus))
    .filter((call): call is ToolCallDisplay => !!call)
}

function normalizeTraceSummary(value: unknown): ExecutionTraceSummaryPayload | null {
  if (!isRecord(value)) return null
  const totalSteps = asNullableNumber(fieldValue(value, 'totalSteps', 'TotalSteps'))
  const completedSteps = asNullableNumber(fieldValue(value, 'completedSteps', 'CompletedSteps'))
  const failedSteps = asNullableNumber(fieldValue(value, 'failedSteps', 'FailedSteps'))
  const totalDurationSeconds = asNullableNumber(fieldValue(value, 'totalDurationSeconds', 'TotalDurationSeconds'))
  const summaryText = asNullableString(fieldValue(value, 'summaryText', 'SummaryText'))
  const failedStepSummaries = asNullableStringList(fieldValue(value, 'failedStepSummaries', 'FailedStepSummaries'))
  if (
    totalSteps == null &&
    completedSteps == null &&
    failedSteps == null &&
    totalDurationSeconds == null &&
    !summaryText &&
    !failedStepSummaries?.length
  ) {
    return null
  }
  return {
    totalSteps,
    completedSteps,
    failedSteps,
    totalDurationSeconds,
    failedStepSummaries,
    summaryText
  }
}

function traceSummaryFromRunEvent(event: RunEvent) {
  const data = event.data
  if (!isRecord(data)) return null
  return normalizeTraceSummary(data.executionTraceSummary ?? data.ExecutionTraceSummary ?? data.summary ?? data.Summary ?? data)
}

function summarizeToolCalls(calls: ToolCallDisplay[]): ExecutionTraceSummaryPayload | null {
  if (calls.length === 0) return null
  const completedSteps = calls.filter((call) => call.status === 'completed').length
  const failedSteps = calls.filter((call) => call.status === 'failed').length
  const failedStepSummaries = calls
    .filter((call) => call.status === 'failed')
    .map((call) => call.errorMessage || call.title || toolCallName(call))
  const totalDurationSeconds = calls.reduce((total, call) => {
    if (typeof call.durationSeconds === 'number') return total + call.durationSeconds
    if (typeof call.durationMs === 'number') return total + call.durationMs / 1000
    return total
  }, 0)
  return {
    totalSteps: calls.length,
    completedSteps,
    failedSteps,
    totalDurationSeconds: totalDurationSeconds > 0 ? totalDurationSeconds : null,
    failedStepSummaries: failedStepSummaries.length > 0 ? failedStepSummaries : null
  }
}

function planSteps(message: ChatMessage) {
  const payload = parseToolPayload(message.toolPayload)
  return payload?.type === 'plan' ? payload.steps ?? [] : []
}

function thinkingBlocks(message: ChatMessage) {
  if (message.analysisBlocksJson) {
    try {
      return JSON.parse(message.analysisBlocksJson) as NonNullable<ChatToolPayload['thinkingBlocks']>
    } catch {
      return []
    }
  }
  return parseToolPayload(message.toolPayload)?.thinkingBlocks ?? []
}

function payloadMeta(message: ChatMessage) {
  return parseToolPayload(message.toolPayload)
}

function canExecutePlan(message: ChatMessage) {
  const payload = payloadMeta(message)
  return message.role === 'assistant' && payload?.type === 'plan' && payload.requiresExecutionEngine === true
}

function toolCallStatusLabel(status?: ToolCallStatus | null) {
  if (status === 'pending') return '等待'
  if (status === 'running') return '运行中'
  if (status === 'completed') return '完成'
  if (status === 'failed') return '失败'
  if (status === 'cancelled') return '已取消'
  return status || '未知'
}

function toolCallStatusTag(status?: ToolCallStatus | null) {
  if (status === 'completed') return 'success'
  if (status === 'failed') return 'danger'
  if (status === 'running') return 'warning'
  if (status === 'cancelled') return 'info'
  return ''
}

function toolCallName(call: ToolCallRecordPayload) {
  const plugin = call.pluginName?.trim()
  const fn = call.functionName?.trim()
  if (plugin && fn) return `${plugin}.${fn}`
  return plugin || fn || call.title || '工具调用'
}

function formatToolValue(value: ToolCallRecordPayload['arguments'] | ToolCallRecordPayload['result']) {
  if (value == null || value === '') return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function formatToolDuration(call: ToolCallRecordPayload) {
  if (typeof call.durationSeconds === 'number') {
    return `${call.durationSeconds.toFixed(call.durationSeconds >= 10 ? 1 : 2)}s`
  }
  if (typeof call.durationMs === 'number') {
    return `${Math.round(call.durationMs)}ms`
  }
  if (call.startTime && call.endTime) {
    const elapsed = new Date(call.endTime).getTime() - new Date(call.startTime).getTime()
    if (Number.isFinite(elapsed) && elapsed >= 0) return `${elapsed}ms`
  }
  return ''
}

function formatTraceSummary(summary?: ExecutionTraceSummaryPayload | null) {
  if (!summary) return ''
  if (summary.summaryText) return summary.summaryText
  const parts: string[] = []
  if (typeof summary.totalSteps === 'number') parts.push(`共 ${summary.totalSteps} 步`)
  if (typeof summary.completedSteps === 'number') parts.push(`${summary.completedSteps} 完成`)
  if (typeof summary.failedSteps === 'number' && summary.failedSteps > 0) parts.push(`${summary.failedSteps} 失败`)
  if (typeof summary.totalDurationSeconds === 'number' && summary.totalDurationSeconds > 0) {
    parts.push(`耗时 ${summary.totalDurationSeconds.toFixed(1)}s`)
  }
  return parts.join(' · ')
}

function shouldShowRawContent(message: ChatMessage) {
  return !payloadMeta(message)?.hideRawContentInBubble
}

function normalizationLabel(value?: string | null) {
  if (value === 'singleChapterMerged') return '单章合并'
  if (value === 'chapterRangeSplit') return '章节范围拆分'
  if (value === 'multiChapterPreserved') return '多章保留'
  return value || ''
}

function directiveLabel(kind?: string) {
  if (kind === 'continue') return '续写'
  if (kind === 'rewrite') return '重写'
  return kind || '指令'
}

function targetPanelLabel(value?: string | null) {
  if (value === 'ExecutionPlan') return '执行计划'
  if (value === 'ExecutionPanel') return '执行面板'
  return value || ''
}

function splitStreaming(raw: string) {
  const pairs = [
    ['<thinking>', '</thinking>'],
    ['<think>', '</think>'],
    ['【思考】', '【/思考】'],
    ['[thinking]', '[/thinking]']
  ]
  for (const [open, close] of pairs) {
    const start = raw.toLowerCase().indexOf(open.toLowerCase())
    const end = raw.toLowerCase().indexOf(close.toLowerCase())
    if (start >= 0 && end > start) {
      return {
        content: (raw.slice(0, start) + raw.slice(end + close.length)).trim(),
        thinking: raw.slice(start + open.length, end).trim()
      }
    }
  }
  return { content: raw, thinking: '' }
}

async function refreshSessions() {
  loading.value = true
  try {
    sessions.value = await listChatSessions(workContext.selectedProjectId || null)
    if (!sessions.value.some((s) => s.id === selectedSessionId.value)) {
      selectedSessionId.value = sessions.value[0]?.id ?? ''
    }
    await refreshMessages()
  } catch (err) {
    ElMessage.error((err as Error).message || '加载会话失败')
  } finally {
    loading.value = false
  }
}

async function refreshMessages() {
  if (!selectedSessionId.value) {
    messages.value = []
    return
  }
  messages.value = await listChatMessages(selectedSessionId.value)
}

async function createSession(nextMode: ChatMode = mode.value) {
  try {
    const session = await createChatSession({
      projectId: workContext.selectedProjectId || null,
      mode: nextMode,
      providerId: selectedProviderId.value || null,
      modelCode: selectedModel.value || null
    })
    sessions.value = [session, ...sessions.value]
    selectedSessionId.value = session.id
    mode.value = session.mode
    messages.value = []
  } catch (err) {
    ElMessage.error((err as Error).message || '创建会话失败')
  }
}

async function saveSessionSettings() {
  if (!selectedSessionId.value) return
  savingSession.value = true
  try {
    const updated = await updateChatSession(selectedSessionId.value, {
      title: titleDraft.value.trim() || selectedSession.value?.title || null,
      mode: mode.value,
      providerId: selectedProviderId.value || null,
      modelCode: selectedModel.value || null
    })
    sessions.value = sessions.value.map((s) => s.id === updated.id ? updated : s)
    ElMessage.success('会话设置已保存')
  } catch (err) {
    ElMessage.error((err as Error).message || '保存会话设置失败')
  } finally {
    savingSession.value = false
  }
}

async function removeSession(session: ChatSession) {
  try {
    await ElMessageBox.confirm(`删除会话「${session.title}」?`, '确认', { type: 'warning' })
  } catch { return }

  try {
    await deleteChatSession(session.id)
    sessions.value = sessions.value.filter((s) => s.id !== session.id)
    if (selectedSessionId.value === session.id) {
      selectedSessionId.value = sessions.value[0]?.id ?? ''
      await refreshMessages()
    }
  } catch (err) {
    ElMessage.error((err as Error).message || '删除会话失败')
  }
}

async function refreshAiConfig() {
  providers.value = (await listProviders()).filter((p) => p.isEnabled)
  if (!providers.value.some((p) => p.id === selectedProviderId.value)) {
    selectedProviderId.value = providers.value[0]?.id ?? ''
  }
  await refreshProviderAssets()
}

async function refreshProviderAssets() {
  if (!selectedProviderId.value) {
    models.value = []
    keys.value = []
    return
  }
  const [nextModels, nextKeys] = await Promise.all([
    listModels(selectedProviderId.value),
    listKeys(selectedProviderId.value)
  ])
  models.value = nextModels
  keys.value = nextKeys

  const provider = providers.value.find((p) => p.id === selectedProviderId.value)
  endpoint.value = provider?.defaultEndpoint || endpoint.value
  if (!enabledModels.value.some((m) => m.code === selectedModel.value)) {
    selectedModel.value = enabledModels.value[0]?.code ?? ''
  }
  if (!enabledKeys.value.some((k) => k.id === selectedKeyId.value)) {
    selectedKeyId.value = ''
  }
}

function onToken(token: string) {
  streamingRaw.value += token
  const next = splitStreaming(streamingRaw.value)
  streamingText.value = next.content
  streamingThinking.value = next.thinking
}
function onStatus(next: string) {
  status.value = next
}
function onCompleted(reason: string) {
  status.value = `completed (${reason})`
}
function onError(message: string) {
  status.value = 'error'
  errorMessage.value = message
  ElMessage.error(message)
}
function onRunEvent(event: RunEvent) {
  runEvents.value = [...runEvents.value, event].slice(-12)
}

async function send() {
  if (!selectedSessionId.value) {
    await createSession(mode.value)
  }
  if (!selectedSessionId.value) return
  if (!input.value.trim()) {
    ElMessage.warning('请输入消息')
    return
  }
  if (!endpoint.value || !selectedModel.value) {
    ElMessage.warning('请选择 Endpoint / Model')
    return
  }
  if (useSavedKey.value && !selectedProviderId.value) {
    ElMessage.warning('请选择 Provider')
    return
  }
  if (!useSavedKey.value && !tempKey.value.trim()) {
    ElMessage.warning('请输入临时 API Key')
    return
  }

  const text = input.value.trim()
  input.value = ''
  streamingText.value = ''
  streamingThinking.value = ''
  streamingRaw.value = ''
  runEvents.value = []
  errorMessage.value = ''
  status.value = 'starting'
  sending.value = true
  const runId = crypto.randomUUID()
  currentRunId.value = runId
  messages.value.push({
    id: `local-${runId}`,
    chatSessionId: selectedSessionId.value,
    role: 'user',
    content: text,
    summary: null,
    thinkingContent: null,
    analysisBlocksJson: null,
    toolPayload: null,
    inputTokens: null,
    outputTokens: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  })

  try {
    await chatHub.joinRun(runId)
    if (selectedSession.value?.mode !== mode.value) {
      const updated = await updateChatSession(selectedSessionId.value, { mode: mode.value })
      sessions.value = sessions.value.map((s) => s.id === updated.id ? updated : s)
    }
    await sendChatMessage(selectedSessionId.value, {
      runId,
      content: text,
      endpoint: endpoint.value,
      model: selectedModel.value,
      providerId: useSavedKey.value ? selectedProviderId.value : null,
      apiKeyId: useSavedKey.value ? (selectedKeyId.value || null) : null,
      apiKey: useSavedKey.value ? null : tempKey.value,
      temperature: 0.7,
      maxTokens: 4096
    })
    streamingText.value = ''
    streamingRaw.value = ''
    streamingThinking.value = ''
    await refreshSessions()
  } catch (err) {
    status.value = 'error'
    errorMessage.value = (err as Error).message || '发送失败'
    ElMessage.error((err as Error).message || '发送失败')
  } finally {
    sending.value = false
    await chatHub.leaveRun(runId)
    currentRunId.value = ''
  }
}

async function executePlan(message: ChatMessage) {
  if (!selectedSessionId.value || !canExecutePlan(message)) return
  if (sending.value || executingMessageId.value) {
    ElMessage.warning('当前已有任务运行中')
    return
  }

  const runId = crypto.randomUUID()
  currentRunId.value = runId
  executingMessageId.value = message.id
  streamingText.value = ''
  streamingThinking.value = ''
  streamingRaw.value = ''
  runEvents.value = []
  errorMessage.value = ''
  status.value = 'executing'

  try {
    await chatHub.joinRun(runId)
    const result = await executeChatPlan(selectedSessionId.value, message.id, { runId })
    messages.value = messages.value.map((item) => item.id === result.message.id ? result.message : item)
    await refreshMessages()
    await refreshSessions()
    status.value = `completed (${result.finishReason})`
    ElMessage.success(result.finishReason === 'failed' ? '计划执行完成，存在失败步骤' : '计划执行完成')
  } catch (err) {
    status.value = 'error'
    errorMessage.value = (err as Error).message || '执行计划失败'
    ElMessage.error(errorMessage.value)
  } finally {
    executingMessageId.value = ''
    await chatHub.leaveRun(runId)
    currentRunId.value = ''
  }
}

watch(selectedSessionId, async () => {
  streamingText.value = ''
  streamingThinking.value = ''
  streamingRaw.value = ''
  runEvents.value = []
  await refreshMessages()
  if (selectedSession.value) {
    mode.value = selectedSession.value.mode
    titleDraft.value = selectedSession.value.title
    if (selectedSession.value.providerId) selectedProviderId.value = selectedSession.value.providerId
    if (selectedSession.value.modelCode) selectedModel.value = selectedSession.value.modelCode
  }
})
watch(() => workContext.selectedProjectId, refreshSessions)
watch(selectedProviderId, refreshProviderAssets)

onMounted(async () => {
  chatHub.onToken(onToken)
  chatHub.onStatus(onStatus)
  chatHub.onCompleted(onCompleted)
  chatHub.onError(onError)
  chatHub.onRunEvent(onRunEvent)
  await workContext.init()
  await refreshAiConfig()
  await refreshSessions()
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
  <div class="assistant-page">
    <aside class="session-panel">
      <div class="panel-head">
        <strong>AI 助手</strong>
        <el-button :icon="Plus" size="small" type="primary" @click="createSession()">新会话</el-button>
      </div>
      <el-segmented v-model="mode" :options="[
        { label: 'Agent', value: 'agent' },
        { label: 'Plan', value: 'plan' },
        { label: 'Edit', value: 'edit' }
      ]" block />
      <div class="session-list" v-loading="loading">
        <button
          v-for="session in sessions"
          :key="session.id"
          class="session-item"
          :class="{ active: session.id === selectedSessionId }"
          @click="selectedSessionId = session.id"
        >
          <span class="session-title">{{ session.title }}</span>
          <span class="session-meta">{{ modeLabel(session.mode) }} · {{ formatTime(session.lastMessageAt) }}</span>
          <el-button text type="danger" :icon="Delete" @click.stop="removeSession(session)" />
        </button>
        <el-empty v-if="sessions.length === 0" description="暂无会话" />
      </div>
    </aside>

    <main class="chat-panel">
      <header class="toolbar">
        <div>
          <h1>{{ selectedSession?.title ?? 'AI 助手' }}</h1>
          <span>{{ modeLabel(mode) }} · {{ status }}</span>
        </div>
        <div class="config">
          <el-switch v-model="useSavedKey" active-text="保存 Key" inactive-text="临时 Key" />
          <el-select v-model="selectedProviderId" placeholder="Provider" filterable style="width: 180px">
            <el-option v-for="p in providers" :key="p.id" :label="p.name" :value="p.id" />
          </el-select>
          <el-select v-if="useSavedKey" v-model="selectedKeyId" placeholder="自动轮换" clearable filterable style="width: 160px">
            <el-option v-for="k in enabledKeys" :key="k.id" :label="`${k.name}${k.maskedTail ? ` · ${k.maskedTail}` : ''}`" :value="k.id" />
          </el-select>
          <el-input v-else v-model="tempKey" type="password" show-password placeholder="API Key" style="width: 180px" />
          <el-select v-model="selectedModel" placeholder="Model" filterable allow-create style="width: 180px">
            <el-option v-for="m in enabledModels" :key="m.id" :label="m.code" :value="m.code" />
          </el-select>
          <el-button :icon="Refresh" @click="refreshAiConfig" />
        </div>
      </header>

      <div class="session-settings" v-if="selectedSession">
        <el-input v-model="titleDraft" placeholder="会话标题" />
        <el-button :loading="savingSession" @click="saveSessionSettings">保存会话设置</el-button>
      </div>

      <el-input v-model="endpoint" placeholder="Endpoint, 如 https://api.openai.com/v1" />
      <el-alert v-if="errorMessage" :title="errorMessage" type="error" show-icon :closable="true" @close="errorMessage = ''" />

      <section v-if="runEvents.length > 0" class="run-events">
        <div v-for="event in runEvents" :key="`${event.at}-${event.type}`" class="run-event">
          <span class="event-time">{{ formatEventTime(event.at) }}</span>
          <strong>{{ event.message }}</strong>
          <span>{{ event.type }}</span>
        </div>
      </section>

      <section v-if="liveToolCalls.length > 0 || hasLiveExecutionEvents" class="execution-panel">
        <div class="execution-head">
          <strong>执行轨迹</strong>
          <span>{{ liveToolCalls.length > 0 ? `${liveToolCalls.length} 个工具调用` : '等待工具调用详情' }}</span>
        </div>
        <div v-if="liveTraceSummary" class="execution-summary">
          <span>{{ formatTraceSummary(liveTraceSummary) }}</span>
          <span v-if="liveTraceSummary.failedStepSummaries?.length">
            {{ liveTraceSummary.failedStepSummaries.join('；') }}
          </span>
        </div>
        <el-empty v-if="liveToolCalls.length === 0" description="执行器事件已收到，暂无工具调用详情" />
        <div v-else class="tool-call-list">
          <div v-for="call in liveToolCalls" :key="call.key" class="tool-call">
            <div class="tool-call-main">
              <el-tag size="small" :type="toolCallStatusTag(call.status)">
                {{ toolCallStatusLabel(call.status) }}
              </el-tag>
              <strong>{{ toolCallName(call) }}</strong>
              <span v-if="call.stepIndex != null">#{{ call.stepIndex }}</span>
              <span v-if="formatToolDuration(call)">{{ formatToolDuration(call) }}</span>
            </div>
            <p v-if="call.title && call.title !== toolCallName(call)" class="tool-call-title">{{ call.title }}</p>
            <p v-else-if="call.fallbackTitle" class="tool-call-title">{{ call.fallbackTitle }}</p>
            <p v-if="call.description" class="tool-call-title">{{ call.description }}</p>
            <div v-if="formatToolValue(call.arguments) || formatToolValue(call.result) || call.errorMessage" class="tool-call-detail">
              <div v-if="formatToolValue(call.arguments)">
                <span>参数</span>
                <pre>{{ formatToolValue(call.arguments) }}</pre>
              </div>
              <div v-if="formatToolValue(call.result)">
                <span>结果</span>
                <pre>{{ formatToolValue(call.result) }}</pre>
              </div>
              <div v-if="call.errorMessage" class="tool-call-error">
                <span>错误</span>
                <pre>{{ call.errorMessage }}</pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="messages">
        <el-empty v-if="visibleMessages.length === 0" description="开始一次对话" />
        <article v-for="message in visibleMessages" :key="message.id" class="message" :class="message.role">
          <div class="role">
            <el-icon><ChatLineRound /></el-icon>
            <span>{{ message.role }}</span>
          </div>
          <p v-if="message.summary && message.summary !== message.content" class="message-summary">
            {{ message.summary }}
          </p>
          <el-collapse v-if="message.thinkingContent">
            <el-collapse-item title="thinking" :name="message.id">
              <pre>{{ message.thinkingContent }}</pre>
            </el-collapse-item>
          </el-collapse>
          <div v-if="thinkingBlocks(message).length > 0" class="thinking-blocks">
            <div v-for="block in thinkingBlocks(message)" :key="block.index" class="thinking-block">
              <strong>{{ block.title }}</strong>
              <p>{{ block.detail }}</p>
            </div>
          </div>
          <div v-if="payloadMeta(message)?.directive || payloadMeta(message)?.normalization || payloadMeta(message)?.chapterRange" class="payload-tags">
            <el-tag v-if="payloadMeta(message)?.targetPanel" size="small" type="info">
              {{ targetPanelLabel(payloadMeta(message)?.targetPanel) }}
            </el-tag>
            <el-tag v-if="payloadMeta(message)?.requiresExecutionEngine" size="small" type="danger">
              需执行器
            </el-tag>
            <el-tag v-if="payloadMeta(message)?.normalization" size="small" type="success">
              {{ normalizationLabel(payloadMeta(message)?.normalization) }}
            </el-tag>
            <el-tag v-if="payloadMeta(message)?.chapterRange" size="small" type="warning">
              第{{ payloadMeta(message)?.chapterRange?.start }}-{{ payloadMeta(message)?.chapterRange?.end }}章
            </el-tag>
            <el-tag v-if="payloadMeta(message)?.directive" size="small">
              {{ directiveLabel(payloadMeta(message)?.directive?.kind) }} {{ payloadMeta(message)?.directive?.chapterId }}
            </el-tag>
          </div>
          <div v-if="planSteps(message).length > 0" class="plan-steps">
            <div v-if="canExecutePlan(message)" class="plan-actions">
              <el-button
                type="primary"
                size="small"
                :loading="executingMessageId === message.id"
                :disabled="sending || (!!executingMessageId && executingMessageId !== message.id)"
                @click="executePlan(message)"
              >
                执行计划
              </el-button>
            </div>
            <div v-for="step in planSteps(message)" :key="step.index" class="plan-step">
              <span class="step-index">{{ step.index }}</span>
              <div>
                <div class="step-title">
                  <strong>{{ step.title }}</strong>
                  <el-tag v-if="step.chapterNumber" size="small" type="info">第{{ step.chapterNumber }}章</el-tag>
                  <el-tag v-if="step.continueFromChapterId" size="small">续写 {{ step.continueFromChapterId }}</el-tag>
                  <el-tag v-if="step.rewriteTargetChapterId" size="small" type="warning">重写 {{ step.rewriteTargetChapterId }}</el-tag>
                </div>
                <p v-if="step.detail">{{ step.detail }}</p>
              </div>
            </div>
          </div>
          <div v-if="payloadToolCalls(message).length > 0" class="execution-panel message-execution">
            <div class="execution-head">
              <strong>执行轨迹 / 工具调用</strong>
              <span>{{ payloadToolCalls(message).length }} 条</span>
            </div>
            <div v-if="payloadTraceSummary(message)" class="execution-summary">
              <span>{{ formatTraceSummary(payloadTraceSummary(message)) }}</span>
              <span v-if="payloadTraceSummary(message)?.failedStepSummaries?.length">
                {{ payloadTraceSummary(message)?.failedStepSummaries?.join('；') }}
              </span>
            </div>
            <div class="tool-call-list">
              <div v-for="call in payloadToolCalls(message)" :key="call.key" class="tool-call">
                <div class="tool-call-main">
                  <el-tag size="small" :type="toolCallStatusTag(call.status)">
                    {{ toolCallStatusLabel(call.status) }}
                  </el-tag>
                  <strong>{{ toolCallName(call) }}</strong>
                  <span v-if="call.stepIndex != null">#{{ call.stepIndex }}</span>
                  <span v-if="formatToolDuration(call)">{{ formatToolDuration(call) }}</span>
                </div>
                <p v-if="call.title && call.title !== toolCallName(call)" class="tool-call-title">{{ call.title }}</p>
                <p v-if="call.description" class="tool-call-title">{{ call.description }}</p>
                <div v-if="formatToolValue(call.arguments) || formatToolValue(call.result) || call.errorMessage" class="tool-call-detail">
                  <div v-if="formatToolValue(call.arguments)">
                    <span>参数</span>
                    <pre>{{ formatToolValue(call.arguments) }}</pre>
                  </div>
                  <div v-if="formatToolValue(call.result)">
                    <span>结果</span>
                    <pre>{{ formatToolValue(call.result) }}</pre>
                  </div>
                  <div v-if="call.errorMessage" class="tool-call-error">
                    <span>错误</span>
                    <pre>{{ call.errorMessage }}</pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <pre v-if="shouldShowRawContent(message)">{{ message.content }}</pre>
        </article>
      </section>

      <footer class="composer">
        <el-input
          v-model="input"
          type="textarea"
          :rows="4"
          resize="none"
          placeholder="输入任务、规划请求或要编辑的文本..."
          @keydown.meta.enter.prevent="send"
          @keydown.ctrl.enter.prevent="send"
        />
        <el-button type="primary" :icon="Promotion" :loading="sending" @click="send">发送</el-button>
      </footer>
    </main>
  </div>
</template>

<style scoped>
.assistant-page {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 16px;
  min-height: calc(100vh - 92px);
}
.session-panel,
.chat-panel {
  border: 1px solid #e1e8e5;
  border-radius: 8px;
  background: #fffdf8;
}
.session-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
}
.panel-head,
.toolbar,
.composer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.session-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: auto;
}
.session-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 34px;
  gap: 4px;
  align-items: center;
  width: 100%;
  padding: 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: #f8faf8;
  text-align: left;
  cursor: pointer;
}
.session-item.active {
  border-color: #4b8f83;
  background: #eef7f4;
}
.session-title {
  overflow: hidden;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.session-meta {
  grid-column: 1 / -1;
  color: #7c8783;
  font-size: 12px;
}
.chat-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  min-width: 0;
}
.toolbar h1 {
  margin: 0;
  font-size: 22px;
}
.toolbar span {
  color: #7a8581;
  font-size: 13px;
}
.config {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}
.session-settings {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 130px;
  gap: 8px;
}
.run-events {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 8px;
  border: 1px solid #dbe8e3;
  border-radius: 8px;
  background: #f8fbf9;
}
.run-event {
  display: grid;
  min-width: 160px;
  gap: 2px;
  padding: 6px 8px;
  border-left: 3px solid #4b8f83;
  background: #ffffff;
}
.run-event span {
  color: #7a8581;
  font-size: 12px;
}
.event-time {
  font-variant-numeric: tabular-nums;
}
.execution-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border: 1px solid #d7e3de;
  border-radius: 8px;
  background: #fbfcfa;
}
.message-execution {
  margin-top: 10px;
}
.execution-head,
.tool-call-main {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.execution-head {
  justify-content: space-between;
  color: #3f514c;
}
.execution-head span,
.execution-summary,
.tool-call-main span,
.tool-call-title,
.tool-call-detail span {
  color: #75817d;
  font-size: 12px;
}
.execution-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  background: #f3f7f5;
}
.tool-call-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tool-call {
  padding: 10px;
  border: 1px solid #e3e9e6;
  border-radius: 8px;
  background: #ffffff;
}
.tool-call-main strong {
  color: #354743;
}
.tool-call-title {
  margin: 6px 0 0;
}
.tool-call-detail {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 8px;
  margin-top: 8px;
}
.tool-call-detail > div {
  min-width: 0;
}
.tool-call-error pre {
  color: #b34343;
}
.messages {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  min-height: 360px;
  overflow: auto;
  padding: 8px;
  background: #f7f8f5;
  border-radius: 8px;
}
.message {
  max-width: 86%;
  padding: 12px;
  border: 1px solid #e1e8e5;
  border-radius: 8px;
  background: #ffffff;
}
.message.user {
  align-self: flex-end;
  background: #eef7f4;
}
.role {
  display: flex;
  gap: 6px;
  align-items: center;
  color: #62706c;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
}
.message-summary {
  margin: 8px 0 0;
  color: #4f5f5a;
  font-weight: 700;
}
.plan-steps {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
}
.plan-actions {
  display: flex;
  justify-content: flex-end;
}
.thinking-blocks,
.payload-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}
.thinking-block {
  flex: 1 1 220px;
  padding: 8px 10px;
  border: 1px solid #e6e2d8;
  border-radius: 8px;
  background: #fffaf0;
}
.thinking-block p {
  margin: 4px 0 0;
  color: #65716d;
  white-space: pre-wrap;
}
.plan-step {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr);
  gap: 10px;
  padding: 10px;
  border: 1px solid #dbe8e3;
  border-radius: 8px;
  background: #f8fbf9;
}
.step-index {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #4b8f83;
  color: #fff;
  font-weight: 700;
}
.step-title {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.plan-step p {
  margin: 6px 0 0;
  color: #65716d;
  white-space: pre-wrap;
}
pre {
  margin: 8px 0 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  line-height: 1.7;
}
.composer {
  align-items: flex-end;
}
.composer .el-button {
  height: 92px;
  width: 96px;
}
@media (max-width: 1080px) {
  .assistant-page {
    grid-template-columns: 1fr;
  }
}
</style>
