<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useWorkContextStore } from '@/stores/workContext'
import {
  getGenerationStatistics,
  listGenerationRecords,
  type GenerationRecord,
  type GenerationStatistics
} from '@/api/modules/generation'

const workContext = useWorkContextStore()
const loading = ref(false)
const records = ref<GenerationRecord[]>([])
const stats = ref<GenerationStatistics | null>(null)

const canLoad = computed(() => !!workContext.selectedProjectId)
const passRate = computed(() => {
  if (!stats.value?.totalGenerations) return '0%'
  return `${Math.round((stats.value.firstPassCount / stats.value.totalGenerations) * 100)}%`
})

interface GateAttempt {
  attempt?: number
  stage?: string
  runId?: string
  model?: string | null
  chunkCount?: number
  charCount?: number
  elapsedMs?: number
  saved?: boolean
  gate?: {
    success?: boolean
    failureStages?: string[]
    allFailures?: string[]
    failures?: Array<{ type?: string; errors?: string[] }>
    parsedChangesJson?: string | null
  }
}

function parseJson<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T
  } catch {
    return fallback
  }
}

function parseJsonText(text: string) {
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}

function stages(row: GenerationRecord) {
  return parseJson<string[]>(row.failureStages, [])
}

function attempts(row: GenerationRecord) {
  return parseJson<GateAttempt[]>(row.attempts, [])
}

function gateTagType(attempt: GateAttempt) {
  return attempt.gate?.success ? 'success' : 'danger'
}

async function refresh() {
  if (!canLoad.value) {
    records.value = []
    stats.value = null
    return
  }

  loading.value = true
  try {
    const [nextStats, nextRecords] = await Promise.all([
      getGenerationStatistics(workContext.selectedProjectId),
      listGenerationRecords(workContext.selectedProjectId, null, 80)
    ])
    stats.value = nextStats
    records.value = nextRecords
  } catch (err) {
    ElMessage.error((err as Error).message ?? 'Failed to load generation gate records.')
  } finally {
    loading.value = false
  }
}

watch(() => workContext.selectedProjectId, refresh)
onMounted(async () => {
  await workContext.init()
  await refresh()
})
</script>

<template>
  <div class="generation-gate">
    <div class="stats-grid">
      <el-card shadow="never">
        <span class="stat-label">Total Runs</span>
        <strong>{{ stats?.totalGenerations ?? 0 }}</strong>
      </el-card>
      <el-card shadow="never">
        <span class="stat-label">First Pass</span>
        <strong>{{ stats?.firstPassCount ?? 0 }}</strong>
      </el-card>
      <el-card shadow="never">
        <span class="stat-label">Failures</span>
        <strong>{{ stats?.failureCount ?? 0 }}</strong>
      </el-card>
      <el-card shadow="never">
        <span class="stat-label">Pass Rate</span>
        <strong>{{ passRate }}</strong>
      </el-card>
    </div>

    <el-card shadow="never">
      <template #header>
        <div class="panel-head">
          <span>Generation Records</span>
          <el-button size="small" :icon="Refresh" :loading="loading" @click="refresh">Refresh</el-button>
        </div>
      </template>

      <el-empty v-if="!canLoad" description="Select a project first." />
      <el-table v-else v-loading="loading" :data="records" size="small">
        <el-table-column label="Result" width="86">
          <template #default="{ row }">
            <el-tag size="small" :type="row.success ? 'success' : 'danger'">
              {{ row.success ? 'Success' : 'Failed' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Chapter" prop="chapterId" min-width="180" />
        <el-table-column label="Attempts" prop="totalAttempts" width="80" />
        <el-table-column label="Rewrites" prop="rewriteCount" width="80" />
        <el-table-column label="Gate Stages" min-width="180">
          <template #default="{ row }">
            <div class="stage-tags">
              <el-tag
                v-for="stage in stages(row)"
                :key="stage"
                size="small"
                :type="row.success ? 'success' : 'warning'"
              >
                {{ stage }}
              </el-tag>
              <span v-if="stages(row).length === 0" class="muted">None</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="Started At" prop="startedAt" min-width="180" />
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="record-detail">
              <div class="attempt-list">
                <div v-for="attempt in attempts(row)" :key="attempt.attempt" class="attempt-item">
                  <div class="attempt-head">
                    <strong>Attempt {{ attempt.attempt ?? '-' }}</strong>
                    <el-tag size="small" :type="gateTagType(attempt)">
                      {{ attempt.gate?.success ? 'Gate Passed' : 'Gate Failed' }}
                    </el-tag>
                    <span class="muted">
                      {{ attempt.model || 'Unknown model' }} /
                      {{ attempt.charCount ?? 0 }} chars /
                      {{ attempt.elapsedMs ?? 0 }}ms
                    </span>
                  </div>
                  <div v-if="attempt.gate?.allFailures?.length" class="failure-list">
                    <div v-for="failure in attempt.gate.allFailures.slice(0, 8)" :key="failure" class="failure-line">
                      {{ failure }}
                    </div>
                  </div>
                </div>
              </div>
              <strong>Raw Attempt Payload</strong>
              <pre>{{ parseJsonText(row.attempts) }}</pre>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<style scoped>
.generation-gate {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
.stat-label {
  display: block;
  color: #78837f;
  margin-bottom: 8px;
}
.stats-grid strong {
  font-size: 26px;
  color: #233631;
}
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.record-detail {
  display: grid;
  gap: 8px;
  padding: 8px 16px;
}
.stage-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.muted {
  color: #7b8782;
  font-size: 12px;
}
.attempt-list {
  display: grid;
  gap: 10px;
}
.attempt-item {
  border: 1px solid #e1e8e5;
  border-radius: 8px;
  padding: 10px;
  background: #fbfcfb;
}
.attempt-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.failure-list {
  margin-top: 8px;
  display: grid;
  gap: 4px;
}
.failure-line {
  color: #9b2c2c;
  font-size: 13px;
}
pre {
  margin: 0;
  padding: 12px;
  overflow: auto;
  border-radius: 10px;
  background: #f6f8f7;
  color: #34413d;
}
@media (max-width: 1080px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
