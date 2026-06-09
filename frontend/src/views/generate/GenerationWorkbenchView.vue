<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useI18n } from '@/composables/useI18n'
import {
  getGenerationFlowStatus,
  getPromptRunSnapshot,
  listPromptRunSnapshots,
  packageGenerationContext,
  type GenerationFlowStatus,
  type PackageContextResult,
  type PromptRunSnapshot
} from '@/api/modules/generation'
import { useWorkContextStore } from '@/stores/workContext'

const workContext = useWorkContextStore()
const router = useRouter()
const { t } = useI18n()
const packaging = ref(false)
const loadingStatus = ref(false)
const loadingSnapshots = ref(false)
const packageResult = ref<PackageContextResult | null>(null)
const flowStatus = ref<GenerationFlowStatus | null>(null)
const promptSnapshots = ref<PromptRunSnapshot[]>([])
const snapshotDrawer = ref(false)
const selectedSnapshot = ref<PromptRunSnapshot | null>(null)

const fallbackCards = [
  {
    key: 'novel_seed',
    title: 'AI 开书',
    path: '/generate/novel-seed',
    icon: '1',
    desc: '从描述或分步工作流生成整书故事、元信息、分卷、章节卡和基础设定。'
  },
  {
    key: 'knowledge_base',
    title: '五件套绑定',
    path: '/generate/tianming-protocol',
    icon: '2',
    desc: '绑定世界基石、世界观规则、角色档案、档案事件、文风样本，运行缺失检测。'
  },
  {
    key: 'outline',
    title: '大纲/规划',
    path: '/generate/planning?module=outlines',
    icon: '3',
    desc: '维护整书大纲、分卷目标、阶段推进和长期结构。'
  },
  {
    key: 'chapter_plans',
    title: '章节计划',
    path: '/generate/planning?module=chapter_plans',
    icon: '4',
    desc: '确认章节标题、简介、核心事件、实体准入、冲突值和宏观阶段。'
  },
  {
    key: 'chapter_blueprints',
    title: '章节蓝图',
    path: '/generate/planning?module=chapter_blueprints',
    icon: '5',
    desc: '把章节拆成场景卡，确认场景顺序、信息增量、POV、钩子和伏笔职责。'
  },
  {
    key: 'tracking',
    title: '叙事追踪',
    path: '/generate/tracking',
    icon: '6',
    desc: '维护伏笔账本和时间线，控制长篇连续生成的因果、回收和时间推进。'
  },
  {
    key: 'preflight',
    title: '生成预检',
    path: '/generate/chapters',
    icon: '7',
    desc: '在章节生成页执行预检，确认项目、分卷、章节计划和蓝图可用。'
  },
  {
    key: 'draft',
    title: '场景/正文',
    path: '/generate/chapters',
    icon: '8',
    desc: '按场景生成正文，合成章节，或启用后台批量自动生成。'
  },
  {
    key: 'validation',
    title: '体检',
    path: '/validate',
    icon: '9',
    desc: '校验事实、角色、地点、伏笔、章节连续性和生成质量。'
  },
  {
    key: 'archive',
    title: '存档/打包',
    path: '/generate',
    icon: '10',
    desc: '打包当前上下文快照，保留 manifest、模块 hash 和后续生成依据。'
  }
]

const cards = computed(() => {
  const steps = flowStatus.value?.steps ?? []
  return fallbackCards.map((card) => {
    const step = steps.find((item) => item.key === card.key)
    return {
      ...card,
      ready: step?.status === 'ready',
      count: step?.count ?? 0,
      message: step?.message ?? card.desc,
      lastUpdatedAt: step?.lastUpdatedAt ?? null,
      path: normalizeStepPath(step?.path || card.path)
    }
  })
})

function normalizeStepPath(path: string) {
  if (path === '/generate/outlines') return '/generate/planning?module=outlines'
  if (path === '/generate/volume_designs') return '/generate/planning?module=volume_designs'
  if (path === '/generate/chapter_plans') return '/generate/planning?module=chapter_plans'
  if (path === '/generate/chapter_blueprints') return '/generate/planning?module=chapter_blueprints'
  if (path === '/generate/gate') return '/generate/tracking'
  return path
}

const nextSuggestion = computed(() =>
  workContext.selectedProjectId
    ? flowStatus.value?.nextSuggestion || '正在读取当前项目的生成流程状态。'
    : '先选择或创建项目，再查看生成流程状态。'
)

const nextAction = computed(() => {
  if (!workContext.selectedProjectId) return null

  const suggestionText = normalizeActionText(nextSuggestion.value)
  const suggestedCard = cards.value.find((card) => {
    if (!card.path) return false
    const candidates = [
      card.key,
      card.key.replace(/_/g, ''),
      card.title,
      card.message,
      card.desc
    ].map(normalizeActionText)

    return candidates.some((candidate) => candidate && suggestionText.includes(candidate))
  })

  const readyCards = cards.value.filter((card) => card.ready && card.path)
  return suggestedCard ?? readyCards[0] ?? null
})

function normalizeActionText(value: string) {
  return value
    .replace(/^待完成[:：]\s*/, '')
    .replace(/[\s_/:：，。,.、/()（）-]+/g, '')
    .toLowerCase()
}

async function continueNextAction() {
  if (!nextAction.value) return
  await router.push(nextAction.value.path)
}

async function refreshFlow() {
  if (!workContext.selectedProjectId) {
    flowStatus.value = null
    promptSnapshots.value = []
    return
  }

  loadingStatus.value = true
  loadingSnapshots.value = true
  try {
    const [status, snapshots] = await Promise.all([
      getGenerationFlowStatus(workContext.selectedProjectId),
      listPromptRunSnapshots({ projectId: workContext.selectedProjectId, take: 12 })
    ])
    flowStatus.value = status
    promptSnapshots.value = snapshots
  } catch (err) {
    ElMessage.error((err as Error).message || '加载生成流程状态失败。')
  } finally {
    loadingStatus.value = false
    loadingSnapshots.value = false
  }
}

async function runPackaging() {
  if (!workContext.selectedProjectId) {
    ElMessage.warning(t('generationWorkbench.messages.selectProjectFirst'))
    return
  }

  packaging.value = true
  try {
    packageResult.value = await packageGenerationContext(
      workContext.selectedProjectId,
      workContext.selectedProject?.currentSourceBookId ?? null
    )
    ElMessage.success(
      t('generationWorkbench.messages.packageSuccess', {
        version: packageResult.value.version,
        files: packageResult.value.fileCount
      })
    )
    await refreshFlow()
  } catch (err) {
    ElMessage.error((err as Error).message || t('generationWorkbench.messages.packageFailed'))
  } finally {
    packaging.value = false
  }
}

async function openSnapshot(item: PromptRunSnapshot) {
  selectedSnapshot.value = item
  snapshotDrawer.value = true
  try {
    selectedSnapshot.value = await getPromptRunSnapshot(item.id)
  } catch (err) {
    ElMessage.error((err as Error).message || '加载 Prompt 快照详情失败。')
  }
}

function formatTime(value?: string | null) {
  return value ? new Date(value).toLocaleString() : '暂无'
}

onMounted(() => {
  void refreshFlow()
})

watch(
  () => workContext.selectedProjectId,
  () => {
    packageResult.value = null
    void refreshFlow()
  }
)
</script>

<template>
  <div class="generation-workbench">
    <section class="hero">
      <div>
        <p class="eyebrow">{{ t('generationWorkbench.eyebrow') }}</p>
        <h1>{{ t('generationWorkbench.title') }}</h1>
        <p class="subtitle">{{ t('generationWorkbench.subtitle') }}</p>
      </div>
      <el-card shadow="never" class="context-card">
        <div class="context-row">
          <span>{{ t('generationWorkbench.context.project') }}</span>
          <strong>{{ workContext.selectedProject?.name ?? t('generationWorkbench.context.notSelected') }}</strong>
        </div>
        <div class="context-row">
          <span>{{ t('generationWorkbench.context.volume') }}</span>
          <strong>
            {{
              workContext.selectedVolume
                ? t('generationWorkbench.context.volumeLabel', {
                    number: workContext.selectedVolume.volumeNumber,
                    title: workContext.selectedVolume.title
                  })
                : t('generationWorkbench.context.notSelected')
            }}
          </strong>
        </div>
      </el-card>
    </section>

    <section class="flow-panel">
      <div class="next-action">
        <div>
          <span class="next-label">下一步建议</span>
          <p>{{ nextSuggestion }}</p>
        </div>
        <el-button type="primary" :disabled="!nextAction" @click="continueNextAction">继续下一步</el-button>
      </div>
      <div class="flow-head">
        <div>
          <h2>完整生成流程</h2>
          <p>下方保留完整流程状态，用于查看每个环节的数据数量和最近更新时间。</p>
        </div>
        <el-button :loading="loadingStatus || loadingSnapshots" @click="refreshFlow">刷新状态</el-button>
      </div>
      <div class="card-grid" v-loading="loadingStatus">
        <component
          :is="card.ready && card.path ? 'router-link' : 'div'"
          v-for="card in cards"
          :key="card.title"
          :to="card.ready && card.path ? card.path : undefined"
          class="module-card"
          :class="{ disabled: !card.ready, active: nextAction?.key === card.key }"
        >
          <span class="card-icon">{{ card.icon }}</span>
          <span class="card-title">
            {{ card.title }}
            <em>{{ card.count }}</em>
          </span>
          <span class="card-desc">{{ card.message }}</span>
          <span class="card-time">最近更新：{{ formatTime(card.lastUpdatedAt) }}</span>
          <el-tag size="small" :type="card.ready ? 'success' : 'warning'">
            {{ card.ready ? t('generationWorkbench.cardStatus.ready') : t('generationWorkbench.cardStatus.pending') }}
          </el-tag>
        </component>
      </div>
    </section>

    <el-card shadow="never" class="package-panel">
      <div class="package-head">
        <div>
          <div class="package-title">{{ t('generationWorkbench.cards.package.title') }}</div>
          <div class="package-desc">{{ t('generationWorkbench.cards.package.desc') }}</div>
        </div>
        <el-button type="primary" :loading="packaging" @click="runPackaging">
          {{ t('generationWorkbench.actions.packageNow') }}
        </el-button>
      </div>

      <el-empty v-if="!packageResult" :description="t('generationWorkbench.empty.package')" :image-size="72" />
      <div v-else class="package-meta">
        <div>{{ t('generationWorkbench.labels.packageVersion', { value: packageResult.version }) }}</div>
        <div>{{ t('generationWorkbench.labels.packageFiles', { value: packageResult.fileCount }) }}</div>
        <div>{{ t('generationWorkbench.labels.packageModules', { value: packageResult.enabledModuleCount }) }}</div>
        <div>{{ t('generationWorkbench.labels.packageTime', { value: new Date(packageResult.publishedAt).toLocaleString() }) }}</div>
      </div>
    </el-card>

    <el-card shadow="never" class="snapshot-panel">
      <div class="package-head">
        <div>
          <div class="package-title">Prompt 运行快照</div>
          <div class="package-desc">查看当前项目最近生成时使用的上下文、Prompt 摘要、输出摘要和错误信息。</div>
        </div>
        <el-button :loading="loadingSnapshots" @click="refreshFlow">刷新快照</el-button>
      </div>

      <el-empty v-if="!loadingSnapshots && promptSnapshots.length === 0" description="暂无 Prompt 运行快照。" :image-size="72" />
      <div v-else class="snapshot-list" v-loading="loadingSnapshots">
        <button
          v-for="item in promptSnapshots"
          :key="item.id"
          type="button"
          class="snapshot-item"
          @click="openSnapshot(item)"
        >
          <strong>{{ item.source }} <span v-if="item.stepKey">/ {{ item.stepKey }}</span></strong>
          <span>{{ item.model || '未记录模型' }} / {{ item.success ? '成功' : '失败' }} / {{ formatTime(item.createdAt) }}</span>
          <small>{{ item.outputSummary || item.error || '暂无输出摘要' }}</small>
        </button>
      </div>
    </el-card>

    <el-drawer v-model="snapshotDrawer" title="Prompt 运行快照" size="52%">
      <div v-if="selectedSnapshot" class="snapshot-detail">
        <div class="detail-grid">
          <div><span>来源</span><strong>{{ selectedSnapshot.source }}</strong></div>
          <div><span>模型</span><strong>{{ selectedSnapshot.model || '未记录' }}</strong></div>
          <div><span>状态</span><strong>{{ selectedSnapshot.success ? '成功' : '失败' }}</strong></div>
          <div><span>耗时</span><strong>{{ selectedSnapshot.elapsedMs }} ms</strong></div>
          <div><span>上下文 Hash</span><strong>{{ selectedSnapshot.contextHash || '无' }}</strong></div>
          <div><span>时间</span><strong>{{ formatTime(selectedSnapshot.createdAt) }}</strong></div>
        </div>
        <h3>上下文摘要</h3>
        <pre>{{ selectedSnapshot.contextSummary || '暂无' }}</pre>
        <h3>Prompt 摘要</h3>
        <pre>{{ selectedSnapshot.promptSummary || '暂无' }}</pre>
        <h3>输出摘要</h3>
        <pre>{{ selectedSnapshot.outputSummary || '暂无' }}</pre>
        <h3 v-if="selectedSnapshot.error">错误</h3>
        <pre v-if="selectedSnapshot.error">{{ selectedSnapshot.error }}</pre>
      </div>
    </el-drawer>
  </div>
</template>

<style scoped>
.generation-workbench {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 16px;
  padding: 28px;
  border-radius: 22px;
  background:
    radial-gradient(circle at 12% 20%, rgba(47, 125, 122, 0.18), transparent 34%),
    linear-gradient(135deg, #f7f0df 0%, #e6f0e6 48%, #d7e7e5 100%);
}
.eyebrow {
  margin: 0 0 8px;
  color: #3f6f69;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
h1 {
  margin: 0;
  font-size: 34px;
  color: #1f332f;
}
.subtitle {
  max-width: 720px;
  color: #53615d;
  line-height: 1.8;
}
.context-card {
  align-self: center;
  border: 0;
  background: rgba(255, 255, 255, 0.72);
}
.context-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin: 8px 0;
}
.context-row span {
  color: #7d8985;
}
.card-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}
.flow-panel {
  border: 1px solid #dfe8e5;
  border-radius: 18px;
  background: #fffef8;
  padding: 18px;
}
.next-action {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
  padding: 16px;
  border: 1px solid #b9d6cf;
  border-radius: 16px;
  background: linear-gradient(135deg, #f1faf6 0%, #fff8e6 100%);
}
.next-label {
  display: inline-flex;
  margin-bottom: 6px;
  color: #2f6f65;
  font-size: 13px;
  font-weight: 800;
}
.next-action p {
  margin: 0;
  color: #263b36;
  line-height: 1.6;
}
.flow-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}
.flow-head h2 {
  margin: 0;
  color: #1f332f;
  font-size: 20px;
}
.flow-head p {
  margin: 6px 0 0;
  color: #6b7773;
  line-height: 1.6;
}
.package-panel,
.snapshot-panel {
  border-radius: 18px;
  background: #fffef8;
}
.package-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}
.package-title {
  font-size: 18px;
  font-weight: 700;
  color: #1f332f;
}
.package-desc {
  color: #6b7773;
  line-height: 1.6;
  margin-top: 6px;
}
.package-meta {
  display: grid;
  gap: 8px;
  color: #3d4c49;
}
.module-card {
  min-height: 154px;
  padding: 20px;
  border: 1px solid #dfe8e5;
  border-radius: 18px;
  color: inherit;
  text-decoration: none;
  background: #fffdf8;
  display: flex;
  flex-direction: column;
  gap: 9px;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}
.module-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 14px 30px rgba(55, 75, 68, 0.12);
}
.module-card.active {
  border-color: #2f7d72;
  background: linear-gradient(180deg, #f4fbf8 0%, #fffdf8 100%);
  box-shadow: 0 16px 34px rgba(47, 125, 114, 0.16);
}
.module-card.active .card-icon {
  background: #2f7d72;
  color: #fffdf8;
}
.module-card.disabled {
  cursor: not-allowed;
  opacity: 0.72;
}
.module-card.disabled:hover {
  transform: none;
  box-shadow: none;
}
.card-icon {
  width: 36px;
  height: 36px;
  min-width: 36px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: #e0ece8;
  color: #24453f;
  font-weight: 800;
}
.card-title {
  font-size: 18px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.card-title em {
  font-style: normal;
  font-size: 13px;
  color: #55736e;
  background: #edf5f2;
  border-radius: 999px;
  padding: 2px 8px;
}
.card-desc {
  color: #6b7773;
  line-height: 1.6;
  flex: 1;
}
.card-time {
  color: #87928e;
  font-size: 12px;
}
.snapshot-list {
  display: grid;
  gap: 10px;
  margin-top: 16px;
}
.snapshot-item {
  width: 100%;
  border: 1px solid #dfe8e5;
  background: #fffdf8;
  border-radius: 12px;
  padding: 12px 14px;
  text-align: left;
  display: grid;
  gap: 5px;
  cursor: pointer;
}
.snapshot-item:hover {
  border-color: #7aa49b;
}
.snapshot-item strong {
  color: #1f332f;
}
.snapshot-item span,
.snapshot-item small {
  color: #6b7773;
  line-height: 1.5;
}
.snapshot-detail {
  display: grid;
  gap: 16px;
}
.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.detail-grid div {
  border: 1px solid #e4ebe8;
  border-radius: 10px;
  padding: 10px;
  display: grid;
  gap: 4px;
}
.detail-grid span {
  color: #87928e;
  font-size: 12px;
}
.detail-grid strong {
  color: #1f332f;
  word-break: break-all;
}
.snapshot-detail h3 {
  margin: 0;
  color: #1f332f;
  font-size: 15px;
}
.snapshot-detail pre {
  margin: 0;
  border-radius: 10px;
  background: #f7faf8;
  border: 1px solid #e4ebe8;
  padding: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  color: #344440;
  line-height: 1.6;
}
@media (max-width: 1080px) {
  .hero,
  .card-grid {
    grid-template-columns: 1fr;
  }

  .package-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .next-action {
    flex-direction: column;
    align-items: flex-start;
  }

  .detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
