<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getHealth, type HealthResult } from '@/api/modules/health'
import { useI18n } from '@/composables/useI18n'

const loading = ref(false)
const result = ref<HealthResult | null>(null)
const errorMsg = ref('')
const { t } = useI18n()

async function ping() {
  loading.value = true
  errorMsg.value = ''
  try {
    result.value = await getHealth()
    ElMessage.success(t('health.success'))
  } catch (error) {
    const err = error as Error
    errorMsg.value = err.message ?? t('health.failure')
    ElMessage.error(errorMsg.value)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="health">
    <el-card shadow="never">
      <h2 class="title">{{ t('health.title') }}</h2>
      <p class="hint">{{ t('health.hint') }}</p>

      <el-space :size="12" wrap style="margin-top: 12px">
        <el-button type="primary" :loading="loading" @click="ping">{{ t('health.action') }}</el-button>
      </el-space>

      <el-divider />

      <div v-if="result">
        <el-descriptions :column="1" border>
          <el-descriptions-item :label="t('health.labels.status')">
            <el-tag type="success" size="small">{{ result.status }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item :label="t('health.labels.version')">{{ result.version }}</el-descriptions-item>
          <el-descriptions-item :label="t('health.labels.env')">{{ result.env }}</el-descriptions-item>
          <el-descriptions-item :label="t('health.labels.time')">{{ result.time }}</el-descriptions-item>
          <el-descriptions-item :label="t('health.labels.timeUtc')">{{ result.timeUtc }}</el-descriptions-item>
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
