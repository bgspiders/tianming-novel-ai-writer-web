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
  if (!workContext.selectedProject) return 'No project selected'
  if (!workContext.selectedVolume) return workContext.selectedProject.name
  return `${workContext.selectedProject.name} / Volume ${workContext.selectedVolume.volumeNumber} / ${workContext.selectedVolume.title}`
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
    { label: 'Chapters', value: overview.chapterCount, hint: 'Covered in the current snapshot' },
    { label: 'Character States', value: overview.characterStateCount, hint: `${overview.characterStatePointCount} state points` },
    { label: 'Character Rules', value: overview.characterDescriptionCount, hint: 'Design character rules' },
    { label: 'Conflict Progress', value: overview.conflictProgressCount, hint: `${overview.conflictProgressPointCount} progress points` },
    { label: 'Faction States', value: overview.factionStateCount, hint: `${overview.factionStatePointCount} state points` },
    { label: 'Location States', value: overview.locationStateCount, hint: `${overview.locationStatePointCount} state points` },
    { label: 'Location Rules', value: overview.locationDescriptionCount, hint: 'Design location rules' },
    { label: 'World Constraints', value: overview.worldRuleConstraintCount, hint: 'Hard rules and special laws' },
    { label: 'Character Locations', value: overview.characterLocationCount, hint: `${overview.characterMovementCount} movements` },
    { label: 'Item States', value: overview.itemStateCount, hint: `${overview.itemStatePointCount} state points` },
    {
      label: 'Foreshadowing',
      value: overview.foreshadowingCount,
      hint: `${overview.unresolvedForeshadowingCount} unresolved / ${overview.overdueForeshadowingCount} overdue`
    },
    { label: 'Plot Points', value: overview.plotPointCount, hint: `${overview.timelineCount} timeline items` },
    { label: 'Volume Archives', value: overview.volumeArchiveCount, hint: 'Archived fact snapshots' }
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
    ElMessage.error((err as Error).message || 'Failed to load validation data.')
  } finally {
    loading.value = false
  }
}

async function runCurrentValidation() {
  if (!workContext.selectedProjectId) {
    ElMessage.warning('Select a project first.')
    return
  }

  running.value = true
  try {
    await runValidation({
      projectId: workContext.selectedProjectId,
      volumeNumber: selectedVolumeNumber.value
    })
    ElMessage.success('Validation completed.')
    await refresh()
  } catch (err) {
    ElMessage.error((err as Error).message || 'Validation failed.')
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
      status === 'needs_fix' ? 'Marked from validation report for follow-up.' : 'Marked as validated from validation report.'
    )
    ElMessage.success(status === 'needs_fix' ? 'Chapter marked for fixes.' : 'Chapter marked as validated.')
    await refresh()
  } catch (err) {
    ElMessage.error((err as Error).message || 'Failed to update chapter status.')
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
        <p class="eyebrow">Stage 5 / Validation</p>
        <h1>Validation Workbench</h1>
        <p class="subtitle">
          Run consistency checks for the current project or volume, review validation summaries,
          and inspect the persisted fact snapshot.
        </p>
      </div>
      <el-card shadow="never" class="action-card">
        <span class="context-label">Current Target</span>
        <strong>{{ targetLabel }}</strong>
        <div class="actions">
          <el-button :loading="loading" @click="refresh">Refresh</el-button>
          <el-button type="primary" :loading="running" @click="runCurrentValidation">Run Validation</el-button>
        </div>
      </el-card>
    </section>

    <el-row :gutter="16">
      <el-col :span="8">
        <el-card shadow="never" class="panel">
          <template #header>
            <div class="panel-title">Validation Summaries</div>
          </template>
          <el-empty v-if="summaries.length === 0" description="No validation summaries yet." />
          <div v-for="summary in summaries" :key="summary.id" class="summary-card">
            <div class="summary-head">
              <span>{{ summary.targetVolumeNumber === 0 ? 'Project Scope' : `Volume ${summary.targetVolumeNumber}` }}</span>
              <el-tag :type="resultType(summary.overallResult)">{{ summary.overallResult }}</el-tag>
            </div>
            <div class="meta">Validated at: {{ formatTime(summary.lastValidatedAt) }}</div>
            <el-collapse>
              <el-collapse-item title="Module Results" :name="`${summary.id}-modules`">
                <pre>{{ parseJsonText(summary.moduleResults) }}</pre>
              </el-collapse-item>
              <el-collapse-item title="Problem Items" :name="`${summary.id}-problems`">
                <pre>{{ parseJsonText(summary.problemItems) }}</pre>
              </el-collapse-item>
            </el-collapse>
          </div>
        </el-card>
      </el-col>

      <el-col :span="16">
        <el-card shadow="never" class="panel">
          <template #header>
            <div class="panel-title">Chapter Reports</div>
          </template>
          <el-table v-loading="loading" :data="reports" row-key="id" border>
            <el-table-column label="Chapter" min-width="180">
              <template #default="{ row }">
                Chapter {{ row.chapterNumber || '-' }} / {{ row.chapterTitle || row.chapterId }}
              </template>
            </el-table-column>
            <el-table-column prop="summary" label="Summary" min-width="180" />
            <el-table-column label="Result" width="110">
              <template #default="{ row }">
                <el-tag :type="resultType(row.result)">{{ row.result }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="Chapter Status" width="120">
              <template #default="{ row }">
                <el-tag :type="statusType(row.chapterStatus)">{{ row.chapterStatus || '-' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="Validated At" width="180">
              <template #default="{ row }">{{ formatTime(row.validatedAt) }}</template>
            </el-table-column>
            <el-table-column label="Actions" width="220" fixed="right">
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
                    Mark Needs Fix
                  </el-button>
                  <el-button
                    size="small"
                    type="success"
                    plain
                    :loading="updatingReportId === row.id"
                    :disabled="row.chapterStatus === 'validated'"
                    @click="markChapterStatus(row, 'validated')"
                  >
                    Mark Validated
                  </el-button>
                </div>
              </template>
            </el-table-column>
            <el-table-column type="expand">
              <template #default="{ row }">
                <el-table :data="row.items" size="small" border>
                  <el-table-column prop="name" label="Check" width="150" />
                  <el-table-column prop="details" label="Details" min-width="220" />
                  <el-table-column prop="suggestion" label="Suggestion" min-width="220" />
                  <el-table-column label="Result" width="100">
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
        <div class="panel-title">Fact Snapshot Overview</div>
      </template>
      <el-empty v-if="!facts" description="No fact snapshot available." />
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
        <div class="panel-title">Tracking Summary</div>
      </template>
      <el-empty v-if="!facts || facts.sections.length === 0" description="No tracking summary available." />
      <el-collapse v-else>
        <el-collapse-item
          v-for="section in facts.sections"
          :key="section.key"
          :title="`${section.title} / ${section.totalCount}`"
          :name="section.key"
        >
          <p class="section-summary">{{ section.summary }}</p>
          <el-table :data="section.items" size="small" border>
            <el-table-column prop="name" label="Name" min-width="150" />
            <el-table-column prop="status" label="Status" width="130" />
            <el-table-column label="Chapter" width="120">
              <template #default="{ row }">{{ row.chapterNumber ? `Chapter ${row.chapterNumber}` : '-' }}</template>
            </el-table-column>
            <el-table-column prop="detail" label="Detail" min-width="240" />
            <el-table-column prop="importance" label="Importance" width="110" />
          </el-table>
        </el-collapse-item>
      </el-collapse>
    </el-card>

    <el-row :gutter="16">
      <el-col :span="14">
        <el-card shadow="never" class="panel">
          <template #header>
            <div class="panel-title">Timeline Snapshot</div>
          </template>
          <el-table :data="facts?.timelines ?? []" row-key="id" border>
            <el-table-column label="Chapter" width="140">
              <template #default="{ row }">Chapter {{ row.chapterNumber }}</template>
            </el-table-column>
            <el-table-column prop="timePeriod" label="Time Period" width="160" />
            <el-table-column prop="elapsedTime" label="Elapsed" width="150" />
            <el-table-column prop="keyTimeEvent" label="Key Event" min-width="240" />
            <el-table-column prop="importance" label="Importance" width="110" />
          </el-table>
        </el-card>
      </el-col>

      <el-col :span="10">
        <el-card shadow="never" class="panel">
          <template #header>
            <div class="panel-title">Volume Archives</div>
          </template>
          <el-empty v-if="!facts || facts.volumeArchives.length === 0" description="No archives yet." />
          <el-collapse v-else>
            <el-collapse-item
              v-for="archive in facts.volumeArchives"
              :key="archive.id"
              :title="`Volume ${archive.volumeNumber} / ${formatTime(archive.archivedAt)}`"
              :name="archive.id"
            >
              <div class="meta">Last Chapter ID: {{ archive.lastChapterId || '-' }}</div>
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
