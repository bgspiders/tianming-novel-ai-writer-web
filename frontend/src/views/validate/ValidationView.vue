<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useI18n } from '@/composables/useI18n'
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
const router = useRouter()
const { t } = useI18n()

const loading = ref(false)
const running = ref(false)
const summaries = ref<ValidationSummary[]>([])
const reports = ref<ValidationReport[]>([])
const facts = ref<FactSnapshot | null>(null)
const updatingReportId = ref('')

const selectedVolumeNumber = computed(() => workContext.selectedVolume?.volumeNumber ?? null)
const targetLabel = computed(() => {
  if (!workContext.selectedProject) return t('validationWorkbench.target.noProjectSelected')
  if (!workContext.selectedVolume) return workContext.selectedProject.name
  return t('validationWorkbench.target.volume', {
    project: workContext.selectedProject.name,
    number: workContext.selectedVolume.volumeNumber,
    title: workContext.selectedVolume.title
  })
})

function resultType(result: string) {
  if (result === 'passed') return 'success'
  if (result === 'failed') return 'danger'
  return 'warning'
}

function resultLabel(result: string) {
  if (result === 'passed') return t('validationWorkbench.result.passed')
  if (result === 'failed') return t('validationWorkbench.result.failed')
  return t('validationWorkbench.result.warning')
}

function statusType(status: string) {
  if (status === 'validated') return 'success'
  if (status === 'needs_fix') return 'danger'
  if (status === 'drafted') return 'warning'
  return 'info'
}

function statusLabel(status: string | null | undefined) {
  if (!status) return '-'
  if (status === 'validated') return t('validationWorkbench.chapterStatus.validated')
  if (status === 'needs_fix') return t('validationWorkbench.chapterStatus.needsFix')
  if (status === 'drafted') return t('validationWorkbench.chapterStatus.drafted')
  if (status === 'planned') return t('validationWorkbench.chapterStatus.planned')
  if (status === 'blueprinted') return t('validationWorkbench.chapterStatus.blueprinted')
  if (status === 'archived') return t('validationWorkbench.chapterStatus.archived')
  return status
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
    {
      key: 'chapters',
      label: t('validationWorkbench.factOverview.chapters.label'),
      value: overview.chapterCount,
      hint: t('validationWorkbench.factOverview.chapters.hint')
    },
    {
      key: 'characterStates',
      label: t('validationWorkbench.factOverview.characterStates.label'),
      value: overview.characterStateCount,
      hint: t('validationWorkbench.factOverview.characterStates.hint', {
        count: overview.characterStatePointCount
      })
    },
    {
      key: 'characterRules',
      label: t('validationWorkbench.factOverview.characterRules.label'),
      value: overview.characterDescriptionCount,
      hint: t('validationWorkbench.factOverview.characterRules.hint')
    },
    {
      key: 'conflictProgress',
      label: t('validationWorkbench.factOverview.conflictProgress.label'),
      value: overview.conflictProgressCount,
      hint: t('validationWorkbench.factOverview.conflictProgress.hint', {
        count: overview.conflictProgressPointCount
      })
    },
    {
      key: 'factionStates',
      label: t('validationWorkbench.factOverview.factionStates.label'),
      value: overview.factionStateCount,
      hint: t('validationWorkbench.factOverview.factionStates.hint', {
        count: overview.factionStatePointCount
      })
    },
    {
      key: 'locationStates',
      label: t('validationWorkbench.factOverview.locationStates.label'),
      value: overview.locationStateCount,
      hint: t('validationWorkbench.factOverview.locationStates.hint', {
        count: overview.locationStatePointCount
      })
    },
    {
      key: 'locationRules',
      label: t('validationWorkbench.factOverview.locationRules.label'),
      value: overview.locationDescriptionCount,
      hint: t('validationWorkbench.factOverview.locationRules.hint')
    },
    {
      key: 'worldConstraints',
      label: t('validationWorkbench.factOverview.worldConstraints.label'),
      value: overview.worldRuleConstraintCount,
      hint: t('validationWorkbench.factOverview.worldConstraints.hint')
    },
    {
      key: 'characterLocations',
      label: t('validationWorkbench.factOverview.characterLocations.label'),
      value: overview.characterLocationCount,
      hint: t('validationWorkbench.factOverview.characterLocations.hint', {
        count: overview.characterMovementCount
      })
    },
    {
      key: 'itemStates',
      label: t('validationWorkbench.factOverview.itemStates.label'),
      value: overview.itemStateCount,
      hint: t('validationWorkbench.factOverview.itemStates.hint', {
        count: overview.itemStatePointCount
      })
    },
    {
      key: 'foreshadowing',
      label: t('validationWorkbench.factOverview.foreshadowing.label'),
      value: overview.foreshadowingCount,
      hint: t('validationWorkbench.factOverview.foreshadowing.hint', {
        unresolved: overview.unresolvedForeshadowingCount,
        overdue: overview.overdueForeshadowingCount
      })
    },
    {
      key: 'plotPoints',
      label: t('validationWorkbench.factOverview.plotPoints.label'),
      value: overview.plotPointCount,
      hint: t('validationWorkbench.factOverview.plotPoints.hint', {
        count: overview.timelineCount
      })
    },
    {
      key: 'volumeArchives',
      label: t('validationWorkbench.factOverview.volumeArchives.label'),
      value: overview.volumeArchiveCount,
      hint: t('validationWorkbench.factOverview.volumeArchives.hint')
    }
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
    ElMessage.error((err as Error).message || t('validationWorkbench.messages.loadFailed'))
  } finally {
    loading.value = false
  }
}

async function runCurrentValidation() {
  if (!workContext.selectedProjectId) {
    ElMessage.warning(t('validationWorkbench.messages.selectProjectFirst'))
    return
  }

  running.value = true
  try {
    await runValidation({
      projectId: workContext.selectedProjectId,
      volumeNumber: selectedVolumeNumber.value
    })
    ElMessage.success(t('validationWorkbench.messages.runSuccess'))
    await refresh()
  } catch (err) {
    ElMessage.error((err as Error).message || t('validationWorkbench.messages.runFailed'))
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
      status === 'needs_fix'
        ? t('validationWorkbench.messages.markNeedsFixReason')
        : t('validationWorkbench.messages.markValidatedReason')
    )
    ElMessage.success(
      status === 'needs_fix'
        ? t('validationWorkbench.messages.markNeedsFixSuccess')
        : t('validationWorkbench.messages.markValidatedSuccess')
    )
    await refresh()
  } catch (err) {
    ElMessage.error((err as Error).message || t('validationWorkbench.messages.updateStatusFailed'))
  } finally {
    updatingReportId.value = ''
  }
}

async function openFixChapter(report: ValidationReport) {
  if (!report.chapterId) return
  const repairSummary = report.items
    .filter((item) => item.result !== 'passed')
    .slice(0, 3)
    .map((item) => `${item.name}：${item.suggestion || item.details}`)
    .join('；')

  await router.push({
    path: '/generate/chapters',
    query: {
      chapterId: report.chapterId,
      validationReportId: report.id,
      rewriteMode: 'validation_fix',
      repairSummary
    }
  })
}

watch(() => [workContext.selectedProjectId, workContext.selectedVolumeId], refresh)
onMounted(refresh)
</script>

<template>
  <div class="validation-page">
    <section class="hero">
      <div>
        <p class="eyebrow">{{ t('validationWorkbench.eyebrow') }}</p>
        <h1>{{ t('validationWorkbench.title') }}</h1>
        <p class="subtitle">{{ t('validationWorkbench.subtitle') }}</p>
      </div>
      <el-card shadow="never" class="action-card">
        <span class="context-label">{{ t('validationWorkbench.currentTarget') }}</span>
        <strong>{{ targetLabel }}</strong>
        <div class="actions">
          <el-button :loading="loading" @click="refresh">{{ t('validationWorkbench.actions.refresh') }}</el-button>
          <el-button type="primary" :loading="running" @click="runCurrentValidation">
            {{ t('validationWorkbench.actions.runValidation') }}
          </el-button>
        </div>
      </el-card>
    </section>

    <el-row :gutter="16">
      <el-col :span="8">
        <el-card shadow="never" class="panel">
          <template #header>
            <div class="panel-title">{{ t('validationWorkbench.panels.summaries') }}</div>
          </template>
          <el-empty v-if="summaries.length === 0" :description="t('validationWorkbench.empty.summaries')" />
          <div v-for="summary in summaries" :key="summary.id" class="summary-card">
            <div class="summary-head">
              <span>
                {{
                  summary.targetVolumeNumber === 0
                    ? t('validationWorkbench.projectScope')
                    : t('validationWorkbench.volumeScope', { number: summary.targetVolumeNumber })
                }}
              </span>
              <el-tag :type="resultType(summary.overallResult)">{{ resultLabel(summary.overallResult) }}</el-tag>
            </div>
            <div class="meta">
              {{ t('validationWorkbench.validatedAt') }}: {{ formatTime(summary.lastValidatedAt) }}
            </div>
            <el-collapse>
              <el-collapse-item :title="t('validationWorkbench.moduleResults')" :name="`${summary.id}-modules`">
                <pre>{{ parseJsonText(summary.moduleResults) }}</pre>
              </el-collapse-item>
              <el-collapse-item :title="t('validationWorkbench.problemItems')" :name="`${summary.id}-problems`">
                <pre>{{ parseJsonText(summary.problemItems) }}</pre>
              </el-collapse-item>
            </el-collapse>
          </div>
        </el-card>
      </el-col>

      <el-col :span="16">
        <el-card shadow="never" class="panel">
          <template #header>
            <div class="panel-title">{{ t('validationWorkbench.panels.reports') }}</div>
          </template>
          <el-table v-loading="loading" :data="reports" row-key="id" border>
            <el-table-column :label="t('validationWorkbench.columns.chapter')" min-width="180">
              <template #default="{ row }">
                {{
                  row.chapterNumber
                    ? t('validationWorkbench.chapterDisplay', {
                        number: row.chapterNumber,
                        title: row.chapterTitle || row.chapterId
                      })
                    : row.chapterTitle || row.chapterId
                }}
              </template>
            </el-table-column>
            <el-table-column prop="summary" :label="t('validationWorkbench.columns.summary')" min-width="180" />
            <el-table-column :label="t('validationWorkbench.columns.result')" width="110">
              <template #default="{ row }">
                <el-tag :type="resultType(row.result)">{{ resultLabel(row.result) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column :label="t('validationWorkbench.columns.chapterStatus')" width="120">
              <template #default="{ row }">
                <el-tag :type="statusType(row.chapterStatus)">{{ statusLabel(row.chapterStatus) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column :label="t('validationWorkbench.columns.validatedAt')" width="180">
              <template #default="{ row }">{{ formatTime(row.validatedAt) }}</template>
            </el-table-column>
            <el-table-column :label="t('validationWorkbench.columns.actions')" width="220" fixed="right">
              <template #default="{ row }">
                <div class="fix-actions">
                  <el-button size="small" plain type="primary" @click="openFixChapter(row)">
                    {{ t('validationWorkbench.actions.goFixChapter') }}
                  </el-button>
                  <el-button
                    size="small"
                    type="danger"
                    plain
                    :loading="updatingReportId === row.id"
                    :disabled="row.chapterStatus === 'needs_fix'"
                    @click="markChapterStatus(row, 'needs_fix')"
                  >
                    {{ t('validationWorkbench.actions.markNeedsFix') }}
                  </el-button>
                  <el-button
                    size="small"
                    type="success"
                    plain
                    :loading="updatingReportId === row.id"
                    :disabled="row.chapterStatus === 'validated'"
                    @click="markChapterStatus(row, 'validated')"
                  >
                    {{ t('validationWorkbench.actions.markValidated') }}
                  </el-button>
                </div>
              </template>
            </el-table-column>
            <el-table-column type="expand">
              <template #default="{ row }">
                <el-table :data="row.items" size="small" border>
                  <el-table-column prop="name" :label="t('validationWorkbench.columns.check')" width="150" />
                  <el-table-column prop="details" :label="t('validationWorkbench.columns.details')" min-width="220" />
                  <el-table-column
                    prop="suggestion"
                    :label="t('validationWorkbench.columns.suggestion')"
                    min-width="220"
                  />
                  <el-table-column :label="t('validationWorkbench.columns.result')" width="100">
                    <template #default="{ row: item }">
                      <el-tag :type="resultType(item.result)">{{ resultLabel(item.result) }}</el-tag>
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
        <div class="panel-title">{{ t('validationWorkbench.panels.factOverview') }}</div>
      </template>
      <el-empty v-if="!facts" :description="t('validationWorkbench.empty.factOverview')" />
      <div v-else class="fact-overview">
        <div v-for="card in factOverviewCards" :key="card.key" class="fact-metric">
          <span>{{ card.label }}</span>
          <strong>{{ card.value }}</strong>
          <small>{{ card.hint }}</small>
        </div>
      </div>
    </el-card>

    <el-card shadow="never" class="panel">
      <template #header>
        <div class="panel-title">{{ t('validationWorkbench.panels.trackingSummary') }}</div>
      </template>
      <el-empty
        v-if="!facts || facts.sections.length === 0"
        :description="t('validationWorkbench.empty.trackingSummary')"
      />
      <el-collapse v-else>
        <el-collapse-item
          v-for="section in facts.sections"
          :key="section.key"
          :title="`${section.title} / ${section.totalCount}`"
          :name="section.key"
        >
          <p class="section-summary">{{ section.summary }}</p>
          <el-table :data="section.items" size="small" border>
            <el-table-column prop="name" :label="t('validationWorkbench.columns.name')" min-width="150" />
            <el-table-column prop="status" :label="t('validationWorkbench.columns.status')" width="130" />
            <el-table-column :label="t('validationWorkbench.columns.chapter')" width="120">
              <template #default="{ row }">
                {{
                  row.chapterNumber
                    ? t('validationWorkbench.chapterOnly', { number: row.chapterNumber })
                    : '-'
                }}
              </template>
            </el-table-column>
            <el-table-column prop="detail" :label="t('validationWorkbench.columns.detail')" min-width="240" />
            <el-table-column
              prop="importance"
              :label="t('validationWorkbench.columns.importance')"
              width="110"
            />
          </el-table>
        </el-collapse-item>
      </el-collapse>
    </el-card>

    <el-row :gutter="16">
      <el-col :span="14">
        <el-card shadow="never" class="panel">
          <template #header>
            <div class="panel-title">{{ t('validationWorkbench.panels.timeline') }}</div>
          </template>
          <el-table :data="facts?.timelines ?? []" row-key="id" border>
            <el-table-column :label="t('validationWorkbench.columns.chapter')" width="140">
              <template #default="{ row }">{{ t('validationWorkbench.chapterOnly', { number: row.chapterNumber }) }}</template>
            </el-table-column>
            <el-table-column prop="timePeriod" :label="t('validationWorkbench.columns.timePeriod')" width="160" />
            <el-table-column prop="elapsedTime" :label="t('validationWorkbench.columns.elapsed')" width="150" />
            <el-table-column prop="keyTimeEvent" :label="t('validationWorkbench.columns.keyEvent')" min-width="240" />
            <el-table-column
              prop="importance"
              :label="t('validationWorkbench.columns.importance')"
              width="110"
            />
          </el-table>
        </el-card>
      </el-col>

      <el-col :span="10">
        <el-card shadow="never" class="panel">
          <template #header>
            <div class="panel-title">{{ t('validationWorkbench.panels.archives') }}</div>
          </template>
          <el-empty v-if="!facts || facts.volumeArchives.length === 0" :description="t('validationWorkbench.empty.archives')" />
          <el-collapse v-else>
            <el-collapse-item
              v-for="archive in facts.volumeArchives"
              :key="archive.id"
              :title="t('validationWorkbench.archiveTitle', { number: archive.volumeNumber, time: formatTime(archive.archivedAt) })"
              :name="archive.id"
            >
              <div class="meta">
                {{ t('validationWorkbench.lastChapterId') }}: {{ archive.lastChapterId || '-' }}
              </div>
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
.actions,
.fix-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  flex-wrap: wrap;
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
