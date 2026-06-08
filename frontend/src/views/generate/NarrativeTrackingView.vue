<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Check, Delete, Edit, Plus, Refresh } from '@element-plus/icons-vue'
import { useWorkContextStore } from '@/stores/workContext'
import {
  createForeshadowing,
  createTimeline,
  deleteForeshadowing,
  deleteTimeline,
  getLongNovelCompleteness,
  listForeshadowings,
  listTimelines,
  rebuildTracking,
  updateForeshadowing,
  updateTimeline,
  type Foreshadowing,
  type ForeshadowingUpsert,
  type LongNovelCompleteness,
  type Timeline,
  type TimelineUpsert
} from '@/api/modules/tracking'
import { listChapters, type Chapter } from '@/api/modules/chapters'

const router = useRouter()
const workContext = useWorkContextStore()

const loading = ref(false)
const rebuilding = ref(false)
const activeTab = ref<'foreshadowings' | 'timeline'>('foreshadowings')
const keyword = ref('')
const foreshadowings = ref<Foreshadowing[]>([])
const timelines = ref<Timeline[]>([])
const chapters = ref<Chapter[]>([])
const completeness = ref<LongNovelCompleteness | null>(null)
const foreshadowingDialogVisible = ref(false)
const timelineDialogVisible = ref(false)
const editingForeshadowingId = ref('')
const editingTimelineId = ref('')

const selectedProjectId = computed(() => workContext.selectedProjectId)
const selectedSourceBookId = computed(() => workContext.selectedProject?.currentSourceBookId ?? null)

const foreshadowingForm = reactive<ForeshadowingUpsert>({
  projectId: '',
  sourceBookId: null,
  name: '',
  tier: 'Tier-3',
  isSetup: false,
  isResolved: false,
  isOverdue: false,
  expectedSetupChapter: '',
  expectedPayoffChapter: '',
  actualSetupChapter: '',
  actualPayoffChapter: '',
  overdueSuggestion: ''
})

const timelineForm = reactive<TimelineUpsert>({
  projectId: '',
  sourceBookId: null,
  chapterId: '',
  timePeriod: '',
  elapsedTime: '',
  keyTimeEvent: '',
  importance: 'normal'
})

const overviewItems = computed(() => completeness.value?.items ?? [])

function statusType(status: string) {
  if (status === 'ready') return 'success'
  if (status === 'warning') return 'warning'
  return 'danger'
}

function resetForeshadowingForm(row?: Foreshadowing) {
  editingForeshadowingId.value = row?.id ?? ''
  Object.assign(foreshadowingForm, {
    projectId: selectedProjectId.value ?? '',
    sourceBookId: selectedSourceBookId.value,
    name: row?.name ?? '',
    tier: row?.tier ?? 'Tier-3',
    isSetup: row?.isSetup ?? false,
    isResolved: row?.isResolved ?? false,
    isOverdue: row?.isOverdue ?? false,
    expectedSetupChapter: row?.expectedSetupChapter ?? '',
    expectedPayoffChapter: row?.expectedPayoffChapter ?? '',
    actualSetupChapter: row?.actualSetupChapter ?? '',
    actualPayoffChapter: row?.actualPayoffChapter ?? '',
    overdueSuggestion: row?.overdueSuggestion ?? ''
  })
}

function resetTimelineForm(row?: Timeline) {
  editingTimelineId.value = row?.id ?? ''
  Object.assign(timelineForm, {
    projectId: selectedProjectId.value ?? '',
    sourceBookId: selectedSourceBookId.value,
    chapterId: row?.chapterId ?? chapters.value[0]?.id ?? '',
    timePeriod: row?.timePeriod ?? '',
    elapsedTime: row?.elapsedTime ?? '',
    keyTimeEvent: row?.keyTimeEvent ?? '',
    importance: row?.importance ?? 'normal'
  })
}

async function refreshAll() {
  if (!selectedProjectId.value) return
  loading.value = true
  try {
    const params = {
      projectId: selectedProjectId.value,
      sourceBookId: selectedSourceBookId.value,
      keyword: keyword.value.trim() || null
    }
    const [foreshadowingRows, timelineRows, chapterRows, completenessResult] = await Promise.all([
      listForeshadowings(params),
      listTimelines(params),
      listChapters(selectedProjectId.value),
      getLongNovelCompleteness(selectedProjectId.value, selectedSourceBookId.value)
    ])
    foreshadowings.value = foreshadowingRows
    timelines.value = timelineRows
    chapters.value = chapterRows.sort((a, b) => a.chapterNumber - b.chapterNumber)
    completeness.value = completenessResult
  } catch (err) {
    ElMessage.error((err as Error).message || '加载叙事追踪失败')
  } finally {
    loading.value = false
  }
}

function openForeshadowingDialog(row?: Foreshadowing) {
  if (!selectedProjectId.value) {
    ElMessage.warning('请先选择项目')
    return
  }
  resetForeshadowingForm(row)
  foreshadowingDialogVisible.value = true
}

function openTimelineDialog(row?: Timeline) {
  if (!selectedProjectId.value) {
    ElMessage.warning('请先选择项目')
    return
  }
  resetTimelineForm(row)
  timelineDialogVisible.value = true
}

async function saveForeshadowing() {
  if (!foreshadowingForm.name.trim()) {
    ElMessage.warning('请输入伏笔名称')
    return
  }
  try {
    if (editingForeshadowingId.value) {
      await updateForeshadowing(editingForeshadowingId.value, foreshadowingForm)
    } else {
      await createForeshadowing(foreshadowingForm)
    }
    foreshadowingDialogVisible.value = false
    ElMessage.success('伏笔已保存')
    await refreshAll()
  } catch (err) {
    ElMessage.error((err as Error).message || '保存伏笔失败')
  }
}

async function saveTimeline() {
  if (!timelineForm.chapterId || !timelineForm.keyTimeEvent.trim()) {
    ElMessage.warning('请选择章节并填写关键事件')
    return
  }
  try {
    if (editingTimelineId.value) {
      await updateTimeline(editingTimelineId.value, timelineForm)
    } else {
      await createTimeline(timelineForm)
    }
    timelineDialogVisible.value = false
    ElMessage.success('时间线已保存')
    await refreshAll()
  } catch (err) {
    ElMessage.error((err as Error).message || '保存时间线失败')
  }
}

async function removeForeshadowing(row: Foreshadowing) {
  await ElMessageBox.confirm(`删除伏笔「${row.name}」？`, '删除确认', { type: 'warning' })
  await deleteForeshadowing(row.id)
  ElMessage.success('伏笔已删除')
  await refreshAll()
}

async function removeTimeline(row: Timeline) {
  await ElMessageBox.confirm(`删除第 ${row.chapterNumber} 章时间线？`, '删除确认', { type: 'warning' })
  await deleteTimeline(row.id)
  ElMessage.success('时间线已删除')
  await refreshAll()
}

async function quickResolve(row: Foreshadowing) {
  await updateForeshadowing(row.id, {
    ...row,
    isSetup: true,
    isResolved: true,
    isOverdue: false,
    actualPayoffChapter: row.actualPayoffChapter || row.expectedPayoffChapter
  })
  ElMessage.success('伏笔已标记回收')
  await refreshAll()
}

async function rebuildAllTracking() {
  if (!selectedProjectId.value) {
    ElMessage.warning('请先选择项目')
    return
  }

  await ElMessageBox.confirm(
    '会删除当前项目/书源下已有伏笔和时间线，并根据章节蓝图重新生成。确定继续？',
    '重新生成确认',
    {
      type: 'warning',
      confirmButtonText: '重新生成',
      cancelButtonText: '取消'
    }
  )

  rebuilding.value = true
  try {
    const result = await rebuildTracking({
      projectId: selectedProjectId.value,
      sourceBookId: selectedSourceBookId.value
    })
    ElMessage.success(
      `已重建：伏笔 ${result.foreshadowingCount} 条，时间线 ${result.timelineCount} 条；移除旧数据 ${result.removedForeshadowingCount + result.removedTimelineCount} 条。`
    )
    await refreshAll()
  } catch (err) {
    ElMessage.error((err as Error).message || '重新生成伏笔和时间线失败')
  } finally {
    rebuilding.value = false
  }
}

function goTo(route: string) {
  router.push(route)
}

watch(() => [selectedProjectId.value, selectedSourceBookId.value], refreshAll)
onMounted(refreshAll)
</script>

<template>
  <section class="tracking-page">
    <div class="tracking-toolbar">
      <div>
        <h2>叙事追踪</h2>
        <p>伏笔账本、时间线和长篇完整性检查。</p>
      </div>
      <div class="tracking-toolbar__actions">
        <el-input v-model="keyword" clearable placeholder="搜索伏笔或事件" @keyup.enter="refreshAll" />
        <el-button type="warning" :icon="Refresh" :loading="rebuilding" @click="rebuildAllTracking">重新生成伏笔和时间线</el-button>
        <el-button :icon="Refresh" :loading="loading" @click="refreshAll">刷新</el-button>
      </div>
    </div>

    <el-empty v-if="!selectedProjectId" description="请先选择项目" />

    <template v-else>
      <div class="completeness-grid">
        <button
          v-for="item in overviewItems"
          :key="item.key"
          class="completeness-item"
          type="button"
          @click="goTo(item.route)"
        >
          <span>{{ item.label }}</span>
          <strong>{{ item.count }}</strong>
          <el-tag size="small" :type="statusType(item.status)">{{ item.status }}</el-tag>
          <small>{{ item.message }}</small>
        </button>
      </div>

      <el-tabs v-model="activeTab" class="tracking-tabs">
        <el-tab-pane label="伏笔账本" name="foreshadowings">
          <div class="table-actions">
            <el-button type="primary" :icon="Plus" @click="openForeshadowingDialog()">新增伏笔</el-button>
          </div>
          <el-table v-loading="loading" :data="foreshadowings" size="small">
            <el-table-column prop="name" label="伏笔" min-width="180" />
            <el-table-column prop="tier" label="等级" width="90" />
            <el-table-column prop="expectedSetupChapter" label="预计埋设" width="110" />
            <el-table-column prop="expectedPayoffChapter" label="预计回收" width="110" />
            <el-table-column label="状态" width="190">
              <template #default="{ row }">
                <el-tag v-if="row.isResolved" size="small" type="success">已回收</el-tag>
                <el-tag v-else-if="row.isOverdue" size="small" type="danger">逾期</el-tag>
                <el-tag v-else-if="row.isSetup" size="small" type="warning">已埋设</el-tag>
                <el-tag v-else size="small" type="info">待埋设</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="overdueSuggestion" label="处理建议" min-width="220" show-overflow-tooltip />
            <el-table-column label="操作" width="210" fixed="right">
              <template #default="{ row }">
                <el-button size="small" :icon="Check" :disabled="row.isResolved" @click="quickResolve(row)">回收</el-button>
                <el-button size="small" :icon="Edit" @click="openForeshadowingDialog(row)">编辑</el-button>
                <el-button size="small" type="danger" :icon="Delete" @click="removeForeshadowing(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="时间线" name="timeline">
          <div class="table-actions">
            <el-button type="primary" :icon="Plus" @click="openTimelineDialog()">新增时间线</el-button>
          </div>
          <el-table v-loading="loading" :data="timelines" size="small">
            <el-table-column prop="chapterNumber" label="章节" width="80" />
            <el-table-column prop="chapterTitle" label="标题" min-width="160" />
            <el-table-column prop="timePeriod" label="时间段" width="120" />
            <el-table-column prop="elapsedTime" label="经过时间" width="120" />
            <el-table-column prop="keyTimeEvent" label="关键事件" min-width="260" />
            <el-table-column prop="importance" label="重要性" width="90" />
            <el-table-column label="操作" width="150" fixed="right">
              <template #default="{ row }">
                <el-button size="small" :icon="Edit" @click="openTimelineDialog(row)">编辑</el-button>
                <el-button size="small" type="danger" :icon="Delete" @click="removeTimeline(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </template>

    <el-dialog v-model="foreshadowingDialogVisible" :title="editingForeshadowingId ? '编辑伏笔' : '新增伏笔'" width="640px">
      <el-form label-width="110px">
        <el-form-item label="伏笔名称">
          <el-input v-model="foreshadowingForm.name" />
        </el-form-item>
        <el-form-item label="等级">
          <el-select v-model="foreshadowingForm.tier">
            <el-option label="Tier-1 主线" value="Tier-1" />
            <el-option label="Tier-2 支线" value="Tier-2" />
            <el-option label="Tier-3 普通" value="Tier-3" />
          </el-select>
        </el-form-item>
        <el-form-item label="预计埋设">
          <el-input v-model="foreshadowingForm.expectedSetupChapter" placeholder="第1章" />
        </el-form-item>
        <el-form-item label="预计回收">
          <el-input v-model="foreshadowingForm.expectedPayoffChapter" placeholder="第12章" />
        </el-form-item>
        <el-form-item label="实际埋设">
          <el-input v-model="foreshadowingForm.actualSetupChapter" />
        </el-form-item>
        <el-form-item label="实际回收">
          <el-input v-model="foreshadowingForm.actualPayoffChapter" />
        </el-form-item>
        <el-form-item label="状态">
          <el-checkbox v-model="foreshadowingForm.isSetup">已埋设</el-checkbox>
          <el-checkbox v-model="foreshadowingForm.isResolved">已回收</el-checkbox>
          <el-checkbox v-model="foreshadowingForm.isOverdue">逾期</el-checkbox>
        </el-form-item>
        <el-form-item label="处理建议">
          <el-input v-model="foreshadowingForm.overdueSuggestion" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="foreshadowingDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveForeshadowing">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="timelineDialogVisible" :title="editingTimelineId ? '编辑时间线' : '新增时间线'" width="640px">
      <el-form label-width="110px">
        <el-form-item label="章节">
          <el-select v-model="timelineForm.chapterId" filterable>
            <el-option
              v-for="chapter in chapters"
              :key="chapter.id"
              :label="`第${chapter.chapterNumber}章 ${chapter.title}`"
              :value="chapter.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="时间段">
          <el-input v-model="timelineForm.timePeriod" />
        </el-form-item>
        <el-form-item label="经过时间">
          <el-input v-model="timelineForm.elapsedTime" />
        </el-form-item>
        <el-form-item label="关键事件">
          <el-input v-model="timelineForm.keyTimeEvent" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="重要性">
          <el-select v-model="timelineForm.importance">
            <el-option label="high" value="high" />
            <el-option label="normal" value="normal" />
            <el-option label="low" value="low" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="timelineDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveTimeline">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.tracking-page {
  display: grid;
  gap: 14px;
}
.tracking-toolbar {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}
.tracking-toolbar h2 {
  margin: 0;
  font-size: 20px;
  line-height: 28px;
}
.tracking-toolbar p {
  margin: 4px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.tracking-toolbar__actions {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) auto auto;
  gap: 8px;
  min-width: min(100%, 620px);
}
.completeness-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 8px;
}
.completeness-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 4px 8px;
  text-align: left;
  padding: 10px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  cursor: pointer;
}
.completeness-item strong {
  font-size: 18px;
}
.completeness-item small {
  grid-column: 1 / -1;
  color: var(--el-text-color-secondary);
  line-height: 18px;
}
.tracking-tabs {
  padding: 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: var(--el-bg-color);
}
.table-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 10px;
}
@media (max-width: 760px) {
  .tracking-toolbar {
    display: grid;
  }
  .tracking-toolbar__actions {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
