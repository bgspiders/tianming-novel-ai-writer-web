<script setup lang="ts">
import { computed } from 'vue'
import { useWorkContextStore } from '@/stores/workContext'

const workContext = useWorkContextStore()

const cards = computed(() => [
  {
    title: 'Outlines',
    path: '/generate/outlines',
    icon: 'O',
    desc: 'Define story scope, themes, and the top-level structure.',
    ready: true
  },
  {
    title: 'Volumes',
    path: '/generate/volume_designs',
    icon: 'V',
    desc: 'Organize volume goals, pacing, and chapter allocation.',
    ready: true
  },
  {
    title: 'Chapter Plans',
    path: '/generate/chapter_plans',
    icon: 'P',
    desc: 'Draft target outcomes, conflict beats, and delivery points.',
    ready: true
  },
  {
    title: 'Blueprints',
    path: '/generate/chapter_blueprints',
    icon: 'B',
    desc: 'Prepare scene order, POV, and required details per chapter.',
    ready: true
  },
  {
    title: 'Draft Chapters',
    path: '/generate/chapters',
    icon: 'C',
    desc: 'Stream chapter drafts and persist the result to the server.',
    ready: true
  },
  {
    title: 'Generation Gate',
    path: '/generate/gate',
    icon: 'G',
    desc: 'Review generation records, retries, and gate outcomes.',
    ready: true
  }
])
</script>

<template>
  <div class="generation-workbench">
    <section class="hero">
      <div>
        <p class="eyebrow">Stage 4 / Generate</p>
        <h1>Generation Workbench</h1>
        <p class="subtitle">
          Move from outlines to chapter drafts, then inspect generation records and gate results
          within the current project and volume context.
        </p>
      </div>
      <el-card shadow="never" class="context-card">
        <div class="context-row">
          <span>Project</span>
          <strong>{{ workContext.selectedProject?.name ?? 'Not selected' }}</strong>
        </div>
        <div class="context-row">
          <span>Volume</span>
          <strong>
            {{
              workContext.selectedVolume
                ? `Volume ${workContext.selectedVolume.volumeNumber} / ${workContext.selectedVolume.title}`
                : 'Not selected'
            }}
          </strong>
        </div>
      </el-card>
    </section>

    <div class="card-grid">
      <router-link v-for="card in cards" :key="card.path" :to="card.path" class="module-card">
        <span class="card-icon">{{ card.icon }}</span>
        <span class="card-title">{{ card.title }}</span>
        <span class="card-desc">{{ card.desc }}</span>
        <el-tag size="small" :type="card.ready ? 'success' : 'warning'">
          {{ card.ready ? 'Ready' : 'Pending' }}
        </el-tag>
      </router-link>
    </div>
  </div>
</template>

<style scoped>
.generation-workbench {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 16px;
  padding: 28px;
  border-radius: 22px;
  background:
    radial-gradient(circle at 12% 20%, rgba(47, 125, 122, 0.18), transparent 34%),
    linear-gradient(135deg, #f7f0df 0%, #e6f0e6 48%, #d7e7e5 100%);
}
.eyebrow {
  margin: 0 0 8px;
  color: #3f6f69;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
h1 {
  margin: 0;
  font-size: 34px;
  color: #1f332f;
}
.subtitle {
  max-width: 720px;
  color: #53615d;
  line-height: 1.8;
}
.context-card {
  align-self: center;
  border: 0;
  background: rgba(255, 255, 255, 0.72);
}
.context-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin: 8px 0;
}
.context-row span {
  color: #7d8985;
}
.card-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}
.module-card {
  min-height: 150px;
  padding: 20px;
  border: 1px solid #dfe8e5;
  border-radius: 18px;
  color: inherit;
  text-decoration: none;
  background: #fffdf8;
  display: flex;
  flex-direction: column;
  gap: 9px;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}
.module-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 14px 30px rgba(55, 75, 68, 0.12);
}
.card-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: #e0ece8;
  color: #24453f;
  font-weight: 800;
}
.card-title {
  font-size: 18px;
  font-weight: 700;
}
.card-desc {
  color: #6b7773;
  line-height: 1.6;
  flex: 1;
}
@media (max-width: 1080px) {
  .hero,
  .card-grid {
    grid-template-columns: 1fr;
  }
}
</style>
