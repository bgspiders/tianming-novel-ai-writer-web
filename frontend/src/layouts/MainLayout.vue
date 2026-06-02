<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  Bell,
  ChatDotRound,
  CircleCheck,
  Cpu,
  Document,
  Edit,
  MagicStick,
  Monitor,
  Moon,
  Notebook,
  Plus,
  Promotion,
  Setting,
  Sunny
} from '@element-plus/icons-vue'
import { useI18n } from '@/composables/useI18n'
import type { Locale } from '@/i18n'
import { useThemeStore } from '@/stores/theme'
import { useWorkContextStore } from '@/stores/workContext'

const route = useRoute()
const router = useRouter()
const themeStore = useThemeStore()
const workContext = useWorkContextStore()
const { localeStore, t, setLocale } = useI18n()

const activeMenu = computed(() => route.path)
const headerTitle = computed(() => {
  const titleKey = route.meta.titleKey as string | undefined
  return titleKey ? t(titleKey) : t('app.title')
})

function navigate(index: string) {
  router.push(index)
}

function cycleTheme() {
  if (themeStore.mode === 'preset') {
    themeStore.setMode('system')
    return
  }
  if (themeStore.mode === 'system') {
    themeStore.setMode('schedule')
    return
  }
  themeStore.setMode('preset')
}

const themeIcon = computed(() => {
  if (themeStore.mode === 'system') return Monitor
  if (themeStore.isDark) return Moon
  return Sunny
})

const themeLabel = computed(() => {
  if (themeStore.mode === 'system') return t('layout.followSystem')
  if (themeStore.mode === 'schedule') return t('layout.scheduled')
  return themeStore.themeLabel
})

const sourceLabel = computed(() => t(`layout.source.${themeStore.currentSource}`))
const localeOptions: Array<{ label: string; value: Locale }> = [
  { label: '中文', value: 'zh-CN' },
  { label: 'English', value: 'en' }
]

const projectDialogVisible = ref(false)
const volumeDialogVisible = ref(false)
const creatingProject = ref(false)
const creatingVolume = ref(false)

const projectForm = reactive({
  name: '',
  description: ''
})

const volumeForm = reactive({
  volumeNumber: 1,
  title: '',
  theme: ''
})

function openProjectDialog() {
  projectForm.name = ''
  projectForm.description = ''
  projectDialogVisible.value = true
}

function openVolumeDialog() {
  if (!workContext.selectedProjectId) {
    ElMessage.warning(t('layout.messages.selectProjectFirst'))
    return
  }
  volumeForm.volumeNumber = (workContext.volumes.at(-1)?.volumeNumber ?? 0) + 1
  volumeForm.title = ''
  volumeForm.theme = ''
  volumeDialogVisible.value = true
}

async function submitProject() {
  if (!projectForm.name.trim()) {
    ElMessage.warning(t('layout.messages.projectNameRequired'))
    return
  }
  creatingProject.value = true
  try {
    await workContext.addProject({
      name: projectForm.name.trim(),
      description: projectForm.description.trim() || null
    })
    projectDialogVisible.value = false
    ElMessage.success(t('layout.messages.projectCreated'))
  } catch (err) {
    ElMessage.error((err as Error).message ?? t('layout.messages.projectCreateFailed'))
  } finally {
    creatingProject.value = false
  }
}

async function submitVolume() {
  if (!volumeForm.title.trim()) {
    ElMessage.warning(t('layout.messages.volumeTitleRequired'))
    return
  }
  creatingVolume.value = true
  try {
    await workContext.addVolume({
      volumeNumber: volumeForm.volumeNumber,
      title: volumeForm.title.trim(),
      theme: volumeForm.theme.trim() || null
    })
    volumeDialogVisible.value = false
    ElMessage.success(t('layout.messages.volumeCreated'))
  } catch (err) {
    ElMessage.error((err as Error).message ?? t('layout.messages.volumeCreateFailed'))
  } finally {
    creatingVolume.value = false
  }
}
</script>

<template>
  <el-container class="layout">
    <el-aside width="236px" class="layout-aside">
      <div class="brand">
        <span class="brand-dot"></span>
        <div class="brand-copy">
          <span class="brand-text">{{ t('app.title') }}</span>
          <span class="brand-sub">{{ t('layout.stageBadge') }}</span>
        </div>
        <el-tag size="small" effect="dark" type="primary">{{ t('layout.stageTag') }}</el-tag>
      </div>

      <el-menu
        :default-active="activeMenu"
        class="layout-menu"
        background-color="transparent"
        text-color="var(--tm-fg-secondary)"
        active-text-color="var(--tm-primary)"
        @select="navigate"
      >
        <el-menu-item index="/">
          <el-icon><Promotion /></el-icon>
          <span>{{ t('routes.home') }}</span>
        </el-menu-item>

        <el-menu-item index="/health">
          <el-icon><Setting /></el-icon>
          <span>{{ t('layout.menu.healthCheck') }}</span>
        </el-menu-item>

        <el-menu-item index="/ai-test">
          <el-icon><Cpu /></el-icon>
          <span>{{ t('layout.menu.aiStreaming') }}</span>
        </el-menu-item>

        <el-menu-item index="/settings/ai-models">
          <el-icon><MagicStick /></el-icon>
          <span>{{ t('routes.aiModels') }}</span>
        </el-menu-item>

        <el-menu-item index="/settings/themes">
          <el-icon><Sunny /></el-icon>
          <span>{{ t('routes.themeStudio') }}</span>
        </el-menu-item>

        <el-menu-item index="/settings/notifications">
          <el-icon><Bell /></el-icon>
          <span>{{ t('routes.notificationCenter') }}</span>
        </el-menu-item>

        <el-menu-item index="/editor/chapters">
          <el-icon><Document /></el-icon>
          <span>{{ t('routes.chapterEditor') }}</span>
        </el-menu-item>

        <el-sub-menu index="design">
          <template #title>
            <el-icon><Edit /></el-icon>
            <span>{{ t('routes.designModules') }}</span>
          </template>
          <el-menu-item index="/design/world_rules">{{ t('layout.menu.worldRules') }}</el-menu-item>
          <el-menu-item index="/design/character_rules">{{ t('layout.menu.characterRules') }}</el-menu-item>
          <el-menu-item index="/design/faction_rules">{{ t('layout.menu.factionRules') }}</el-menu-item>
          <el-menu-item index="/design/location_rules">{{ t('layout.menu.locationRules') }}</el-menu-item>
          <el-menu-item index="/design/plot_rules">{{ t('layout.menu.plotRules') }}</el-menu-item>
          <el-menu-item index="/design/creative_materials">{{ t('layout.menu.creativeMaterials') }}</el-menu-item>
          <el-menu-item index="/design/book_analyses">{{ t('layout.menu.bookAnalyses') }}</el-menu-item>
          <el-menu-item index="/design/outlines">{{ t('layout.menu.outlines') }}</el-menu-item>
          <el-menu-item index="/design/volume_designs">{{ t('layout.menu.volumeDesigns') }}</el-menu-item>
          <el-menu-item index="/design/chapter_plans">{{ t('layout.menu.chapterPlans') }}</el-menu-item>
          <el-menu-item index="/design/chapter_blueprints">{{ t('layout.menu.chapterBlueprints') }}</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="generate">
          <template #title>
            <el-icon><Notebook /></el-icon>
            <span>{{ t('layout.menu.generate') }}</span>
          </template>
          <el-menu-item index="/generate">{{ t('layout.menu.workbench') }}</el-menu-item>
          <el-menu-item index="/generate/novel-seed">{{ t('layout.menu.novelSeed') }}</el-menu-item>
          <el-menu-item index="/generate/outlines">{{ t('layout.menu.outlines') }}</el-menu-item>
          <el-menu-item index="/generate/volume_designs">{{ t('layout.menu.volumeDesigns') }}</el-menu-item>
          <el-menu-item index="/generate/chapter_plans">{{ t('layout.menu.chapterPlans') }}</el-menu-item>
          <el-menu-item index="/generate/chapter_blueprints">{{ t('layout.menu.chapterBlueprints') }}</el-menu-item>
          <el-menu-item index="/generate/chapters">{{ t('layout.menu.chapterDrafts') }}</el-menu-item>
          <el-menu-item index="/generate/gate">{{ t('layout.menu.generationGate') }}</el-menu-item>
        </el-sub-menu>

        <el-menu-item index="/editor">
          <el-icon><Document /></el-icon>
          <span>{{ t('layout.menu.writerEditor') }}</span>
        </el-menu-item>

        <el-menu-item index="/validate">
          <el-icon><CircleCheck /></el-icon>
          <span>{{ t('layout.menu.validation') }}</span>
        </el-menu-item>

        <el-menu-item index="/ai-assistant">
          <el-icon><ChatDotRound /></el-icon>
          <span>{{ t('routes.aiAssistant') }}</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header height="60px" class="layout-header">
        <div>
          <div class="header-title">{{ headerTitle }}</div>
          <div class="header-sub">
            {{ t('layout.currentThemeAndSource', { theme: themeStore.effectiveTheme.label, source: sourceLabel }) }}
          </div>
        </div>

        <div class="header-right">
          <div class="work-context">
            <el-button
              v-if="!workContext.projects.length"
              type="primary"
              size="small"
              :icon="Plus"
              class="primary-project-entry"
              @click="openProjectDialog"
            >
              {{ t('layout.dialogs.newProject') }}
            </el-button>

            <span class="context-label">{{ t('layout.project') }}</span>
            <el-select
              v-model="workContext.selectedProjectId"
              :loading="workContext.loadingProjects"
              :placeholder="t('layout.placeholders.selectProject')"
              size="small"
              filterable
              style="width: 190px"
            >
              <el-option
                v-for="project in workContext.projects"
                :key="project.id"
                :label="project.name"
                :value="project.id"
              />
            </el-select>
            <el-button size="small" :icon="Plus" @click="openProjectDialog">
              {{ t('layout.dialogs.newProject') }}
            </el-button>

            <span class="context-label">{{ t('layout.volume') }}</span>
            <el-select
              v-model="workContext.selectedVolumeId"
              :disabled="!workContext.selectedProjectId"
              :loading="workContext.loadingVolumes"
              :placeholder="t('layout.placeholders.selectVolume')"
              size="small"
              filterable
              clearable
              style="width: 180px"
            >
              <el-option
                v-for="volume in workContext.volumes"
                :key="volume.id"
                :label="t('layout.volumeOption', { number: volume.volumeNumber, title: volume.title })"
                :value="volume.id"
              />
            </el-select>
            <el-button text size="small" :icon="Plus" @click="openVolumeDialog" />
          </div>

          <el-select
            :model-value="localeStore.locale"
            size="small"
            style="width: 118px"
            @change="setLocale($event as Locale)"
          >
            <el-option
              v-for="option in localeOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>

          <el-button class="theme-trigger" @click="router.push('/settings/themes')">
            <span class="theme-pill" :style="{ background: themeStore.effectiveTheme.hero }"></span>
            <span>{{ t('layout.themeStudio') }}</span>
          </el-button>

          <el-button text size="small" @click="cycleTheme">
            <el-icon class="mr-4"><component :is="themeIcon" /></el-icon>
            <span>{{ themeLabel }}</span>
          </el-button>
        </div>
      </el-header>

      <el-main class="layout-main">
        <RouterView />
      </el-main>
    </el-container>
  </el-container>

  <el-dialog v-model="projectDialogVisible" :title="t('layout.dialogs.newProject')" width="420px">
    <el-form :model="projectForm" label-width="80px">
      <el-form-item :label="t('layout.dialogs.name')" required>
        <el-input v-model="projectForm.name" @keyup.enter="submitProject" />
      </el-form-item>
      <el-form-item :label="t('layout.dialogs.summary')">
        <el-input v-model="projectForm.description" type="textarea" :rows="3" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="projectDialogVisible = false">{{ t('layout.dialogs.cancel') }}</el-button>
      <el-button type="primary" :loading="creatingProject" @click="submitProject">{{ t('layout.dialogs.create') }}</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="volumeDialogVisible" :title="t('layout.dialogs.newVolume')" width="420px">
    <el-form :model="volumeForm" label-width="90px">
      <el-form-item :label="t('layout.dialogs.number')" required>
        <el-input-number v-model="volumeForm.volumeNumber" :min="1" controls-position="right" />
      </el-form-item>
      <el-form-item :label="t('layout.dialogs.title')" required>
        <el-input v-model="volumeForm.title" @keyup.enter="submitVolume" />
      </el-form-item>
      <el-form-item :label="t('layout.dialogs.theme')">
        <el-input v-model="volumeForm.theme" type="textarea" :rows="3" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="volumeDialogVisible = false">{{ t('layout.dialogs.cancel') }}</el-button>
      <el-button type="primary" :loading="creatingVolume" @click="submitVolume">{{ t('layout.dialogs.create') }}</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.layout {
  height: 100vh;
}

.layout-aside {
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--tm-bg-elevated) 88%, transparent) 0%, transparent 100%),
    var(--tm-bg-elevated);
  border-right: 1px solid var(--tm-border);
  padding: 14px 10px 10px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px 16px;
}

.brand-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--tm-primary), var(--tm-info));
  box-shadow: 0 0 0 6px color-mix(in srgb, var(--tm-primary) 18%, transparent);
}

.brand-copy {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.brand-text {
  font-size: 15px;
  font-weight: 700;
  color: var(--tm-fg-primary);
}

.brand-sub {
  font-size: 11px;
  color: var(--tm-fg-secondary);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.layout-menu {
  border-right: none;
}

.layout-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: color-mix(in srgb, var(--tm-bg-elevated) 90%, transparent);
  border-bottom: 1px solid var(--tm-border);
  backdrop-filter: blur(18px);
}

.header-title {
  font-size: 16px;
  color: var(--tm-fg-primary);
  font-weight: 700;
}

.header-sub {
  font-size: 12px;
  color: var(--tm-fg-secondary);
  margin-top: 4px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.work-context {
  display: flex;
  align-items: center;
  gap: 6px;
}

.primary-project-entry {
  margin-right: 10px;
}

.context-label {
  color: var(--tm-fg-secondary);
  font-size: 12px;
}

.theme-trigger {
  border-radius: 999px;
}

.theme-pill {
  width: 22px;
  height: 22px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--tm-border) 80%, transparent);
  margin-right: 8px;
}

.layout-main {
  background: transparent;
  padding: 20px;
  overflow: auto;
}

.mr-4 {
  margin-right: 4px;
}

@media (max-width: 1100px) {
  .header-right {
    gap: 8px;
  }

  .work-context {
    flex-wrap: wrap;
    justify-content: flex-end;
  }
}
</style>
