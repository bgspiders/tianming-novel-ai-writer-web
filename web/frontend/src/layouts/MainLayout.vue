<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
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
import { useThemeStore } from '@/stores/theme'
import { useWorkContextStore } from '@/stores/workContext'

const route = useRoute()
const router = useRouter()
const themeStore = useThemeStore()
const workContext = useWorkContextStore()

const activeMenu = computed(() => route.path)
const headerTitle = computed(() => (route.meta.title as string) || 'TM Web')

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
  if (themeStore.mode === 'system') return 'Follow System'
  if (themeStore.mode === 'schedule') return 'Scheduled'
  return themeStore.themeLabel
})

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
    ElMessage.warning('Select a project first.')
    return
  }
  volumeForm.volumeNumber = (workContext.volumes.at(-1)?.volumeNumber ?? 0) + 1
  volumeForm.title = ''
  volumeForm.theme = ''
  volumeDialogVisible.value = true
}

async function submitProject() {
  if (!projectForm.name.trim()) {
    ElMessage.warning('Project name is required.')
    return
  }
  creatingProject.value = true
  try {
    await workContext.addProject({
      name: projectForm.name.trim(),
      description: projectForm.description.trim() || null
    })
    projectDialogVisible.value = false
    ElMessage.success('Project created.')
  } catch (err) {
    ElMessage.error((err as Error).message ?? 'Failed to create project.')
  } finally {
    creatingProject.value = false
  }
}

async function submitVolume() {
  if (!volumeForm.title.trim()) {
    ElMessage.warning('Volume title is required.')
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
    ElMessage.success('Volume created.')
  } catch (err) {
    ElMessage.error((err as Error).message ?? 'Failed to create volume.')
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
          <span class="brand-text">TM Web</span>
          <span class="brand-sub">Stages 4-9</span>
        </div>
        <el-tag size="small" effect="dark" type="primary">S9</el-tag>
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
          <span>Home</span>
        </el-menu-item>

        <el-menu-item index="/health">
          <el-icon><Setting /></el-icon>
          <span>Health Check</span>
        </el-menu-item>

        <el-menu-item index="/ai-test">
          <el-icon><Cpu /></el-icon>
          <span>AI Streaming</span>
        </el-menu-item>

        <el-menu-item index="/settings/ai-models">
          <el-icon><MagicStick /></el-icon>
          <span>AI Models</span>
        </el-menu-item>

        <el-menu-item index="/settings/themes">
          <el-icon><Sunny /></el-icon>
          <span>Theme Studio</span>
        </el-menu-item>

        <el-menu-item index="/editor/chapters">
          <el-icon><Document /></el-icon>
          <span>Chapter Editor</span>
        </el-menu-item>

        <el-sub-menu index="design">
          <template #title>
            <el-icon><Edit /></el-icon>
            <span>Design Modules</span>
          </template>
          <el-menu-item index="/design/world_rules">World Rules</el-menu-item>
          <el-menu-item index="/design/character_rules">Character Rules</el-menu-item>
          <el-menu-item index="/design/faction_rules">Faction Rules</el-menu-item>
          <el-menu-item index="/design/location_rules">Location Rules</el-menu-item>
          <el-menu-item index="/design/plot_rules">Plot Rules</el-menu-item>
          <el-menu-item index="/design/creative_materials">Creative Materials</el-menu-item>
          <el-menu-item index="/design/book_analyses">Book Analyses</el-menu-item>
          <el-menu-item index="/design/outlines">Outlines</el-menu-item>
          <el-menu-item index="/design/volume_designs">Volume Designs</el-menu-item>
          <el-menu-item index="/design/chapter_plans">Chapter Plans</el-menu-item>
          <el-menu-item index="/design/chapter_blueprints">Chapter Blueprints</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="generate">
          <template #title>
            <el-icon><Notebook /></el-icon>
            <span>Generate</span>
          </template>
          <el-menu-item index="/generate">Workbench</el-menu-item>
          <el-menu-item index="/generate/outlines">Outlines</el-menu-item>
          <el-menu-item index="/generate/volume_designs">Volume Designs</el-menu-item>
          <el-menu-item index="/generate/chapter_plans">Chapter Plans</el-menu-item>
          <el-menu-item index="/generate/chapter_blueprints">Chapter Blueprints</el-menu-item>
          <el-menu-item index="/generate/chapters">Chapter Drafts</el-menu-item>
          <el-menu-item index="/generate/gate">Generation Gate</el-menu-item>
        </el-sub-menu>

        <el-menu-item index="/editor">
          <el-icon><Document /></el-icon>
          <span>Writer Editor</span>
        </el-menu-item>

        <el-menu-item index="/validate">
          <el-icon><CircleCheck /></el-icon>
          <span>Validation</span>
        </el-menu-item>

        <el-menu-item index="/ai-assistant">
          <el-icon><ChatDotRound /></el-icon>
          <span>AI Assistant</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header height="60px" class="layout-header">
        <div>
          <div class="header-title">{{ headerTitle }}</div>
          <div class="header-sub">
            {{ themeStore.effectiveTheme.label }} / {{ themeStore.currentSource }}
          </div>
        </div>

        <div class="header-right">
          <div class="work-context">
            <span class="context-label">Project</span>
            <el-select
              v-model="workContext.selectedProjectId"
              :loading="workContext.loadingProjects"
              placeholder="Not selected"
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
            <el-button text size="small" :icon="Plus" @click="openProjectDialog" />

            <span class="context-label">Volume</span>
            <el-select
              v-model="workContext.selectedVolumeId"
              :disabled="!workContext.selectedProjectId"
              :loading="workContext.loadingVolumes"
              placeholder="Not selected"
              size="small"
              filterable
              clearable
              style="width: 180px"
            >
              <el-option
                v-for="volume in workContext.volumes"
                :key="volume.id"
                :label="`Vol ${volume.volumeNumber} | ${volume.title}`"
                :value="volume.id"
              />
            </el-select>
            <el-button text size="small" :icon="Plus" @click="openVolumeDialog" />
          </div>

          <el-button class="theme-trigger" @click="router.push('/settings/themes')">
            <span class="theme-pill" :style="{ background: themeStore.effectiveTheme.hero }"></span>
            <span>Theme Studio</span>
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

  <el-dialog v-model="projectDialogVisible" title="New Project" width="420px">
    <el-form :model="projectForm" label-width="80px">
      <el-form-item label="Name" required>
        <el-input v-model="projectForm.name" @keyup.enter="submitProject" />
      </el-form-item>
      <el-form-item label="Summary">
        <el-input v-model="projectForm.description" type="textarea" :rows="3" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="projectDialogVisible = false">Cancel</el-button>
      <el-button type="primary" :loading="creatingProject" @click="submitProject">Create</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="volumeDialogVisible" title="New Volume" width="420px">
    <el-form :model="volumeForm" label-width="90px">
      <el-form-item label="Number" required>
        <el-input-number v-model="volumeForm.volumeNumber" :min="1" controls-position="right" />
      </el-form-item>
      <el-form-item label="Title" required>
        <el-input v-model="volumeForm.title" @keyup.enter="submitVolume" />
      </el-form-item>
      <el-form-item label="Theme">
        <el-input v-model="volumeForm.theme" type="textarea" :rows="3" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="volumeDialogVisible = false">Cancel</el-button>
      <el-button type="primary" :loading="creatingVolume" @click="submitVolume">Create</el-button>
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
