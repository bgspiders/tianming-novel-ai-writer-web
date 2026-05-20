<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useWorkContextStore } from '@/stores/workContext'
import {
  getFactSnapshot,
  listValidationReports,
  listValidationSummaries,
  runValidation,
  updateValidationReportChapterStatus,
  type FactSnapshot,
  type ValidationReport,
  type ValidationSummary
} from '@/api/modules/validation'

const workContext = useWorkContextStore()

const loading = ref(false)
const running = ref(false)
const summaries = ref<ValidationSummary[]>([])
const reports = ref<ValidationReport[]>([])
const facts = ref<FactSnapshot | null>(null)
const updatingReportId = ref('')

const selectedVolumeNumber = computed(() => workContext.selectedVolume?.volumeNumber ?? null)
const targetLabel = computed(() => {
  if (!workContext.selectedProject) return '未选择项目'
  if (!workContext.selectedVolume) return workContext.selectedProject.name
  return `${workContext.selectedProject.name} / 第 ${workContext.selectedVolume.volumeNumber} 卷`
})

function resultType(result: string) {
  if (result === 'passed') return 'success'
  if (result === 'failed') return 'danger'
  return 'warning'
}

function statusType(status: string) {
  if (status === 'validated') return 'success'
  if (status === 'needs_fix') return 'danger'
  if (status === 'drafted') return 'warning'
  return 'info'
}

function formatTime(value: string) {
  return value ? new Date(value).toLocaleString() : '-'
}

function parseJsonText(value: string) {
  if (!value) return ''
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

const factOverviewCards = computed(() => {
  const overview = facts.value?.overview
  if (!overview) return []
  return [
    { label: '章节范围', value: overview.chapterCount, hint: '当前快照覆盖章节' },
    { label: '角色状态', value: overview.characterStateCount, hint: `${overview.characterStatePointCount} 条状态点` },
    { label: '角色设定', value: overview.characterDescriptionCount, hint: 'Design CharacterRule' },
    { label: '冲突进度', value: overview.conflictProgressCount, hint: `${overview.conflictProgressPointCount} 条推进点` },
    { label: '势力状态', value: overview.factionStateCount, hint: `${overview.factionStatePointCount} 条状态点` },
    { label: '地点状态', value: overview.locationStateCount, hint: `${overview.locationStatePointCount} 条状态点` },
    { label: '地点设定', value: overview.locationDescriptionCount, hint: 'Design LocationRule' },
    { label: '世界约束', value: overview.worldRuleConstraintCount, hint: '硬规则/特殊法则' },
    { label: '角色位置', value: overview.characterLocationCount, hint: `${overview.characterMovementCount} 条移动` },
    { label: '物品状态', value: overview.itemStateCount, hint: `${overview.itemStatePointCount} 条状态点` },
    { label: '伏笔', value: overview.foreshadowingCount, hint: `未回收 ${overview.unresolvedForeshadowingCount} · 逾期 ${overview.overdueForeshadowingCount}` },
    { label: '情节点', value: overview.plotPointCount, hint: `${overview.timelineCount} 条时间线` },
    { label: '卷归档', value: overview.volumeArchiveCount, hint: 'VolumeFactArchive' }
  ]
})

async function refresh() {
  if (!workContext.selectedProjectId) {
    summaries.value = []
    reports.value = []
    facts.value = null
    return
  }

  loading.value = true
  try {
    const volumeNumber = selectedVolumeNumber.value
    const [summaryRows, reportRows, factSnapshot] = await Promise.all([
      listValidationSummaries(workContext.selectedProjectId, volumeNumber),
      listValidationReports(workContext.selectedProjectId, volumeNumber, null, 100),
      getFactSnapshot(workContext.selectedProjectId, volumeNumber)
    ])
    summaries.value = summaryRows
    reports.value = reportRows
    facts.value = factSnapshot
  } catch (err) {
    ElMessage.error((err as Error).message || '加载校验数据失败')
  } finally {
    loading.value = false
  }
}

async function runCurrentValidation() {
  if (!workContext.selectedProjectId) {
    ElMessage.warning('请先选择项目')
    return
  }

  running.value = true
  try {
    await runValidation({
      projectId: workContext.selectedProjectId,
      volumeNumber: selectedVolumeNumber.value
    })
    ElMessage.success('校验完成')
    await refresh()
  } catch (err) {
    ElMessage.error((err as Error).message || '校验失败')
  } finally {
    running.value = false
  }
}

async function markChapterStatus(report: ValidationReport, status: 'needs_fix' | 'validated') {
  updatingReportId.value = report.id
  try {
    await updateValidationReportChapterStatus(
      report.id,
      status,
      status === 'needs_fix' ? '校验报告标记待修复' : '校验报告标记已验证'
    )
    ElMessage.success(status === 'needs_fix' ? '已标记待修复' : '已标记已验证')
    await refresh()
  } catch (err) {
    ElMessage.error((err as Error).message || '更新章节状态失败')
  } finally {
    updatingReportId.value = ''
  }
}

watch(() => [workContext.selectedProjectId, workContext.selectedVolumeId], refresh)
onMounted(refresh)
</script>

<template>
  <div class="validation-page">
    <section class="hero">
      <div>
        <p class="eyebrow">Stage 5 · Validation</p>
        <h1>校验工作台</h1>
        <p class="subtitle">
          对当前 Project / Volume 做最小可用静态一致性检查，持久化 ValidationSummary 与 ValidationReport，
          并浏览已归档的事实快照。
        </p>
      </div>
      <el-card shadow="never" class="action-card">
        <span class="context-label">当前目标</span>
        <strong>{{ targetLabel }}</strong>
        <div class="actions">
          <el-button :loading="loading" @click="refresh">刷新</el-button>
          <el-button type="primary" :loading="running" @click="runCurrentValidation">运行校验</el-button>
        </div>
      </el-card>
    </section>

    <el-row :gutter="16">
      <el-col :span="8">
        <el-card shadow="never" class="panel">
          <template #header>
            <div class="panel-title">校验汇总</div>
          </template>
          <el-empty v-if="summaries.length === 0" description="暂无汇总" />
          <div v-for="summary in summaries" :key="summary.id" class="summary-card">
            <div class="summary-head">
              <span>{{ summary.targetVolumeNumber === 0 ? '全书' : `第 ${summary.targetVolumeNumber} 卷` }}</span>
              <el-tag :type="resultType(summary.overallResult)">{{ summary.overallResult }}</el-tag>
            </div>
            <div class="meta">校验时间：{{ formatTime(summary.lastValidatedAt) }}</div>
            <el-collapse>
              <el-collapse-item title="ModuleResults" :name="`${summary.id}-modules`">
                <pre>{{ parseJsonText(summary.moduleResults) }}</pre>
              </el-collapse-item>
              <el-collapse-item title="ProblemItems" :name="`${summary.id}-problems`">
                <pre>{{ parseJsonText(summary.problemItems) }}</pre>
              </el-collapse-item>
            </el-collapse>
          </div>
        </el-card>
      </el-col>

      <el-col :span="16">
        <el-card shadow="never" class="panel">
          <template #header>
            <div class="panel-title">章节报告</div>
          </template>
          <el-table v-loading="loading" :data="reports" row-key="id" border>
            <el-table-column label="章节" min-width="180">
              <template #default="{ row }">
                第 {{ row.chapterNumber || '-' }} 章 · {{ row.chapterTitle || row.chapterId }}
              </template>
            </el-table-column>
            <el-table-column prop="summary" label="摘要" min-width="180" />
            <el-table-column label="结果" width="110">
              <template #default="{ row }">
                <el-tag :type="resultType(row.result)">{{ row.result }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="章节状态" width="120">
              <template #default="{ row }">
                <el-tag :type="statusType(row.chapterStatus)">{{ row.chapterStatus || '-' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="时间" width="180">
              <template #default="{ row }">{{ formatTime(row.validatedAt) }}</template>
            </el-table-column>
            <el-table-column label="修复闭环" width="210" fixed="right">
              <template #default="{ row }">
                <div class="fix-actions">
                  <el-button
                    size="small"
                    type="danger"
                    plain
                    :loading="updatingReportId === row.id"
                    :disabled="row.chapterStatus === 'needs_fix'"
                    @click="markChapterStatus(row, 'needs_fix')"
                  >
                    待修复
                  </el-button>
                  <el-button
                    size="small"
                    type="success"
                    plain
                    :loading="updatingReportId === row.id"
                    :disabled="row.chapterStatus === 'validated'"
                    @click="markChapterStatus(row, 'validated')"
                  >
                    已验证
                  </el-button>
                </div>
              </template>
            </el-table-column>
            <el-table-column type="expand">
              <template #default="{ row }">
                <el-table :data="row.items" size="small" border>
                  <el-table-column prop="name" label="检查项" width="130" />
                  <el-table-column prop="details" label="详情" min-width="220" />
                  <el-table-column prop="suggestion" label="建议" min-width="220" />
                  <el-table-column label="结果" width="100">
                    <template #default="{ row: item }">
                      <el-tag :type="resultType(item.result)">{{ item.result }}</el-tag>
                    </template>
                  </el-table-column>
                </el-table>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never" class="panel">
      <template #header>
        <div class="panel-title">事实快照概览</div>
      </template>
      <el-empty v-if="!facts" description="暂无事实快照" />
      <div v-else class="fact-overview">
        <div v-for="card in factOverviewCards" :key="card.label" class="fact-metric">
          <span>{{ card.label }}</span>
          <strong>{{ card.value }}</strong>
          <small>{{ card.hint }}</small>
        </div>
      </div>
    </el-card>

    <el-card shadow="never" class="panel">
      <template #header>
        <div class="panel-title">Tracking 摘要</div>
      </template>
      <el-empty v-if="!facts || facts.sections.length === 0" description="暂无摘要" />
      <el-collapse v-else>
        <el-collapse-item
          v-for="section in facts.sections"
          :key="section.key"
          :title="`${section.title} · ${section.totalCount}`"
          :name="section.key"
        >
          <p class="section-summary">{{ section.summary }}</p>
          <el-table :data="section.items" size="small" border>
            <el-table-column prop="name" label="名称" min-width="150" />
            <el-table-column prop="status" label="状态" width="130" />
            <el-table-column label="章节" width="100">
              <template #default="{ row }">{{ row.chapterNumber ? `第 ${row.chapterNumber} 章` : '-' }}</template>
            </el-table-column>
            <el-table-column prop="detail" label="摘要" min-width="240" />
            <el-table-column prop="importance" label="等级" width="110" />
          </el-table>
        </el-collapse-item>
      </el-collapse>
    </el-card>

    <el-row :gutter="16">
      <el-col :span="14">
        <el-card shadow="never" class="panel">
          <template #header>
            <div class="panel-title">章节时间线快照</div>
          </template>
          <el-table :data="facts?.timelines ?? []" row-key="id" border>
            <el-table-column label="章节" width="150">
              <template #default="{ row }">第 {{ row.chapterNumber }} 章</template>
            </el-table-column>
            <el-table-column prop="timePeriod" label="时间段" width="160" />
            <el-table-column prop="elapsedTime" label="经过时间" width="150" />
            <el-table-column prop="keyTimeEvent" label="关键事件" min-width="240" />
            <el-table-column prop="importance" label="重要性" width="110" />
          </el-table>
        </el-card>
      </el-col>

      <el-col :span="10">
        <el-card shadow="never" class="panel">
          <template #header>
            <div class="panel-title">卷事实归档</div>
          </template>
          <el-empty v-if="!facts || facts.volumeArchives.length === 0" description="暂无归档" />
          <el-collapse v-else>
            <el-collapse-item
              v-for="archive in facts.volumeArchives"
              :key="archive.id"
              :title="`第 ${archive.volumeNumber} 卷 · ${formatTime(archive.archivedAt)}`"
              :name="archive.id"
            >
              <div class="meta">LastChapterId：{{ archive.lastChapterId || '-' }}</div>
              <pre>{{ parseJsonText(archive.snapshotPayload) }}</pre>
            </el-collapse-item>
          </el-collapse>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped>
.validation-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 330px;
  gap: 18px;
  padding: 28px;
  border-radius: 24px;
  background:
    radial-gradient(circle at 18% 24%, rgba(163, 116, 67, 0.18), transparent 32%),
    linear-gradient(135deg, #fff7e8 0%, #edf4ea 54%, #dcebe7 100%);
}
.eyebrow {
  margin: 0 0 8px;
  color: #8a5b2d;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
h1 {
  margin: 0;
  color: #263832;
  font-size: 34px;
}
.subtitle {
  max-width: 760px;
  color: #65736f;
  line-height: 1.8;
}
.action-card {
  align-self: center;
  border: 0;
  background: rgba(255, 255, 255, 0.76);
}
.context-label,
.meta {
  color: #7f8986;
  font-size: 13px;
}
.actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}
.fix-actions {
  display: flex;
  gap: 8px;
}
.panel {
  min-height: 220px;
  border-color: #e2ebe7;
}
.panel-title {
  font-weight: 700;
}
.fact-overview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}
.fact-metric {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px;
  border: 1px solid #e1ebe7;
  border-radius: 16px;
  background: linear-gradient(145deg, #ffffff 0%, #f5f1e8 100%);
}
.fact-metric span {
  color: #75827e;
  font-size: 13px;
}
.fact-metric strong {
  color: #263832;
  font-size: 26px;
}
.fact-metric small,
.section-summary {
  color: #7f8986;
}
.section-summary {
  margin: 0 0 12px;
}
.summary-card {
  padding: 12px 0;
  border-bottom: 1px solid #edf1ef;
}
.summary-card:last-child {
  border-bottom: 0;
}
.summary-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-weight: 700;
}
pre {
  max-height: 280px;
  overflow: auto;
  margin: 0;
  padding: 10px;
  border-radius: 10px;
  background: #f7f4ed;
  color: #34433f;
  white-space: pre-wrap;
}
@media (max-width: 1180px) {
  .hero,
  :deep(.el-row) {
    display: block;
  }
  :deep(.el-col) {
    max-width: 100%;
    width: 100%;
    margin-bottom: 16px;
  }
}
</style>
