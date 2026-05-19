<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { storeToRefs } from 'pinia'
import { useAiTestStore } from '@/stores/aiTest'
import { postTestCompletion } from '@/api/modules/aiTest'
import { chatHub } from '@/signalr/chat'

const store = useAiTestStore()
const { form, output, status, error, isStreaming } = storeToRefs(store)

const currentRunId = ref<string>('')
const metaInfo = ref<{ chunkCount: number; charCount: number; elapsedMs: number; finishReason?: string } | null>(null)

function onToken(token: string) {
  store.appendToken(token)
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
    ElMessage.warning('请填写完整的 endpoint / apiKey / model / prompt')
    return
  }

  store.reset()
  metaInfo.value = null
  isStreaming.value = true

  const runId = crypto.randomUUID()
  currentRunId.value = runId

  try {
    await chatHub.joinRun(runId)
  } catch (e) {
    isStreaming.value = false
    const err = e as Error
    ElMessage.error('SignalR 连接失败：' + (err.message ?? '未知错误'))
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
  } catch (e) {
    const err = e as Error
    error.value = err.message ?? '请求失败'
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
      <h2 class="title">AI 流式测试</h2>
      <p class="hint">
        端到端验证：前端提交 <code>POST /api/ai/test-completion</code> →
        后端用 Semantic Kernel 调 OpenAI 兼容服务 →
        流式 token 通过 SignalR <code>ChatHub</code> 推回前端实时显示。<br />
        <strong>密钥仅本次内存使用，不落盘。</strong>
        Endpoint 不带 <code>/v1</code> 时会自动补齐。
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
            placeholder="可选"
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
              {{ isStreaming ? '生成中…' : '发送' }}
            </el-button>
            <el-button @click="clearOutput" :disabled="isStreaming">清空</el-button>
          </el-space>
        </el-form-item>
      </el-form>

      <el-divider />

      <div class="status-row">
        <el-tag size="small" :type="status === 'error' ? 'danger' : 'info'">状态: {{ status }}</el-tag>
        <el-tag v-if="metaInfo" size="small" type="success">
          chunks: {{ metaInfo.chunkCount }} · chars: {{ metaInfo.charCount }} · {{ metaInfo.elapsedMs }}ms · {{ metaInfo.finishReason }}
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

      <div class="output" v-if="output">{{ output }}</div>
      <el-empty v-else description="尚未生成内容" :image-size="80" />
    </el-card>
  </div>
</template>

<style scoped>
.ai-test {
  max-width: 900px;
  margin: 0 auto;
}
.title {
  font-size: 20px;
  font-weight: 600;
  color: var(--tm-fg-primary);
  margin: 0 0 8px;
}
.hint {
  color: var(--tm-fg-secondary);
  font-size: 13px;
  line-height: 1.7;
}
.hint code {
  background: var(--tm-bg-elevated);
  padding: 1px 6px;
  border-radius: 3px;
  font-family: 'SF Mono', Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
}
.form {
  margin-top: 16px;
}
.status-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.output {
  white-space: pre-wrap;
  word-break: break-word;
  background: var(--tm-bg-elevated);
  border: 1px solid var(--tm-border);
  border-radius: 6px;
  padding: 14px 16px;
  min-height: 100px;
  color: var(--tm-fg-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 14px;
  line-height: 1.8;
}
</style>
