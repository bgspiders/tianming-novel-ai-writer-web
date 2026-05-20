<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useThemeStore } from '@/stores/theme'
import { useWorkContextStore } from '@/stores/workContext'
import { Sunny, Moon, Monitor, Promotion, Cpu, Setting, MagicStick, Edit, Plus, Notebook, CircleCheck, ChatDotRound, Document } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const themeStore = useThemeStore()
const workContext = useWorkContextStore()

const activeMenu = computed(() => route.path)

function navigate(idx: string) {
  router.push(idx)
}

function cycleTheme() {
  const order = ['auto', 'light', 'dark'] as const
  const cur = themeStore.mode
  const next = order[(order.indexOf(cur) + 1) % order.length]
  themeStore.setMode(next)
}

const themeIcon = computed(() => {
  if (themeStore.mode === 'auto') return Monitor
  if (themeStore.mode === 'dark') return Moon
  return Sunny
})

const themeLabel = computed(() => {
  if (themeStore.mode === 'auto') return '跟随系统'
  if (themeStore.mode === 'dark') return '深色'
  return '浅色'
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
    ElMessage.warning('请先创建或选择项目')
    return
  }
  volumeForm.volumeNumber = (workContext.volumes.at(-1)?.volumeNumber ?? 0) + 1
  volumeForm.title = ''
  volumeForm.theme = ''
  volumeDialogVisible.value = true
}

async function submitProject() {
  if (!projectForm.name.trim()) {
    ElMessage.warning('项目名称必填')
    return
  }
  creatingProject.value = true
  try {
    await workContext.addProject({
      name: projectForm.name.trim(),
      description: projectForm.description.trim() || null
    })
    projectDialogVisible.value = false
    ElMessage.success('项目已创建')
  } catch (err) {
    ElMessage.error((err as Error).message ?? '创建项目失败')
  } finally {
    creatingProject.value = false
  }
}

async function submitVolume() {
  if (!volumeForm.title.trim()) {
    ElMessage.warning('卷标题必填')
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
    ElMessage.success('分卷已创建')
  } catch (err) {
    ElMessage.error((err as Error).message ?? '创建分卷失败')
  } finally {
    creatingVolume.value = false
  }
}
</script>

<template>
  <el-container class="layout">
    <el-aside width="220px" class="layout-aside">
      <div class="brand">
        <span class="brand-dot"></span>
        <span class="brand-text">天命 Web</span>
        <el-tag size="small" type="info" effect="plain">阶段 0</el-tag>
      </div>
      <el-menu
        :default-active="activeMenu"
        class="layout-menu"
        background-color="transparent"
        @select="navigate"
      >
        <el-menu-item index="/">
          <el-icon><Promotion /></el-icon>
          <span>首页</span>
        </el-menu-item>
        <el-menu-item index="/health">
          <el-icon><Setting /></el-icon>
          <span>健康检查</span>
        </el-menu-item>
        <el-menu-item index="/ai-test">
          <el-icon><Cpu /></el-icon>
          <span>AI 流式测试</span>
        </el-menu-item>
        <el-menu-item index="/settings/ai-models">
          <el-icon><MagicStick /></el-icon>
          <span>AI 模型管理</span>
        </el-menu-item>
        <el-sub-menu index="design">
          <template #title>
            <el-icon><Edit /></el-icon>
            <span>设计模块</span>
          </template>
          <el-menu-item index="/design/world_rules">🌍 世界规则</el-menu-item>
          <el-menu-item index="/design/character_rules">🧑 角色规则</el-menu-item>
          <el-menu-item index="/design/faction_rules">⚔️ 势力规则</el-menu-item>
          <el-menu-item index="/design/location_rules">🗺️ 地点规则</el-menu-item>
          <el-menu-item index="/design/plot_rules">📜 剧情规则</el-menu-item>
          <el-menu-item index="/design/creative_materials">💡 创意素材</el-menu-item>
          <el-menu-item index="/design/book_analyses">📖 智能拆书</el-menu-item>
          <el-menu-item index="/design/outlines">🧭 全书大纲</el-menu-item>
          <el-menu-item index="/design/volume_designs">📚 卷设计</el-menu-item>
          <el-menu-item index="/design/chapter_plans">📝 章节规划</el-menu-item>
          <el-menu-item index="/design/chapter_blueprints">🎬 章节蓝图</el-menu-item>
        </el-sub-menu>
        <el-sub-menu index="generate">
          <template #title>
            <el-icon><Notebook /></el-icon>
            <span>生成模块</span>
          </template>
          <el-menu-item index="/generate">🏗️ 生成工作台</el-menu-item>
          <el-menu-item index="/generate/outlines">🧭 大纲</el-menu-item>
          <el-menu-item index="/generate/volume_designs">📚 分卷</el-menu-item>
          <el-menu-item index="/generate/chapter_plans">📝 章节规划</el-menu-item>
          <el-menu-item index="/generate/chapter_blueprints">🎬 章节蓝图</el-menu-item>
          <el-menu-item index="/generate/chapters">✍️ 章节生成</el-menu-item>
          <el-menu-item index="/generate/gate">🚦 生成门禁</el-menu-item>
        </el-sub-menu>
        <el-menu-item index="/editor">
          <el-icon><Document /></el-icon>
          <span>章节编辑器</span>
        </el-menu-item>
        <el-menu-item index="/validate">
          <el-icon><CircleCheck /></el-icon>
          <span>校验工作台</span>
        </el-menu-item>
        <el-menu-item index="/ai-assistant">
          <el-icon><ChatDotRound /></el-icon>
          <span>AI 助手</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header height="52px" class="layout-header">
        <div class="header-title">{{ ($route.meta.title as string) || '天命 Web' }}</div>
        <div class="header-right">
          <div class="work-context">
            <span class="context-label">Project</span>
            <el-select
              v-model="workContext.selectedProjectId"
              :loading="workContext.loadingProjects"
              placeholder="未选择"
              size="small"
              filterable
              style="width: 190px"
            >
              <el-option
                v-for="p in workContext.projects"
                :key="p.id"
                :label="p.name"
                :value="p.id"
              />
            </el-select>
            <el-button text size="small" :icon="Plus" @click="openProjectDialog" />

            <span class="context-label">Volume</span>
            <el-select
              v-model="workContext.selectedVolumeId"
              :disabled="!workContext.selectedProjectId"
              :loading="workContext.loadingVolumes"
              placeholder="未选择"
              size="small"
              filterable
              clearable
              style="width: 170px"
            >
              <el-option
                v-for="v in workContext.volumes"
                :key="v.id"
                :label="`第 ${v.volumeNumber} 卷 · ${v.title}`"
                :value="v.id"
              />
            </el-select>
            <el-button text size="small" :icon="Plus" @click="openVolumeDialog" />
          </div>

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

  <el-dialog v-model="projectDialogVisible" title="新建项目" width="420px">
    <el-form :model="projectForm" label-width="80px">
      <el-form-item label="名称" required>
        <el-input v-model="projectForm.name" @keyup.enter="submitProject" />
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="projectForm.description" type="textarea" :rows="3" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="projectDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="creatingProject" @click="submitProject">创建</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="volumeDialogVisible" title="新建分卷" width="420px">
    <el-form :model="volumeForm" label-width="80px">
      <el-form-item label="卷序号" required>
        <el-input-number v-model="volumeForm.volumeNumber" :min="1" controls-position="right" />
      </el-form-item>
      <el-form-item label="标题" required>
        <el-input v-model="volumeForm.title" @keyup.enter="submitVolume" />
      </el-form-item>
      <el-form-item label="主题">
        <el-input v-model="volumeForm.theme" type="textarea" :rows="3" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="volumeDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="creatingVolume" @click="submitVolume">创建</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.layout {
  height: 100vh;
}
.layout-aside {
  background: var(--tm-bg-elevated);
  border-right: 1px solid var(--tm-border);
  padding-top: 12px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 18px 14px;
}
.brand-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--tm-primary);
}
.brand-text {
  font-size: 15px;
  font-weight: 600;
  color: var(--tm-fg-primary);
  flex: 1;
}
.layout-menu {
  border-right: none;
}
.layout-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: var(--tm-bg-elevated);
  border-bottom: 1px solid var(--tm-border);
}
.header-title {
  font-size: 14px;
  color: var(--tm-fg-primary);
  font-weight: 500;
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
.layout-main {
  background: var(--tm-bg);
  padding: 20px;
  overflow: auto;
}
.mr-4 {
  margin-right: 4px;
}
</style>
