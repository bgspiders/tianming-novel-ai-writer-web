<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useThemeStore } from '@/stores/theme'
import {
  Sunny,
  Moon,
  Monitor,
  Promotion,
  Cpu,
  Setting,
  MagicStick,
  Edit,
  Document
} from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const themeStore = useThemeStore()

const activeMenu = computed(() => route.path)

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
</script>

<template>
  <el-container class="layout">
    <el-aside width="236px" class="layout-aside">
      <div class="brand">
        <span class="brand-dot"></span>
        <div class="brand-copy">
          <span class="brand-text">TM Web</span>
          <span class="brand-sub">Stage 9 Theme System</span>
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
      </el-menu>
    </el-aside>

    <el-container>
      <el-header height="60px" class="layout-header">
        <div>
          <div class="header-title">{{ ($route.meta.title as string) || 'TM Web' }}</div>
          <div class="header-sub">
            {{ themeStore.effectiveTheme.label }} / {{ themeStore.currentSource }}
          </div>
        </div>
        <div class="header-right">
          <el-button class="theme-trigger" @click="router.push('/settings/themes')">
            <span class="theme-pill" :style="{ background: themeStore.effectiveTheme.hero }"></span>
            <span>Open Theme Studio</span>
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
  gap: 10px;
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
</style>
