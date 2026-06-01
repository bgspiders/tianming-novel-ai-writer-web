<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useI18n } from '@/composables/useI18n'
import { packageGenerationContext, type PackageContextResult } from '@/api/modules/generation'
import { useWorkContextStore } from '@/stores/workContext'

const workContext = useWorkContextStore()
const { t } = useI18n()
const packaging = ref(false)
const packageResult = ref<PackageContextResult | null>(null)

const cards = computed(() => [
  {
    title: t('generationWorkbench.cards.outlines.title'),
    path: '/generate/outlines',
    icon: 'O',
    desc: t('generationWorkbench.cards.outlines.desc'),
    ready: true
  },
  {
    title: t('generationWorkbench.cards.volumes.title'),
    path: '/generate/volume_designs',
    icon: 'V',
    desc: t('generationWorkbench.cards.volumes.desc'),
    ready: true
  },
  {
    title: t('generationWorkbench.cards.chapterPlans.title'),
    path: '/generate/chapter_plans',
    icon: 'P',
    desc: t('generationWorkbench.cards.chapterPlans.desc'),
    ready: true
  },
  {
    title: t('generationWorkbench.cards.blueprints.title'),
    path: '/generate/chapter_blueprints',
    icon: 'B',
    desc: t('generationWorkbench.cards.blueprints.desc'),
    ready: true
  },
  {
    title: t('generationWorkbench.cards.package.title'),
    path: '/generate',
    icon: '包',
    desc: t('generationWorkbench.cards.package.desc'),
    ready: true
  },
  {
    title: t('generationWorkbench.cards.preview.title'),
    path: '/generate/chapters',
    icon: '阅',
    desc: t('generationWorkbench.cards.preview.desc'),
    ready: true
  },
  {
    title: t('generationWorkbench.cards.draftChapters.title'),
    path: '/generate/chapters',
    icon: '写',
    desc: t('generationWorkbench.cards.draftChapters.desc'),
    ready: true
  },
  {
    title: t('generationWorkbench.cards.gate.title'),
    path: '/generate/gate',
    icon: 'G',
    desc: t('generationWorkbench.cards.gate.desc'),
    ready: true
  }
])

async function runPackaging() {
  if (!workContext.selectedProjectId) {
    ElMessage.warning(t('generationWorkbench.messages.selectProjectFirst'))
    return
  }

  packaging.value = true
  try {
    packageResult.value = await packageGenerationContext(
      workContext.selectedProjectId,
      workContext.selectedProject?.currentSourceBookId ?? null
    )
    ElMessage.success(
      t('generationWorkbench.messages.packageSuccess', {
        version: packageResult.value.version,
        files: packageResult.value.fileCount
      })
    )
  } catch (err) {
    ElMessage.error((err as Error).message || t('generationWorkbench.messages.packageFailed'))
  } finally {
    packaging.value = false
  }
}
</script>

<template>
  <div class="generation-workbench">
    <section class="hero">
      <div>
        <p class="eyebrow">{{ t('generationWorkbench.eyebrow') }}</p>
        <h1>{{ t('generationWorkbench.title') }}</h1>
        <p class="subtitle">{{ t('generationWorkbench.subtitle') }}</p>
      </div>
      <el-card shadow="never" class="context-card">
        <div class="context-row">
          <span>{{ t('generationWorkbench.context.project') }}</span>
          <strong>{{ workContext.selectedProject?.name ?? t('generationWorkbench.context.notSelected') }}</strong>
        </div>
        <div class="context-row">
          <span>{{ t('generationWorkbench.context.volume') }}</span>
          <strong>
            {{
              workContext.selectedVolume
                ? t('generationWorkbench.context.volumeLabel', {
                    number: workContext.selectedVolume.volumeNumber,
                    title: workContext.selectedVolume.title
                  })
                : t('generationWorkbench.context.notSelected')
            }}
          </strong>
        </div>
      </el-card>
    </section>

    <div class="card-grid">
      <component
        :is="card.ready && card.path ? 'router-link' : 'div'"
        v-for="card in cards"
        :key="card.title"
        :to="card.ready && card.path ? card.path : undefined"
        class="module-card"
        :class="{ disabled: !card.ready }"
      >
        <span class="card-icon">{{ card.icon }}</span>
        <span class="card-title">{{ card.title }}</span>
        <span class="card-desc">{{ card.desc }}</span>
        <el-tag size="small" :type="card.ready ? 'success' : 'warning'">
          {{ card.ready ? t('generationWorkbench.cardStatus.ready') : t('generationWorkbench.cardStatus.pending') }}
        </el-tag>
      </component>
    </div>

    <el-card shadow="never" class="package-panel">
      <div class="package-head">
        <div>
          <div class="package-title">{{ t('generationWorkbench.cards.package.title') }}</div>
          <div class="package-desc">{{ t('generationWorkbench.cards.package.desc') }}</div>
        </div>
        <el-button type="primary" :loading="packaging" @click="runPackaging">
          {{ t('generationWorkbench.actions.packageNow') }}
        </el-button>
      </div>

      <el-empty v-if="!packageResult" :description="t('generationWorkbench.empty.package')" :image-size="72" />
      <div v-else class="package-meta">
        <div>{{ t('generationWorkbench.labels.packageVersion', { value: packageResult.version }) }}</div>
        <div>{{ t('generationWorkbench.labels.packageFiles', { value: packageResult.fileCount }) }}</div>
        <div>{{ t('generationWorkbench.labels.packageModules', { value: packageResult.enabledModuleCount }) }}</div>
        <div>{{ t('generationWorkbench.labels.packageTime', { value: new Date(packageResult.publishedAt).toLocaleString() }) }}</div>
      </div>
    </el-card>
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
.package-panel {
  border-radius: 18px;
  background: #fffef8;
}
.package-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}
.package-title {
  font-size: 18px;
  font-weight: 700;
  color: #1f332f;
}
.package-desc {
  color: #6b7773;
  line-height: 1.6;
  margin-top: 6px;
}
.package-meta {
  display: grid;
  gap: 8px;
  color: #3d4c49;
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
.module-card.disabled {
  cursor: not-allowed;
  opacity: 0.72;
}
.module-card.disabled:hover {
  transform: none;
  box-shadow: none;
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

  .package-head {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
