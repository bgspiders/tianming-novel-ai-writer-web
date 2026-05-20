<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Edit, Plus, Promotion } from '@element-plus/icons-vue'
import {
  createKey,
  createModel,
  createProvider,
  deleteKey,
  deleteModel,
  deleteProvider,
  listKeys,
  listModels,
  listProviders,
  testKey,
  updateKey,
  updateModel,
  updateProvider,
  type AiApiKey,
  type AiApiKeyCreate,
  type AiApiKeyTestInput,
  type AiApiKeyTestResult,
  type AiApiKeyUpdate,
  type AiModel,
  type AiModelUpsert,
  type AiProvider,
  type AiProviderUpsert
} from '@/api/modules/ai'

type CapabilityKey =
  | 'streaming'
  | 'developerMessage'
  | 'arrayContent'
  | 'serviceTier'
  | 'thinking'
  | 'vision'
  | 'tools'

const CAPABILITY_OPTIONS: Array<{ key: CapabilityKey; label: string; hint: string }> = [
  { key: 'streaming', label: 'Streaming', hint: 'Supports SSE or token streaming.' },
  { key: 'developerMessage', label: 'Developer Role', hint: 'Supports system and developer roles.' },
  { key: 'arrayContent', label: 'Array Content', hint: 'Supports array-based message content.' },
  { key: 'serviceTier', label: 'Service Tier', hint: 'Supports a service tier parameter.' },
  { key: 'thinking', label: 'Thinking', hint: 'Supports reasoning or thinking controls.' },
  { key: 'vision', label: 'Vision', hint: 'Accepts image or multimodal input.' },
  { key: 'tools', label: 'Tools', hint: 'Supports function calling or tools.' }
]

function parseCapabilities(value: string): Record<string, boolean> {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>
    return Object.fromEntries(
      CAPABILITY_OPTIONS.map((opt) => [opt.key, Boolean(parsed[opt.key])])
    ) as Record<string, boolean>
  } catch {
    return Object.fromEntries(CAPABILITY_OPTIONS.map((opt) => [opt.key, false])) as Record<string, boolean>
  }
}

function serializeCapabilities(value: Record<string, boolean>): string {
  return JSON.stringify(
    Object.fromEntries(Object.entries(value).filter(([, enabled]) => enabled)),
    null,
    0
  )
}

const providers = ref<AiProvider[]>([])
const selectedProviderId = ref('')
const loadingProviders = ref(false)
const tab = ref<'models' | 'keys'>('models')

const selectedProvider = computed(() =>
  providers.value.find((provider) => provider.id === selectedProviderId.value) ?? null
)

async function refreshProviders(keepSelection = true) {
  loadingProviders.value = true
  try {
    providers.value = await listProviders()
    if (!keepSelection || !providers.value.some((provider) => provider.id === selectedProviderId.value)) {
      selectedProviderId.value = providers.value[0]?.id ?? ''
    }
  } catch (err) {
    ElMessage.error((err as Error).message ?? 'Failed to load providers.')
  } finally {
    loadingProviders.value = false
  }
}

const providerDialogVisible = ref(false)
const providerDialogMode = ref<'create' | 'edit'>('create')
const providerEditId = ref('')
const providerForm = ref<AiProviderUpsert>({
  code: '',
  name: '',
  defaultEndpoint: '',
  iconUrl: '',
  notes: '',
  isEnabled: true,
  sortOrder: 0
})

function openCreateProvider() {
  providerDialogMode.value = 'create'
  providerEditId.value = ''
  providerForm.value = {
    code: '',
    name: '',
    defaultEndpoint: '',
    iconUrl: '',
    notes: '',
    isEnabled: true,
    sortOrder: providers.value.length
  }
  providerDialogVisible.value = true
}

function openEditProvider(provider: AiProvider) {
  providerDialogMode.value = 'edit'
  providerEditId.value = provider.id
  providerForm.value = {
    code: provider.code,
    name: provider.name,
    defaultEndpoint: provider.defaultEndpoint,
    iconUrl: provider.iconUrl,
    notes: provider.notes,
    isEnabled: provider.isEnabled,
    sortOrder: provider.sortOrder
  }
  providerDialogVisible.value = true
}

async function saveProvider() {
  try {
    if (providerDialogMode.value === 'create') {
      await createProvider(providerForm.value)
      ElMessage.success('Provider created.')
    } else {
      await updateProvider(providerEditId.value, providerForm.value)
      ElMessage.success('Provider updated.')
    }
    providerDialogVisible.value = false
    await refreshProviders()
  } catch (err) {
    ElMessage.error((err as Error).message ?? 'Failed to save provider.')
  }
}

async function removeProvider(provider: AiProvider) {
  if (provider.isBuiltIn) {
    ElMessage.warning('Built-in providers cannot be deleted.')
    return
  }

  try {
    await ElMessageBox.confirm(
      `Delete provider "${provider.name}"? Related models and API keys will be removed as well.`,
      'Confirm',
      { type: 'warning' }
    )
  } catch {
    return
  }

  try {
    await deleteProvider(provider.id)
    ElMessage.success('Provider deleted.')
    await refreshProviders(false)
  } catch (err) {
    ElMessage.error((err as Error).message ?? 'Failed to delete provider.')
  }
}

const models = ref<AiModel[]>([])
const loadingModels = ref(false)

async function refreshModels() {
  if (!selectedProviderId.value) {
    models.value = []
    return
  }

  loadingModels.value = true
  try {
    models.value = await listModels(selectedProviderId.value)
  } catch (err) {
    ElMessage.error((err as Error).message ?? 'Failed to load models.')
  } finally {
    loadingModels.value = false
  }
}

const modelDialogVisible = ref(false)
const modelDialogMode = ref<'create' | 'edit'>('create')
const modelEditId = ref('')
const modelForm = ref<AiModelUpsert>({
  code: '',
  name: '',
  description: '',
  contextWindow: null,
  maxOutputTokens: null,
  capabilities: '{}',
  inputPricePerMillion: null,
  outputPricePerMillion: null,
  isEnabled: true,
  sortOrder: 0
})
const capabilityChecks = ref<Record<string, boolean>>(parseCapabilities(modelForm.value.capabilities ?? '{}'))

function openCreateModel() {
  modelDialogMode.value = 'create'
  modelEditId.value = ''
  modelForm.value = {
    code: '',
    name: '',
    description: '',
    contextWindow: null,
    maxOutputTokens: null,
    capabilities: '{"streaming":true}',
    inputPricePerMillion: null,
    outputPricePerMillion: null,
    isEnabled: true,
    sortOrder: models.value.length
  }
  capabilityChecks.value = parseCapabilities(modelForm.value.capabilities ?? '{}')
  modelDialogVisible.value = true
}

function openEditModel(model: AiModel) {
  modelDialogMode.value = 'edit'
  modelEditId.value = model.id
  modelForm.value = {
    code: model.code,
    name: model.name,
    description: model.description,
    contextWindow: model.contextWindow,
    maxOutputTokens: model.maxOutputTokens,
    capabilities: model.capabilities,
    inputPricePerMillion: model.inputPricePerMillion,
    outputPricePerMillion: model.outputPricePerMillion,
    isEnabled: model.isEnabled,
    sortOrder: model.sortOrder
  }
  capabilityChecks.value = parseCapabilities(modelForm.value.capabilities ?? '{}')
  modelDialogVisible.value = true
}

watch(
  capabilityChecks,
  (value) => {
    modelForm.value.capabilities = serializeCapabilities(value)
  },
  { deep: true }
)

async function saveModel() {
  if (!selectedProviderId.value) return

  try {
    modelForm.value.capabilities = serializeCapabilities(capabilityChecks.value)
    if (modelDialogMode.value === 'create') {
      await createModel(selectedProviderId.value, modelForm.value)
      ElMessage.success('Model created.')
    } else {
      await updateModel(selectedProviderId.value, modelEditId.value, modelForm.value)
      ElMessage.success('Model updated.')
    }
    modelDialogVisible.value = false
    await refreshModels()
    await refreshProviders()
  } catch (err) {
    ElMessage.error((err as Error).message ?? 'Failed to save model.')
  }
}

async function removeModel(model: AiModel) {
  try {
    await ElMessageBox.confirm(`Delete model "${model.name}"?`, 'Confirm', { type: 'warning' })
  } catch {
    return
  }

  try {
    await deleteModel(selectedProviderId.value, model.id)
    ElMessage.success('Model deleted.')
    await refreshModels()
    await refreshProviders()
  } catch (err) {
    ElMessage.error((err as Error).message ?? 'Failed to delete model.')
  }
}

const keys = ref<AiApiKey[]>([])
const loadingKeys = ref(false)

async function refreshKeys() {
  if (!selectedProviderId.value) {
    keys.value = []
    return
  }

  loadingKeys.value = true
  try {
    keys.value = await listKeys(selectedProviderId.value)
  } catch (err) {
    ElMessage.error((err as Error).message ?? 'Failed to load API keys.')
  } finally {
    loadingKeys.value = false
  }
}

const keyDialogVisible = ref(false)
const keyDialogMode = ref<'create' | 'edit'>('create')
const keyEditId = ref('')
const keyForm = ref<AiApiKeyCreate & AiApiKeyUpdate>({
  providerId: '',
  name: '',
  plainKey: '',
  isEnabled: true,
  rotationOrder: 0
})

function openCreateKey() {
  keyDialogMode.value = 'create'
  keyEditId.value = ''
  keyForm.value = {
    providerId: selectedProviderId.value,
    name: '',
    plainKey: '',
    isEnabled: true,
    rotationOrder: keys.value.length
  }
  keyDialogVisible.value = true
}

function openEditKey(key: AiApiKey) {
  keyDialogMode.value = 'edit'
  keyEditId.value = key.id
  keyForm.value = {
    providerId: key.providerId,
    name: key.name,
    plainKey: '',
    isEnabled: key.isEnabled,
    rotationOrder: key.rotationOrder
  }
  keyDialogVisible.value = true
}

async function saveKey() {
  try {
    if (keyDialogMode.value === 'create') {
      if (!keyForm.value.plainKey) {
        ElMessage.warning('Please provide an API key value.')
        return
      }

      await createKey({
        providerId: keyForm.value.providerId,
        name: keyForm.value.name,
        plainKey: keyForm.value.plainKey,
        isEnabled: keyForm.value.isEnabled,
        rotationOrder: keyForm.value.rotationOrder
      })
      ElMessage.success('API key created.')
    } else {
      await updateKey(keyEditId.value, {
        name: keyForm.value.name,
        plainKey: keyForm.value.plainKey || null,
        isEnabled: keyForm.value.isEnabled,
        rotationOrder: keyForm.value.rotationOrder
      })
      ElMessage.success('API key updated.')
    }

    keyDialogVisible.value = false
    await refreshKeys()
    await refreshProviders()
  } catch (err) {
    ElMessage.error((err as Error).message ?? 'Failed to save API key.')
  }
}

async function removeKey(key: AiApiKey) {
  try {
    await ElMessageBox.confirm(`Delete API key "${key.name}"?`, 'Confirm', { type: 'warning' })
  } catch {
    return
  }

  try {
    await deleteKey(key.id)
    ElMessage.success('API key deleted.')
    await refreshKeys()
    await refreshProviders()
  } catch (err) {
    ElMessage.error((err as Error).message ?? 'Failed to delete API key.')
  }
}

const testDialogVisible = ref(false)
const testingKeyId = ref('')
const testRunning = ref(false)
const testForm = ref<AiApiKeyTestInput>({
  endpoint: '',
  modelCode: '',
  prompt: 'Introduce yourself in one sentence.'
})
const testResult = ref<AiApiKeyTestResult | null>(null)

function openTest(key: AiApiKey) {
  testingKeyId.value = key.id
  testForm.value = {
    endpoint: selectedProvider.value?.defaultEndpoint ?? '',
    modelCode: models.value[0]?.code ?? '',
    prompt: 'Introduce yourself in one sentence.'
  }
  testResult.value = null
  testDialogVisible.value = true
}

async function runTest() {
  if (!testForm.value.endpoint || !testForm.value.modelCode) {
    ElMessage.warning('Please provide endpoint and model code.')
    return
  }

  testRunning.value = true
  testResult.value = null
  try {
    testResult.value = await testKey(testingKeyId.value, testForm.value)
    if (testResult.value.ok) {
      ElMessage.success(`Connection test passed: ${testResult.value.outputChars ?? 0} chars / ${testResult.value.elapsedMs ?? 0}ms`)
    } else {
      ElMessage.error(`Connection test failed: ${testResult.value.error ?? 'Unknown error'}`)
    }
  } catch (err) {
    ElMessage.error((err as Error).message ?? 'Failed to run connection test.')
  } finally {
    testRunning.value = false
  }
}

watch(selectedProviderId, () => {
  refreshModels()
  refreshKeys()
})

onMounted(refreshProviders)
</script>

<template>
  <div class="ai-models">
    <el-card shadow="never">
      <div class="header">
        <h2 class="title">AI Model Management</h2>
        <p class="hint">
          Manage providers, models, and encrypted API keys. Keys are stored server-side and can be tested
          against any configured endpoint and model code.
        </p>
      </div>
    </el-card>

    <div class="layout">
      <el-card shadow="never" class="provider-panel">
        <template #header>
          <div class="panel-head">
            <span>Providers</span>
            <el-button type="primary" :icon="Plus" size="small" @click="openCreateProvider">New</el-button>
          </div>
        </template>

        <div v-loading="loadingProviders" class="provider-list">
          <div
            v-for="provider in providers"
            :key="provider.id"
            :class="['provider-item', { active: provider.id === selectedProviderId }]"
            @click="selectedProviderId = provider.id"
          >
            <div class="provider-row">
              <span class="provider-name">{{ provider.name }}</span>
              <el-tag v-if="provider.isBuiltIn" size="small" type="info" effect="plain">Built-in</el-tag>
              <el-tag v-if="!provider.isEnabled" size="small" type="warning">Disabled</el-tag>
            </div>
            <div class="provider-meta">
              <span class="code">{{ provider.code }}</span>
              <span class="counts">{{ provider.modelCount }} models | {{ provider.keyCount }} keys</span>
            </div>
            <div class="provider-actions">
              <el-button size="small" :icon="Edit" link @click.stop="openEditProvider(provider)">Edit</el-button>
              <el-button
                size="small"
                :icon="Delete"
                link
                type="danger"
                :disabled="provider.isBuiltIn"
                @click.stop="removeProvider(provider)"
              >
                Delete
              </el-button>
            </div>
          </div>

          <el-empty v-if="!loadingProviders && providers.length === 0" description="No providers yet" />
        </div>
      </el-card>

      <el-card shadow="never" class="detail-panel">
        <template #header>
          <div class="panel-head">
            <span>{{ selectedProvider?.name || 'Select a provider' }}</span>
            <span v-if="selectedProvider?.defaultEndpoint" class="default-endpoint">
              {{ selectedProvider.defaultEndpoint }}
            </span>
          </div>
        </template>

        <div v-if="selectedProvider">
          <el-tabs v-model="tab">
            <el-tab-pane label="Models" name="models">
              <div class="tab-toolbar">
                <el-button type="primary" :icon="Plus" size="small" @click="openCreateModel">New Model</el-button>
              </div>

              <el-table v-loading="loadingModels" :data="models" stripe size="small">
                <el-table-column prop="code" label="Code" min-width="180" />
                <el-table-column prop="name" label="Name" min-width="160" />
                <el-table-column prop="contextWindow" label="Context" width="100" align="right" />
                <el-table-column prop="maxOutputTokens" label="Max Output" width="110" align="right" />
                <el-table-column label="Status" width="90">
                  <template #default="{ row }">
                    <el-tag :type="row.isEnabled ? 'success' : 'info'" size="small">
                      {{ row.isEnabled ? 'Enabled' : 'Disabled' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="Actions" width="140" align="center">
                  <template #default="{ row }">
                    <el-button size="small" :icon="Edit" link @click="openEditModel(row)">Edit</el-button>
                    <el-button size="small" :icon="Delete" link type="danger" @click="removeModel(row)">Delete</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>

            <el-tab-pane label="API Keys" name="keys">
              <div class="tab-toolbar">
                <el-button type="primary" :icon="Plus" size="small" @click="openCreateKey">Add Key</el-button>
              </div>

              <el-table v-loading="loadingKeys" :data="keys" stripe size="small">
                <el-table-column prop="name" label="Name" min-width="160" />
                <el-table-column label="Tail" width="120">
                  <template #default="{ row }">
                    <span class="masked">{{ row.maskedTail || '--' }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="rotationOrder" label="Order" width="80" align="right" />
                <el-table-column label="Last Used" width="180">
                  <template #default="{ row }">
                    <span class="muted">{{ row.lastUsedAt ? new Date(row.lastUsedAt).toLocaleString() : '--' }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="Status" width="90">
                  <template #default="{ row }">
                    <el-tag :type="row.isEnabled ? 'success' : 'info'" size="small">
                      {{ row.isEnabled ? 'Enabled' : 'Disabled' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="Actions" width="220" align="center">
                  <template #default="{ row }">
                    <el-button size="small" :icon="Promotion" link type="primary" @click="openTest(row)">Test</el-button>
                    <el-button size="small" :icon="Edit" link @click="openEditKey(row)">Edit</el-button>
                    <el-button size="small" :icon="Delete" link type="danger" @click="removeKey(row)">Delete</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>
          </el-tabs>
        </div>

        <el-empty v-else description="Select a provider from the left panel" />
      </el-card>
    </div>

    <el-dialog
      v-model="providerDialogVisible"
      :title="providerDialogMode === 'create' ? 'New Provider' : 'Edit Provider'"
      width="520px"
    >
      <el-form :model="providerForm" label-width="120px" label-position="right">
        <el-form-item label="Code" required>
          <el-input v-model="providerForm.code" placeholder="openai / anthropic" />
        </el-form-item>
        <el-form-item label="Name" required>
          <el-input v-model="providerForm.name" />
        </el-form-item>
        <el-form-item label="Default Endpoint">
          <el-input v-model="providerForm.defaultEndpoint" placeholder="https://api.openai.com/v1" />
        </el-form-item>
        <el-form-item label="Icon URL">
          <el-input v-model="providerForm.iconUrl" />
        </el-form-item>
        <el-form-item label="Notes">
          <el-input v-model="providerForm.notes" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="Enabled">
          <el-switch v-model="providerForm.isEnabled" />
        </el-form-item>
        <el-form-item label="Sort Order">
          <el-input-number v-model="providerForm.sortOrder" :min="0" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="providerDialogVisible = false">Cancel</el-button>
        <el-button type="primary" @click="saveProvider">Save</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="modelDialogVisible"
      :title="modelDialogMode === 'create' ? 'New Model' : 'Edit Model'"
      width="640px"
    >
      <el-form :model="modelForm" label-width="130px" label-position="right">
        <el-form-item label="Model Code" required>
          <el-input v-model="modelForm.code" placeholder="gpt-4o-mini" />
        </el-form-item>
        <el-form-item label="Display Name" required>
          <el-input v-model="modelForm.name" />
        </el-form-item>
        <el-form-item label="Description">
          <el-input v-model="modelForm.description" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="Context Window">
          <el-input-number v-model="modelForm.contextWindow" :min="1" />
        </el-form-item>
        <el-form-item label="Max Output Tokens">
          <el-input-number v-model="modelForm.maxOutputTokens" :min="1" />
        </el-form-item>
        <el-form-item label="Capabilities">
          <div class="capability-grid">
            <el-checkbox
              v-for="option in CAPABILITY_OPTIONS"
              :key="option.key"
              v-model="capabilityChecks[option.key]"
            >
              <div class="capability-item">
                <span>{{ option.label }}</span>
                <small>{{ option.hint }}</small>
              </div>
            </el-checkbox>
          </div>
        </el-form-item>
        <el-form-item label="Input Price / 1M">
          <el-input-number v-model="modelForm.inputPricePerMillion" :precision="4" :step="0.1" />
        </el-form-item>
        <el-form-item label="Output Price / 1M">
          <el-input-number v-model="modelForm.outputPricePerMillion" :precision="4" :step="0.1" />
        </el-form-item>
        <el-form-item label="Enabled">
          <el-switch v-model="modelForm.isEnabled" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="modelDialogVisible = false">Cancel</el-button>
        <el-button type="primary" @click="saveModel">Save</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="keyDialogVisible"
      :title="keyDialogMode === 'create' ? 'Add API Key' : 'Edit API Key'"
      width="520px"
    >
      <el-form :model="keyForm" label-width="120px" label-position="right">
        <el-form-item label="Name" required>
          <el-input v-model="keyForm.name" placeholder="Primary / Backup 1" />
        </el-form-item>
        <el-form-item label="API Key" :required="keyDialogMode === 'create'">
          <el-input
            v-model="keyForm.plainKey"
            type="password"
            show-password
            :placeholder="keyDialogMode === 'edit' ? 'Leave blank to keep the existing key' : 'sk-...'"
          />
        </el-form-item>
        <el-form-item label="Enabled">
          <el-switch v-model="keyForm.isEnabled" />
        </el-form-item>
        <el-form-item label="Rotation Order">
          <el-input-number v-model="keyForm.rotationOrder" :min="0" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="keyDialogVisible = false">Cancel</el-button>
        <el-button type="primary" @click="saveKey">Save</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="testDialogVisible" title="API Key Connection Test" width="520px">
      <el-form :model="testForm" label-width="110px" label-position="right">
        <el-form-item label="Endpoint" required>
          <el-input v-model="testForm.endpoint" placeholder="https://api.openai.com/v1" />
        </el-form-item>
        <el-form-item label="Model Code" required>
          <el-input v-model="testForm.modelCode" placeholder="gpt-4o-mini" />
        </el-form-item>
        <el-form-item label="Prompt">
          <el-input v-model="testForm.prompt" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>

      <el-alert
        v-if="testResult?.ok"
        type="success"
        show-icon
        :closable="false"
        :title="`Passed | ${testResult.outputChars ?? 0} chars | ${testResult.elapsedMs ?? 0}ms`"
      />
      <el-alert
        v-else-if="testResult && !testResult.ok"
        type="error"
        show-icon
        :closable="false"
        :title="testResult.error || 'Failed'"
        :description="`Elapsed ${testResult.elapsedMs ?? 0}ms`"
      />

      <template #footer>
        <el-button @click="testDialogVisible = false">Close</el-button>
        <el-button type="primary" :loading="testRunning" @click="runTest">Run Test</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.ai-models {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 1280px;
  margin: 0 auto;
}

.header .title {
  margin: 0 0 6px;
  color: var(--tm-fg-primary);
  font-size: 20px;
  font-weight: 600;
}

.header .hint {
  margin: 0;
  color: var(--tm-fg-secondary);
  font-size: 13px;
}

.layout {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 16px;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.default-endpoint {
  color: var(--tm-fg-secondary);
  font-family: 'SF Mono', Menlo, monospace;
  font-size: 12px;
}

.provider-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.provider-item {
  padding: 10px 12px;
  border: 1px solid var(--tm-border);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}

.provider-item:hover,
.provider-item.active {
  background: var(--tm-bg-elevated);
}

.provider-item.active {
  border-color: var(--tm-primary);
}

.provider-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.provider-name {
  flex: 1;
  color: var(--tm-fg-primary);
  font-weight: 500;
}

.provider-meta {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
  color: var(--tm-fg-secondary);
  font-size: 12px;
}

.provider-meta .code,
.masked {
  font-family: 'SF Mono', Menlo, monospace;
}

.provider-actions {
  display: flex;
  gap: 4px;
  margin-top: 4px;
}

.tab-toolbar {
  margin-bottom: 8px;
}

.muted,
.masked {
  color: var(--tm-fg-secondary);
  font-size: 12px;
}

.capability-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 12px;
}

.capability-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.capability-item small {
  color: var(--tm-fg-secondary);
  font-size: 12px;
}

@media (max-width: 960px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
</style>
