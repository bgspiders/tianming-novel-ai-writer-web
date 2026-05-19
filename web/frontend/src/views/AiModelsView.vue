<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Edit, Delete, Plus, Key, Promotion } from '@element-plus/icons-vue'
import {
  listProviders,
  createProvider,
  updateProvider,
  deleteProvider,
  listModels,
  createModel,
  updateModel,
  deleteModel,
  listKeys,
  createKey,
  updateKey,
  deleteKey,
  testKey,
  type AiProvider,
  type AiProviderUpsert,
  type AiModel,
  type AiModelUpsert,
  type AiApiKey,
  type AiApiKeyCreate,
  type AiApiKeyUpdate,
  type AiApiKeyTestInput,
  type AiApiKeyTestResult
} from '@/api/modules/ai'

const providers = ref<AiProvider[]>([])
const selectedProviderId = ref<string>('')
const loadingProviders = ref(false)
const tab = ref<'models' | 'keys'>('models')

const selectedProvider = computed(() =>
  providers.value.find((p) => p.id === selectedProviderId.value) ?? null
)

async function refreshProviders(keepSelection = true) {
  loadingProviders.value = true
  try {
    providers.value = await listProviders()
    if (!keepSelection || !providers.value.some((p) => p.id === selectedProviderId.value)) {
      selectedProviderId.value = providers.value[0]?.id ?? ''
    }
  } catch (err) {
    ElMessage.error((err as Error).message ?? '加载 Provider 失败')
  } finally {
    loadingProviders.value = false
  }
}

// --- Provider 编辑 ---
const providerDialogVisible = ref(false)
const providerDialogMode = ref<'create' | 'edit'>('create')
const providerForm = ref<AiProviderUpsert>({
  code: '',
  name: '',
  defaultEndpoint: '',
  iconUrl: '',
  notes: '',
  isEnabled: true,
  sortOrder: 0
})
const providerEditId = ref<string>('')

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
    sortOrder: (providers.value.length || 0)
  }
  providerDialogVisible.value = true
}

function openEditProvider(p: AiProvider) {
  providerDialogMode.value = 'edit'
  providerEditId.value = p.id
  providerForm.value = {
    code: p.code,
    name: p.name,
    defaultEndpoint: p.defaultEndpoint,
    iconUrl: p.iconUrl,
    notes: p.notes,
    isEnabled: p.isEnabled,
    sortOrder: p.sortOrder
  }
  providerDialogVisible.value = true
}

async function saveProvider() {
  try {
    if (providerDialogMode.value === 'create') {
      await createProvider(providerForm.value)
      ElMessage.success('Provider 已创建')
    } else {
      await updateProvider(providerEditId.value, providerForm.value)
      ElMessage.success('Provider 已更新')
    }
    providerDialogVisible.value = false
    await refreshProviders()
  } catch (err) {
    ElMessage.error((err as Error).message ?? '保存失败')
  }
}

async function removeProvider(p: AiProvider) {
  if (p.isBuiltIn) {
    ElMessage.warning('内置 Provider 不可删除，可改为禁用')
    return
  }
  try {
    await ElMessageBox.confirm(`确定删除 "${p.name}"？关联的模型和 Key 会一并删除。`, '确认', { type: 'warning' })
  } catch {
    return
  }
  try {
    await deleteProvider(p.id)
    ElMessage.success('已删除')
    await refreshProviders(false)
  } catch (err) {
    ElMessage.error((err as Error).message ?? '删除失败')
  }
}

// --- Models ---
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
    ElMessage.error((err as Error).message ?? '加载模型失败')
  } finally {
    loadingModels.value = false
  }
}

const modelDialogVisible = ref(false)
const modelDialogMode = ref<'create' | 'edit'>('create')
const modelEditId = ref<string>('')
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
  modelDialogVisible.value = true
}

function openEditModel(m: AiModel) {
  modelDialogMode.value = 'edit'
  modelEditId.value = m.id
  modelForm.value = {
    code: m.code,
    name: m.name,
    description: m.description,
    contextWindow: m.contextWindow,
    maxOutputTokens: m.maxOutputTokens,
    capabilities: m.capabilities,
    inputPricePerMillion: m.inputPricePerMillion,
    outputPricePerMillion: m.outputPricePerMillion,
    isEnabled: m.isEnabled,
    sortOrder: m.sortOrder
  }
  modelDialogVisible.value = true
}

async function saveModel() {
  if (!selectedProviderId.value) return
  try {
    if (modelDialogMode.value === 'create') {
      await createModel(selectedProviderId.value, modelForm.value)
      ElMessage.success('模型已创建')
    } else {
      await updateModel(selectedProviderId.value, modelEditId.value, modelForm.value)
      ElMessage.success('模型已更新')
    }
    modelDialogVisible.value = false
    await refreshModels()
    await refreshProviders()
  } catch (err) {
    ElMessage.error((err as Error).message ?? '保存失败')
  }
}

async function removeModel(m: AiModel) {
  try {
    await ElMessageBox.confirm(`删除模型 "${m.name}"？`, '确认', { type: 'warning' })
  } catch {
    return
  }
  try {
    await deleteModel(selectedProviderId.value, m.id)
    ElMessage.success('已删除')
    await refreshModels()
    await refreshProviders()
  } catch (err) {
    ElMessage.error((err as Error).message ?? '删除失败')
  }
}

// --- Keys ---
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
    ElMessage.error((err as Error).message ?? '加载 Key 失败')
  } finally {
    loadingKeys.value = false
  }
}

const keyDialogVisible = ref(false)
const keyDialogMode = ref<'create' | 'edit'>('create')
const keyEditId = ref<string>('')
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

function openEditKey(k: AiApiKey) {
  keyDialogMode.value = 'edit'
  keyEditId.value = k.id
  keyForm.value = {
    providerId: k.providerId,
    name: k.name,
    plainKey: '',
    isEnabled: k.isEnabled,
    rotationOrder: k.rotationOrder
  }
  keyDialogVisible.value = true
}

async function saveKey() {
  try {
    if (keyDialogMode.value === 'create') {
      if (!keyForm.value.plainKey) {
        ElMessage.warning('请填写 API Key')
        return
      }
      await createKey({
        providerId: keyForm.value.providerId,
        name: keyForm.value.name,
        plainKey: keyForm.value.plainKey,
        isEnabled: keyForm.value.isEnabled,
        rotationOrder: keyForm.value.rotationOrder
      })
      ElMessage.success('Key 已添加（已加密落库）')
    } else {
      await updateKey(keyEditId.value, {
        name: keyForm.value.name,
        plainKey: keyForm.value.plainKey || null,
        isEnabled: keyForm.value.isEnabled,
        rotationOrder: keyForm.value.rotationOrder
      })
      ElMessage.success('Key 已更新')
    }
    keyDialogVisible.value = false
    await refreshKeys()
    await refreshProviders()
  } catch (err) {
    ElMessage.error((err as Error).message ?? '保存失败')
  }
}

async function removeKey(k: AiApiKey) {
  try {
    await ElMessageBox.confirm(`删除 Key "${k.name}"？`, '确认', { type: 'warning' })
  } catch {
    return
  }
  try {
    await deleteKey(k.id)
    ElMessage.success('已删除')
    await refreshKeys()
    await refreshProviders()
  } catch (err) {
    ElMessage.error((err as Error).message ?? '删除失败')
  }
}

// --- Key 测试 ---
const testDialogVisible = ref(false)
const testingKeyId = ref<string>('')
const testForm = ref<AiApiKeyTestInput>({
  endpoint: '',
  modelCode: '',
  prompt: '用一句话介绍你自己'
})
const testResult = ref<AiApiKeyTestResult | null>(null)
const testRunning = ref(false)

function openTest(k: AiApiKey) {
  testingKeyId.value = k.id
  testForm.value = {
    endpoint: selectedProvider.value?.defaultEndpoint ?? '',
    modelCode: models.value[0]?.code ?? '',
    prompt: '用一句话介绍你自己'
  }
  testResult.value = null
  testDialogVisible.value = true
}

async function runTest() {
  if (!testForm.value.endpoint || !testForm.value.modelCode) {
    ElMessage.warning('请填写 Endpoint 与 Model Code')
    return
  }
  testRunning.value = true
  testResult.value = null
  try {
    testResult.value = await testKey(testingKeyId.value, testForm.value)
    if (testResult.value.ok) {
      ElMessage.success(`测试通过：${testResult.value.outputChars} 字 / ${testResult.value.elapsedMs}ms`)
    } else {
      ElMessage.error(`测试失败：${testResult.value.error}`)
    }
  } catch (err) {
    ElMessage.error((err as Error).message ?? '调用失败')
  } finally {
    testRunning.value = false
  }
}

// --- 监听 provider 切换 ---
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
        <h2 class="title">AI 模型管理</h2>
        <p class="hint">
          管理 AI Provider、模型清单与 API Key。Key 用 AES-GCM 加密后落库（master.key 独立保管）。
        </p>
      </div>
    </el-card>

    <div class="layout">
      <!-- 左侧 Provider 列表 -->
      <el-card shadow="never" class="provider-panel">
        <template #header>
          <div class="panel-head">
            <span>Provider</span>
            <el-button type="primary" :icon="Plus" size="small" @click="openCreateProvider">新建</el-button>
          </div>
        </template>
        <div v-loading="loadingProviders" class="provider-list">
          <div
            v-for="p in providers"
            :key="p.id"
            :class="['provider-item', { active: p.id === selectedProviderId }]"
            @click="selectedProviderId = p.id"
          >
            <div class="provider-row">
              <span class="provider-name">{{ p.name }}</span>
              <el-tag v-if="p.isBuiltIn" type="info" size="small" effect="plain">内置</el-tag>
              <el-tag v-if="!p.isEnabled" type="warning" size="small">禁用</el-tag>
            </div>
            <div class="provider-meta">
              <span class="code">{{ p.code }}</span>
              <span class="counts">{{ p.modelCount }} 模型 · {{ p.keyCount }} Key</span>
            </div>
            <div class="provider-actions">
              <el-button size="small" :icon="Edit" link @click.stop="openEditProvider(p)">编辑</el-button>
              <el-button size="small" :icon="Delete" link type="danger" :disabled="p.isBuiltIn" @click.stop="removeProvider(p)">删除</el-button>
            </div>
          </div>
          <el-empty v-if="!loadingProviders && providers.length === 0" description="暂无 Provider" />
        </div>
      </el-card>

      <!-- 右侧 Models / Keys Tab -->
      <el-card shadow="never" class="detail-panel">
        <template #header>
          <div class="panel-head">
            <span>{{ selectedProvider?.name || '请选择 Provider' }}</span>
            <span class="default-endpoint" v-if="selectedProvider?.defaultEndpoint">{{ selectedProvider.defaultEndpoint }}</span>
          </div>
        </template>

        <div v-if="selectedProvider">
          <el-tabs v-model="tab">
            <el-tab-pane label="模型清单" name="models">
              <div class="tab-toolbar">
                <el-button type="primary" :icon="Plus" size="small" @click="openCreateModel">新建模型</el-button>
              </div>
              <el-table v-loading="loadingModels" :data="models" stripe size="small">
                <el-table-column prop="code" label="编码" min-width="180" />
                <el-table-column prop="name" label="名称" min-width="160" />
                <el-table-column prop="contextWindow" label="上下文" width="100" align="right" />
                <el-table-column prop="maxOutputTokens" label="最大输出" width="100" align="right" />
                <el-table-column label="状态" width="80">
                  <template #default="{ row }">
                    <el-tag :type="row.isEnabled ? 'success' : 'info'" size="small">{{ row.isEnabled ? '启用' : '禁用' }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="140" align="center">
                  <template #default="{ row }">
                    <el-button size="small" :icon="Edit" link @click="openEditModel(row)">编辑</el-button>
                    <el-button size="small" :icon="Delete" link type="danger" @click="removeModel(row)">删除</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>

            <el-tab-pane label="API Key" name="keys">
              <div class="tab-toolbar">
                <el-button type="primary" :icon="Plus" size="small" @click="openCreateKey">添加 Key</el-button>
              </div>
              <el-table v-loading="loadingKeys" :data="keys" stripe size="small">
                <el-table-column prop="name" label="名称" min-width="160" />
                <el-table-column label="尾段" width="120">
                  <template #default="{ row }">
                    <span class="masked">{{ row.maskedTail || '—' }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="rotationOrder" label="轮换序" width="80" align="right" />
                <el-table-column label="最近使用" width="180">
                  <template #default="{ row }">
                    <span class="muted">{{ row.lastUsedAt ? new Date(row.lastUsedAt).toLocaleString() : '—' }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="状态" width="80">
                  <template #default="{ row }">
                    <el-tag :type="row.isEnabled ? 'success' : 'info'" size="small">{{ row.isEnabled ? '启用' : '禁用' }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="220" align="center">
                  <template #default="{ row }">
                    <el-button size="small" :icon="Promotion" link type="primary" @click="openTest(row)">测试</el-button>
                    <el-button size="small" :icon="Edit" link @click="openEditKey(row)">编辑</el-button>
                    <el-button size="small" :icon="Delete" link type="danger" @click="removeKey(row)">删除</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>
          </el-tabs>
        </div>
        <el-empty v-else description="请在左侧选择 Provider" />
      </el-card>
    </div>

    <!-- Provider 编辑对话框 -->
    <el-dialog v-model="providerDialogVisible" :title="providerDialogMode === 'create' ? '新建 Provider' : '编辑 Provider'" width="520px">
      <el-form :model="providerForm" label-width="120px" label-position="right">
        <el-form-item label="编码" required>
          <el-input v-model="providerForm.code" placeholder="如 openai / anthropic" />
        </el-form-item>
        <el-form-item label="名称" required>
          <el-input v-model="providerForm.name" />
        </el-form-item>
        <el-form-item label="默认 Endpoint">
          <el-input v-model="providerForm.defaultEndpoint" placeholder="https://api.openai.com/v1" />
        </el-form-item>
        <el-form-item label="图标 URL">
          <el-input v-model="providerForm.iconUrl" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="providerForm.notes" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="providerForm.isEnabled" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="providerForm.sortOrder" :min="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="providerDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveProvider">保存</el-button>
      </template>
    </el-dialog>

    <!-- Model 编辑对话框 -->
    <el-dialog v-model="modelDialogVisible" :title="modelDialogMode === 'create' ? '新建模型' : '编辑模型'" width="600px">
      <el-form :model="modelForm" label-width="130px" label-position="right">
        <el-form-item label="模型 Code" required>
          <el-input v-model="modelForm.code" placeholder="如 gpt-4o-mini" />
        </el-form-item>
        <el-form-item label="显示名" required>
          <el-input v-model="modelForm.name" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="modelForm.description" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="上下文窗口">
          <el-input-number v-model="modelForm.contextWindow" :min="1" />
        </el-form-item>
        <el-form-item label="最大输出 Token">
          <el-input-number v-model="modelForm.maxOutputTokens" :min="1" />
        </el-form-item>
        <el-form-item label="能力 JSON">
          <el-input v-model="modelForm.capabilities" type="textarea" :rows="2"
            placeholder='{"vision":true,"tools":true,"streaming":true}' />
        </el-form-item>
        <el-form-item label="输入价 / 1M">
          <el-input-number v-model="modelForm.inputPricePerMillion" :precision="4" :step="0.1" />
        </el-form-item>
        <el-form-item label="输出价 / 1M">
          <el-input-number v-model="modelForm.outputPricePerMillion" :precision="4" :step="0.1" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="modelForm.isEnabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="modelDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveModel">保存</el-button>
      </template>
    </el-dialog>

    <!-- Key 编辑对话框 -->
    <el-dialog v-model="keyDialogVisible" :title="keyDialogMode === 'create' ? '添加 Key' : '编辑 Key'" width="520px">
      <el-form :model="keyForm" label-width="120px" label-position="right">
        <el-form-item label="名称" required>
          <el-input v-model="keyForm.name" placeholder="如 主账号 / 备用 1" />
        </el-form-item>
        <el-form-item label="API Key" :required="keyDialogMode === 'create'">
          <el-input v-model="keyForm.plainKey" :placeholder="keyDialogMode === 'edit' ? '留空则不修改' : 'sk-...'" type="password" show-password />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="keyForm.isEnabled" />
        </el-form-item>
        <el-form-item label="轮换序">
          <el-input-number v-model="keyForm.rotationOrder" :min="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="keyDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveKey">保存</el-button>
      </template>
    </el-dialog>

    <!-- Key 测试对话框 -->
    <el-dialog v-model="testDialogVisible" title="Key 连通测试" width="520px">
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

      <el-alert v-if="testResult?.ok" type="success" show-icon :closable="false"
        :title="`通过 · ${testResult.outputChars} 字 · ${testResult.elapsedMs}ms`" />
      <el-alert v-else-if="testResult && !testResult.ok" type="error" show-icon :closable="false"
        :title="testResult.error || '失败'" :description="`耗时 ${testResult.elapsedMs}ms`" />

      <template #footer>
        <el-button @click="testDialogVisible = false">关闭</el-button>
        <el-button type="primary" :loading="testRunning" @click="runTest">发起测试</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.ai-models {
  max-width: 1280px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.header .title {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 6px;
  color: var(--tm-fg-primary);
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
  justify-content: space-between;
  align-items: center;
}
.panel-head .default-endpoint {
  font-size: 12px;
  color: var(--tm-fg-secondary);
  font-family: 'SF Mono', Menlo, monospace;
}
.provider-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.provider-item {
  border: 1px solid var(--tm-border);
  border-radius: 6px;
  padding: 10px 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.provider-item:hover {
  background: var(--tm-bg-elevated);
}
.provider-item.active {
  border-color: var(--tm-primary);
  background: var(--tm-bg-elevated);
}
.provider-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.provider-name {
  flex: 1;
  font-weight: 500;
  color: var(--tm-fg-primary);
}
.provider-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--tm-fg-secondary);
  margin-bottom: 4px;
}
.provider-meta .code {
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
.masked {
  font-family: 'SF Mono', Menlo, monospace;
  color: var(--tm-fg-secondary);
}
.muted {
  color: var(--tm-fg-secondary);
  font-size: 12px;
}
</style>
