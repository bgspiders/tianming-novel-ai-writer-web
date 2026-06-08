<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  Bell,
  ChatDotRound,
  CircleCheck,
  Delete,
  Document,
  Edit,
  FolderOpened,
  MagicStick,
  Monitor,
  Moon,
  Notebook,
  Plus,
  Promotion,
  Sunny,
  SwitchButton,
  UserFilled
} from '@element-plus/icons-vue'
import { useI18n } from '@/composables/useI18n'
import type { Locale } from '@/i18n'
import { useThemeStore } from '@/stores/theme'
import { useWorkContextStore } from '@/stores/workContext'
import { useAuthStore } from '@/stores/auth'
import { onboardingGuideSteps } from '@/onboarding/guideSteps'

const route = useRoute()
const router = useRouter()
const themeStore = useThemeStore()
const workContext = useWorkContextStore()
const authStore = useAuthStore()
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
const projectManagerVisible = ref(false)
const volumeDialogVisible = ref(false)
const creatingProject = ref(false)
const deletingProjectId = ref('')
const creatingVolume = ref(false)
const guideVisible = ref(false)
const guideCurrent = ref(0)
const minSidebarWidth = 188
const maxSidebarWidth = 420
const sidebarWidth = ref(readSidebarWidth())
const isSidebarResizing = ref(false)
let sidebarPointerMoveHandler: ((event: PointerEvent) => void) | null = null
let sidebarPointerUpHandler: (() => void) | null = null

const sidebarStyle = computed(() => ({
  width: `${sidebarWidth.value}px`,
  flex: `0 0 ${sidebarWidth.value}px`
}))

const projectForm = reactive({
  name: '',
  description: ''
})

const volumeForm = reactive({
  volumeNumber: 1,
  title: '',
  theme: ''
})

function clampSidebarWidth(width: number) {
  return Math.min(maxSidebarWidth, Math.max(minSidebarWidth, Math.round(width)))
}

function readSidebarWidth() {
  const storedWidth = Number(localStorage.getItem('tm.sidebar.width'))
  return Number.isFinite(storedWidth) && storedWidth > 0 ? clampSidebarWidth(storedWidth) : 236
}

function saveSidebarWidth() {
  localStorage.setItem('tm.sidebar.width', String(sidebarWidth.value))
}

function openProjectDialog() {
  projectForm.name = ''
  projectForm.description = ''
  projectDialogVisible.value = true
}

function openProjectManager() {
  projectManagerVisible.value = true
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

async function deleteManagedProject(projectId: string) {
  const project = workContext.projects.find((p) => p.id === projectId)
  if (!project) return

  deletingProjectId.value = projectId
  try {
    await workContext.removeProject(projectId)
    ElMessage.success(t('layout.messages.projectDeleted', { name: project.name }))
  } catch (err) {
    ElMessage.error((err as Error).message ?? t('layout.messages.projectDeleteFailed'))
  } finally {
    deletingProjectId.value = ''
  }
}

function formatProjectTime(value: string) {
  if (!value) return '-'
  return new Intl.DateTimeFormat(localeStore.locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))
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

async function signOut() {
  try {
    await authStore.signOut()
    await router.replace('/login')
  } catch (err) {
    ElMessage.error((err as Error).message ?? t('layout.messages.logoutFailed'))
  }
}

function startGuide() {
  guideCurrent.value = 0
  guideVisible.value = true
  router.push(onboardingGuideSteps[0].route)
}

function handleGuideChange(current: number) {
  const step = onboardingGuideSteps[current]
  if (!step) return
  guideCurrent.value = current
  if (route.path !== step.route) {
    router.push(step.route)
  }
}

function handleGuideClose() {
  guideVisible.value = false
}

function clearSidebarResizeListeners() {
  if (sidebarPointerMoveHandler) {
    window.removeEventListener('pointermove', sidebarPointerMoveHandler)
    sidebarPointerMoveHandler = null
  }
  if (sidebarPointerUpHandler) {
    window.removeEventListener('pointerup', sidebarPointerUpHandler)
    window.removeEventListener('pointercancel', sidebarPointerUpHandler)
    sidebarPointerUpHandler = null
  }
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  isSidebarResizing.value = false
}

function startSidebarResize(event: PointerEvent) {
  event.preventDefault()
  isSidebarResizing.value = true
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'

  sidebarPointerMoveHandler = (moveEvent: PointerEvent) => {
    sidebarWidth.value = clampSidebarWidth(moveEvent.clientX)
  }
  sidebarPointerUpHandler = () => {
    saveSidebarWidth()
    clearSidebarResizeListeners()
  }

  window.addEventListener('pointermove', sidebarPointerMoveHandler)
  window.addEventListener('pointerup', sidebarPointerUpHandler)
  window.addEventListener('pointercancel', sidebarPointerUpHandler)
}

onMounted(() => {
  workContext.init()
})

onBeforeUnmount(() => {
  clearSidebarResizeListeners()
})
</script>

<template>
  <el-container class="layout">
    <el-aside :width="`${sidebarWidth}px`" :style="sidebarStyle" class="layout-aside">
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

        <el-menu-item index="/settings/ai-models">
          <el-icon><MagicStick /></el-icon>
          <span data-guide="ai-models">{{ t('routes.aiModels') }}</span>
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
          <span data-guide="chapter-editor">{{ t('routes.chapterEditor') }}</span>
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
          <el-menu-item index="/generate/novel-seed">
            <span data-guide="novel-seed">{{ t('layout.menu.novelSeed') }}</span>
          </el-menu-item>
          <el-menu-item index="/generate/tianming-protocol">{{ t('layout.menu.tianmingProtocol') }}</el-menu-item>
          <el-menu-item index="/generate/outlines">{{ t('layout.menu.outlines') }}</el-menu-item>
          <el-menu-item index="/generate/volume_designs">{{ t('layout.menu.volumeDesigns') }}</el-menu-item>
          <el-menu-item index="/generate/chapter_plans">
            <span data-guide="chapter-plans">{{ t('layout.menu.chapterPlans') }}</span>
          </el-menu-item>
          <el-menu-item index="/generate/chapter_blueprints">{{ t('layout.menu.chapterBlueprints') }}</el-menu-item>
          <el-menu-item index="/generate/chapters">
            <span data-guide="chapter-generation">{{ t('layout.menu.chapterDrafts') }}</span>
          </el-menu-item>
          <el-menu-item index="/generate/tracking">{{ t('layout.menu.narrativeTracking') }}</el-menu-item>
          <el-menu-item index="/generate/gate">{{ t('layout.menu.generationGate') }}</el-menu-item>
        </el-sub-menu>

        <el-menu-item index="/editor">
          <el-icon><Document /></el-icon>
          <span>{{ t('layout.menu.writerEditor') }}</span>
        </el-menu-item>

        <el-menu-item index="/validate">
          <el-icon><CircleCheck /></el-icon>
          <span data-guide="validation">{{ t('layout.menu.validation') }}</span>
        </el-menu-item>

        <el-menu-item index="/ai-assistant">
          <el-icon><ChatDotRound /></el-icon>
          <span>{{ t('routes.aiAssistant') }}</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <button
      class="sidebar-resizer"
      :class="{ 'is-resizing': isSidebarResizing }"
      type="button"
      :aria-label="t('layout.resizeSidebar')"
      @pointerdown="startSidebarResize"
    ></button>

    <el-container class="layout-content">
      <el-header height="60px" class="layout-header">
        <div>
          <div class="header-title">{{ headerTitle }}</div>
          <div class="header-sub">
            {{ t('layout.currentThemeAndSource', { theme: themeStore.effectiveTheme.label, source: sourceLabel }) }}
          </div>
        </div>

        <div class="header-right">
          <div class="work-context" data-guide="work-context">
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
            <el-button size="small" :icon="FolderOpened" @click="openProjectManager">
              {{ t('layout.projectManage') }}
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

          <el-button type="primary" plain size="small" class="guide-trigger" @click="startGuide">
            {{ t('layout.guide.start') }}
          </el-button>

          <el-button text size="small" @click="cycleTheme">
            <el-icon class="mr-4"><component :is="themeIcon" /></el-icon>
            <span>{{ themeLabel }}</span>
          </el-button>

          <div class="user-chip">
            <el-icon><UserFilled /></el-icon>
            <span>{{ authStore.username || 'Admin' }}</span>
          </div>
          <el-button text size="small" :icon="SwitchButton" @click="signOut">
            {{ t('layout.logout') }}
          </el-button>
        </div>
      </el-header>

      <el-main class="layout-main">
        <RouterView />
      </el-main>
    </el-container>
  </el-container>

  <el-tour
    v-model="guideVisible"
    v-model:current="guideCurrent"
    type="primary"
    :show-close="true"
    :mask="{ color: 'rgba(8, 12, 24, 0.56)' }"
    :gap="{ offset: 8, radius: 8 }"
    :scroll-into-view-options="{ block: 'center', behavior: 'smooth' }"
    @change="handleGuideChange"
    @close="handleGuideClose"
    @finish="handleGuideClose"
  >
    <el-tour-step
      v-for="step in onboardingGuideSteps"
      :key="step.id"
      :target="step.target"
      :title="step.title"
      :description="step.description"
      :placement="step.placement"
      :prev-button-props="{ children: t('layout.guide.previous') }"
      :next-button-props="{ children: t('layout.guide.next') }"
    />
  </el-tour>

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

  <el-dialog v-model="projectManagerVisible" :title="t('layout.dialogs.projectManager')" width="720px">
    <div class="project-manager">
      <div v-if="!workContext.projects.length" class="project-empty">
        {{ t('layout.projectManager.empty') }}
      </div>
      <div v-for="project in workContext.projects" :key="project.id" class="project-row">
        <div class="project-row-main">
          <div class="project-row-title">
            <span>{{ project.name }}</span>
            <el-tag v-if="project.id === workContext.selectedProjectId" size="small" type="success">
              {{ t('layout.projectManager.current') }}
            </el-tag>
          </div>
          <div class="project-row-desc">{{ project.description || t('layout.projectManager.noDescription') }}</div>
          <div class="project-row-meta">
            {{ t('layout.projectManager.updatedAt', { time: formatProjectTime(project.updatedAt) }) }}
          </div>
        </div>
        <el-popconfirm
          width="320"
          :title="t('layout.projectManager.deleteConfirm', { name: project.name })"
          :confirm-button-text="t('layout.dialogs.delete')"
          :cancel-button-text="t('layout.dialogs.cancel')"
          confirm-button-type="danger"
          @confirm="deleteManagedProject(project.id)"
        >
          <template #reference>
            <el-button
              type="danger"
              plain
              size="small"
              :icon="Delete"
              :loading="deletingProjectId === project.id"
            >
              {{ t('layout.dialogs.delete') }}
            </el-button>
          </template>
        </el-popconfirm>
      </div>
    </div>
    <template #footer>
      <el-button @click="projectManagerVisible = false">{{ t('layout.dialogs.close') }}</el-button>
      <el-button type="primary" :icon="Plus" @click="openProjectDialog">{{ t('layout.dialogs.newProject') }}</el-button>
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
  overflow: hidden;
}

.layout-aside {
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--tm-bg-elevated) 88%, transparent) 0%, transparent 100%),
    var(--tm-bg-elevated);
  border-right: 1px solid var(--tm-border);
  padding: 14px 10px 10px;
  min-width: 188px;
  max-width: 420px;
  overflow: hidden auto;
  flex-shrink: 0;
}

.brand {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 12px 16px;
}

.brand-dot {
  flex: 0 0 auto;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--tm-primary), var(--tm-info));
  box-shadow: 0 0 0 6px color-mix(in srgb, var(--tm-primary) 18%, transparent);
  margin-top: 4px;
}

.brand-copy {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.brand-text {
  font-size: 15px;
  font-weight: 700;
  color: var(--tm-fg-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.brand-sub {
  font-size: 11px;
  color: var(--tm-fg-secondary);
  letter-spacing: 0;
  line-height: 1.45;
  overflow-wrap: anywhere;
  word-break: keep-all;
  white-space: normal;
}

.brand :deep(.el-tag) {
  flex: 0 0 auto;
  margin-top: 1px;
}

.sidebar-resizer {
  position: relative;
  z-index: 3;
  flex: 0 0 8px;
  width: 8px;
  border: 0;
  padding: 0;
  cursor: col-resize;
  background: transparent;
}

.sidebar-resizer::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 3px;
  width: 2px;
  background: transparent;
  transition: background-color 0.16s ease, box-shadow 0.16s ease;
}

.sidebar-resizer:hover::before,
.sidebar-resizer.is-resizing::before {
  background: var(--tm-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--tm-primary) 14%, transparent);
}

.layout-content {
  min-width: 0;
}

.layout-menu {
  border-right: none;
}

.layout-menu :deep(.el-menu-item span),
.layout-menu :deep(.el-sub-menu__title span) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-manager {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.project-empty {
  padding: 20px 0;
  text-align: center;
  color: var(--tm-fg-secondary);
}

.project-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--tm-bg-elevated) 92%, transparent);
}

.project-row-main {
  min-width: 0;
  flex: 1;
}

.project-row-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  color: var(--tm-fg-primary);
}

.project-row-desc {
  margin-top: 4px;
  color: var(--tm-fg-secondary);
  font-size: 12px;
  line-height: 1.5;
  word-break: break-word;
}

.project-row-meta {
  margin-top: 6px;
  color: var(--tm-fg-tertiary);
  font-size: 12px;
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
  white-space: nowrap;
}

.header-sub {
  font-size: 12px;
  color: var(--tm-fg-secondary);
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.work-context {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.primary-project-entry {
  margin-right: 10px;
}

.context-label {
  color: var(--tm-fg-secondary);
  font-size: 12px;
}

.guide-trigger {
  border-radius: 999px;
  font-weight: 600;
  white-space: nowrap;
}

.user-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--tm-border);
  border-radius: 999px;
  color: var(--tm-fg-secondary);
  font-size: 12px;
  background: color-mix(in srgb, var(--tm-bg-elevated) 78%, transparent);
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
  .layout-header {
    height: auto !important;
    min-height: 60px;
    align-items: flex-start;
    gap: 12px;
    padding: 10px 14px;
  }

  .header-right {
    gap: 8px;
    justify-content: flex-end;
    flex-wrap: wrap;
  }

  .work-context {
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .project-row {
    flex-direction: column;
  }
}

@media (max-width: 760px) {
  .layout-aside {
    min-width: 172px;
  }

  .sidebar-resizer {
    flex-basis: 10px;
    width: 10px;
  }

  .layout-header {
    flex-direction: column;
  }

  .header-right {
    width: 100%;
    justify-content: flex-start;
  }

  .work-context {
    justify-content: flex-start;
  }
}
</style>
