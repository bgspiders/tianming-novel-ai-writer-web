<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { storeToRefs } from 'pinia'
import { Delete, Edit, Plus, RefreshRight } from '@element-plus/icons-vue'
import {
  createProviderConfig,
  deleteProviderConfig,
  discoverRemoteModels,
  listProviderConfigs,
  type AiProviderConfig,
  type AiProviderConfigUpsert,
  type AiRemoteModelOption,
  updateProviderConfig
} from '@/api/modules/ai'
import { postTestCompletion } from '@/api/modules/aiTest'
import { useI18n } from '@/composables/useI18n'
import { chatHub } from '@/signalr/chat'
import { useAiTestStore } from '@/stores/aiTest'

const { t } = useI18n()
const testStore = useAiTestStore()
const { form: testForm, output, status, error, isStreaming } = storeToRefs(testStore)

type PlatformOption = {
  code: string
  name: string
  endpoint: string
  hint: string
}

const platformOptions: PlatformOption[] = [
  { code: 'openai', name: 'OpenAI', endpoint: 'https://api.openai.com/v1', hint: 'OpenAI 官方兼容接口' },
  { code: 'anthropic', name: 'Anthropic', endpoint: 'https://api.anthropic.com/v1', hint: 'Claude OpenAI 兼容接入' },
  { code: 'gemini', name: 'Google Gemini', endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai', hint: 'Gemini OpenAI 兼容入口' },
  { code: 'deepseek', name: 'DeepSeek', endpoint: 'https://api.deepseek.com/v1', hint: 'DeepSeek 官方接口' },
  { code: 'moonshot', name: 'Moonshot', endpoint: 'https://api.moonshot.cn/v1', hint: 'Moonshot 官方接口' },
  { code: 'custom', name: '自定义兼容平台', endpoint: 'https://api.openai.com/v1', hint: '任何 OpenAI 兼容 /v1/models 平台' }
]

function defaultEndpointFor(platformCode: string) {
  return platformOptions.find((item) => item.code === platformCode)?.endpoint ?? 'https://api.openai.com/v1'
}

const configs = ref<AiProviderConfig[]>([])
const loading = ref(false)
const selectedConfigId = ref('')

const editorVisible = ref(false)
const editorMode = ref<'create' | 'edit'>('create')
const editorProviderId = ref('')
const saving = ref(false)
const discoveringModels = ref(false)
const currentRunId = ref('')
const testMeta = ref<{ chunkCount: number; charCount: number; elapsedMs: number; finishReason?: string } | null>(null)

const editorForm = ref<AiProviderConfigUpsert>({
  platformCode: 'openai',
  name: '',
  defaultEndpoint: defaultEndpointFor('openai'),
  notes: '',
  isEnabled: true,
  sortOrder: 0,
  modelCode: '',
  modelName: '',
  plainKey: '',
  apiKeyName: 'Default'
})

const remoteModels = ref<AiRemoteModelOption[]>([])
const modelKeyword = ref('')

const filteredRemoteModels = computed(() => {
  const keyword = modelKeyword.value.trim().toLowerCase()
  if (!keyword) return remoteModels.value
  return remoteModels.value.filter((item) =>
    item.id.toLowerCase().includes(keyword) || item.name.toLowerCase().includes(keyword)
  )
})

const selectedConfig = computed(() =>
  configs.value.find((item) => item.providerId === selectedConfigId.value) ?? null
)

function onToken(token: string) {
  testStore.appendToken(token)
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

async function refreshConfigs(keepSelection = true) {
  loading.value = true
  try {
    configs.value = await listProviderConfigs()
    if (!keepSelection || !configs.value.some((item) => item.providerId === selectedConfigId.value)) {
      selectedConfigId.value = configs.value[0]?.providerId ?? ''
    }
    applySelectedConfigToTest()
  } catch (err) {
    ElMessage.error((err as Error).message ?? t('aiModels.messages.providersLoadFailed'))
  } finally {
    loading.value = false
  }
}

function applySelectedConfigToTest() {
  const config = selectedConfig.value
  if (!config) return
  testForm.value.configId = config.providerId
  testForm.value.endpoint = config.defaultEndpoint || testForm.value.endpoint
  testForm.value.model = config.modelCode || testForm.value.model
}

function resetEditor() {
  editorProviderId.value = ''
  editorForm.value = {
    platformCode: 'openai',
    name: '',
    defaultEndpoint: defaultEndpointFor('openai'),
    notes: '',
    isEnabled: true,
    sortOrder: configs.value.length,
    modelCode: '',
    modelName: '',
    plainKey: '',
    apiKeyName: 'Default'
  }
  remoteModels.value = []
  modelKeyword.value = ''
}

function openCreate() {
  editorMode.value = 'create'
  resetEditor()
  editorVisible.value = true
}

function openEdit(config: AiProviderConfig) {
  editorMode.value = 'edit'
  editorProviderId.value = config.providerId
  editorForm.value = {
    platformCode: config.platformCode || 'custom',
    name: config.name,
    defaultEndpoint: config.defaultEndpoint || defaultEndpointFor(config.platformCode || 'custom'),
    notes: config.notes || '',
    isEnabled: config.isEnabled,
    sortOrder: config.sortOrder,
    modelCode: config.modelCode || '',
    modelName: config.modelName || config.modelCode || '',
    plainKey: '',
    apiKeyName: config.apiKeyName || 'Default'
  }
  remoteModels.value = config.modelCode
    ? [{ id: config.modelCode, name: config.modelName || config.modelCode, ownedBy: null }]
    : []
  modelKeyword.value = ''
  editorVisible.value = true
}

watch(
  () => editorForm.value.platformCode,
  (platformCode, previous) => {
    if (!platformCode || platformCode === previous) return
    if (!editorForm.value.defaultEndpoint || editorForm.value.defaultEndpoint === defaultEndpointFor(previous || 'openai')) {
      editorForm.value.defaultEndpoint = defaultEndpointFor(platformCode)
    }
  }
)

async function discoverModels() {
  if (!editorForm.value.platformCode) {
    ElMessage.warning(t('aiModels.config.form.platformRequired'))
    return
  }
  if (!editorForm.value.defaultEndpoint) {
    ElMessage.warning(t('aiModels.config.form.endpointRequired'))
    return
  }
  if (editorMode.value === 'create' && !editorForm.value.plainKey?.trim()) {
    ElMessage.warning(t('aiModels.config.form.keyRequired'))
    return
  }

  discoveringModels.value = true
  try {
    const result = await discoverRemoteModels({
      providerId: editorMode.value === 'edit' ? editorProviderId.value : null,
      platformCode: editorForm.value.platformCode,
      endpoint: editorForm.value.defaultEndpoint,
      apiKey: editorForm.value.plainKey?.trim() || null
    })
    remoteModels.value = result.models
    editorForm.value.defaultEndpoint = result.resolvedEndpoint
    if (!remoteModels.value.some((item) => item.id === editorForm.value.modelCode)) {
      editorForm.value.modelCode = remoteModels.value[0]?.id ?? ''
      editorForm.value.modelName = remoteModels.value[0]?.name ?? ''
    }
    ElMessage.success(t('aiModels.messages.modelsDiscovered', { count: remoteModels.value.length }))
  } catch (err) {
    ElMessage.error((err as Error).message ?? t('aiModels.messages.modelsDiscoverFailed'))
  } finally {
    discoveringModels.value = false
  }
}

function applyModel(model: AiRemoteModelOption) {
  editorForm.value.modelCode = model.id
  editorForm.value.modelName = model.name
}

async function saveConfig() {
  if (!editorForm.value.platformCode) {
    ElMessage.warning(t('aiModels.config.form.platformRequired'))
    return
  }
  if (!editorForm.value.name.trim()) {
    ElMessage.warning(t('aiModels.config.form.nameRequired'))
    return
  }
  if (!editorForm.value.defaultEndpoint?.trim()) {
    ElMessage.warning(t('aiModels.config.form.endpointRequired'))
    return
  }
  if (!editorForm.value.modelCode.trim()) {
    ElMessage.warning(t('aiModels.config.form.modelRequired'))
    return
  }
  if (editorMode.value === 'create' && !editorForm.value.plainKey?.trim()) {
    ElMessage.warning(t('aiModels.config.form.keyRequired'))
    return
  }

  saving.value = true
  try {
    if (editorMode.value === 'create') {
      await createProviderConfig(editorForm.value)
      ElMessage.success(t('aiModels.messages.providerCreated'))
    } else {
      await updateProviderConfig(editorProviderId.value, editorForm.value)
      ElMessage.success(t('aiModels.messages.providerUpdated'))
    }
    editorVisible.value = false
    await refreshConfigs()
  } catch (err) {
    ElMessage.error((err as Error).message ?? t('aiModels.messages.providerSaveFailed'))
  } finally {
    saving.value = false
  }
}

async function removeConfig(config: AiProviderConfig) {
  try {
    await ElMessageBox.confirm(
      t('aiModels.messages.providerDeleteConfirm', { name: config.name }),
      t('layout.dialogs.confirm'),
      { type: 'warning' }
    )
  } catch {
    return
  }

  try {
    await deleteProviderConfig(config.providerId)
    ElMessage.success(t('aiModels.messages.providerDeleted'))
    await refreshConfigs(false)
  } catch (err) {
    ElMessage.error((err as Error).message ?? t('aiModels.messages.providerDeleteFailed'))
  }
}

onMounted(() => {
  testStore.loadFromStorage()
  chatHub.onToken(onToken)
  chatHub.onStatus(onStatus)
  chatHub.onCompleted(onCompleted)
  chatHub.onError(onError)
  refreshConfigs()
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

watch(selectedConfigId, () => {
  applySelectedConfigToTest()
})

async function submitModelTest() {
  applySelectedConfigToTest()
  const hasResolvedKey = Boolean(testForm.value.apiKey || testForm.value.configId)
  if (!testForm.value.endpoint || !hasResolvedKey || !testForm.value.model || !testForm.value.prompt) {
    ElMessage.warning(t('aiTest.messages.required'))
    return
  }

  testStore.reset()
  testMeta.value = null
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
      configId: testForm.value.configId || null,
      endpoint: testForm.value.endpoint,
      apiKey: testForm.value.apiKey,
      model: testForm.value.model,
      prompt: testForm.value.prompt,
      systemPrompt: testForm.value.systemPrompt || undefined,
      temperature: testForm.value.temperature,
      maxTokens: testForm.value.maxTokens
    })

    testMeta.value = {
      chunkCount: result.chunkCount,
      charCount: result.charCount,
      elapsedMs: result.elapsedMs,
      finishReason: result.finishReason
    }
    testStore.saveToStorage()
  } catch (err) {
    error.value = (err as Error).message ?? t('aiTest.messages.requestFailed')
    ElMessage.error(error.value)
  } finally {
    isStreaming.value = false
    await chatHub.leaveRun(runId)
    currentRunId.value = ''
  }
}

function clearModelTest() {
  testStore.reset()
  testMeta.value = null
}
</script>

<template>
  <div class="ai-models">
    <el-card shadow="never" class="hero-card">
      <div class="hero-row">
        <div>
          <h2 class="title">{{ t('aiModels.title') }}</h2>
          <p class="hint">{{ t('aiModels.hint') }}</p>
        </div>
        <el-button type="primary" :icon="Plus" @click="openCreate">{{ t('aiModels.provider.create') }}</el-button>
      </div>
    </el-card>

    <div class="layout">
      <el-card shadow="never" class="config-list-panel">
        <template #header>
          <div class="panel-head">
            <span>{{ t('aiModels.provider.title') }}</span>
            <el-button text :icon="RefreshRight" @click="refreshConfigs(false)" />
          </div>
        </template>

        <div v-loading="loading" class="config-list">
          <button
            v-for="config in configs"
            :key="config.providerId"
            type="button"
            :class="['config-item', { active: config.providerId === selectedConfigId }]"
            @click="selectedConfigId = config.providerId"
          >
            <div class="config-item-top">
              <div>
                <div class="config-name">{{ config.name }}</div>
                <div class="config-code">{{ config.platformCode }} / {{ config.providerCode }}</div>
              </div>
              <el-tag :type="config.isEnabled ? 'success' : 'info'" size="small" effect="plain">
                {{ config.isEnabled ? t('aiModels.status.enabled') : t('aiModels.status.disabled') }}
              </el-tag>
            </div>
            <div class="config-meta">
              <span>{{ config.modelCode || '--' }}</span>
              <span>{{ config.hasKey ? (config.apiKeyMaskedTail || '--') : t('aiModels.config.empty.noKey') }}</span>
            </div>
          </button>

          <el-empty v-if="!loading && configs.length === 0" :description="t('aiModels.provider.empty')" />
        </div>
      </el-card>

      <el-card shadow="never" class="detail-panel">
        <template #header>
          <div class="panel-head">
            <span>{{ selectedConfig?.name || t('aiModels.provider.selectedEmpty') }}</span>
            <div v-if="selectedConfig" class="detail-actions">
              <el-button text :icon="Edit" @click="openEdit(selectedConfig)">{{ t('aiModels.actions.edit') }}</el-button>
              <el-button text type="danger" :icon="Delete" @click="removeConfig(selectedConfig)">{{ t('aiModels.actions.delete') }}</el-button>
            </div>
          </div>
        </template>

        <template v-if="selectedConfig">
          <div class="detail-grid">
            <div class="detail-card">
              <div class="detail-label">{{ t('aiModels.config.fields.platform') }}</div>
              <div class="detail-value">{{ selectedConfig.platformCode }}</div>
            </div>
            <div class="detail-card">
              <div class="detail-label">{{ t('aiModels.config.fields.endpoint') }}</div>
              <div class="detail-mono">{{ selectedConfig.defaultEndpoint || '--' }}</div>
            </div>
            <div class="detail-card">
              <div class="detail-label">{{ t('aiModels.config.fields.model') }}</div>
              <div class="detail-value">{{ selectedConfig.modelName || selectedConfig.modelCode || '--' }}</div>
              <div class="detail-sub">{{ selectedConfig.modelCode || '--' }}</div>
            </div>
            <div class="detail-card">
              <div class="detail-label">{{ t('aiModels.config.fields.key') }}</div>
              <div class="detail-value">{{ selectedConfig.apiKeyMaskedTail || t('aiModels.config.empty.noKey') }}</div>
              <div class="detail-sub">
                {{ selectedConfig.keyLastUsedAt ? new Date(selectedConfig.keyLastUsedAt).toLocaleString() : t('aiModels.config.empty.neverUsed') }}
              </div>
            </div>
          </div>

          <el-alert
            v-if="selectedConfig.notes"
            type="info"
            show-icon
            :closable="false"
            class="notes-alert"
            :title="selectedConfig.notes"
          />

          <section class="test-panel">
            <div class="test-head">
              <div>
                <h3>{{ t('aiTest.title') }}</h3>
                <p>{{ t('aiTest.memoryOnly') }}</p>
              </div>
              <el-space>
                <el-button :disabled="isStreaming" @click="clearModelTest">{{ t('aiTest.actions.clear') }}</el-button>
                <el-button type="primary" :loading="isStreaming" @click="submitModelTest">
                  {{ isStreaming ? t('aiTest.actions.running') : t('aiTest.actions.send') }}
                </el-button>
              </el-space>
            </div>

            <el-form :model="testForm" label-position="top" class="test-form" :disabled="isStreaming">
              <el-form-item :label="t('aiTest.labels.endpoint')">
                <el-input v-model="testForm.endpoint" :placeholder="selectedConfig.defaultEndpoint || t('aiTest.placeholders.endpoint')" />
              </el-form-item>
              <el-form-item :label="t('aiTest.labels.model')">
                <el-input v-model="testForm.model" :placeholder="selectedConfig.modelCode || t('aiTest.placeholders.model')" />
              </el-form-item>
              <el-form-item :label="t('aiTest.labels.apiKey')">
                <el-input
                  v-model="testForm.apiKey"
                  type="password"
                  show-password
                  :placeholder="selectedConfig.hasKey ? t('aiTest.labels.noSavedKey') : t('aiTest.placeholders.apiKey')"
                />
              </el-form-item>
              <el-form-item :label="t('aiTest.labels.maxTokens')">
                <el-input-number v-model="testForm.maxTokens" :min="64" :max="8192" :step="64" />
              </el-form-item>
              <el-form-item :label="t('aiTest.labels.systemPrompt')" class="span-2">
                <el-input
                  v-model="testForm.systemPrompt"
                  type="textarea"
                  :rows="2"
                  :placeholder="t('aiTest.placeholders.systemPrompt')"
                />
              </el-form-item>
              <el-form-item :label="t('aiTest.labels.userPrompt')" class="span-2">
                <el-input v-model="testForm.prompt" type="textarea" :rows="3" />
              </el-form-item>
              <el-form-item :label="t('aiTest.labels.temperature')">
                <el-input-number v-model="testForm.temperature" :min="0" :max="2" :step="0.1" />
              </el-form-item>
            </el-form>

            <div class="status-row">
              <el-tag size="small" :type="status === 'error' ? 'danger' : 'info'">
                {{ t('aiTest.status.label', { status }) }}
              </el-tag>
              <el-tag v-if="testMeta" size="small" type="success">
                {{ t('aiTest.status.chunks') }}: {{ testMeta.chunkCount }} |
                {{ t('aiTest.status.chars') }}: {{ testMeta.charCount }} |
                {{ testMeta.elapsedMs }}ms |
                {{ testMeta.finishReason || t('aiTest.status.completed') }}
              </el-tag>
            </div>

            <el-alert
              v-if="error"
              :title="error"
              type="error"
              show-icon
              :closable="false"
              class="test-error"
            />

            <div v-if="output" class="test-output">{{ output }}</div>
            <el-empty v-else :description="t('aiTest.status.noOutput')" :image-size="80" />
          </section>
        </template>

        <el-empty v-else :description="t('aiModels.provider.selectedEmpty')" />
      </el-card>
    </div>

    <el-dialog
      v-model="editorVisible"
      :title="editorMode === 'create' ? t('aiModels.config.create') : t('aiModels.config.edit')"
      width="860px"
      :close-on-click-modal="false"
    >
      <div class="editor-shell">
        <el-form :model="editorForm" label-width="110px" label-position="right" class="editor-form">
          <el-form-item :label="t('aiModels.config.form.platform')" required>
            <el-select v-model="editorForm.platformCode" style="width: 100%">
              <el-option
                v-for="platform in platformOptions"
                :key="platform.code"
                :label="`${platform.name} · ${platform.hint}`"
                :value="platform.code"
              />
            </el-select>
          </el-form-item>

          <el-form-item :label="t('aiModels.config.form.name')" required>
            <el-input v-model="editorForm.name" :placeholder="t('aiModels.config.placeholders.name')" />
          </el-form-item>

          <el-form-item :label="t('aiModels.config.form.endpoint')" required>
            <el-input v-model="editorForm.defaultEndpoint" :placeholder="defaultEndpointFor(editorForm.platformCode)" />
          </el-form-item>

          <el-form-item :label="t('aiModels.config.form.apiKey')" :required="editorMode === 'create'">
            <el-input
              v-model="editorForm.plainKey"
              type="password"
              show-password
              :placeholder="editorMode === 'edit' ? t('aiModels.config.placeholders.keepExistingKey') : 'sk-...'"
            />
          </el-form-item>

          <el-form-item :label="t('aiModels.config.form.apiKeyName')">
            <el-input v-model="editorForm.apiKeyName" :placeholder="t('aiModels.config.placeholders.keyName')" />
          </el-form-item>

          <el-form-item :label="t('aiModels.config.form.notes')">
            <el-input v-model="editorForm.notes" type="textarea" :rows="2" :placeholder="t('aiModels.config.placeholders.notes')" />
          </el-form-item>

          <el-form-item :label="t('aiModels.config.form.sortOrder')">
            <el-input-number v-model="editorForm.sortOrder" :min="0" />
          </el-form-item>

          <el-form-item :label="t('aiModels.config.form.enabled')">
            <el-switch v-model="editorForm.isEnabled" />
          </el-form-item>
        </el-form>

        <div class="model-pane">
          <div class="model-pane-head">
            <div>
              <div class="model-pane-title">{{ t('aiModels.config.modelSection.title') }}</div>
              <div class="model-pane-hint">{{ t('aiModels.config.modelSection.hint') }}</div>
            </div>
            <el-button type="primary" :loading="discoveringModels" :icon="RefreshRight" @click="discoverModels">
              {{ t('aiModels.config.modelSection.fetch') }}
            </el-button>
          </div>

          <div class="model-toolbar">
            <el-input v-model="modelKeyword" :placeholder="t('aiModels.config.placeholders.searchModel')" clearable />
          </div>

          <div class="selected-model">
            <span class="detail-label">{{ t('aiModels.config.form.selectedModel') }}</span>
            <div class="selected-model-value">
              <strong>{{ editorForm.modelName || editorForm.modelCode || '--' }}</strong>
              <span class="detail-sub">{{ editorForm.modelCode || t('aiModels.config.empty.noModel') }}</span>
            </div>
          </div>

          <div class="model-list">
            <button
              v-for="model in filteredRemoteModels"
              :key="model.id"
              type="button"
              :class="['model-item', { active: model.id === editorForm.modelCode }]"
              @click="applyModel(model)"
            >
              <div class="model-name">{{ model.name }}</div>
              <div class="model-id">{{ model.id }}</div>
            </button>
            <el-empty v-if="filteredRemoteModels.length === 0" :description="t('aiModels.config.empty.noDiscoveredModels')" />
          </div>
        </div>
      </div>

      <template #footer>
        <el-button @click="editorVisible = false">{{ t('aiModels.actions.cancel') }}</el-button>
        <el-button type="primary" :loading="saving" @click="saveConfig">{{ t('aiModels.actions.save') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.ai-models {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 1320px;
  margin: 0 auto;
}

.hero-card {
  border-radius: 20px;
  overflow: hidden;
}

.hero-card :deep(.el-card__body) {
  background:
    radial-gradient(circle at top right, rgba(225, 90, 62, 0.12), transparent 32%),
    linear-gradient(135deg, rgba(12, 30, 58, 0.96), rgba(24, 58, 87, 0.92));
  color: #f7f5ef;
  padding: 22px 24px;
}

.hero-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.title {
  margin: 0 0 6px;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.hint {
  margin: 0;
  max-width: 760px;
  color: rgba(247, 245, 239, 0.78);
  font-size: 13px;
  line-height: 1.7;
}

.layout {
  display: grid;
  grid-template-columns: 340px 1fr;
  gap: 16px;
}

.config-list-panel,
.detail-panel {
  border-radius: 18px;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.config-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 360px;
}

.config-item {
  width: 100%;
  border: 1px solid rgba(21, 74, 117, 0.12);
  background: linear-gradient(180deg, #ffffff, #f7fbff);
  border-radius: 16px;
  padding: 14px 16px;
  text-align: left;
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}

.config-item:hover,
.config-item.active {
  transform: translateY(-1px);
  border-color: rgba(33, 97, 154, 0.35);
  box-shadow: 0 10px 24px rgba(18, 54, 91, 0.08);
}

.config-item-top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.config-name {
  color: #192436;
  font-size: 17px;
  font-weight: 700;
}

.config-code {
  margin-top: 4px;
  color: #617089;
  font-family: 'SF Mono', Menlo, monospace;
  font-size: 12px;
}

.config-meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: #51627b;
  font-size: 12px;
}

.detail-actions {
  display: flex;
  gap: 8px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.detail-card {
  border: 1px solid rgba(25, 69, 112, 0.1);
  border-radius: 16px;
  padding: 16px;
  background: linear-gradient(180deg, #ffffff, #fbfcfe);
}

.detail-label {
  color: #6c7a8c;
  font-size: 12px;
  margin-bottom: 8px;
}

.detail-value {
  color: #1a2434;
  font-size: 16px;
  font-weight: 700;
}

.detail-sub,
.detail-mono {
  color: #60718a;
  font-size: 12px;
  margin-top: 6px;
}

.detail-mono {
  font-family: 'SF Mono', Menlo, monospace;
  line-height: 1.6;
  word-break: break-all;
}

.notes-alert {
  margin-top: 14px;
}

.test-panel {
  margin-top: 16px;
  border: 1px solid rgba(25, 69, 112, 0.1);
  border-radius: 18px;
  background:
    linear-gradient(180deg, #ffffff, #fbfcfe),
    radial-gradient(circle at top right, rgba(49, 121, 187, 0.08), transparent 38%);
  padding: 16px;
}

.test-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.test-head h3 {
  margin: 0;
  color: #172236;
  font-size: 17px;
}

.test-head p {
  margin: 5px 0 0;
  color: #65758c;
  font-size: 12px;
}

.test-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 12px;
}

.test-form .span-2 {
  grid-column: 1 / -1;
}

.status-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 6px 0 10px;
}

.test-error {
  margin-bottom: 10px;
}

.test-output {
  min-height: 120px;
  max-height: 320px;
  overflow: auto;
  border: 1px solid rgba(24, 66, 109, 0.12);
  border-radius: 12px;
  background: #f7fbff;
  color: #1d2a3a;
  padding: 13px 14px;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.8;
}

.editor-shell {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 18px;
}

.editor-form {
  padding-right: 6px;
}

.model-pane {
  border: 1px solid rgba(24, 66, 109, 0.12);
  border-radius: 18px;
  padding: 16px;
  background:
    linear-gradient(180deg, rgba(248, 251, 255, 0.98), rgba(255, 255, 255, 0.98)),
    radial-gradient(circle at top, rgba(76, 128, 196, 0.08), transparent 50%);
}

.model-pane-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.model-pane-title {
  color: #182438;
  font-size: 15px;
  font-weight: 700;
}

.model-pane-hint {
  margin-top: 4px;
  color: #6a7890;
  font-size: 12px;
  line-height: 1.6;
}

.model-toolbar {
  margin: 14px 0 12px;
}

.selected-model {
  border: 1px dashed rgba(34, 95, 146, 0.28);
  border-radius: 14px;
  padding: 12px 14px;
  margin-bottom: 12px;
  background: rgba(236, 244, 255, 0.7);
}

.selected-model-value {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.model-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 360px;
  overflow: auto;
  padding-right: 4px;
}

.model-item {
  width: 100%;
  border: 1px solid rgba(28, 82, 127, 0.12);
  border-radius: 14px;
  padding: 11px 12px;
  background: #fff;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.model-item:hover,
.model-item.active {
  border-color: rgba(31, 93, 147, 0.38);
  background: rgba(235, 244, 255, 0.9);
}

.model-name {
  color: #1a2433;
  font-size: 14px;
  font-weight: 700;
}

.model-id {
  margin-top: 4px;
  color: #6d7b8e;
  font-family: 'SF Mono', Menlo, monospace;
  font-size: 11px;
}

@media (max-width: 980px) {
  .layout,
  .editor-shell {
    grid-template-columns: 1fr;
  }

  .detail-grid {
    grid-template-columns: 1fr;
  }

  .test-form {
    grid-template-columns: 1fr;
  }

  .hero-row {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
