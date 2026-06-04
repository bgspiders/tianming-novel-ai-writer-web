<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Collection, DocumentChecked, MagicStick, Refresh } from '@element-plus/icons-vue'
import { storeToRefs } from 'pinia'
import { listProviderConfigs, type AiProviderConfig } from '@/api/modules/ai'
import {
  exportTianmingKnowledgeBase,
  getTianmingKnowledgeBaseFile,
  getTianmingKnowledgeBaseStatus,
  importTianmingKnowledgeBaseFile,
  listTianmingKnowledgeBaseFiles,
  listTianmingProtocols,
  runTianmingProtocol,
  type TianmingKnowledgeBaseFile,
  type TianmingKnowledgeBaseBindingStatus,
  type TianmingProtocolDescriptor,
  type TianmingProtocolResult
} from '@/api/modules/tianming'
import { useAiTestStore } from '@/stores/aiTest'
import { useWorkContextStore } from '@/stores/workContext'

const workContext = useWorkContextStore()
const aiStore = useAiTestStore()
const { form: aiForm } = storeToRefs(aiStore)

const protocols = ref<TianmingProtocolDescriptor[]>([])
const knowledgeFiles = ref<TianmingKnowledgeBaseFile[]>([])
const result = ref<TianmingProtocolResult | null>(null)
const activeKnowledgeFile = ref<TianmingKnowledgeBaseFile | null>(null)
const knowledgeStatus = ref<TianmingKnowledgeBaseBindingStatus | null>(null)
const loading = ref(false)
const loadingKnowledge = ref(false)
const loadingConfigs = ref(false)
const configs = ref<AiProviderConfig[]>([])
const selectedConfigId = ref('')
const selectedKey = ref('initialize')
const selectedKnowledgeKey = ref('world_stone')
const stepResults = reactive<Record<string, TianmingProtocolResult | null>>({})

const form = reactive({
  chapterNumber: 1,
  startChapterNumber: 1,
  endChapterNumber: 10,
  prompt: '',
  systemPrompt: '你是天命长篇小说系统。严格遵守当前协议输出。',
  temperature: 0.8,
  maxTokens: 4096,
  saveToChapter: false
})

const importForm = reactive({
  content: ''
})

const selectedProtocol = computed(() => protocols.value.find((item) => item.key === selectedKey.value) ?? protocols.value[0])
const selectedConfig = computed(() => configs.value.find((item) => item.providerId === selectedConfigId.value) ?? null)
const workflowSteps = computed(() => {
  const order = ['initialize', 'outline', 'plan', 'directory', 'draft', 'manifest', 'health_check', 'archive']
  return order
    .map((key, index) => {
      const protocol = protocols.value.find((item) => item.key === key)
      return protocol
        ? {
            index: index + 1,
            key,
            label: protocol.label,
            command: protocol.command,
            apiId: protocol.apiId,
            description: protocol.description,
            result: stepResults[key] ?? null
          }
        : null
    })
    .filter(Boolean) as Array<{
      index: number
      key: string
      label: string
      command: string
      apiId: string
      description: string
      result: TianmingProtocolResult | null
    }>
})

async function loadProtocols() {
  protocols.value = await listTianmingProtocols()
  if (!protocols.value.some((item) => item.key === selectedKey.value)) {
    selectedKey.value = protocols.value[0]?.key ?? 'initialize'
  }
}

async function loadKnowledgeFiles() {
  knowledgeFiles.value = await listTianmingKnowledgeBaseFiles()
  if (!knowledgeFiles.value.some((item) => item.key === selectedKnowledgeKey.value)) {
    selectedKnowledgeKey.value = knowledgeFiles.value[0]?.key ?? 'world_stone'
  }
}

async function refreshKnowledgeStatus() {
  if (!workContext.selectedProjectId) return
  knowledgeStatus.value = await getTianmingKnowledgeBaseStatus(
    workContext.selectedProjectId,
    workContext.selectedProject?.currentSourceBookId ?? null
  )
}

async function loadConfigs() {
  loadingConfigs.value = true
  try {
    configs.value = (await listProviderConfigs()).filter((item) => item.isEnabled)
    selectedConfigId.value = configs.value[0]?.providerId ?? ''
    applyConfig()
  } finally {
    loadingConfigs.value = false
  }
}

function applyConfig() {
  const config = selectedConfig.value
  if (!config) return
  if (config.defaultEndpoint) aiForm.value.endpoint = config.defaultEndpoint
  if (config.modelCode) aiForm.value.model = config.modelCode
}

async function runProtocol(key = selectedKey.value) {
  if (!workContext.selectedProjectId) {
    ElMessage.warning('请先选择项目。')
    return
  }

  selectedKey.value = key
  const protocol = selectedProtocol.value
  loading.value = true
  result.value = null

  try {
    result.value = await runTianmingProtocol({
      command: protocol?.command ?? key,
      projectId: workContext.selectedProjectId,
      sourceBookId: workContext.selectedProject?.currentSourceBookId ?? null,
      volumeId: workContext.selectedVolumeId || null,
      chapterNumber: form.chapterNumber,
      startChapterNumber: form.startChapterNumber,
      endChapterNumber: form.endChapterNumber,
      prompt: form.prompt.trim() || null,
      systemPrompt: form.systemPrompt.trim() || null,
      configId: selectedConfigId.value || null,
      providerId: selectedConfigId.value || null,
      endpoint: aiForm.value.endpoint || null,
      model: aiForm.value.model || null,
      apiKey: aiForm.value.apiKey || null,
      temperature: form.temperature,
      maxTokens: form.maxTokens,
      saveToChapter: form.saveToChapter
    })
    stepResults[key] = result.value
    aiStore.saveToStorage()
    if (result.value.status === 'fatal') {
      ElMessage.error('协议门禁未通过。')
    } else {
      ElMessage.success('协议执行完成。')
    }
  } catch (err) {
    ElMessage.error((err as Error).message || '协议执行失败。')
  } finally {
    loading.value = false
  }
}

async function runWorkflowUntil(targetKey: string) {
  const steps = workflowSteps.value
  const targetIndex = steps.findIndex((item) => item.key === targetKey)
  if (targetIndex < 0) return
  for (const step of steps.slice(0, targetIndex + 1)) {
    await runProtocol(step.key)
    if (result.value?.status === 'fatal') break
  }
}

function getStepState(step: { key: string; result: TianmingProtocolResult | null }) {
  if (selectedKey.value === step.key && loading.value) return 'running'
  if (!step.result) return 'waiting'
  if (step.result.status === 'fatal') return 'fatal'
  if (step.result.status === 'missing') return 'missing'
  return 'done'
}

async function loadKnowledgeFile(key = selectedKnowledgeKey.value) {
  if (!workContext.selectedProjectId) {
    ElMessage.warning('请先选择项目。')
    return
  }

  loadingKnowledge.value = true
  selectedKnowledgeKey.value = key
  try {
    activeKnowledgeFile.value = await getTianmingKnowledgeBaseFile(
      key,
      workContext.selectedProjectId,
      workContext.selectedProject?.currentSourceBookId ?? null
    )
    importForm.content = activeKnowledgeFile.value.content
    await refreshKnowledgeStatus()
    ElMessage.success(`已生成《${activeKnowledgeFile.value.fileName}》`)
  } catch (err) {
    ElMessage.error((err as Error).message || '生成知识库文件失败。')
  } finally {
    loadingKnowledge.value = false
  }
}

async function importCurrentKnowledgeFile() {
  if (!workContext.selectedProjectId) {
    ElMessage.warning('请先选择项目。')
    return
  }
  if (!importForm.content.trim()) {
    ElMessage.warning('导入内容不能为空。')
    return
  }

  loadingKnowledge.value = true
  try {
    activeKnowledgeFile.value = await importTianmingKnowledgeBaseFile({
      projectId: workContext.selectedProjectId,
      sourceBookId: workContext.selectedProject?.currentSourceBookId ?? null,
      key: selectedKnowledgeKey.value,
      content: importForm.content
    })
    await refreshKnowledgeStatus()
    ElMessage.success(`已绑定《${activeKnowledgeFile.value.fileName}》`)
  } catch (err) {
    ElMessage.error((err as Error).message || '导入知识库文件失败。')
  } finally {
    loadingKnowledge.value = false
  }
}

async function exportAllKnowledgeFiles() {
  if (!workContext.selectedProjectId) {
    ElMessage.warning('请先选择项目。')
    return
  }

  loadingKnowledge.value = true
  try {
    const files = await exportTianmingKnowledgeBase(
      workContext.selectedProjectId,
      workContext.selectedProject?.currentSourceBookId ?? null
    )
    activeKnowledgeFile.value = {
      key: 'all',
      fileName: '天命知识库五件套.md',
      title: '天命知识库五件套',
      description: '五件套合并预览',
      isBound: files.every((item) => item.isBound),
      isMissing: files.some((item) => item.isMissing),
      characterCount: files.reduce((sum, item) => sum + item.characterCount, 0),
      generatedAt: new Date().toISOString(),
      content: files.map((item) => `<!-- ${item.fileName} -->\n\n${item.content}`).join('\n\n---\n\n')
    }
    ElMessage.success('五件套已生成。')
  } catch (err) {
    ElMessage.error((err as Error).message || '导出知识库失败。')
  } finally {
    loadingKnowledge.value = false
  }
}

onMounted(async () => {
  aiStore.loadFromStorage()
  await workContext.init()
  await Promise.all([loadProtocols(), loadKnowledgeFiles(), loadConfigs()])
  await refreshKnowledgeStatus()
})
</script>

<template>
  <main class="tm-protocol">
    <header class="page-head">
      <div>
        <p class="eyebrow">Tianming Protocol</p>
        <h1>天命协议工作台</h1>
        <p class="summary">初始化、大纲、规划、目录、草案、正文、体检、存档统一从这里执行。</p>
      </div>
      <div class="head-actions">
        <el-button :icon="Refresh" :loading="loading" @click="runWorkflowUntil('archive')">跑完整流程</el-button>
        <el-button type="primary" :icon="Refresh" :loading="loading" @click="runProtocol()">运行当前协议</el-button>
      </div>
    </header>

    <section class="flow-panel">
      <article
        v-for="step in workflowSteps"
        :key="step.key"
        class="flow-step"
        :class="[getStepState(step), { active: selectedKey === step.key }]"
        @click="selectedKey = step.key"
      >
        <div class="step-index">{{ step.index }}</div>
        <div class="step-copy">
          <strong>{{ step.label }}</strong>
          <span>{{ step.command }}</span>
        </div>
        <button class="step-run" type="button" @click.stop="runWorkflowUntil(step.key)">跑到这里</button>
      </article>
    </section>

    <section class="workspace">
      <aside class="protocol-list">
        <button
          v-for="item in protocols"
          :key="item.key"
          class="protocol-item"
          :class="{ active: selectedKey === item.key }"
          type="button"
          @click="selectedKey = item.key"
        >
          <span>{{ item.label }}</span>
          <small>{{ item.apiId }}</small>
        </button>
      </aside>

      <section class="panel">
        <div class="panel-title">
          <el-icon><Collection /></el-icon>
          <span>{{ selectedProtocol?.label ?? '协议' }}</span>
          <small>{{ selectedProtocol?.command }}</small>
        </div>
        <p class="protocol-desc">{{ selectedProtocol?.description }}</p>
        <div class="gate-summary" :class="result?.status === 'fatal' ? 'fatal' : ''">
          <strong>当前门禁</strong>
          <span>{{ result?.status ?? '未执行' }}</span>
          <small>协议优先读取已绑定 Markdown 五件套，缺少关键蓝图会返回 fatal。</small>
        </div>

        <el-form label-position="top" class="form-grid">
          <el-form-item label="项目">
            <el-input :model-value="workContext.selectedProject?.name ?? '未选择项目'" readonly />
          </el-form-item>
          <el-form-item label="章节号">
            <el-input-number v-model="form.chapterNumber" :min="1" controls-position="right" />
          </el-form-item>
          <el-form-item label="目录起始章">
            <el-input-number v-model="form.startChapterNumber" :min="1" controls-position="right" />
          </el-form-item>
          <el-form-item label="目录结束章">
            <el-input-number v-model="form.endChapterNumber" :min="1" controls-position="right" />
          </el-form-item>
          <el-form-item label="AI 配置">
            <el-select v-model="selectedConfigId" clearable filterable :loading="loadingConfigs" @change="applyConfig">
              <el-option v-for="item in configs" :key="item.providerId" :label="item.name" :value="item.providerId" />
            </el-select>
          </el-form-item>
          <el-form-item label="模型">
            <el-input v-model="aiForm.model" />
          </el-form-item>
          <el-form-item label="Endpoint">
            <el-input v-model="aiForm.endpoint" />
          </el-form-item>
          <el-form-item label="最大 Tokens">
            <el-input-number v-model="form.maxTokens" :min="1500" :max="30000" :step="500" />
          </el-form-item>
        </el-form>

        <el-form label-position="top">
          <el-form-item label="系统提示词">
            <el-input v-model="form.systemPrompt" type="textarea" :rows="2" />
          </el-form-item>
          <el-form-item label="补充指令">
            <el-input v-model="form.prompt" type="textarea" :rows="4" placeholder="可选。正文协议会附加到生成提示里。" />
          </el-form-item>
          <div class="actions">
            <el-checkbox v-model="form.saveToChapter">正文协议保存到章节</el-checkbox>
            <el-button type="primary" :icon="MagicStick" :loading="loading" @click="runProtocol()">执行协议</el-button>
          </div>
        </el-form>
      </section>

      <section class="panel result-panel">
        <el-tabs>
          <el-tab-pane label="协议输出">
            <div class="panel-title">
              <el-icon><DocumentChecked /></el-icon>
              <span>{{ result?.title ?? '协议输出' }}</span>
              <small>{{ result?.status ?? 'idle' }}</small>
            </div>
            <pre class="result-output">{{ result?.content ?? '选择协议并执行后，这里显示结果。' }}</pre>
          </el-tab-pane>
          <el-tab-pane label="知识库五件套">
            <div class="panel-title">
              <el-icon><DocumentChecked /></el-icon>
              <span>{{ activeKnowledgeFile?.fileName ?? '知识库文件' }}</span>
              <small>{{ knowledgeStatus?.allRequiredBound ? '已全部绑定' : '存在缺失' }}</small>
            </div>
            <div v-if="knowledgeStatus && !knowledgeStatus.allRequiredBound" class="kb-alert">
              缺失：{{ knowledgeStatus.missingRequiredFiles.join('、') }}
            </div>
            <div class="kb-toolbar">
              <el-select v-model="selectedKnowledgeKey" size="small" @change="(key: string) => loadKnowledgeFile(key)">
                <el-option
                  v-for="item in knowledgeFiles"
                  :key="item.key"
                  :label="item.fileName"
                  :value="item.key"
                />
              </el-select>
              <el-button size="small" :loading="loadingKnowledge" @click="loadKnowledgeFile()">生成当前文件</el-button>
              <el-button size="small" type="primary" :loading="loadingKnowledge" @click="exportAllKnowledgeFiles">生成五件套</el-button>
              <el-button size="small" type="success" :loading="loadingKnowledge" @click="importCurrentKnowledgeFile">导入绑定</el-button>
            </div>
            <el-input
              v-model="importForm.content"
              class="kb-import"
              type="textarea"
              :rows="6"
              placeholder="可粘贴对应 Markdown 文件内容，然后点击导入绑定。"
            />
            <pre class="result-output">{{ activeKnowledgeFile?.content ?? '选择文件后生成 Markdown 预览。' }}</pre>
          </el-tab-pane>
        </el-tabs>
      </section>
    </section>
  </main>
</template>

<style scoped>
.tm-protocol {
  padding: 24px;
}

.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.head-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.eyebrow {
  margin: 0 0 6px;
  color: var(--el-color-primary);
  font-size: 12px;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  font-size: 26px;
}

.summary,
.protocol-desc {
  margin: 6px 0 0;
  color: var(--el-text-color-secondary);
}

.flow-panel {
  display: grid;
  grid-template-columns: repeat(8, minmax(120px, 1fr));
  gap: 10px;
  margin-bottom: 16px;
}

.flow-step {
  min-height: 86px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-bg-color);
  padding: 10px;
  cursor: pointer;
}

.flow-step.active {
  border-color: var(--el-color-primary);
  box-shadow: inset 0 0 0 1px var(--el-color-primary);
}

.flow-step.done {
  border-color: var(--el-color-success-light-5);
  background: var(--el-color-success-light-9);
}

.flow-step.fatal {
  border-color: var(--el-color-danger-light-5);
  background: var(--el-color-danger-light-9);
}

.flow-step.missing {
  border-color: var(--el-color-warning-light-5);
  background: var(--el-color-warning-light-9);
}

.flow-step.running {
  border-color: var(--el-color-primary-light-3);
  background: var(--el-color-primary-light-9);
}

.step-index {
  display: inline-grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  background: var(--el-fill-color);
  color: var(--el-text-color-secondary);
  font-size: 12px;
  font-weight: 700;
}

.step-copy {
  display: grid;
  gap: 3px;
  margin-top: 8px;
}

.step-copy strong {
  font-size: 14px;
}

.step-copy span {
  overflow: hidden;
  color: var(--el-text-color-secondary);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.step-run {
  width: 100%;
  margin-top: 8px;
  border: 0;
  border-radius: 6px;
  background: var(--el-fill-color);
  color: var(--el-text-color-regular);
  padding: 5px 0;
  cursor: pointer;
}

.step-run:hover {
  color: var(--el-color-primary);
}

.workspace {
  display: grid;
  grid-template-columns: 220px minmax(360px, 0.9fr) minmax(420px, 1.1fr);
  gap: 16px;
  align-items: start;
}

.protocol-list,
.panel {
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-bg-color);
}

.protocol-list {
  padding: 8px;
}

.protocol-item {
  width: 100%;
  border: 0;
  border-radius: 6px;
  background: transparent;
  padding: 10px;
  text-align: left;
  cursor: pointer;
}

.protocol-item + .protocol-item {
  margin-top: 4px;
}

.protocol-item span,
.protocol-item small {
  display: block;
}

.protocol-item small {
  margin-top: 2px;
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.protocol-item.active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.panel {
  padding: 16px;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
}

.panel-title small {
  margin-left: auto;
  color: var(--el-text-color-secondary);
  font-weight: 400;
}

.gate-summary {
  display: grid;
  grid-template-columns: auto auto 1fr;
  gap: 8px;
  align-items: center;
  margin-top: 14px;
  padding: 10px;
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
}

.gate-summary span {
  color: var(--el-color-primary);
  font-weight: 700;
}

.gate-summary.fatal span {
  color: var(--el-color-danger);
}

.gate-summary small {
  color: var(--el-text-color-secondary);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 12px;
  margin-top: 16px;
}

.actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.kb-toolbar {
  display: grid;
  grid-template-columns: minmax(160px, 1fr) auto auto auto;
  gap: 8px;
  margin-top: 14px;
}

.kb-alert {
  margin-top: 12px;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning-dark-2);
}

.kb-import {
  margin-top: 12px;
}

.result-output {
  min-height: 560px;
  max-height: calc(100vh - 230px);
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 16px 0 0;
  padding: 14px;
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
  line-height: 1.7;
}

@media (max-width: 1180px) {
  .flow-panel {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .workspace {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .page-head,
  .head-actions,
  .actions {
    align-items: stretch;
    flex-direction: column;
  }

  .flow-panel,
  .form-grid,
  .kb-toolbar {
    grid-template-columns: 1fr;
  }

  .gate-summary {
    grid-template-columns: 1fr;
  }
}
</style>
