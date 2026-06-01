<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from '@/composables/useI18n'
import { useThemeStore } from '@/stores/theme'

const router = useRouter()
const themeStore = useThemeStore()
const { t } = useI18n()

const quickActions = computed(() => [
  { label: t('home.quickActions.aiModels'), path: '/settings/ai-models', type: 'primary' as const },
  { label: t('home.quickActions.bookAnalyses'), path: '/design/book_analyses', type: 'default' as const },
  { label: t('home.quickActions.creativeMaterials'), path: '/design/creative_materials', type: 'success' as const },
  { label: t('home.quickActions.outlines'), path: '/generate/outlines', type: 'warning' as const },
  { label: t('home.quickActions.generationWorkbench'), path: '/generate', type: 'info' as const },
  { label: t('home.quickActions.aiAssistant'), path: '/ai-assistant', type: 'default' as const }
])

const currentTheme = computed(() => t('home.preview.current', { theme: themeStore.effectiveTheme.label }))
const previewMode = computed(() => t('home.preview.mode', { mode: t(`home.preview.modeValue.${themeStore.mode}`) }))
const previewSource = computed(() => t('home.preview.source', { source: t(`home.preview.sourceValue.${themeStore.currentSource}`) }))
const previewHoliday = computed(() =>
  t('home.preview.holiday', { holiday: themeStore.activeHoliday || t('home.preview.none') })
)
const previewNext = computed(() =>
  t('home.preview.next', { next: themeStore.nextScheduledThemeAt || t('home.preview.notScheduled') })
)
</script>

<template>
  <div class="home">
    <section class="hero tm-panel">
      <div class="hero-copy">
        <div class="eyebrow">{{ t('home.eyebrow') }}</div>
        <h1>{{ t('home.title') }}</h1>
        <p>{{ t('home.summary') }}</p>
        <el-space wrap :size="12">
          <el-button
            v-for="action in quickActions"
            :key="action.path"
            :type="action.type"
            @click="router.push(action.path)"
          >
            {{ action.label }}
          </el-button>
        </el-space>
      </div>
      <div class="hero-preview" :style="{ background: themeStore.effectiveTheme.hero }">
        <div class="preview-chip">{{ currentTheme }}</div>
        <div class="preview-card">
          <div class="preview-line strong">{{ previewMode }}</div>
          <div class="preview-line">{{ previewSource }}</div>
          <div class="preview-line">{{ previewHoliday }}</div>
          <div class="preview-line">{{ previewNext }}</div>
        </div>
      </div>
    </section>

    <section class="grid">
      <el-card shadow="never" class="panel">
        <template #header>
          <div class="panel-title">{{ t('home.sections.currentFocus') }}</div>
        </template>
        <ul class="feature-list">
          <li>{{ t('home.focusItems.step1') }}</li>
          <li>{{ t('home.focusItems.step2') }}</li>
          <li>{{ t('home.focusItems.step3') }}</li>
          <li>{{ t('home.focusItems.step4') }}</li>
        </ul>
      </el-card>

      <el-card shadow="never" class="panel">
        <template #header>
          <div class="panel-title">{{ t('home.sections.runtime') }}</div>
        </template>
        <ul class="feature-list">
          <li>{{ t('home.runtimeItems.backend', { url: 'http://localhost:38721' }) }}</li>
          <li>{{ t('home.runtimeItems.frontend', { url: 'http://localhost:38720' }) }}</li>
          <li>{{ t('home.runtimeItems.swagger', { url: 'http://localhost:38721/swagger' }) }}</li>
          <li>{{ t('home.runtimeItems.theme') }}</li>
        </ul>
      </el-card>
    </section>
  </div>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.hero {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 18px;
  padding: 24px;
  border-radius: 24px;
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-size: 11px;
  color: var(--tm-primary);
  margin-bottom: 10px;
}

.hero-copy h1 {
  margin: 0 0 12px;
  font-size: 34px;
}

.hero-copy p {
  margin: 0 0 16px;
  line-height: 1.8;
  color: var(--tm-fg-secondary);
}

.hero-preview {
  border-radius: 20px;
  padding: 18px;
  min-height: 260px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border: 1px solid color-mix(in srgb, var(--tm-border) 60%, transparent);
}

.preview-chip {
  display: inline-flex;
  align-self: flex-start;
  padding: 6px 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--tm-bg-elevated) 76%, transparent);
  font-size: 12px;
}

.preview-card {
  border-radius: 16px;
  padding: 16px;
  background: color-mix(in srgb, var(--tm-bg-elevated) 84%, transparent);
  backdrop-filter: blur(12px);
}

.preview-line {
  color: var(--tm-fg-secondary);
  line-height: 1.8;
}

.preview-line.strong {
  color: var(--tm-fg-primary);
  font-weight: 600;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.panel {
  border-radius: 20px;
  background: color-mix(in srgb, var(--tm-bg-elevated) 92%, transparent);
  border: 1px solid color-mix(in srgb, var(--tm-border) 70%, transparent);
}

.panel-title {
  font-weight: 700;
}

.feature-list {
  margin: 0;
  padding-left: 18px;
  color: var(--tm-fg-secondary);
  line-height: 1.9;
}

code {
  background: var(--tm-bg-muted);
  padding: 2px 6px;
  border-radius: 4px;
}

@media (max-width: 1100px) {
  .hero,
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
