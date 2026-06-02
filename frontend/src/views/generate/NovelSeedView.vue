<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { MagicStick, Notebook, Cpu, DocumentAdd, CollectionTag } from '@element-plus/icons-vue'
import { storeToRefs } from 'pinia'
import { listProviderConfigs, type AiProviderConfig } from '@/api/modules/ai'
import { generateNovelSeed, type NovelSeedResult } from '@/api/modules/novelSeed'
import { chatHub } from '@/signalr/chat'
import { useAiTestStore } from '@/stores/aiTest'
import { useWorkContextStore } from '@/stores/workContext'

const router = useRouter()
const aiStore = useAiTestStore()
const workContext = useWorkContextStore()
const { form: aiForm } = storeToRefs(aiStore)

const configs = ref<AiProviderConfig[]>([])
const selectedConfigId = ref('')
const loadingConfigs = ref(false)
const generating = ref(false)
const result = ref<NovelSeedResult | null>(null)
const currentRunId = ref('')
const streamText = ref('')
const streamStatus = ref('idle')
const streamError = ref('')

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

function applySelectedConfig() {
  const config = selectedConfig.value
  if (!config) return
  if (config.defaultEndpoint) aiForm.value.endpoint = config.defaultEndpoint
  if (config.modelCode) aiForm.value.model = config.modelCode
}

async function submit() {
  if (!form.description.trim()) {
    ElMessage.warning('请先输入小说描述。')
    return
  }
  if (!aiForm.value.endpoint || !aiForm.value.model) {
    ElMessage.warning('请填写 Endpoint 和模型。')
    return
  }
  if (!selectedConfigId.value && !aiForm.value.apiKey) {
    ElMessage.warning('请选择已保存配置，或填写临时 API Key。')
    return
  }

  generating.value = true
  result.value = null
  streamText.value = ''
  streamError.value = ''
  streamStatus.value = 'connecting'
  const runId = crypto.randomUUID()
  currentRunId.value = runId

  try {
    await chatHub.joinRun(runId)
    const created = await generateNovelSeed({
      runId,
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
    })

    result.value = created
    await workContext.refreshProjects()
    workContext.selectedProjectId = created.project.id
    workContext.selectedVolumeId = created.volumes[0]?.id ?? ''
    aiStore.saveToStorage()
    ElMessage.success(`已创建《${created.project.name}》`)
  } catch (err) {
    streamError.value = (err as Error).message || 'AI 开书失败。'
    streamStatus.value = 'error'
    ElMessage.error(streamError.value)
  } finally {
    generating.value = false
    await chatHub.leaveRun(runId)
    currentRunId.value = ''
  }
}

function openProject() {
  if (!result.value) return
  router.push('/generate/chapters')
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

onMounted(() => {
  chatHub.onToken(onToken)
  chatHub.onStatus(onStatus)
  chatHub.onCompleted(onCompleted)
  chatHub.onError(onError)
  void loadConfigs()
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
  <main class="novel-seed">
    <header class="page-head">
      <div>
        <p class="eyebrow">AI 开书规划</p>
        <h1>用描述生成一整套小说骨架</h1>
        <p class="summary">输入题材和大方向，先创建开书素材、世界观、人物、势力、地点、大纲、卷设计、章节计划和章节蓝图。</p>
      </div>
      <el-button type="primary" :icon="MagicStick" :loading="generating" @click="submit">
        {{ generating ? '生成中' : '生成新小说' }}
      </el-button>
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

    <section v-if="generating || streamText || streamError" class="panel stream-panel">
      <div class="panel-title">
        <el-icon><MagicStick /></el-icon>
        <span>AI 实时规划</span>
        <small>{{ streamStatus }}</small>
      </div>
      <pre class="stream-output">{{ streamText || '等待 AI 返回规划 JSON...' }}</pre>
      <p v-if="streamError" class="stream-error">{{ streamError }}</p>
    </section>

    <section v-if="result" class="panel result-panel">
      <div class="panel-title">
        <el-icon><DocumentAdd /></el-icon>
        <span>生成结果</span>
      </div>
      <div class="result-grid">
        <div><strong>{{ result.project.name }}</strong><span>项目</span></div>
        <div><strong>{{ result.volumes.length }}</strong><span>分卷</span></div>
        <div><strong>{{ result.totalPlannedChapterCount }}</strong><span>全书章数</span></div>
        <div><strong>{{ result.creativeMaterialCount }}</strong><span>创意素材</span></div>
        <div><strong>{{ result.characterRuleCount }}</strong><span>角色</span></div>
        <div><strong>{{ result.factionRuleCount }}</strong><span>势力</span></div>
        <div><strong>{{ result.locationRuleCount }}</strong><span>地点</span></div>
        <div><strong>{{ result.chapterPlanCount }}</strong><span>首批章节规划</span></div>
        <div><strong>{{ result.chapterBlueprintCount }}</strong><span>章节蓝图</span></div>
      </div>
      <div class="result-actions">
        <el-button type="primary" @click="openProject">进入章节生成</el-button>
        <el-button @click="router.push('/design/world_rules')">查看世界观</el-button>
        <el-button @click="router.push('/design/creative_materials')">查看创意素材</el-button>
      </div>
    </section>
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

.metrics,
.result-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin: 6px 0 14px;
}

.metrics div,
.result-grid div {
  border: 1px solid var(--tm-border);
  border-radius: 6px;
  padding: 12px;
  background: var(--tm-bg);
}

.metrics strong,
.result-grid strong {
  display: block;
  color: var(--tm-fg);
  font-size: 20px;
}

.metrics span,
.result-grid span {
  color: var(--tm-fg-secondary);
  font-size: 12px;
}

.result-grid {
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
}

.result-actions {
  display: flex;
  gap: 10px;
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

.stream-error {
  margin: 10px 0 0;
  color: var(--tm-danger, #d03050);
}

@media (max-width: 1200px) {
  .seed-grid {
    grid-template-columns: 1fr;
  }

  .result-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
