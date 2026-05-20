<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getHealth, type HealthResult } from '@/api/modules/health'

const loading = ref(false)
const result = ref<HealthResult | null>(null)
const errorMsg = ref('')

async function ping() {
  loading.value = true
  errorMsg.value = ''
  try {
    result.value = await getHealth()
    ElMessage.success('Backend health check succeeded')
  } catch (error) {
    const err = error as Error
    errorMsg.value = err.message ?? 'Health request failed'
    ElMessage.error(errorMsg.value)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="health">
    <el-card shadow="never">
      <h2 class="title">Health Check</h2>
      <p class="hint">
        Call <code>GET /api/health</code> to confirm the backend is online and returning version plus timestamp data.
        If the request fails, verify the API is running on <code>http://localhost:38721</code>.
      </p>

      <el-space :size="12" wrap style="margin-top: 12px">
        <el-button type="primary" :loading="loading" @click="ping">Call /api/health</el-button>
      </el-space>

      <el-divider />

      <div v-if="result">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="status">
            <el-tag type="success" size="small">{{ result.status }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="version">{{ result.version }}</el-descriptions-item>
          <el-descriptions-item label="env">{{ result.env }}</el-descriptions-item>
          <el-descriptions-item label="time">{{ result.time }}</el-descriptions-item>
          <el-descriptions-item label="timeUtc">{{ result.timeUtc }}</el-descriptions-item>
        </el-descriptions>
      </div>

      <el-alert
        v-else-if="errorMsg"
        :title="errorMsg"
        type="error"
        show-icon
        :closable="false"
      />
    </el-card>
  </div>
</template>

<style scoped>
.health {
  max-width: 760px;
  margin: 0 auto;
}

.title {
  font-size: 20px;
  font-weight: 600;
  color: var(--tm-fg-primary);
  margin: 0 0 8px;
}

.hint {
  color: var(--tm-fg-secondary);
  font-size: 13px;
  line-height: 1.7;
}

.hint code {
  background: var(--tm-bg-elevated);
  padding: 1px 6px;
  border-radius: 3px;
  font-family: 'SF Mono', Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
}
</style>
