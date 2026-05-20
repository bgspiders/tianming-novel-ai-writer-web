<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, RefreshRight, Connection, EditPen, Clock } from '@element-plus/icons-vue'
import {
  chaptersApi,
  type ChapterDetail,
  type ChapterListItem,
  type ChapterRecallResult,
  type ChapterVersionDetail,
  type ChapterVersionItem
} from '@/api/modules/chapters'
import { listSourceBooks, type SourceBook } from '@/api/modules/sourceBooks'
import MonacoMarkdownEditor from '@/components/editor/MonacoMarkdownEditor.vue'

interface DiffLine {
  line: number
  before: string
  after: string
  type: 'same' | 'added' | 'removed' | 'changed'
}

const markdownModuleName = 'markdown-it'
const diff2htmlModuleName = 'diff2html'

const loading = ref(false)
const detailLoading = ref(false)
const saving = ref(false)
const recalling = ref(false)
const versionsLoading = ref(false)
const restoringVersion = ref(false)

const keyword = ref('')
const selectedSourceBookId = ref('')
const chapters = ref<ChapterListItem[]>([])
const sourceBooks = ref<SourceBook[]>([])
const selectedChapterId = ref('')
const chapterDetail = ref<ChapterDetail | null>(null)
const editorContent = ref('')
const lastSavedContent = ref('')
const activeTab = ref<'write' | 'preview' | 'recall' | 'history' | 'diff'>('write')
const recallQuery = ref('')
const recallResults = ref<ChapterRecallResult[]>([])
const recallQuerySource = ref('')
const monacoFallback = ref(false)
const markdownFallback = ref(false)
const diffFallback = ref(true)
const diffHtml = ref('')
const versions = ref<ChapterVersionItem[]>([])
const selectedVersionId = ref('')
const selectedVersionDetail = ref<ChapterVersionDetail | null>(null)

const markdownRenderer = ref<(value: string) => string>((value) => fallbackMarkdownRender(value))

const selectedChapter = computed(() =>
  chapters.value.find((item) => item.id === selectedChapterId.value) ?? null
)

const previewHtml = computed(() => markdownRenderer.value(editorContent.value || ''))
const hasUnsavedChanges = computed(() => editorContent.value !== lastSavedContent.value)
const diffBaseContent = computed(() => selectedVersionDetail.value?.content ?? lastSavedContent.value)
const restoreDisabled = computed(() => !selectedVersionId.value)

const diffLines = computed<DiffLine[]>(() => {
  const beforeLines = diffBaseContent.value.split(/\r?\n/)
  const afterLines = editorContent.value.split(/\r?\n/)
  const max = Math.max(beforeLines.length, afterLines.length)

  return Array.from({ length: max }, (_, index) => {
    const before = beforeLines[index] ?? ''
    const after = afterLines[index] ?? ''

    let type: DiffLine['type'] = 'same'
    if (!before && after) type = 'added'
    else if (before && !after) type = 'removed'
    else if (before !== after) type = 'changed'

    return {
      line: index + 1,
      before,
      after,
      type
    }
  }).filter((item) => item.type !== 'same')
})

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function fallbackMarkdownRender(value: string) {
  if (!value) return ''
  return escapeHtml(value).replaceAll('\n', '<br />')
}

function buildUnifiedDiff(before: string, after: string) {
  const beforeLines = before.split(/\r?\n/)
  const afterLines = after.split(/\r?\n/)
  const chunks: string[] = [
    '--- 基准版本.md',
    '+++ 当前编辑.md',
    `@@ -1,${Math.max(beforeLines.length, 1)} +1,${Math.max(afterLines.length, 1)} @@`
  ]

  const total = Math.max(beforeLines.length, afterLines.length)
  for (let index = 0; index < total; index++) {
    const oldLine = beforeLines[index]
    const newLine = afterLines[index]

    if (oldLine === newLine) {
      if (oldLine !== undefined) chunks.push(` ${oldLine}`)
      continue
    }

    if (oldLine !== undefined) chunks.push(`-${oldLine}`)
    if (newLine !== undefined) chunks.push(`+${newLine}`)
  }

  return chunks.join('\n')
}

function formatTime(value: string | null | undefined) {
  if (!value) return '未知时间'
  const time = new Date(value)
  if (Number.isNaN(time.getTime())) return value
  return time.toLocaleString('zh-CN', { hour12: false })
}

function formatSize(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

async function loadOptionalMarkdown() {
  try {
    const markdownModule = await import(/* @vite-ignore */ markdownModuleName)
    const MarkdownIt = markdownModule.default
    const renderer = new MarkdownIt({
      html: false,
      linkify: true,
      breaks: true
    })
    markdownRenderer.value = (value: string) => renderer.render(value)
  } catch {
    markdownFallback.value = true
  }
}

async function renderOptionalDiff() {
  try {
    const diff2htmlModule = await import(/* @vite-ignore */ diff2htmlModuleName)
    const html = diff2htmlModule.html(buildUnifiedDiff(diffBaseContent.value, editorContent.value), {
      drawFileList: false,
      matching: 'lines',
      outputFormat: 'side-by-side'
    })

    diffHtml.value = html
    diffFallback.value = false
  } catch {
    diffFallback.value = true
    diffHtml.value = ''
  }
}

async function loadSourceBooks() {
  try {
    sourceBooks.value = await listSourceBooks()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载来源书失败')
  }
}

async function loadChapters() {
  loading.value = true
  try {
    chapters.value = await chaptersApi.list({
      sourceBookId: selectedSourceBookId.value || null,
      keyword: keyword.value || null
    })

    if (!chapters.value.length) {
      selectedChapterId.value = ''
      chapterDetail.value = null
      editorContent.value = ''
      lastSavedContent.value = ''
      recallResults.value = []
      versions.value = []
      selectedVersionId.value = ''
      selectedVersionDetail.value = null
      diffHtml.value = ''
      return
    }

    const nextId = chapters.value.some((item) => item.id === selectedChapterId.value)
      ? selectedChapterId.value
      : chapters.value[0].id

    if (nextId === selectedChapterId.value) {
      await loadChapterDetail(nextId)
    } else {
      selectedChapterId.value = nextId
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载章节失败')
  } finally {
    loading.value = false
  }
}

async function loadChapterDetail(id: string) {
  if (!id) return

  detailLoading.value = true
  try {
    const detail = await chaptersApi.get(id)
    chapterDetail.value = detail
    editorContent.value = detail.content
    lastSavedContent.value = detail.content
    recallQuery.value = detail.title
    recallResults.value = []
    await loadVersions(id)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载章节详情失败')
  } finally {
    detailLoading.value = false
  }
}

async function loadVersions(id: string) {
  versionsLoading.value = true
  try {
    versions.value = await chaptersApi.versions(id)

    if (!versions.value.length) {
      selectedVersionId.value = ''
      selectedVersionDetail.value = null
      diffHtml.value = ''
      return
    }

    const currentSelected = versions.value.find((item) => item.versionId === selectedVersionId.value)
    selectedVersionId.value = currentSelected?.versionId ?? versions.value[0].versionId
    await loadVersionDetail()
  } catch (error) {
    versions.value = []
    selectedVersionId.value = ''
    selectedVersionDetail.value = null
    ElMessage.error(error instanceof Error ? error.message : '加载版本历史失败')
  } finally {
    versionsLoading.value = false
  }
}

async function loadVersionDetail() {
  if (!selectedChapterId.value || !selectedVersionId.value) {
    selectedVersionDetail.value = null
    return
  }

  try {
    selectedVersionDetail.value = await chaptersApi.version(selectedChapterId.value, selectedVersionId.value)
    if (activeTab.value === 'diff') {
      await renderOptionalDiff()
    }
  } catch (error) {
    selectedVersionDetail.value = null
    ElMessage.error(error instanceof Error ? error.message : '加载版本内容失败')
  }
}

async function saveContent() {
  if (!selectedChapterId.value) return

  saving.value = true
  try {
    const detail = await chaptersApi.saveContent(selectedChapterId.value, { content: editorContent.value })
    chapterDetail.value = detail
    lastSavedContent.value = detail.content

    const index = chapters.value.findIndex((item) => item.id === detail.id)
    if (index >= 0) {
      chapters.value[index] = { ...chapters.value[index], ...detail }
    }

    await loadVersions(selectedChapterId.value)
    ElMessage.success('章节内容已保存')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存章节内容失败')
  } finally {
    saving.value = false
  }
}

async function restoreSelectedVersion() {
  if (!selectedChapterId.value || !selectedVersionId.value) return

  restoringVersion.value = true
  try {
    const detail = await chaptersApi.restoreVersion(selectedChapterId.value, {
      versionId: selectedVersionId.value
    })

    chapterDetail.value = detail
    editorContent.value = detail.content
    lastSavedContent.value = detail.content

    const index = chapters.value.findIndex((item) => item.id === detail.id)
    if (index >= 0) {
      chapters.value[index] = { ...chapters.value[index], ...detail }
    }

    await loadVersions(selectedChapterId.value)
    activeTab.value = 'write'
    ElMessage.success('已恢复到所选版本')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '恢复版本失败')
  } finally {
    restoringVersion.value = false
  }
}

async function runRecall() {
  if (!selectedChapterId.value) return

  recalling.value = true
  try {
    const response = await chaptersApi.recall(selectedChapterId.value, {
      query: recallQuery.value || null,
      topK: 6
    })

    recallResults.value = response.results
    recallQuerySource.value = response.querySource
    activeTab.value = 'recall'
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载召回结果失败')
  } finally {
    recalling.value = false
  }
}

function onMonacoFallback() {
  monacoFallback.value = true
}

watch(selectedChapterId, (id, previousId) => {
  if (!id || id === previousId) return
  void loadChapterDetail(id)
})

watch(selectedVersionId, (id, previousId) => {
  if (!id || id === previousId) return
  void loadVersionDetail()
})

watch(
  () => [diffBaseContent.value, editorContent.value, activeTab.value] as const,
  ([, , tab]) => {
    if (tab === 'diff') {
      void renderOptionalDiff()
    }
  }
)

onMounted(async () => {
  await loadOptionalMarkdown()
  await Promise.all([loadSourceBooks(), loadChapters()])
})
</script>

<template>
  <div class="editor-view">
    <section class="toolbar">
      <div class="toolbar-left">
        <el-select
          v-model="selectedSourceBookId"
          clearable
          placeholder="按来源书筛选"
          style="width: 220px"
          @change="loadChapters"
        >
          <el-option
            v-for="book in sourceBooks"
            :key="book.id"
            :label="book.name"
            :value="book.id"
          />
        </el-select>

        <el-input
          v-model="keyword"
          placeholder="搜索章节标题或摘要"
          clearable
          style="width: 280px"
          :prefix-icon="Search"
          @keyup.enter="loadChapters"
          @clear="loadChapters"
        />

        <el-button :icon="RefreshRight" @click="loadChapters">刷新</el-button>
      </div>

      <div class="toolbar-right">
        <el-tag v-if="monacoFallback" type="warning" effect="plain">Monaco 未加载，已回退为文本框</el-tag>
        <el-tag v-if="markdownFallback" type="info" effect="plain">使用基础 Markdown 预览</el-tag>

        <el-button
          type="success"
          :icon="Connection"
          :loading="recalling"
          :disabled="!selectedChapterId"
          @click="runRecall"
        >
          执行召回
        </el-button>

        <el-button
          type="primary"
          :icon="EditPen"
          :loading="saving"
          :disabled="!selectedChapterId || !hasUnsavedChanges"
          @click="saveContent"
        >
          保存正文
        </el-button>
      </div>
    </section>

    <section class="workspace">
      <el-card class="chapter-list-card" shadow="never">
        <template #header>
          <div class="card-header">
            <span>章节列表</span>
            <el-tag type="info" effect="plain">{{ chapters.length }}</el-tag>
          </div>
        </template>

        <el-skeleton :rows="8" animated :loading="loading">
          <div class="chapter-list">
            <button
              v-for="chapter in chapters"
              :key="chapter.id"
              class="chapter-item"
              :class="{ active: chapter.id === selectedChapterId }"
              @click="selectedChapterId = chapter.id"
            >
              <div class="chapter-item-top">
                <span class="chapter-index">第 {{ chapter.chapterNumber }} 章</span>
                <span class="chapter-status">{{ chapter.status }}</span>
              </div>
              <div class="chapter-title">{{ chapter.title }}</div>
              <div class="chapter-summary">{{ chapter.summary || '暂无摘要' }}</div>
            </button>
          </div>
        </el-skeleton>
      </el-card>

      <el-card class="editor-card" shadow="never">
        <template #header>
          <div class="card-header">
            <div>
              <div class="editor-title">{{ selectedChapter?.title || '未选择章节' }}</div>
              <div v-if="chapterDetail" class="editor-meta">
                <span>{{ chapterDetail.projectName || chapterDetail.projectId }}</span>
                <span>第 {{ chapterDetail.volumeNumber }} 卷</span>
                <span>{{ chapterDetail.wordCount }} 字</span>
                <span>{{ chapterDetail.status }}</span>
                <span>{{ formatTime(chapterDetail.updatedAt) }}</span>
              </div>
            </div>

            <el-input
              v-model="recallQuery"
              placeholder="可选：自定义召回查询"
              clearable
              style="width: 280px"
            />
          </div>
        </template>

        <el-empty v-if="!selectedChapterId" description="请先从左侧选择章节" />

        <template v-else>
          <el-skeleton :rows="10" animated :loading="detailLoading">
            <el-tabs v-model="activeTab" class="editor-tabs">
              <el-tab-pane label="正文编辑" name="write">
                <MonacoMarkdownEditor
                  v-model="editorContent"
                  height="58vh"
                  placeholder="在这里编辑章节正文，支持 Markdown。"
                  @fallback="onMonacoFallback"
                />
              </el-tab-pane>

              <el-tab-pane label="预览" name="preview">
                <div class="preview-pane" v-html="previewHtml"></div>
              </el-tab-pane>

              <el-tab-pane label="召回结果" name="recall">
                <div class="recall-meta">
                  <el-tag type="info" effect="plain">查询来源：{{ recallQuerySource || '手动输入' }}</el-tag>
                </div>

                <el-empty v-if="!recallResults.length" description="尚未执行召回" />

                <div v-else class="recall-list">
                  <el-card v-for="item in recallResults" :key="item.chapterId" shadow="hover" class="recall-item">
                    <div class="recall-item-top">
                      <div>
                        <div class="recall-title">第 {{ item.chapterNumber }} 章 · {{ item.chapterTitle }}</div>
                        <div class="recall-reason">{{ item.reason }}</div>
                      </div>
                      <el-tag type="success" effect="plain">评分 {{ item.score }}</el-tag>
                    </div>

                    <p class="recall-summary">{{ item.summary || '暂无摘要' }}</p>

                    <div class="recall-keywords">
                      <el-tag
                        v-for="keywordItem in item.matchedKeywords"
                        :key="keywordItem"
                        size="small"
                        effect="plain"
                      >
                        {{ keywordItem }}
                      </el-tag>
                    </div>
                  </el-card>
                </div>
              </el-tab-pane>

              <el-tab-pane label="历史版本" name="history">
                <div class="history-toolbar">
                  <el-select
                    v-model="selectedVersionId"
                    :loading="versionsLoading"
                    placeholder="选择版本"
                    style="width: 320px"
                  >
                    <el-option
                      v-for="item in versions"
                      :key="item.versionId"
                      :label="`${item.label}${item.isCurrent ? '（当前）' : ''}`"
                      :value="item.versionId"
                    />
                  </el-select>

                  <el-button
                    type="warning"
                    :loading="restoringVersion"
                    :disabled="restoreDisabled"
                    @click="restoreSelectedVersion"
                  >
                    恢复到该版本
                  </el-button>
                </div>

                <el-empty v-if="!versions.length" description="暂无历史版本" />

                <div v-else class="history-layout">
                  <div class="history-list">
                    <button
                      v-for="item in versions"
                      :key="item.versionId"
                      class="history-item"
                      :class="{ active: item.versionId === selectedVersionId }"
                      @click="selectedVersionId = item.versionId"
                    >
                      <div class="history-item-top">
                        <span>{{ item.label }}</span>
                        <el-tag v-if="item.isCurrent" type="success" size="small" effect="plain">当前</el-tag>
                      </div>
                      <div class="history-item-meta">
                        <span>{{ item.fileName }}</span>
                        <span>{{ formatSize(item.size) }}</span>
                        <span>{{ formatTime(item.createdAt) }}</span>
                      </div>
                    </button>
                  </div>

                  <div class="history-preview">
                    <div class="history-preview-title">
                      <el-icon><Clock /></el-icon>
                      <span>{{ selectedVersionDetail?.label || '未选择版本' }}</span>
                    </div>
                    <pre class="history-content">{{ selectedVersionDetail?.content || '暂无版本内容' }}</pre>
                  </div>
                </div>
              </el-tab-pane>

              <el-tab-pane label="版本对比" name="diff">
                <div class="diff-toolbar">
                  <el-select
                    v-model="selectedVersionId"
                    :loading="versionsLoading"
                    placeholder="选择对比基准版本"
                    style="width: 320px"
                  >
                    <el-option
                      v-for="item in versions"
                      :key="item.versionId"
                      :label="`${item.label}${item.isCurrent ? '（当前）' : ''}`"
                      :value="item.versionId"
                    />
                  </el-select>

                  <el-tag type="info" effect="plain">左侧为基准版本，右侧为当前编辑内容</el-tag>
                </div>

                <div class="diff-hint">
                  <el-alert
                    :title="diffFallback ? '未加载 diff2html，当前使用轻量行级对比。' : '已加载 diff2html，当前显示双栏差异。'"
                    type="info"
                    :closable="false"
                    show-icon
                  />
                </div>

                <div v-if="!diffFallback && diffHtml" class="diff2html-pane" v-html="diffHtml"></div>

                <div v-else-if="diffLines.length" class="diff-table">
                  <div
                    v-for="item in diffLines"
                    :key="item.line"
                    class="diff-row"
                    :class="`diff-${item.type}`"
                  >
                    <div class="diff-line">{{ item.line }}</div>
                    <pre class="diff-cell">{{ item.before }}</pre>
                    <pre class="diff-cell">{{ item.after }}</pre>
                  </div>
                </div>

                <el-empty v-else description="当前编辑内容与基准版本没有差异" />
              </el-tab-pane>
            </el-tabs>
          </el-skeleton>
        </template>
      </el-card>
    </section>
  </div>
</template>

<style scoped>
.editor-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.toolbar-left,
.toolbar-right,
.chapter-item-top,
.editor-meta,
.recall-item-top,
.recall-keywords,
.history-item-top,
.history-item-meta,
.diff-toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.workspace {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 16px;
  min-height: 70vh;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.chapter-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 68vh;
  overflow: auto;
}

.chapter-item,
.history-item {
  border: 1px solid var(--tm-border);
  background: var(--tm-bg);
  border-radius: 10px;
  padding: 12px;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s ease, transform 0.2s ease;
}

.chapter-item:hover,
.chapter-item.active,
.history-item:hover,
.history-item.active {
  border-color: var(--tm-primary);
  transform: translateY(-1px);
}

.chapter-index,
.chapter-status,
.editor-meta,
.recall-reason,
.history-item-meta {
  color: var(--tm-fg-secondary);
  font-size: 12px;
}

.chapter-title,
.editor-title,
.recall-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--tm-fg-primary);
}

.chapter-summary,
.recall-summary {
  margin: 6px 0 0;
  color: var(--tm-fg-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.preview-pane {
  min-height: 58vh;
  padding: 20px;
  border: 1px solid var(--tm-border);
  border-radius: 10px;
  background: var(--tm-bg-elevated);
  overflow: auto;
  color: var(--tm-fg-primary);
}

.preview-pane :deep(p),
.preview-pane :deep(li) {
  color: var(--tm-fg-secondary);
  line-height: 1.8;
}

.recall-meta,
.diff-hint,
.history-toolbar,
.diff-toolbar {
  margin-bottom: 12px;
}

.recall-list,
.history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-layout {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 16px;
}

.history-preview {
  border: 1px solid var(--tm-border);
  border-radius: 10px;
  background: var(--tm-bg-elevated);
  overflow: hidden;
}

.history-preview-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--tm-border);
  color: var(--tm-fg-primary);
  font-weight: 600;
}

.history-content {
  margin: 0;
  padding: 14px;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 52vh;
  overflow: auto;
  color: var(--tm-fg-secondary);
}

.diff-table {
  border: 1px solid var(--tm-border);
  border-radius: 10px;
  overflow: hidden;
}

.diff2html-pane {
  overflow: auto;
  border: 1px solid var(--tm-border);
  border-radius: 10px;
  padding: 12px;
  background: var(--tm-bg-elevated);
}

.diff-row {
  display: grid;
  grid-template-columns: 64px 1fr 1fr;
  border-top: 1px solid var(--tm-border);
}

.diff-row:first-child {
  border-top: none;
}

.diff-line,
.diff-cell {
  margin: 0;
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.6;
}

.diff-line {
  background: var(--tm-bg-elevated);
  color: var(--tm-fg-secondary);
}

.diff-cell {
  white-space: pre-wrap;
  word-break: break-word;
}

.diff-added .diff-cell:last-child {
  background: rgba(34, 197, 94, 0.12);
}

.diff-removed .diff-cell:first-of-type {
  background: rgba(239, 68, 68, 0.12);
}

.diff-changed .diff-cell {
  background: rgba(59, 130, 246, 0.08);
}

@media (max-width: 1100px) {
  .workspace,
  .history-layout {
    grid-template-columns: 1fr;
  }

  .chapter-list {
    max-height: 32vh;
  }
}
</style>
