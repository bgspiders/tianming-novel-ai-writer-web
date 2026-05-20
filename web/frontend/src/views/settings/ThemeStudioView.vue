<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useThemeStore, type ThemeMode } from '@/stores/theme'
import type { ThemeId } from '@/theme/presets'

const themeStore = useThemeStore()

const aiSeed = ref('')
const uploading = ref(false)
const presetFilter = ref<'all' | 'light' | 'dark' | 'seasonal' | 'focus'>('all')

const modeOptions: { label: string; value: ThemeMode; hint: string }[] = [
  { label: 'Preset', value: 'preset', hint: 'Manual theme selection.' },
  { label: 'System', value: 'system', hint: 'Follow browser light or dark scheme.' },
  { label: 'Schedule', value: 'schedule', hint: 'Switch by time or sun events.' }
]

const themeOptions = computed(() =>
  themeStore.availableThemes.map((item) => ({
    label: item.label,
    value: item.id,
    dark: item.dark
  }))
)

const presetCount = computed(() => themeStore.availableThemes.length)
const filteredPresets = computed(() =>
  themeStore.availableThemes.filter((item) => presetFilter.value === 'all' || item.category === presetFilter.value)
)

const holidayRows = computed(() =>
  themeStore.holidayCatalog.map((item) => ({
    key: item.key,
    label: item.label,
    value: (themeStore.holiday.themeMap[item.key] ?? 'light') as ThemeId
  }))
)

const currentTokens = computed(() => [
  { label: 'Primary', value: themeStore.effectiveTheme.tokens.primary },
  { label: 'Background', value: themeStore.effectiveTheme.tokens.bg },
  { label: 'Surface', value: themeStore.effectiveTheme.tokens.bgElevated },
  { label: 'Text', value: themeStore.effectiveTheme.tokens.fgPrimary },
  { label: 'Border', value: themeStore.effectiveTheme.tokens.border },
  { label: 'Selection', value: themeStore.effectiveTheme.tokens.selection }
])

const presetStatCards = computed(() => [
  { label: 'Total', value: themeStore.presetStats.total },
  { label: 'Light', value: themeStore.presetStats.light },
  { label: 'Dark', value: themeStore.presetStats.dark },
  { label: 'Seasonal', value: themeStore.presetStats.seasonal },
  { label: 'Focus', value: themeStore.presetStats.focus }
])

function setMode(value: ThemeMode) {
  themeStore.setMode(value)
}

function updateHolidayTheme(key: string, value: ThemeId) {
  themeStore.updateHoliday({
    themeMap: {
      [key]: value
    }
  })
}

async function onUploadImage(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  uploading.value = true
  try {
    await themeStore.generateThemeFromImage(file)
    ElMessage.success('Generated theme from image')
  } catch (error) {
    ElMessage.error((error as Error).message ?? 'Unable to generate image theme')
  } finally {
    uploading.value = false
    input.value = ''
  }
}

function generateAiTheme() {
  themeStore.generateAiTheme(aiSeed.value)
  ElMessage.success('Generated AI-style palette')
}
</script>

<template>
  <div class="theme-studio">
    <div class="hero tm-panel">
      <div>
        <div class="eyebrow">Stage 9</div>
        <h1>Theme Studio</h1>
        <p>
          Full theme system with preset palettes, browser follow, scheduled switching, holiday overrides,
          image color extraction, and AI-style palette generation.
        </p>
      </div>
      <div class="hero-card" :style="{ background: themeStore.effectiveTheme.hero }">
        <div class="hero-card-top">
          <span class="tm-chip">{{ themeStore.themeLabel }}</span>
          <span class="tm-chip">{{ themeStore.currentSource }}</span>
          <span class="tm-chip">{{ themeStore.scheduleSummary.basisLabel }}</span>
        </div>
        <div class="hero-card-metrics">
          <div>
            <span class="metric-label">Current Theme</span>
            <strong>{{ themeStore.effectiveTheme.label }}</strong>
          </div>
          <div>
            <span class="metric-label">Next Switch</span>
            <strong>{{ themeStore.nextScheduledThemeAt || 'Not scheduled' }}</strong>
          </div>
          <div>
            <span class="metric-label">Holiday</span>
            <strong>{{ themeStore.activeHoliday || 'None' }}</strong>
          </div>
          <div>
            <span class="metric-label">Sun Times</span>
            <strong>{{ themeStore.todaySunTimes.sunrise }} / {{ themeStore.todaySunTimes.sunset }}</strong>
          </div>
        </div>
      </div>
    </div>

    <div class="grid">
      <section class="panel tm-panel span-2">
        <div class="section-head">
          <h2>Palette Stats</h2>
          <span class="muted">Built-in preset breakdown</span>
        </div>
        <div class="stats-grid">
          <div v-for="item in presetStatCards" :key="item.label" class="stat-card">
            <strong>{{ item.value }}</strong>
            <span>{{ item.label }}</span>
          </div>
        </div>
      </section>

      <section class="panel tm-panel">
        <div class="section-head">
          <h2>Mode</h2>
          <span class="muted">Switch strategy</span>
        </div>
        <div class="mode-list">
          <button
            v-for="option in modeOptions"
            :key="option.value"
            :class="['mode-card', { active: themeStore.mode === option.value }]"
            @click="setMode(option.value)"
          >
            <strong>{{ option.label }}</strong>
            <span>{{ option.hint }}</span>
          </button>
        </div>
      </section>

      <section class="panel tm-panel">
        <div class="section-head">
          <h2>System Follow</h2>
          <span class="muted">Browser preference: {{ themeStore.systemScheme }}</span>
        </div>
        <div class="form-grid">
          <label>
            <span>Light Mapping</span>
            <el-select
              :model-value="themeStore.systemLightThemeId"
              @update:model-value="themeStore.setSystemThemePair($event, themeStore.systemDarkThemeId)"
            >
              <el-option v-for="item in themeOptions" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </label>
          <label>
            <span>Dark Mapping</span>
            <el-select
              :model-value="themeStore.systemDarkThemeId"
              @update:model-value="themeStore.setSystemThemePair(themeStore.systemLightThemeId, $event)"
            >
              <el-option v-for="item in themeOptions" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </label>
        </div>
      </section>

      <section class="panel tm-panel span-2">
        <div class="section-head">
          <h2>Presets</h2>
          <span class="muted">{{ presetCount }} built-in palettes mapped from the desktop theme system</span>
        </div>
        <div class="filter-row">
          <el-radio-group v-model="presetFilter" size="small">
            <el-radio-button label="all">All</el-radio-button>
            <el-radio-button label="light">Light</el-radio-button>
            <el-radio-button label="dark">Dark</el-radio-button>
            <el-radio-button label="seasonal">Seasonal</el-radio-button>
            <el-radio-button label="focus">Focus</el-radio-button>
          </el-radio-group>
        </div>
        <div class="preset-grid">
          <button
            v-for="preset in filteredPresets"
            :key="preset.id"
            :class="['preset-card', { active: themeStore.currentThemeId === preset.id }]"
            @click="themeStore.setTheme(preset.id)"
          >
            <div class="preset-preview" :style="{ background: preset.hero }"></div>
            <div class="preset-meta">
              <strong>{{ preset.label }}</strong>
              <span>{{ preset.description }}</span>
            </div>
          </button>
        </div>
      </section>

      <section class="panel tm-panel span-2">
        <div class="section-head">
          <h2>Schedule</h2>
          <span class="muted">{{ themeStore.nextScheduledThemeAt || 'No next switch yet' }}</span>
        </div>
        <div class="schedule-summary">
          <div class="tm-chip">Basis: {{ themeStore.scheduleSummary.basisLabel }}</div>
          <div class="tm-chip">Day: {{ themeStore.scheduleSummary.dayStartsAt }}</div>
          <div class="tm-chip">Night: {{ themeStore.scheduleSummary.nightStartsAt }}</div>
        </div>
        <div class="switch-line">
          <span>Enable schedule</span>
          <el-switch
            :model-value="themeStore.schedule.enabled"
            @update:model-value="themeStore.updateSchedule({ enabled: $event })"
          />
        </div>
        <div class="switch-line">
          <span>Use sunrise and sunset</span>
          <el-switch
            :model-value="themeStore.schedule.basis === 'sun'"
            @update:model-value="themeStore.updateSchedule({ basis: $event ? 'sun' : 'fixed' })"
          />
        </div>
        <div class="form-grid">
          <label>
            <span>Day Theme</span>
            <el-select
              :model-value="themeStore.schedule.dayThemeId"
              @update:model-value="themeStore.updateSchedule({ dayThemeId: $event })"
            >
              <el-option v-for="item in themeOptions" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </label>
          <label>
            <span>Night Theme</span>
            <el-select
              :model-value="themeStore.schedule.nightThemeId"
              @update:model-value="themeStore.updateSchedule({ nightThemeId: $event })"
            >
              <el-option v-for="item in themeOptions" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </label>
          <label>
            <span>Sunrise Accent</span>
            <el-select
              :model-value="themeStore.schedule.sunriseThemeId"
              @update:model-value="themeStore.updateSchedule({ sunriseThemeId: $event })"
            >
              <el-option v-for="item in themeOptions" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </label>
          <label>
            <span>Sunset Accent</span>
            <el-select
              :model-value="themeStore.schedule.sunsetThemeId"
              @update:model-value="themeStore.updateSchedule({ sunsetThemeId: $event })"
            >
              <el-option v-for="item in themeOptions" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </label>
          <label>
            <span>Day Start</span>
            <el-input
              :model-value="themeStore.schedule.dayStart"
              @update:model-value="themeStore.updateSchedule({ dayStart: $event })"
            />
          </label>
          <label>
            <span>Night Start</span>
            <el-input
              :model-value="themeStore.schedule.nightStart"
              @update:model-value="themeStore.updateSchedule({ nightStart: $event })"
            />
          </label>
          <label>
            <span>Latitude</span>
            <el-input-number
              :model-value="themeStore.schedule.latitude"
              :step="0.01"
              :min="-90"
              :max="90"
              @update:model-value="themeStore.updateSchedule({ latitude: Number($event ?? 0) })"
            />
          </label>
          <label>
            <span>Longitude</span>
            <el-input-number
              :model-value="themeStore.schedule.longitude"
              :step="0.01"
              :min="-180"
              :max="180"
              @update:model-value="themeStore.updateSchedule({ longitude: Number($event ?? 0) })"
            />
          </label>
        </div>
      </section>

      <section class="panel tm-panel">
        <div class="section-head">
          <h2>Holiday Override</h2>
          <span class="muted">Optional special-day themes</span>
        </div>
        <div class="switch-line">
          <span>Enable holiday theme override</span>
          <el-switch
            :model-value="themeStore.holiday.enabled"
            @update:model-value="themeStore.updateHoliday({ enabled: $event })"
          />
        </div>
        <div class="holiday-list">
          <div v-for="row in holidayRows" :key="row.key" class="holiday-row">
            <span>{{ row.label }}</span>
            <el-select :model-value="row.value" @update:model-value="updateHolidayTheme(row.key, $event)">
              <el-option v-for="item in themeOptions" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </div>
        </div>
      </section>

      <section class="panel tm-panel">
        <div class="section-head">
          <h2>Upcoming Holidays</h2>
          <span class="muted">Loaded from the stage 9 holiday library</span>
        </div>
        <div class="holiday-list">
          <div v-for="item in themeStore.upcomingHolidays" :key="`${item.key}-${item.date}`" class="holiday-row">
            <span>{{ item.label }}</span>
            <span class="muted">{{ item.date }}</span>
          </div>
        </div>
      </section>

      <section class="panel tm-panel">
        <div class="section-head">
          <h2>Generated Theme</h2>
          <span class="muted">Image extraction and AI palette</span>
        </div>
        <div class="generated-actions">
          <label class="upload-box">
            <span>Pick image for palette</span>
            <input type="file" accept="image/*" :disabled="uploading" @change="onUploadImage" />
          </label>
          <div class="ai-box">
            <el-input v-model="aiSeed" placeholder="Seed words, genre, mood..." />
            <el-button type="primary" @click="generateAiTheme">Generate</el-button>
          </div>
          <el-button v-if="themeStore.customTheme" text type="danger" @click="themeStore.clearCustomTheme">
            Clear custom theme
          </el-button>
        </div>
        <div v-if="themeStore.customTheme" class="custom-preview">
          <div class="custom-swatch" :style="{ background: themeStore.customTheme.tokens.primary }"></div>
          <div>
            <strong>{{ themeStore.customTheme.label }}</strong>
            <div class="muted">
              {{ themeStore.customTheme.source }} / {{ themeStore.customTheme.dark ? 'dark' : 'light' }}
            </div>
          </div>
        </div>
      </section>

      <section class="panel tm-panel span-2">
        <div class="section-head">
          <h2>Live Tokens</h2>
          <span class="muted">Current resolved theme palette</span>
        </div>
        <div class="token-grid">
          <div v-for="token in currentTokens" :key="token.label" class="token-card">
            <div class="token-swatch" :style="{ background: token.value }"></div>
            <div>
              <strong>{{ token.label }}</strong>
              <div class="muted token-value">{{ token.value }}</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.theme-studio {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.hero {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 18px;
  padding: 22px;
  border-radius: 22px;
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-size: 11px;
  color: var(--tm-primary);
  margin-bottom: 10px;
}

h1 {
  margin: 0 0 12px;
  font-size: 32px;
}

p {
  margin: 0;
  line-height: 1.7;
  color: var(--tm-fg-secondary);
}

.hero-card {
  border-radius: 18px;
  padding: 18px;
  min-height: 220px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border: 1px solid color-mix(in srgb, var(--tm-border) 60%, transparent);
}

.hero-card-top {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.hero-card-metrics {
  display: grid;
  gap: 12px;
}

.metric-label {
  display: block;
  font-size: 12px;
  color: var(--tm-fg-secondary);
  margin-bottom: 4px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.span-2 {
  grid-column: span 2;
}

.panel {
  padding: 18px;
  border-radius: 18px;
}

.section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.section-head h2 {
  margin: 0;
  font-size: 18px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}

.stat-card {
  padding: 14px;
  border-radius: 14px;
  border: 1px solid var(--tm-border);
  background: var(--tm-bg-muted);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.stat-card strong {
  font-size: 24px;
}

.stat-card span {
  color: var(--tm-fg-secondary);
  font-size: 12px;
}

.muted {
  color: var(--tm-fg-secondary);
  font-size: 13px;
}

.filter-row {
  margin-bottom: 14px;
}

.mode-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.mode-card,
.preset-card {
  border: 1px solid var(--tm-border);
  background: var(--tm-bg-elevated);
  color: inherit;
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}

.mode-card {
  border-radius: 14px;
  padding: 16px;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mode-card.active,
.preset-card.active {
  border-color: var(--tm-primary);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--tm-primary) 60%, transparent);
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.preset-card {
  border-radius: 16px;
  padding: 10px;
  text-align: left;
}

.preset-preview {
  height: 92px;
  border-radius: 12px;
  margin-bottom: 10px;
}

.preset-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.preset-meta span,
.mode-card span {
  color: var(--tm-fg-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.form-grid label,
.holiday-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
}

.switch-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--tm-border) 55%, transparent);
}

.switch-line:last-of-type {
  margin-bottom: 14px;
}

.schedule-summary {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.holiday-list {
  display: grid;
  gap: 12px;
}

.generated-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.upload-box {
  border: 1px dashed var(--tm-border-strong);
  border-radius: 14px;
  padding: 16px;
  background: var(--tm-bg-muted);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.upload-box input {
  max-width: 220px;
}

.ai-box {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
}

.custom-preview {
  margin-top: 14px;
  display: flex;
  gap: 12px;
  align-items: center;
}

.custom-swatch {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  border: 1px solid var(--tm-border);
}

.token-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.token-card {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 12px;
  border-radius: 14px;
  background: var(--tm-bg-muted);
  border: 1px solid var(--tm-border);
}

.token-swatch {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--tm-border) 80%, transparent);
  flex-shrink: 0;
}

.token-value {
  margin-top: 4px;
  font-family: Consolas, 'SF Mono', monospace;
}

@media (max-width: 1100px) {
  .hero,
  .grid,
  .stats-grid,
  .mode-list,
  .form-grid,
  .preset-grid,
  .token-grid {
    grid-template-columns: 1fr;
  }

  .span-2 {
    grid-column: span 1;
  }
}
</style>
