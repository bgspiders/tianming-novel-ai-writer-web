<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { storeToRefs } from 'pinia'
import { postTestCompletion } from '@/api/modules/aiTest'
import { chatHub } from '@/signalr/chat'
import { useAiTestStore } from '@/stores/aiTest'

const store = useAiTestStore()
const { form, output, status, error, isStreaming } = storeToRefs(store)

const currentRunId = ref('')
const metaInfo = ref<{ chunkCount: number; charCount: number; elapsedMs: number; finishReason?: string } | null>(null)

function onToken(token: string) {
  store.appendToken(token)
}

function onStatus(nextStatus: string) {
  status.value = nextStatus
}

function onCompleted(reason: string) {
  status.value = `completed (${reason})`
}

function onError(message: string) {
  error.value = message
  status.value = 'error'
}

onMounted(() => {
  store.loadFromStorage()
  chatHub.onToken(onToken)
  chatHub.onStatus(onStatus)
  chatHub.onCompleted(onCompleted)
  chatHub.onError(onError)
})

onBeforeUnmount(async () => {
  chatHub.offToken(onToken)
  chatHub.offStatus(onStatus)
  chatHub.offCompleted(onCompleted)
  chatHub.offError(onError)

  if (currentRunId.value) {
    await chatHub.leaveRun(currentRunId.value)
  }
})

async function submit() {
  if (!form.value.endpoint || !form.value.apiKey || !form.value.model || !form.value.prompt) {
    ElMessage.warning('Please provide endpoint, API key, model, and prompt.')
    return
  }

  store.reset()
  metaInfo.value = null
  isStreaming.value = true

  const runId = crypto.randomUUID()
  currentRunId.value = runId

  try {
    await chatHub.joinRun(runId)
  } catch (err) {
    isStreaming.value = false
    ElMessage.error(`SignalR connection failed: ${(err as Error).message ?? 'Unknown error'}`)
    return
  }

  try {
    const result = await postTestCompletion({
      runId,
      endpoint: form.value.endpoint,
      apiKey: form.value.apiKey,
      model: form.value.model,
      prompt: form.value.prompt,
      systemPrompt: form.value.systemPrompt || undefined,
      temperature: form.value.temperature,
      maxTokens: form.value.maxTokens
    })

    metaInfo.value = {
      chunkCount: result.chunkCount,
      charCount: result.charCount,
      elapsedMs: result.elapsedMs,
      finishReason: result.finishReason
    }
    store.saveToStorage()
  } catch (err) {
    error.value = (err as Error).message ?? 'Request failed.'
    ElMessage.error(error.value)
  } finally {
    isStreaming.value = false
    await chatHub.leaveRun(runId)
    currentRunId.value = ''
  }
}

function clearOutput() {
  store.reset()
  metaInfo.value = null
}
</script>

<template>
  <div class="ai-test">
    <el-card shadow="never">
      <h2 class="title">AI Streaming Test</h2>
      <p class="hint">
        This page sends a request to <code>POST /api/ai/test-completion</code>, receives streamed tokens
        through SignalR <code>ChatHub</code>, and renders the result live in the browser.
        <br />
        <strong>The API key is used in memory only and is not written to local storage.</strong>
      </p>

      <el-form :model="form" label-width="110px" class="form" :disabled="isStreaming">
        <el-form-item label="Endpoint">
          <el-input v-model="form.endpoint" placeholder="https://api.openai.com/v1" />
        </el-form-item>
        <el-form-item label="API Key">
          <el-input v-model="form.apiKey" type="password" show-password placeholder="sk-..." />
        </el-form-item>
        <el-form-item label="Model">
          <el-input v-model="form.model" placeholder="gpt-4o-mini / deepseek-chat / ..." />
        </el-form-item>
        <el-form-item label="System Prompt">
          <el-input
            v-model="form.systemPrompt"
            type="textarea"
            :rows="2"
            placeholder="Optional system instruction"
          />
        </el-form-item>
        <el-form-item label="User Prompt">
          <el-input v-model="form.prompt" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="Temperature">
          <el-input-number v-model="form.temperature" :min="0" :max="2" :step="0.1" />
        </el-form-item>
        <el-form-item label="Max Tokens">
          <el-input-number v-model="form.maxTokens" :min="64" :max="8192" :step="64" />
        </el-form-item>

        <el-form-item>
          <el-space :size="12">
            <el-button type="primary" :loading="isStreaming" @click="submit">
              {{ isStreaming ? 'Running...' : 'Send Request' }}
            </el-button>
            <el-button :disabled="isStreaming" @click="clearOutput">Clear</el-button>
          </el-space>
        </el-form-item>
      </el-form>

      <el-divider />

      <div class="status-row">
        <el-tag size="small" :type="status === 'error' ? 'danger' : 'info'">Status: {{ status }}</el-tag>
        <el-tag v-if="metaInfo" size="small" type="success">
          chunks: {{ metaInfo.chunkCount }} | chars: {{ metaInfo.charCount }} | {{ metaInfo.elapsedMs }}ms |
          {{ metaInfo.finishReason || 'completed' }}
        </el-tag>
      </div>

      <el-alert
        v-if="error"
        :title="error"
        type="error"
        show-icon
        :closable="false"
        style="margin-top: 8px"
      />

      <div v-if="output" class="output">{{ output }}</div>
      <el-empty v-else description="No output yet" :image-size="80" />
    </el-card>
  </div>
</template>

<style scoped>
.ai-test {
  max-width: 900px;
  margin: 0 auto;
}

.title {
  margin: 0 0 8px;
  color: var(--tm-fg-primary);
  font-size: 20px;
  font-weight: 600;
}

.hint {
  color: var(--tm-fg-secondary);
  font-size: 13px;
  line-height: 1.7;
}

.hint code {
  padding: 1px 6px;
  border-radius: 3px;
  background: var(--tm-bg-elevated);
  font-family: 'SF Mono', Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
}

.form {
  margin-top: 16px;
}

.status-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.output {
  min-height: 100px;
  padding: 14px 16px;
  border: 1px solid var(--tm-border);
  border-radius: 6px;
  background: var(--tm-bg-elevated);
  color: var(--tm-fg-primary);
  white-space: pre-wrap;
  word-break: break-word;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 14px;
  line-height: 1.8;
}
</style>
