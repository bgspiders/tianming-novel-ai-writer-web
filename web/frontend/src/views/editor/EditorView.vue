<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { DocumentChecked, Position, Refresh, Search } from '@element-plus/icons-vue'
import { useWorkContextStore } from '@/stores/workContext'
import {
  getEditorIndexStatus,
  getEditorChapterAssist,
  listEditorChapters,
  rebuildEditorIndex,
  saveEditorChapterContent,
  searchVectorRecall,
  type EditorIndexStatus,
  type EditorChapterVersion,
  type VectorRecallResult
} from '@/api/modules/editor'
import type { Chapter } from '@/api/modules/chapters'

const workContext = useWorkContextStore()

const chapters = ref<Chapter[]>([])
const selectedChapterId = ref('')
const selectedChapter = ref<Chapter | null>(null)
const editorContent = ref('')
const baselineContent = ref('')
const baselineSavedAt = ref('')
const loadingChapters = ref(false)
const loadingChapter = ref(false)
const saving = ref(false)
const previewMode = ref<'edit' | 'preview' | 'split'>('split')
const editorInputRef = ref<{ textarea?: HTMLTextAreaElement } | null>(null)
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

const canUseWorkspace = computed(() => !!workContext.selectedProjectId)
const currentWordCount = computed(() => editorContent.value.trim().length)
const hasUnsavedChanges = computed(() => editorContent.value !== baselineContent.value)
const currentTitle = computed(() => {
  if (!selectedChapter.value) return '未选择章节'
  return `第 ${selectedChapter.value.chapterNumber} 章 · ${selectedChapter.value.title}`
})

const versionSnapshots = computed<EditorChapterVersion[]>(() => {
  const currentTime = selectedChapter.value?.updatedAt || new Date().toISOString()
  return [
    {
      id: 'baseline',
      label: '加载时版本',
      content: baselineContent.value,
      savedAt: baselineSavedAt.value
    },
    {
      id: 'current',
      label: hasUnsavedChanges.value ? '当前编辑（未保存）' : '当前编辑',
      content: editorContent.value,
      savedAt: currentTime
    }
  ]
})

const diffStats = computed(() => {
  const before = baselineContent.value
  const after = editorContent.value
  return {
    beforeChars: before.length,
    afterChars: after.length,
    deltaChars: after.length - before.length,
    beforeLines: before ? before.split('\n').length : 0,
    afterLines: after ? after.split('\n').length : 0
  }
})

const markdownHtml = computed(() => renderMarkdown(editorContent.value))
const searchMatches = computed(() => {
  const needle = searchText.value
  if (!needle) return []

  const matches: Array<{ start: number; end: number }> = []
  const lowerContent = editorContent.value.toLocaleLowerCase()
  const lowerNeedle = needle.toLocaleLowerCase()
  let start = 0
  let index = lowerContent.indexOf(lowerNeedle, start)

  while (index !== -1) {
    matches.push({ start: index, end: index + needle.length })
    start = index + needle.length
    index = lowerContent.indexOf(lowerNeedle, start)
  }

  return matches
})
const activeMatchLabel = computed(() => {
  if (!searchText.value) return '未输入'
  if (searchMatches.value.length === 0) return '0 / 0'
  return `${currentSearchIndex.value + 1} / ${searchMatches.value.length}`
})
const indexProgressLabel = computed(() => {
  if (!indexStatus.value) return '未加载'
  return `${indexStatus.value.indexedChapterCount}/${indexStatus.value.totalChapterCount} 章`
})
const indexStatusType = computed(() => {
  const status = indexStatus.value?.status
  if (status === 'ready') return 'success'
  if (status === 'stale') return 'warning'
  if (status === 'failed') return 'danger'
  if (status === 'building') return 'info'
  return 'info'
})

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderInlineMarkdown(value: string) {
  return escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

function renderMarkdown(value: string) {
  const lines = value.split('\n')
  const html: string[] = []
  let listOpen = false

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    const heading = line.match(/^(#{1,6})\s+(.+)$/)
    const bullet = line.match(/^[-*]\s+(.+)$/)

    if (heading) {
      if (listOpen) {
        html.push('</ul>')
        listOpen = false
      }
      html.push(`<h${heading[1].length}>${renderInlineMarkdown(heading[2])}</h${heading[1].length}>`)
    } else if (bullet) {
      if (!listOpen) {
        html.push('<ul>')
        listOpen = true
      }
      html.push(`<li>${renderInlineMarkdown(bullet[1])}</li>`)
    } else if (!line.trim()) {
      if (listOpen) {
        html.push('</ul>')
        listOpen = false
      }
    } else {
      if (listOpen) {
        html.push('</ul>')
        listOpen = false
      }
      html.push(`<p>${renderInlineMarkdown(line)}</p>`)
    }
  }

  if (listOpen) html.push('</ul>')
  return html.join('\n')
}

function formatTime(value: string) {
  return value ? new Date(value).toLocaleString() : '-'
}

function statusType(status: string) {
  if (status === 'validated') return 'success'
  if (status === 'needs_fix') return 'danger'
  if (status === 'drafted') return 'warning'
  if (status === 'planned') return 'info'
  return 'info'
}

function getEditorTextarea() {
  return editorInputRef.value?.textarea ?? null
}

async function focusEditorRange(start: number, end = start) {
  if (previewMode.value === 'preview') {
    previewMode.value = 'edit'
    await nextTick()
  }
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function goToSearchMatch(index: number) {
  currentSearchIndex.value = normalizeSearchIndex(index)
  const match = searchMatches.value[currentSearchIndex.value]
  if (!match) return
  await focusEditorRange(match.start, match.end)
}

async function findNextMatch(step = 1) {
  if (!searchText.value) {
    ElMessage.warning('请输入搜索内容')
    return
  }
  if (searchMatches.value.length === 0) {
    ElMessage.info('当前章节未找到匹配内容')
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
  const nextStart = match.start + replaceText.value.length
  await nextTick()
  const nextIndex = searchMatches.value.findIndex((item) => item.start >= nextStart)
  await goToSearchMatch(nextIndex === -1 ? 0 : nextIndex)
}

async function replaceAllMatches() {
  if (!searchText.value) {
    ElMessage.warning('请输入搜索内容')
    return
  }
  const total = searchMatches.value.length
  if (total === 0) {
    ElMessage.info('没有可替换的匹配内容')
    return
  }

  editorContent.value = editorContent.value.replace(new RegExp(escapeRegExp(searchText.value), 'gi'), replaceText.value)
  currentSearchIndex.value = -1
  ElMessage.success(`已替换 ${total} 处`)
}

async function insertTextAtCursor(text: string) {
  if (!selectedChapter.value) {
    ElMessage.warning('请先选择章节')
    return
  }

  const textarea = getEditorTextarea()
  const start = textarea?.selectionStart ?? editorContent.value.length
  const end = textarea?.selectionEnd ?? editorContent.value.length
  const prefix = editorContent.value.slice(0, start)
  const suffix = editorContent.value.slice(end)
  const spacerBefore = prefix && !prefix.endsWith('\n') ? '\n\n' : ''
  const spacerAfter = suffix && !suffix.startsWith('\n') ? '\n\n' : ''
  const inserted = `${spacerBefore}${text.trim()}${spacerAfter}`

  editorContent.value = `${prefix}${inserted}${suffix}`
  await focusEditorRange(start + inserted.length)
}

async function insertRecallResult(item: VectorRecallResult) {
  const text = `> ${item.source} · ${item.title}\n${item.excerpt}`
  await insertTextAtCursor(text)
  ElMessage.success('召回片段已插入')
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
    if (!silent) ElMessage.error((err as Error).message || '加载索引状态失败')
  } finally {
    loadingIndexStatus.value = false
  }
}

async function rebuildIndex() {
  if (!workContext.selectedProjectId) {
    ElMessage.warning('请先选择项目')
    return
  }

  rebuildingIndex.value = true
  try {
    indexStatus.value = await rebuildEditorIndex(workContext.selectedProjectId)
    ElMessage.success('轻量索引已重建')
  } catch (err) {
    ElMessage.error((err as Error).message || '重建轻量索引失败')
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
    indexStatus.value = null
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
    ElMessage.error((err as Error).message || '加载章节失败')
  } finally {
    loadingChapters.value = false
  }
}

async function loadSelectedChapter() {
  if (!selectedChapterId.value) {
    selectedChapter.value = null
    editorContent.value = ''
    baselineContent.value = ''
    baselineSavedAt.value = ''
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
    baselineSavedAt.value = assist.chapter.updatedAt
    recallResults.value = assist.related
  } catch (err) {
    ElMessage.error((err as Error).message || '加载章节详情失败')
  } finally {
    loadingChapter.value = false
    loadingAssist.value = false
  }
}

async function saveContent() {
  if (!selectedChapter.value) {
    ElMessage.warning('请先选择章节')
    return
  }

  saving.value = true
  try {
    const chapter = await saveEditorChapterContent(selectedChapter.value.id, editorContent.value, 'drafted')
    selectedChapter.value = chapter
    baselineContent.value = chapter.content ?? ''
    baselineSavedAt.value = chapter.updatedAt
    editorContent.value = chapter.content ?? ''
    chapters.value = chapters.value.map((item) => (item.id === chapter.id ? chapter : item))
    await refreshIndexStatus(true)
    ElMessage.success('章节内容已保存')
  } catch (err) {
    ElMessage.error((err as Error).message || '保存章节失败')
  } finally {
    saving.value = false
  }
}

async function runVectorRecall() {
  if (!workContext.selectedProjectId) {
    ElMessage.warning('请先选择项目')
    return
  }
  if (!recallQuery.value.trim()) {
    ElMessage.warning('请输入召回关键词')
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
      ElMessage.info('没有匹配到可召回上下文')
    }
  } catch (err) {
    ElMessage.error((err as Error).message || '向量召回失败')
  } finally {
    searchingRecall.value = false
  }
}

watch(() => [workContext.selectedProjectId, workContext.selectedVolumeId], refreshChapters)
watch(selectedChapterId, loadSelectedChapter)
watch(() => workContext.selectedProjectId, () => refreshIndexStatus(true))
watch(searchMatches, (matches) => {
  if (matches.length === 0) {
    currentSearchIndex.value = -1
  } else if (currentSearchIndex.value >= matches.length) {
    currentSearchIndex.value = matches.length - 1
  }
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
        <p class="eyebrow">Stage 7 · Editor MVP</p>
        <h1>章节编辑器</h1>
        <p class="subtitle">
          {{ workContext.selectedProject?.name || '未选择项目' }}
          <template v-if="workContext.selectedVolume">
            / 第 {{ workContext.selectedVolume.volumeNumber }} 卷 · {{ workContext.selectedVolume.title }}
          </template>
        </p>
      </div>
      <div class="toolbar-actions">
        <el-segmented
          v-model="previewMode"
          :options="[
            { label: '编辑', value: 'edit' },
            { label: '预览', value: 'preview' },
            { label: '分屏', value: 'split' }
          ]"
        />
        <el-button :icon="Refresh" :loading="loadingChapters" @click="refreshChapters">刷新</el-button>
        <el-button
          type="primary"
          :icon="DocumentChecked"
          :loading="saving"
          :disabled="!selectedChapter"
          @click="saveContent"
        >
          保存
        </el-button>
      </div>
    </section>

    <div class="editor-grid">
      <el-card shadow="never" class="chapter-panel">
        <template #header>
          <div class="panel-head">
            <span>项目章节</span>
            <el-tag size="small" type="info">{{ chapters.length }}</el-tag>
          </div>
        </template>

        <el-empty v-if="!canUseWorkspace" description="请先在顶栏选择 Project" />
        <el-empty v-else-if="chapters.length === 0 && !loadingChapters" description="暂无章节，可先到章节生成创建" />
        <el-scrollbar v-else class="chapter-scroll" v-loading="loadingChapters">
          <button
            v-for="chapter in chapters"
            :key="chapter.id"
            class="chapter-item"
            :class="{ active: chapter.id === selectedChapterId }"
            type="button"
            @click="selectedChapterId = chapter.id"
          >
            <span class="chapter-title">第 {{ chapter.chapterNumber }} 章 · {{ chapter.title }}</span>
            <span class="chapter-meta">
              <el-tag size="small" :type="statusType(chapter.status)" effect="plain">{{ chapter.status || 'unknown' }}</el-tag>
              <span>{{ chapter.wordCount || 0 }} 字</span>
            </span>
          </button>
        </el-scrollbar>
      </el-card>

      <el-card shadow="never" class="writing-panel" v-loading="loadingChapter">
        <template #header>
          <div class="panel-head">
            <div>
              <span>{{ currentTitle }}</span>
              <small v-if="selectedChapter">更新于 {{ formatTime(selectedChapter.updatedAt) }}</small>
            </div>
            <div class="chapter-stats">
              <el-tag v-if="hasUnsavedChanges" size="small" type="warning">未保存</el-tag>
              <span>{{ currentWordCount }} 字符</span>
            </div>
          </div>
        </template>

        <el-empty v-if="!selectedChapter" description="请选择一个章节开始编辑" />
        <div v-else class="writer-wrap">
          <div class="search-replace-bar">
            <el-input
              v-model="searchText"
              class="search-input"
              clearable
              placeholder="搜索当前章节"
              @keyup.enter="findNextMatch(1)"
            />
            <el-input
              v-model="replaceText"
              class="search-input"
              clearable
              placeholder="替换为"
              @keyup.enter="replaceCurrentMatch"
            />
            <span class="search-status">{{ activeMatchLabel }}</span>
            <el-button :disabled="!searchText" @click="findNextMatch(-1)">上一个</el-button>
            <el-button :disabled="!searchText" @click="findNextMatch(1)">下一个</el-button>
            <el-button :disabled="!searchText" @click="replaceCurrentMatch">替换</el-button>
            <el-button type="primary" plain :disabled="!searchText" @click="replaceAllMatches">全部替换</el-button>
          </div>

          <div class="writer-surface" :class="`mode-${previewMode}`">
            <el-input
              v-if="previewMode !== 'preview'"
              ref="editorInputRef"
              v-model="editorContent"
              class="markdown-editor"
              type="textarea"
              resize="none"
              placeholder="在这里编辑 Markdown 正文。"
            />
            <article
              v-if="previewMode !== 'edit'"
              class="markdown-preview"
              v-html="markdownHtml"
            ></article>
          </div>
        </div>
      </el-card>

      <aside class="side-stack">
        <el-card shadow="never" class="index-panel">
          <template #header>
            <div class="panel-head">
              <span>轻量索引</span>
              <el-tag size="small" :type="indexStatusType">
                {{ indexStatus?.status || 'unknown' }}
              </el-tag>
            </div>
          </template>

          <div class="index-metrics" v-loading="loadingIndexStatus">
            <div>
              <span>索引章节</span>
              <strong>{{ indexProgressLabel }}</strong>
            </div>
            <div>
              <span>关键词</span>
              <strong>{{ indexStatus?.keywordCount ?? '-' }}</strong>
            </div>
            <div>
              <span>待更新</span>
              <strong>{{ indexStatus?.staleChapterCount ?? 0 }}</strong>
            </div>
          </div>
          <p class="index-updated">最近构建：{{ formatTime(indexStatus?.lastBuiltAt || '') }}</p>
          <div class="index-actions">
            <el-button :icon="Refresh" :loading="loadingIndexStatus" @click="refreshIndexStatus()">刷新状态</el-button>
            <el-button
              type="primary"
              plain
              :loading="rebuildingIndex"
              :disabled="!workContext.selectedProjectId"
              @click="rebuildIndex"
            >
              重建轻量索引
            </el-button>
          </div>
        </el-card>

        <el-card shadow="never" class="version-panel">
          <template #header>
            <div class="panel-head">
              <span>版本对比</span>
              <el-tag size="small" :type="hasUnsavedChanges ? 'warning' : 'success'">
                {{ hasUnsavedChanges ? '有改动' : '同步' }}
              </el-tag>
            </div>
          </template>

          <div class="diff-metrics">
            <div>
              <span>字符变化</span>
              <strong>{{ diffStats.deltaChars >= 0 ? '+' : '' }}{{ diffStats.deltaChars }}</strong>
            </div>
            <div>
              <span>加载版本</span>
              <strong>{{ diffStats.beforeChars }}</strong>
            </div>
            <div>
              <span>当前版本</span>
              <strong>{{ diffStats.afterChars }}</strong>
            </div>
          </div>

          <el-divider />
          <div class="version-list">
            <div v-for="version in versionSnapshots" :key="version.id" class="version-item">
              <div class="version-title">
                <span>{{ version.label }}</span>
                <small>{{ formatTime(version.savedAt) }}</small>
              </div>
              <pre>{{ version.content.slice(0, 420) || '空内容' }}</pre>
            </div>
          </div>
        </el-card>

        <el-card shadow="never" class="recall-panel">
          <template #header>
            <div class="panel-head">
              <span>向量召回</span>
              <el-tag size="small" type="success">轻量召回</el-tag>
            </div>
          </template>

          <el-input
            v-model="recallQuery"
            type="textarea"
            :rows="3"
            placeholder="输入人物、地点、伏笔或设定关键词"
          />
          <el-button
            class="recall-button"
            :icon="Search"
            :loading="searchingRecall"
            :disabled="!workContext.selectedProjectId"
            @click="runVectorRecall"
          >
            搜索上下文
          </el-button>

          <el-empty v-if="recallResults.length === 0" description="输入关键词搜索项目章节上下文" />
          <div v-else class="recall-results" v-loading="loadingAssist">
            <div v-for="item in recallResults" :key="item.id" class="recall-item">
              <div class="recall-title-row">
                <div>
                  <strong>{{ item.title }}</strong>
                  <span>{{ item.source }} · {{ item.score.toFixed(2) }}</span>
                </div>
                <el-button
                  size="small"
                  :icon="Position"
                  :disabled="!selectedChapter"
                  @click="insertRecallResult(item)"
                >
                  插入
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
.version-panel,
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
.writer-surface {
  display: grid;
  gap: 12px;
  height: calc(100vh - 318px);
  min-height: 520px;
}
.writer-surface.mode-split {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}
.writer-surface.mode-edit,
.writer-surface.mode-preview {
  grid-template-columns: minmax(0, 1fr);
}
.markdown-editor {
  height: 100%;
}
.markdown-editor :deep(.el-textarea__inner) {
  height: 100%;
  min-height: 100%;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  line-height: 1.7;
}
.markdown-preview {
  border: 1px solid var(--tm-border);
  border-radius: 6px;
  background: var(--tm-bg-elevated);
  color: var(--tm-fg-primary);
  line-height: 1.8;
  overflow: auto;
  padding: 16px 18px;
}
.markdown-preview :deep(h1),
.markdown-preview :deep(h2),
.markdown-preview :deep(h3) {
  margin: 0 0 12px;
}
.markdown-preview :deep(p) {
  margin: 0 0 12px;
}
.markdown-preview :deep(code) {
  background: var(--tm-bg);
  border: 1px solid var(--tm-border);
  border-radius: 4px;
  padding: 1px 4px;
}
.side-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
.diff-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.diff-metrics div,
.index-metrics div {
  border: 1px solid var(--tm-border);
  border-radius: 6px;
  padding: 8px;
}
.diff-metrics span,
.index-metrics span,
.version-title small,
.recall-item span {
  color: var(--tm-fg-tertiary);
  display: block;
  font-size: 12px;
}
.diff-metrics strong,
.index-metrics strong {
  color: var(--tm-fg-primary);
  display: block;
  font-size: 18px;
  margin-top: 4px;
}
.index-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
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
.version-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.version-item {
  border: 1px solid var(--tm-border);
  border-radius: 6px;
  overflow: hidden;
}
.version-title {
  background: var(--tm-bg);
  border-bottom: 1px solid var(--tm-border);
  padding: 8px 10px;
}
.version-title span {
  color: var(--tm-fg-primary);
  font-weight: 600;
}
.version-item pre {
  color: var(--tm-fg-secondary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
  margin: 0;
  max-height: 150px;
  overflow: auto;
  padding: 10px;
  white-space: pre-wrap;
  word-break: break-word;
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
    grid-template-columns: repeat(3, minmax(0, 1fr));
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
  .search-replace-bar,
  .writer-surface.mode-split {
    grid-template-columns: 1fr;
  }
}
</style>
