<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useThemeStore } from '@/stores/theme'
import { Sunny, Moon, Monitor, Promotion, Cpu, Setting, MagicStick, Edit } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const themeStore = useThemeStore()

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
      </el-menu>
    </el-aside>

    <el-container>
      <el-header height="52px" class="layout-header">
        <div class="header-title">{{ ($route.meta.title as string) || '天命 Web' }}</div>
        <div class="header-right">
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
.layout-main {
  background: var(--tm-bg);
  padding: 20px;
  overflow: auto;
}
.mr-4 {
  margin-right: 4px;
}
</style>
