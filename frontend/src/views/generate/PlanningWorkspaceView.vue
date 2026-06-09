<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router'
import { ArrowRight } from '@element-plus/icons-vue'

type PlanningModuleKey = 'outlines' | 'volume_designs' | 'chapter_plans' | 'chapter_blueprints'

interface PlanningModule {
  key: PlanningModuleKey
  label: string
  icon: string
  path: string
  title: string
  description: string
  focus: string[]
}

const route = useRoute()
const router = useRouter()

const planningModules: PlanningModule[] = [
  {
    key: 'outlines',
    label: '大纲',
    icon: '纲',
    path: '/generate/outlines',
    title: '整书大纲与主线结构',
    description: '先确认作品的主干冲突、阶段目标、关键转折和长期伏笔，给后续分卷与章节拆解一个稳定骨架。',
    focus: ['主线目标与终局方向', '阶段推进节奏', '关键人物和伏笔落点']
  },
  {
    key: 'volume_designs',
    label: '卷设计',
    icon: '卷',
    path: '/generate/volume_designs',
    title: '分卷目标与阶段边界',
    description: '把整书大纲拆成可执行的卷级任务，明确每卷主题、起止状态、高潮节点和与章节计划的衔接。',
    focus: ['分卷主题和目标', '卷内冲突曲线', '卷尾状态变化']
  },
  {
    key: 'chapter_plans',
    label: '章节计划',
    icon: '章',
    path: '/generate/chapter_plans',
    title: '章节标题、简介与事件安排',
    description: '在章节粒度锁定标题、简介、核心事件、出场实体和推进职责，减少正文生成时的漂移。',
    focus: ['章节标题和简介', '核心事件与冲突值', '角色地点等实体准入']
  },
  {
    key: 'chapter_blueprints',
    label: '章节蓝图',
    icon: '图',
    path: '/generate/chapter_blueprints',
    title: '场景卡与正文生成蓝图',
    description: '把章节计划进一步拆成场景顺序、POV、信息增量、钩子和伏笔职责，作为正文生成的直接依据。',
    focus: ['场景顺序和 POV', '信息增量与钩子', '伏笔埋设和回收职责']
  }
]

const moduleKeys = new Set<PlanningModuleKey>(planningModules.map((item) => item.key))

function normalizeModule(value: unknown): PlanningModuleKey {
  const raw = Array.isArray(value) ? value[0] : value
  return typeof raw === 'string' && moduleKeys.has(raw as PlanningModuleKey) ? (raw as PlanningModuleKey) : 'outlines'
}

const activeModule = ref<PlanningModuleKey>(normalizeModule(route.query.module))

const activeModuleMeta = computed(
  () => planningModules.find((item) => item.key === activeModule.value) ?? planningModules[0]
)

watch(
  () => route.query.module,
  (module) => {
    const nextModule = normalizeModule(module)
    if (nextModule !== activeModule.value) activeModule.value = nextModule
  }
)

watch(activeModule, (module) => {
  if (normalizeModule(route.query.module) === module) return

  const query: LocationQueryRaw = { ...route.query, module }
  void router.replace({ query })
})
</script>

<template>
  <div class="planning-workspace">
    <section class="planning-hero">
      <div>
        <p class="eyebrow">Planning Workspace</p>
        <h1>规划聚合页</h1>
        <p class="subtitle">
          在这里集中查看大纲、卷设计、章节计划、章节蓝图四个规划入口。当前选中的是
          <strong>{{ activeModuleMeta.label }}</strong>
          ，进入模块后继续使用原有设计工作台维护数据。
        </p>
      </div>

      <div class="current-module">
        <span class="module-mark">{{ activeModuleMeta.icon }}</span>
        <div>
          <span>当前说明</span>
          <strong>{{ activeModuleMeta.title }}</strong>
        </div>
      </div>
    </section>

    <el-tabs v-model="activeModule" type="border-card" class="planning-tabs">
      <el-tab-pane v-for="module in planningModules" :key="module.key" :name="module.key">
        <template #label>
          <span class="tab-label">
            <span>{{ module.icon }}</span>
            {{ module.label }}
          </span>
        </template>

        <div class="module-panel">
          <div class="module-copy">
            <span class="module-icon">{{ module.icon }}</span>
            <div>
              <h2>{{ module.title }}</h2>
              <p>{{ module.description }}</p>
            </div>
          </div>

          <div class="focus-list">
            <div v-for="item in module.focus" :key="item" class="focus-item">
              <span></span>
              {{ item }}
            </div>
          </div>

          <router-link :to="module.path" class="module-entry">
            进入{{ module.label }}
            <el-icon><ArrowRight /></el-icon>
          </router-link>
        </div>
      </el-tab-pane>
    </el-tabs>

    <section class="quick-grid" aria-label="规划模块快捷入口">
      <router-link
        v-for="module in planningModules"
        :key="module.key"
        :to="module.path"
        class="quick-card"
        :class="{ active: activeModule === module.key }"
      >
        <span class="quick-icon">{{ module.icon }}</span>
        <strong>{{ module.label }}</strong>
        <small>{{ module.title }}</small>
      </router-link>
    </section>
  </div>
</template>

<style scoped>
.planning-workspace {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.planning-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 18px;
  padding: 28px;
  border: 1px solid #dfe8e5;
  border-radius: 18px;
  background:
    radial-gradient(circle at 16% 18%, rgba(62, 133, 124, 0.16), transparent 34%),
    linear-gradient(135deg, #fffaf0 0%, #eef5ee 52%, #e1efed 100%);
}

.eyebrow {
  margin: 0 0 8px;
  color: #3f6f69;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  color: #1f332f;
  font-size: 32px;
  line-height: 1.25;
}

.subtitle {
  max-width: 760px;
  margin: 12px 0 0;
  color: #53615d;
  line-height: 1.8;
}

.subtitle strong {
  color: #2f7d7a;
}

.current-module {
  display: flex;
  align-items: center;
  gap: 14px;
  align-self: center;
  min-width: 0;
  padding: 18px;
  border: 1px solid rgba(63, 111, 105, 0.18);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.74);
}

.module-mark,
.module-icon,
.quick-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  color: #fff;
  font-weight: 800;
  background: #2f7d7a;
}

.module-mark {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  font-size: 20px;
}

.current-module span:not(.module-mark) {
  display: block;
  color: #7d8985;
  font-size: 13px;
}

.current-module strong {
  display: block;
  margin-top: 4px;
  color: #1f332f;
  line-height: 1.4;
}

.planning-tabs {
  border-radius: 14px;
  overflow: hidden;
}

.tab-label {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.tab-label span {
  color: #2f7d7a;
  font-weight: 800;
}

.module-panel {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(220px, 0.7fr) auto;
  align-items: center;
  gap: 22px;
  min-height: 190px;
  padding: 10px 2px 2px;
}

.module-copy {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.module-icon {
  width: 54px;
  height: 54px;
  border-radius: 14px;
  font-size: 23px;
}

h2 {
  margin: 0;
  color: #1f332f;
  font-size: 22px;
  line-height: 1.35;
}

.module-copy p {
  margin: 10px 0 0;
  color: #5d6965;
  line-height: 1.8;
}

.focus-list {
  display: grid;
  gap: 10px;
}

.focus-item {
  display: flex;
  align-items: center;
  gap: 9px;
  color: #3d4d49;
  font-size: 14px;
}

.focus-item span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #e3a84f;
}

.module-entry {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 132px;
  min-height: 40px;
  padding: 0 16px;
  border-radius: 8px;
  color: #fff;
  font-weight: 700;
  text-decoration: none;
  background: #2f7d7a;
}

.module-entry:hover {
  background: #256866;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.quick-card {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 4px 12px;
  align-items: center;
  padding: 16px;
  border: 1px solid #dfe8e5;
  border-radius: 12px;
  color: inherit;
  text-decoration: none;
  background: #fffef8;
}

.quick-card.active {
  border-color: rgba(47, 125, 122, 0.5);
  box-shadow: 0 10px 28px rgba(47, 125, 122, 0.1);
}

.quick-icon {
  grid-row: span 2;
  width: 42px;
  height: 42px;
  border-radius: 10px;
}

.quick-card strong {
  color: #1f332f;
  font-size: 16px;
}

.quick-card small {
  min-width: 0;
  color: #6b7773;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 960px) {
  .planning-hero,
  .module-panel {
    grid-template-columns: 1fr;
  }

  .current-module {
    align-self: stretch;
  }

  .quick-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .planning-hero {
    padding: 20px;
  }

  h1 {
    font-size: 26px;
  }

  .quick-grid {
    grid-template-columns: 1fr;
  }
}
</style>
