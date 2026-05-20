<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useThemeStore } from '@/stores/theme'

const router = useRouter()
const themeStore = useThemeStore()

const quickActions = computed(() => [
  { label: 'Theme Studio', path: '/settings/themes', type: 'primary' as const },
  { label: 'Chapter Editor', path: '/editor/chapters', type: 'success' as const },
  { label: 'Design Modules', path: '/design/world_rules', type: 'default' as const },
  { label: 'Health Check', path: '/health', type: 'info' as const }
])
</script>

<template>
  <div class="home">
    <section class="hero tm-panel">
      <div class="hero-copy">
        <div class="eyebrow">TM Web Migration</div>
        <h1>Stage 9 Theme System</h1>
        <p>
          The frontend now carries a full theme system instead of the earlier light and dark shell:
          built-in palettes, system follow, time scheduling, sunrise and sunset switching,
          holiday overrides, image color extraction, and AI-style palette generation.
        </p>
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
        <div class="preview-chip">Current: {{ themeStore.effectiveTheme.label }}</div>
        <div class="preview-card">
          <div class="preview-line strong">Mode: {{ themeStore.mode }}</div>
          <div class="preview-line">Source: {{ themeStore.currentSource }}</div>
          <div class="preview-line">Holiday: {{ themeStore.activeHoliday || 'None' }}</div>
          <div class="preview-line">Next: {{ themeStore.nextScheduledThemeAt || 'Not scheduled' }}</div>
        </div>
      </div>
    </section>

    <section class="grid">
      <el-card shadow="never" class="panel">
        <template #header>
          <div class="panel-title">Theme Capabilities</div>
        </template>
        <ul class="feature-list">
          <li>Multiple built-in palettes mapped from the desktop theme set</li>
          <li>System light and dark follow with theme remapping</li>
          <li>Fixed-time and sunrise or sunset schedule switching</li>
          <li>Holiday theme overrides for key dates</li>
          <li>Image-based palette extraction using Canvas</li>
          <li>Prompt-seeded AI-style palette generation</li>
        </ul>
      </el-card>

      <el-card shadow="never" class="panel">
        <template #header>
          <div class="panel-title">Runtime</div>
        </template>
        <ul class="feature-list">
          <li>Backend: <code>http://localhost:38721</code></li>
          <li>Frontend: <code>http://localhost:38720</code></li>
          <li>Swagger: <code>http://localhost:38721/swagger</code></li>
          <li>Theme state persists in local storage.</li>
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
