<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { storeToRefs } from 'pinia'
import { postTestCompletion } from '@/api/modules/aiTest'
import { listProviderConfigs, type AiProviderConfig } from '@/api/modules/ai'
import { useI18n } from '@/composables/useI18n'
import { chatHub } from '@/signalr/chat'
import { useAiTestStore } from '@/stores/aiTest'

const store = useAiTestStore()
const { form, output, status, error, isStreaming } = storeToRefs(store)
const { t } = useI18n()

const currentRunId = ref('')
const metaInfo = ref<{ chunkCount: number; charCount: number; elapsedMs: number; finishReason?: string } | null>(null)
const configs = ref<AiProviderConfig[]>([])
const loadingConfigs = ref(false)

const selectedConfig = computed(() =>
  configs.value.find((item) => item.providerId === form.value.configId) ?? null
)

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
  void refreshConfigs()
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
  const hasResolvedKey = Boolean(form.value.apiKey || form.value.configId)
  if (!form.value.endpoint || !hasResolvedKey || !form.value.model || !form.value.prompt) {
    ElMessage.warning(t('aiTest.messages.required'))
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
    ElMessage.error(
      t('aiTest.messages.signalrFailed', {
        message: (err as Error).message ?? t('aiTest.messages.unknownError')
      })
    )
    return
  }

  try {
    const result = await postTestCompletion({
      runId,
      configId: form.value.configId || null,
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
    error.value = (err as Error).message ?? t('aiTest.messages.requestFailed')
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

async function refreshConfigs() {
  loadingConfigs.value = true
  try {
    configs.value = (await listProviderConfigs()).filter((item) => item.isEnabled)
    if (!configs.value.some((item) => item.providerId === form.value.configId)) {
      form.value.configId = configs.value[0]?.providerId ?? ''
    }
  } catch (err) {
    ElMessage.error((err as Error).message ?? t('aiTest.messages.loadConfigsFailed'))
  } finally {
    loadingConfigs.value = false
  }
}

watch(
  () => form.value.configId,
  (configId) => {
    const config = configs.value.find((item) => item.providerId === configId)
    if (!config) return
    form.value.endpoint = config.defaultEndpoint || form.value.endpoint
    form.value.model = config.modelCode || form.value.model
  }
)
</script>

<template>
  <div class="ai-test">
    <el-card shadow="never">
      <h2 class="title">{{ t('aiTest.title') }}</h2>
      <p class="hint">
        {{ t('aiTest.hint') }}
        <br />
        <strong>{{ t('aiTest.memoryOnly') }}</strong>
      </p>

      <el-form :model="form" label-width="110px" class="form" :disabled="isStreaming">
        <el-form-item :label="t('aiTest.labels.config')">
          <el-select v-model="form.configId" filterable clearable :loading="loadingConfigs" style="width: 100%">
            <el-option
              v-for="config in configs"
              :key="config.providerId"
              :label="`${config.name} / ${config.modelCode || '--'}`"
              :value="config.providerId"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('aiTest.labels.endpoint')">
          <el-input v-model="form.endpoint" :placeholder="t('aiTest.placeholders.endpoint')" />
        </el-form-item>
        <el-form-item :label="t('aiTest.labels.apiKey')">
          <el-input v-model="form.apiKey" type="password" show-password :placeholder="t('aiTest.placeholders.apiKey')" />
        </el-form-item>
        <el-form-item :label="t('aiTest.labels.model')">
          <el-input v-model="form.model" :placeholder="t('aiTest.placeholders.model')" />
        </el-form-item>
        <el-form-item v-if="selectedConfig" :label="t('aiTest.labels.configSummary')">
          <div class="config-summary">
            <div>{{ selectedConfig.name }}</div>
            <div class="config-meta">{{ selectedConfig.defaultEndpoint || '--' }}</div>
            <div class="config-meta">{{ selectedConfig.apiKeyMaskedTail || t('aiTest.labels.noSavedKey') }}</div>
          </div>
        </el-form-item>
        <el-form-item :label="t('aiTest.labels.systemPrompt')">
          <el-input
            v-model="form.systemPrompt"
            type="textarea"
            :rows="2"
            :placeholder="t('aiTest.placeholders.systemPrompt')"
          />
        </el-form-item>
        <el-form-item :label="t('aiTest.labels.userPrompt')">
          <el-input v-model="form.prompt" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item :label="t('aiTest.labels.temperature')">
          <el-input-number v-model="form.temperature" :min="0" :max="2" :step="0.1" />
        </el-form-item>
        <el-form-item :label="t('aiTest.labels.maxTokens')">
          <el-input-number v-model="form.maxTokens" :min="64" :max="8192" :step="64" />
        </el-form-item>

        <el-form-item>
          <el-space :size="12">
            <el-button type="primary" :loading="isStreaming" @click="submit">
              {{ isStreaming ? t('aiTest.actions.running') : t('aiTest.actions.send') }}
            </el-button>
            <el-button :disabled="isStreaming" @click="clearOutput">{{ t('aiTest.actions.clear') }}</el-button>
          </el-space>
        </el-form-item>
      </el-form>

      <el-divider />

      <div class="status-row">
        <el-tag size="small" :type="status === 'error' ? 'danger' : 'info'">
          {{ t('aiTest.status.label', { status }) }}
        </el-tag>
        <el-tag v-if="metaInfo" size="small" type="success">
          {{ t('aiTest.status.chunks') }}: {{ metaInfo.chunkCount }} |
          {{ t('aiTest.status.chars') }}: {{ metaInfo.charCount }} |
          {{ metaInfo.elapsedMs }}ms |
          {{ metaInfo.finishReason || t('aiTest.status.completed') }}
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
      <el-empty v-else :description="t('aiTest.status.noOutput')" :image-size="80" />
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

.config-summary {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: var(--tm-fg-primary);
}

.config-meta {
  color: var(--tm-fg-secondary);
  font-size: 12px;
  word-break: break-all;
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
