<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { DocumentChecked, Position, Refresh, Search } from '@element-plus/icons-vue'
import { useI18n } from '@/composables/useI18n'
import { useWorkContextStore } from '@/stores/workContext'
import {
  getEditorIndexStatus,
  getEditorChapterAssist,
  listEditorChapters,
  rebuildEditorIndex,
  saveEditorChapterContent,
  searchVectorRecall,
  type EditorIndexStatus,
  type VectorRecallResult
} from '@/api/modules/editor'
import type { Chapter } from '@/api/modules/chapters'

const workContext = useWorkContextStore()
const { t } = useI18n()

const chapters = ref<Chapter[]>([])
const selectedChapterId = ref('')
const selectedChapter = ref<Chapter | null>(null)
const editorContent = ref('')
const baselineContent = ref('')
const loadingChapters = ref(false)
const loadingChapter = ref(false)
const saving = ref(false)
const searchText = ref('')
const replaceText = ref('')
const currentSearchIndex = ref(-1)
const recallQuery = ref('')
const recallResults = ref<VectorRecallResult[]>([])
const searchingRecall = ref(false)
const loadingAssist = ref(false)
const indexStatus = ref<EditorIndexStatus | null>(null)
const loadingIndexStatus = ref(false)
const rebuildingIndex = ref(false)
const editorInputRef = ref<{ textarea?: HTMLTextAreaElement } | null>(null)

const canUseWorkspace = computed(() => !!workContext.selectedProjectId)
const hasUnsavedChanges = computed(() => editorContent.value !== baselineContent.value)
const currentWordCount = computed(() => editorContent.value.trim().length)
const currentTitle = computed(() => {
  if (!selectedChapter.value) return t('editorWorkspace.labels.noProjectSelected')
  return t('editorWorkspace.labels.chapterTitle', {
    number: selectedChapter.value.chapterNumber,
    title: selectedChapter.value.title
  })
})
const indexStatusType = computed(() => {
  const status = indexStatus.value?.status
  if (status === 'ready') return 'success'
  if (status === 'stale') return 'warning'
  if (status === 'failed') return 'danger'
  return 'info'
})
const searchMatches = computed(() => {
  if (!searchText.value) return []
  const source = editorContent.value.toLowerCase()
  const target = searchText.value.toLowerCase()
  const matches: Array<{ start: number; end: number }> = []
  let index = source.indexOf(target)
  while (index !== -1) {
    matches.push({ start: index, end: index + target.length })
    index = source.indexOf(target, index + target.length)
  }
  return matches
})
const activeMatchLabel = computed(() => {
  if (!searchText.value) return t('editorWorkspace.labels.noQuery')
  if (searchMatches.value.length === 0) return '0 / 0'
  return `${currentSearchIndex.value + 1} / ${searchMatches.value.length}`
})

function formatTime(value?: string | null) {
  return value ? new Date(value).toLocaleString() : '-'
}

function statusType(status?: string | null) {
  if (status === 'validated') return 'success'
  if (status === 'needs_fix') return 'danger'
  if (status === 'drafted') return 'warning'
  if (status === 'planned') return 'info'
  return 'info'
}

function statusLabel(status?: string | null) {
  if (!status) return t('editorWorkspace.labels.unknown')
  const key = `editorWorkspace.labels.status.${status}`
  const label = t(key)
  return label === key ? status : label
}

function getEditorTextarea() {
  return editorInputRef.value?.textarea ?? null
}

async function focusEditorRange(start: number, end = start) {
  await nextTick()
  const textarea = getEditorTextarea()
  if (!textarea) return
  textarea.focus()
  textarea.setSelectionRange(start, end)
}

function normalizeSearchIndex(index: number) {
  const total = searchMatches.value.length
  if (total === 0) return -1
  return (index + total) % total
}

async function goToSearchMatch(index: number) {
  currentSearchIndex.value = normalizeSearchIndex(index)
  const match = searchMatches.value[currentSearchIndex.value]
  if (!match) return
  await focusEditorRange(match.start, match.end)
}

async function findNextMatch(step = 1) {
  if (!searchText.value) {
    ElMessage.warning(t('editorWorkspace.messages.enterSearchText'))
    return
  }
  if (searchMatches.value.length === 0) {
    ElMessage.info(t('editorWorkspace.messages.noMatchesFound'))
    return
  }
  await goToSearchMatch(currentSearchIndex.value + step)
}

async function replaceCurrentMatch() {
  const match = searchMatches.value[currentSearchIndex.value]
  if (!match) {
    await findNextMatch()
    return
  }
  editorContent.value =
    editorContent.value.slice(0, match.start) + replaceText.value + editorContent.value.slice(match.end)
  await nextTick()
  await goToSearchMatch(currentSearchIndex.value)
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function replaceAllMatches() {
  if (!searchText.value) {
    ElMessage.warning(t('editorWorkspace.messages.enterSearchText'))
    return
  }
  const total = searchMatches.value.length
  if (total === 0) {
    ElMessage.info(t('editorWorkspace.messages.noMatchesToReplace'))
    return
  }
  editorContent.value = editorContent.value.replace(
    new RegExp(escapeRegExp(searchText.value), 'gi'),
    replaceText.value
  )
  currentSearchIndex.value = -1
  ElMessage.success(t('editorWorkspace.messages.replacedMatches', { count: total }))
}

async function insertTextAtCursor(text: string) {
  const textarea = getEditorTextarea()
  const start = textarea?.selectionStart ?? editorContent.value.length
  const end = textarea?.selectionEnd ?? editorContent.value.length
  editorContent.value = `${editorContent.value.slice(0, start)}${text}${editorContent.value.slice(end)}`
  await focusEditorRange(start + text.length)
}

async function insertRecallResult(item: VectorRecallResult) {
  await insertTextAtCursor(`\n> ${item.source} / ${item.title}\n${item.excerpt}\n`)
  ElMessage.success(t('editorWorkspace.messages.recallSnippetInserted'))
}

async function refreshIndexStatus(silent = false) {
  if (!workContext.selectedProjectId) {
    indexStatus.value = null
    return
  }
  loadingIndexStatus.value = true
  try {
    indexStatus.value = await getEditorIndexStatus(workContext.selectedProjectId)
  } catch (err) {
    indexStatus.value = null
    if (!silent) ElMessage.error((err as Error).message || t('editorWorkspace.messages.loadIndexStatusFailed'))
  } finally {
    loadingIndexStatus.value = false
  }
}

async function rebuildIndex() {
  if (!workContext.selectedProjectId) {
    ElMessage.warning(t('editorWorkspace.messages.selectProjectFirst'))
    return
  }
  rebuildingIndex.value = true
  try {
    indexStatus.value = await rebuildEditorIndex(workContext.selectedProjectId)
    ElMessage.success(t('editorWorkspace.messages.indexRebuilt'))
  } catch (err) {
    ElMessage.error((err as Error).message || t('editorWorkspace.messages.rebuildIndexFailed'))
  } finally {
    rebuildingIndex.value = false
  }
}

async function refreshChapters() {
  if (!canUseWorkspace.value) {
    chapters.value = []
    selectedChapterId.value = ''
    selectedChapter.value = null
    editorContent.value = ''
    baselineContent.value = ''
    return
  }

  loadingChapters.value = true
  try {
    chapters.value = await listEditorChapters(workContext.selectedProjectId, workContext.selectedVolumeId || null)
    if (!chapters.value.some((chapter) => chapter.id === selectedChapterId.value)) {
      selectedChapterId.value = chapters.value[0]?.id ?? ''
    }
    await loadSelectedChapter()
  } catch (err) {
    ElMessage.error((err as Error).message || t('editorWorkspace.messages.loadChaptersFailed'))
  } finally {
    loadingChapters.value = false
  }
}

async function loadSelectedChapter() {
  if (!selectedChapterId.value) {
    selectedChapter.value = null
    editorContent.value = ''
    baselineContent.value = ''
    recallResults.value = []
    return
  }

  loadingChapter.value = true
  loadingAssist.value = true
  try {
    const assist = await getEditorChapterAssist(selectedChapterId.value)
    selectedChapter.value = assist.chapter
    editorContent.value = assist.chapter.content ?? ''
    baselineContent.value = assist.chapter.content ?? ''
    recallResults.value = assist.related
  } catch (err) {
    ElMessage.error((err as Error).message || t('editorWorkspace.messages.loadChapterDetailsFailed'))
  } finally {
    loadingChapter.value = false
    loadingAssist.value = false
  }
}

async function saveContent() {
  if (!selectedChapter.value) {
    ElMessage.warning(t('editorWorkspace.messages.selectChapterFirst'))
    return
  }

  saving.value = true
  try {
    const chapter = await saveEditorChapterContent(selectedChapter.value.id, editorContent.value, 'drafted')
    selectedChapter.value = chapter
    baselineContent.value = chapter.content ?? ''
    editorContent.value = chapter.content ?? ''
    chapters.value = chapters.value.map((item) => (item.id === chapter.id ? chapter : item))
    await refreshIndexStatus(true)
    ElMessage.success(t('editorWorkspace.messages.contentSaved'))
  } catch (err) {
    ElMessage.error((err as Error).message || t('editorWorkspace.messages.saveContentFailed'))
  } finally {
    saving.value = false
  }
}

async function runVectorRecall() {
  if (!workContext.selectedProjectId) {
    ElMessage.warning(t('editorWorkspace.messages.selectProjectFirst'))
    return
  }
  if (!recallQuery.value.trim()) {
    ElMessage.warning(t('editorWorkspace.messages.enterRecallKeywords'))
    return
  }

  searchingRecall.value = true
  try {
    recallResults.value = await searchVectorRecall({
      projectId: workContext.selectedProjectId,
      chapterId: selectedChapter.value?.id,
      query: recallQuery.value.trim(),
      topK: 5
    })
    if (recallResults.value.length === 0) {
      ElMessage.info(t('editorWorkspace.messages.noRelatedContextFound'))
    }
  } catch (err) {
    ElMessage.error((err as Error).message || t('editorWorkspace.messages.vectorRecallFailed'))
  } finally {
    searchingRecall.value = false
  }
}

watch(() => [workContext.selectedProjectId, workContext.selectedVolumeId], refreshChapters)
watch(selectedChapterId, loadSelectedChapter)
watch(() => workContext.selectedProjectId, () => refreshIndexStatus(true))
watch(searchMatches, (matches) => {
  if (matches.length === 0) currentSearchIndex.value = -1
  else if (currentSearchIndex.value >= matches.length) currentSearchIndex.value = matches.length - 1
})

onMounted(async () => {
  await workContext.init()
  await refreshChapters()
  await refreshIndexStatus(true)
})
</script>

<template>
  <div class="editor-page">
    <section class="editor-toolbar">
      <div>
        <p class="eyebrow">{{ t('editorWorkspace.eyebrow') }}</p>
        <h1>{{ t('editorWorkspace.title') }}</h1>
        <p class="subtitle">
          {{ workContext.selectedProject?.name || t('editorWorkspace.labels.noProjectSelected') }}
          <template v-if="workContext.selectedVolume">
            / {{ t('editorWorkspace.labels.volume', { number: workContext.selectedVolume.volumeNumber }) }} / {{ workContext.selectedVolume.title }}
          </template>
        </p>
      </div>
      <div class="toolbar-actions">
        <el-button :icon="Refresh" :loading="loadingChapters" @click="refreshChapters">{{ t('editorWorkspace.labels.refresh') }}</el-button>
        <el-button
          type="primary"
          :icon="DocumentChecked"
          :loading="saving"
          :disabled="!selectedChapter"
          @click="saveContent"
        >
          {{ t('editorWorkspace.labels.save') }}
        </el-button>
      </div>
    </section>

    <div class="editor-grid">
      <el-card shadow="never" class="chapter-panel">
        <template #header>
          <div class="panel-head">
            <span>{{ t('editorWorkspace.labels.chapters') }}</span>
            <el-tag size="small" type="info">{{ chapters.length }}</el-tag>
          </div>
        </template>

        <el-empty v-if="!canUseWorkspace" :description="t('editorWorkspace.empty.selectProjectFirst')" />
        <el-empty v-else-if="chapters.length === 0 && !loadingChapters" :description="t('editorWorkspace.empty.noChapters')" />
        <el-scrollbar v-else class="chapter-scroll" v-loading="loadingChapters">
          <button
            v-for="chapter in chapters"
            :key="chapter.id"
            class="chapter-item"
            :class="{ active: chapter.id === selectedChapterId }"
            type="button"
            @click="selectedChapterId = chapter.id"
          >
            <span class="chapter-title">{{ t('editorWorkspace.labels.chapterTitle', { number: chapter.chapterNumber, title: chapter.title }) }}</span>
            <span class="chapter-meta">
              <el-tag size="small" :type="statusType(chapter.status)" effect="plain">{{ statusLabel(chapter.status) }}</el-tag>
              <span>{{ t('editorWorkspace.labels.chars', { count: chapter.wordCount || 0 }) }}</span>
            </span>
          </button>
        </el-scrollbar>
      </el-card>

      <el-card shadow="never" class="writing-panel" v-loading="loadingChapter">
        <template #header>
          <div class="panel-head">
            <div>
              <span>{{ currentTitle }}</span>
              <small v-if="selectedChapter">{{ t('editorWorkspace.labels.updatedAt', { time: formatTime(selectedChapter.updatedAt) }) }}</small>
            </div>
            <div class="chapter-stats">
              <el-tag v-if="hasUnsavedChanges" size="small" type="warning">{{ t('editorWorkspace.labels.unsaved') }}</el-tag>
              <span>{{ t('editorWorkspace.labels.chars', { count: currentWordCount }) }}</span>
            </div>
          </div>
        </template>

        <el-empty v-if="!selectedChapter" :description="t('editorWorkspace.empty.selectChapterToEdit')" />
        <div v-else class="writer-wrap">
          <div class="search-replace-bar">
            <el-input
              v-model="searchText"
              class="search-input"
              clearable
              :placeholder="t('editorWorkspace.placeholders.searchCurrentChapter')"
              @keyup.enter="findNextMatch(1)"
            />
            <el-input
              v-model="replaceText"
              class="search-input"
              clearable
              :placeholder="t('editorWorkspace.placeholders.replacementText')"
              @keyup.enter="replaceCurrentMatch"
            />
            <span class="search-status">{{ activeMatchLabel }}</span>
            <el-button :disabled="!searchText" @click="findNextMatch(-1)">{{ t('editorWorkspace.actions.prev') }}</el-button>
            <el-button :disabled="!searchText" @click="findNextMatch(1)">{{ t('editorWorkspace.actions.next') }}</el-button>
            <el-button :disabled="!searchText" @click="replaceCurrentMatch">{{ t('editorWorkspace.actions.replace') }}</el-button>
            <el-button type="primary" plain :disabled="!searchText" @click="replaceAllMatches">{{ t('editorWorkspace.actions.replaceAll') }}</el-button>
          </div>

          <el-input
            ref="editorInputRef"
            v-model="editorContent"
            class="markdown-editor"
            type="textarea"
            resize="none"
            :placeholder="t('editorWorkspace.placeholders.editorContent')"
          />
        </div>
      </el-card>

      <aside class="side-stack">
        <el-card shadow="never" class="index-panel">
          <template #header>
            <div class="panel-head">
              <span>{{ t('editorWorkspace.labels.editorIndex') }}</span>
              <el-tag size="small" :type="indexStatusType">{{ statusLabel(indexStatus?.status) }}</el-tag>
            </div>
          </template>

          <div class="index-metrics" v-loading="loadingIndexStatus">
            <div>
              <span>{{ t('editorWorkspace.labels.indexedChapters') }}</span>
              <strong>{{ indexStatus ? `${indexStatus.indexedChapterCount}/${indexStatus.totalChapterCount}` : '-' }}</strong>
            </div>
            <div>
              <span>{{ t('editorWorkspace.labels.keywords') }}</span>
              <strong>{{ indexStatus?.keywordCount ?? '-' }}</strong>
            </div>
            <div>
              <span>{{ t('editorWorkspace.labels.staleChapters') }}</span>
              <strong>{{ indexStatus?.staleChapterCount ?? 0 }}</strong>
            </div>
          </div>
          <p class="index-updated">{{ t('editorWorkspace.labels.lastBuilt', { time: formatTime(indexStatus?.lastBuiltAt) }) }}</p>
          <div class="index-actions">
            <el-button :icon="Refresh" :loading="loadingIndexStatus" @click="refreshIndexStatus()">{{ t('editorWorkspace.labels.refreshStatus') }}</el-button>
            <el-button
              type="primary"
              plain
              :loading="rebuildingIndex"
              :disabled="!workContext.selectedProjectId"
              @click="rebuildIndex"
            >
              {{ t('editorWorkspace.labels.rebuildIndex') }}
            </el-button>
          </div>
        </el-card>

        <el-card shadow="never" class="recall-panel">
          <template #header>
            <div class="panel-head">
              <span>{{ t('editorWorkspace.labels.vectorRecall') }}</span>
              <el-tag size="small" type="success">{{ t('editorWorkspace.labels.context') }}</el-tag>
            </div>
          </template>

          <el-input
            v-model="recallQuery"
            type="textarea"
            :rows="3"
            :placeholder="t('editorWorkspace.placeholders.recallQuery')"
          />
          <el-button
            class="recall-button"
            :icon="Search"
            :loading="searchingRecall"
            :disabled="!workContext.selectedProjectId"
            @click="runVectorRecall"
          >
            {{ t('editorWorkspace.actions.searchRecall') }}
          </el-button>

          <el-empty v-if="recallResults.length === 0" :description="t('editorWorkspace.empty.noRelatedContext')" />
          <div v-else class="recall-results" v-loading="loadingAssist">
            <div v-for="item in recallResults" :key="item.id" class="recall-item">
              <div class="recall-title-row">
                <div>
                  <strong>{{ item.title }}</strong>
                  <span>{{ item.source }} / {{ item.score.toFixed(2) }}</span>
                </div>
                <el-button size="small" :icon="Position" :disabled="!selectedChapter" @click="insertRecallResult(item)">
                  {{ t('editorWorkspace.labels.insert') }}
                </el-button>
              </div>
              <div v-if="item.matchedKeywords?.length" class="recall-keywords">
                <el-tag v-for="keyword in item.matchedKeywords" :key="keyword" size="small" effect="plain">
                  {{ keyword }}
                </el-tag>
              </div>
              <p>{{ item.excerpt }}</p>
            </div>
          </div>
        </el-card>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.editor-page {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.editor-toolbar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}
.eyebrow {
  margin: 0 0 4px;
  color: var(--tm-fg-tertiary);
  font-size: 12px;
  text-transform: uppercase;
}
h1 {
  margin: 0;
  color: var(--tm-fg-primary);
  font-size: 24px;
  line-height: 1.25;
}
.subtitle {
  margin: 6px 0 0;
  color: var(--tm-fg-secondary);
  font-size: 13px;
}
.toolbar-actions,
.panel-head,
.chapter-meta,
.chapter-stats {
  display: flex;
  align-items: center;
  gap: 8px;
}
.toolbar-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}
.panel-head {
  justify-content: space-between;
}
.panel-head small {
  display: block;
  margin-top: 3px;
  color: var(--tm-fg-tertiary);
  font-weight: 400;
}
.editor-grid {
  display: grid;
  grid-template-columns: 280px minmax(460px, 1fr) 340px;
  gap: 12px;
  min-height: calc(100vh - 152px);
}
.chapter-panel,
.writing-panel,
.index-panel,
.recall-panel {
  border: 1px solid var(--tm-border);
}
.chapter-scroll {
  height: calc(100vh - 270px);
}
.chapter-item {
  width: 100%;
  min-height: 70px;
  border: 1px solid var(--tm-border);
  border-radius: 6px;
  background: var(--tm-bg-elevated);
  color: var(--tm-fg-primary);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 9px;
  margin-bottom: 8px;
  padding: 10px;
  text-align: left;
}
.chapter-item:hover,
.chapter-item.active {
  border-color: var(--tm-primary);
}
.chapter-item.active {
  background: color-mix(in srgb, var(--tm-primary) 8%, var(--tm-bg-elevated));
}
.chapter-title {
  font-weight: 600;
  line-height: 1.35;
}
.chapter-meta {
  color: var(--tm-fg-secondary);
  font-size: 12px;
  justify-content: space-between;
}
.writer-wrap {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.search-replace-bar {
  align-items: center;
  display: grid;
  grid-template-columns: minmax(150px, 1fr) minmax(150px, 1fr) auto auto auto auto auto;
  gap: 8px;
}
.search-status {
  color: var(--tm-fg-secondary);
  font-size: 12px;
  min-width: 54px;
  text-align: center;
}
.markdown-editor {
  height: calc(100vh - 318px);
  min-height: 520px;
}
.markdown-editor :deep(.el-textarea__inner) {
  height: 100%;
  min-height: 100%;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  line-height: 1.7;
}
.side-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
.index-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.index-metrics div {
  border: 1px solid var(--tm-border);
  border-radius: 6px;
  padding: 8px;
}
.index-metrics span,
.recall-item span {
  color: var(--tm-fg-tertiary);
  display: block;
  font-size: 12px;
}
.index-metrics strong {
  color: var(--tm-fg-primary);
  display: block;
  font-size: 18px;
  margin-top: 4px;
}
.index-updated {
  color: var(--tm-fg-secondary);
  font-size: 12px;
  margin: 10px 0;
}
.index-actions {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}
.recall-button {
  margin-top: 10px;
  width: 100%;
}
.recall-results {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}
.recall-item {
  border: 1px solid var(--tm-border);
  border-radius: 6px;
  padding: 10px;
}
.recall-item strong {
  color: var(--tm-fg-primary);
}
.recall-title-row {
  align-items: flex-start;
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.recall-keywords {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}
.recall-item p {
  color: var(--tm-fg-secondary);
  font-size: 13px;
  line-height: 1.5;
  margin: 6px 0 0;
}
@media (max-width: 1280px) {
  .editor-grid {
    grid-template-columns: 240px minmax(420px, 1fr);
  }
  .side-stack {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 920px) {
  .editor-toolbar,
  .toolbar-actions {
    align-items: stretch;
    flex-direction: column;
  }
  .editor-grid,
  .side-stack,
  .search-replace-bar {
    grid-template-columns: 1fr;
  }
}
</style>
