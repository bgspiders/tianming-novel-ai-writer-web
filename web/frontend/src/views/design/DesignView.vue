<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Edit, Delete, Refresh, FolderAdd, Search } from '@element-plus/icons-vue'

import {
  DESIGN_MODULES,
  type DesignModuleKey,
  worldRulesApi,
  characterRulesApi,
  factionRulesApi,
  locationRulesApi,
  plotRulesApi,
  creativeMaterialsApi,
  bookAnalysesApi,
  outlinesApi,
  volumeDesignsApi,
  chapterPlansApi,
  chapterBlueprintsApi
} from '@/api/modules/design'
import {
  getCategoryTree,
  createCategory,
  updateCategory,
  deleteCategory,
  type CategoryTreeNode,
  type CategoryUpsert
} from '@/api/modules/categories'
import {
  listSourceBooks,
  createSourceBook,
  type SourceBook
} from '@/api/modules/sourceBooks'

import DesignFormField from '@/components/design/DesignFormField.vue'
import { MODULE_SCHEMAS, buildEmptyForm, type FieldDef } from '@/components/design/moduleSchemas'

const route = useRoute()
const router = useRouter()

// --- 路由模块 ---
const moduleKey = computed<DesignModuleKey>(() => {
  const k = route.params.module as string
  const valid = DESIGN_MODULES.find((m) => m.key === k)
  return (valid?.key ?? 'world_rules') as DesignModuleKey
})

const moduleMeta = computed(() => DESIGN_MODULES.find((m) => m.key === moduleKey.value)!)
const schema = computed(() => MODULE_SCHEMAS[moduleKey.value])

// --- API 选择 ---
const apiMap = {
  world_rules: worldRulesApi,
  character_rules: characterRulesApi,
  faction_rules: factionRulesApi,
  location_rules: locationRulesApi,
  plot_rules: plotRulesApi,
  creative_materials: creativeMaterialsApi,
  book_analyses: bookAnalysesApi,
  outlines: outlinesApi,
  volume_designs: volumeDesignsApi,
  chapter_plans: chapterPlansApi,
  chapter_blueprints: chapterBlueprintsApi
} as const
const activeApi = computed(() => apiMap[moduleKey.value])

// --- SourceBook 切换 ---
const sourceBooks = ref<SourceBook[]>([])
const selectedSourceBookId = ref<string>('')

async function refreshSourceBooks() {
  try {
    sourceBooks.value = await listSourceBooks()
  } catch (err) {
    ElMessage.error((err as Error).message ?? '加载源书失败')
  }
}

const newSourceBookName = ref('')
const newSourceBookVisible = ref(false)
async function quickCreateSourceBook() {
  if (!newSourceBookName.value.trim()) {
    ElMessage.warning('请输入源书名称')
    return
  }
  try {
    const sb = await createSourceBook({ name: newSourceBookName.value.trim() })
    sourceBooks.value = [sb, ...sourceBooks.value]
    selectedSourceBookId.value = sb.id
    newSourceBookVisible.value = false
    newSourceBookName.value = ''
    ElMessage.success('源书已创建')
  } catch (err) {
    ElMessage.error((err as Error).message ?? '创建失败')
  }
}

// --- Category 树 ---
const categoryTree = ref<CategoryTreeNode[]>([])
const loadingCategories = ref(false)
const selectedCategoryId = ref<string | null>(null)
const treeRef = ref()

async function refreshCategories() {
  loadingCategories.value = true
  try {
    categoryTree.value = await getCategoryTree(
      moduleKey.value,
      moduleMeta.value.hasSourceBookScope ? selectedSourceBookId.value || null : null
    )
  } catch (err) {
    ElMessage.error((err as Error).message ?? '加载分类失败')
  } finally {
    loadingCategories.value = false
  }
}

const categoryDialogVisible = ref(false)
const categoryDialogMode = ref<'create' | 'edit'>('create')
const categoryEditId = ref<string>('')
const categoryForm = ref<CategoryUpsert>({
  moduleType: '',
  name: '',
  parentId: null,
  sortOrder: 0,
  isEnabled: true,
  sourceBookId: null
})

function openCreateCategory(parent?: CategoryTreeNode) {
  categoryDialogMode.value = 'create'
  categoryEditId.value = ''
  categoryForm.value = {
    moduleType: moduleKey.value,
    name: '',
    parentId: parent?.id ?? null,
    sortOrder: 0,
    isEnabled: true,
    sourceBookId: moduleMeta.value.hasSourceBookScope ? (selectedSourceBookId.value || null) : null
  }
  categoryDialogVisible.value = true
}

function openEditCategory(node: CategoryTreeNode) {
  categoryDialogMode.value = 'edit'
  categoryEditId.value = node.id
  categoryForm.value = {
    moduleType: node.moduleType,
    name: node.name,
    parentId: node.parentId,
    sortOrder: node.sortOrder,
    isEnabled: node.isEnabled,
    sourceBookId: node.sourceBookId
  }
  categoryDialogVisible.value = true
}

async function saveCategory() {
  try {
    if (categoryDialogMode.value === 'create') {
      await createCategory(categoryForm.value)
      ElMessage.success('分类已创建')
    } else {
      await updateCategory(categoryEditId.value, categoryForm.value)
      ElMessage.success('分类已更新')
    }
    categoryDialogVisible.value = false
    await refreshCategories()
  } catch (err) {
    ElMessage.error((err as Error).message ?? '保存失败')
  }
}

async function removeCategory(node: CategoryTreeNode) {
  if (node.isBuiltIn) {
    ElMessage.warning('内置分类不可删除')
    return
  }
  try {
    await ElMessageBox.confirm(`删除分类 "${node.name}"?`, '确认', { type: 'warning' })
  } catch { return }
  try {
    await deleteCategory(node.id)
    ElMessage.success('已删除')
    if (selectedCategoryId.value === node.id) selectedCategoryId.value = null
    await refreshCategories()
  } catch (err) {
    ElMessage.error((err as Error).message ?? '删除失败')
  }
}

// --- 数据列表 ---
const items = ref<Record<string, unknown>[]>([])
const loadingItems = ref(false)
const keyword = ref('')

async function refreshItems() {
  loadingItems.value = true
  try {
    items.value = (await activeApi.value.list({
      categoryId: selectedCategoryId.value,
      sourceBookId: moduleMeta.value.hasSourceBookScope ? (selectedSourceBookId.value || null) : null,
      keyword: keyword.value || null
    })) as unknown as Record<string, unknown>[]
  } catch (err) {
    ElMessage.error((err as Error).message ?? '加载列表失败')
  } finally {
    loadingItems.value = false
  }
}

// --- 编辑器 ---
const editorVisible = ref(false)
const editorMode = ref<'create' | 'edit'>('create')
const editorId = ref<string>('')
const editorForm = ref<Record<string, unknown>>({})
const editorTab = ref<string>('')
const saving = ref(false)

function openCreate() {
  editorMode.value = 'create'
  editorId.value = ''
  editorForm.value = buildEmptyForm(moduleKey.value)
  editorForm.value.categoryId = selectedCategoryId.value
  editorForm.value.sourceBookId = moduleMeta.value.hasSourceBookScope ? (selectedSourceBookId.value || null) : null
  editorTab.value = schema.value.tabs[0]?.key ?? ''
  editorVisible.value = true
}

async function openEdit(row: Record<string, unknown>) {
  editorMode.value = 'edit'
  editorId.value = row.id as string
  try {
    const detail = (await activeApi.value.get(row.id as string)) as unknown as Record<string, unknown>
    editorForm.value = { ...buildEmptyForm(moduleKey.value), ...detail }
    editorTab.value = schema.value.tabs[0]?.key ?? ''
    editorVisible.value = true
  } catch (err) {
    ElMessage.error((err as Error).message ?? '加载详情失败')
  }
}

async function saveEditor() {
  if (!editorForm.value.name) {
    ElMessage.warning('名称必填')
    return
  }
  saving.value = true
  try {
    if (editorMode.value === 'create') {
      await activeApi.value.create(editorForm.value as never)
      ElMessage.success('已创建')
    } else {
      await activeApi.value.update(editorId.value, editorForm.value as never)
      ElMessage.success('已更新')
    }
    editorVisible.value = false
    await refreshItems()
    await refreshCategories() // 刷新计数
  } catch (err) {
    ElMessage.error((err as Error).message ?? '保存失败')
  } finally {
    saving.value = false
  }
}

async function removeItem(row: Record<string, unknown>) {
  try {
    await ElMessageBox.confirm(`删除 "${row.name}"?`, '确认', { type: 'warning' })
  } catch { return }
  try {
    await activeApi.value.remove(row.id as string)
    ElMessage.success('已删除')
    await refreshItems()
    await refreshCategories()
  } catch (err) {
    ElMessage.error((err as Error).message ?? '删除失败')
  }
}

// --- 字段渲染辅助 ---
function getField(key: string): FieldDef | undefined {
  for (const f of schema.value.commonFields) if (f.key === key) return f
  for (const t of schema.value.tabs) for (const f of t.fields) if (f.key === key) return f
  return undefined
}

function formatCellValue(row: Record<string, unknown>, col: { key: string }): string {
  const v = row[col.key]
  if (v === null || v === undefined) return '—'
  if (Array.isArray(v)) return v.join('、')
  const s = String(v)
  return s.length > 60 ? s.slice(0, 60) + '…' : s
}

// --- 模块/源书切换 ---
function switchModule(key: DesignModuleKey) {
  router.push({ name: 'design-module', params: { module: key } })
}

watch(moduleKey, async () => {
  selectedCategoryId.value = null
  await refreshCategories()
  await refreshItems()
})

watch(selectedSourceBookId, async () => {
  selectedCategoryId.value = null
  await refreshCategories()
  await refreshItems()
})

watch(selectedCategoryId, refreshItems)

onMounted(async () => {
  await refreshSourceBooks()
  await refreshCategories()
  await refreshItems()
})
</script>

<template>
  <div class="design-view">
    <!-- 顶部模块切换 -->
    <el-card shadow="never" class="header-card">
      <div class="header-row">
        <div class="module-tabs">
          <button
            v-for="m in DESIGN_MODULES"
            :key="m.key"
            :class="['module-tab', { active: m.key === moduleKey }]"
            @click="switchModule(m.key)"
          >
            <span class="icon">{{ m.icon }}</span>
            <span>{{ m.label }}</span>
          </button>
        </div>

        <div v-if="moduleMeta.hasSourceBookScope" class="sourcebook-area">
          <span class="label">源书:</span>
          <el-select
            v-model="selectedSourceBookId"
            placeholder="全部"
            clearable
            size="small"
            style="width: 200px"
          >
            <el-option label="(全局共享)" value="" />
            <el-option
              v-for="sb in sourceBooks"
              :key="sb.id"
              :label="sb.name"
              :value="sb.id"
            />
          </el-select>
          <el-button size="small" :icon="Plus" @click="newSourceBookVisible = true">新建源书</el-button>
        </div>
      </div>
    </el-card>

    <div class="main-layout">
      <!-- 左侧分类树 -->
      <el-card shadow="never" class="tree-panel">
        <template #header>
          <div class="panel-head">
            <span>{{ moduleMeta.label }} · 分类</span>
            <div>
              <el-button text size="small" :icon="Refresh" @click="refreshCategories" />
              <el-button text size="small" :icon="FolderAdd" @click="openCreateCategory()" />
            </div>
          </div>
        </template>

        <div v-loading="loadingCategories" class="tree-body">
          <div
            :class="['cat-item all', { active: !selectedCategoryId }]"
            @click="selectedCategoryId = null"
          >
            <span>全部 / 未分类</span>
          </div>

          <el-tree
            ref="treeRef"
            :data="categoryTree"
            node-key="id"
            :default-expand-all="true"
            :expand-on-click-node="false"
            :highlight-current="true"
            empty-text="暂无分类"
          >
            <template #default="{ node, data }">
              <div
                :class="['cat-node', { active: selectedCategoryId === data.id }]"
                @click.stop="selectedCategoryId = data.id"
              >
                <span class="cat-name">{{ data.name }}</span>
                <el-tag v-if="data.isBuiltIn" size="small" type="info" effect="plain">内置</el-tag>
                <span class="cat-count">{{ data.itemCount }}</span>
                <span class="cat-actions">
                  <el-button text size="small" :icon="Plus" @click.stop="openCreateCategory(data)" />
                  <el-button text size="small" :icon="Edit" @click.stop="openEditCategory(data)" />
                  <el-button v-if="!data.isBuiltIn" text size="small" :icon="Delete" type="danger" @click.stop="removeCategory(data)" />
                </span>
              </div>
            </template>
          </el-tree>
        </div>
      </el-card>

      <!-- 右侧列表 -->
      <el-card shadow="never" class="list-panel">
        <template #header>
          <div class="panel-head">
            <span>{{ moduleMeta.label }} · 数据</span>
            <div class="head-actions">
              <el-input
                v-model="keyword"
                placeholder="名称关键字"
                clearable
                size="small"
                style="width: 200px"
                :prefix-icon="Search"
                @change="refreshItems"
              />
              <el-button size="small" :icon="Refresh" @click="refreshItems" />
              <el-button type="primary" size="small" :icon="Plus" @click="openCreate">新建</el-button>
            </div>
          </div>
        </template>

        <el-table v-loading="loadingItems" :data="items" stripe size="small" @row-dblclick="openEdit">
          <el-table-column prop="name" label="名称" min-width="200" />
          <el-table-column prop="category" label="分类" width="120" />
          <el-table-column
            v-for="col in schema.listColumns ?? []"
            :key="col.key"
            :label="col.label"
            :width="col.width"
          >
            <template #default="{ row }">
              <span>{{ formatCellValue(row, col) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="70">
            <template #default="{ row }">
              <el-tag :type="row.isEnabled ? 'success' : 'info'" size="small">
                {{ row.isEnabled ? '启用' : '禁用' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="更新时间" width="160">
            <template #default="{ row }">
              <span class="muted">{{ new Date(row.updatedAt).toLocaleString() }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="140" align="center" fixed="right">
            <template #default="{ row }">
              <el-button text size="small" :icon="Edit" @click="openEdit(row)">编辑</el-button>
              <el-button text size="small" :icon="Delete" type="danger" @click="removeItem(row)">删除</el-button>
            </template>
          </el-table-column>
          <template #empty>
            <el-empty :description="`暂无数据,点 「新建」 添加 ${moduleMeta.label}`" />
          </template>
        </el-table>
      </el-card>
    </div>

    <!-- 分类编辑对话框 -->
    <el-dialog v-model="categoryDialogVisible" :title="categoryDialogMode === 'create' ? '新建分类' : '编辑分类'" width="460px">
      <el-form :model="categoryForm" label-width="100px" label-position="right">
        <el-form-item label="名称" required>
          <el-input v-model="categoryForm.name" />
        </el-form-item>
        <el-form-item label="父分类">
          <el-input v-model="categoryForm.parentId" placeholder="留空为根分类(暂无 picker)" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="categoryForm.sortOrder" :min="0" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="categoryForm.isEnabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="categoryDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveCategory">保存</el-button>
      </template>
    </el-dialog>

    <!-- 数据编辑器 -->
    <el-dialog
      v-model="editorVisible"
      :title="`${editorMode === 'create' ? '新建' : '编辑'} ${moduleMeta.label}`"
      :width="780"
      :close-on-click-modal="false"
    >
      <el-form :model="editorForm" label-width="130px" label-position="right">
        <!-- 公共字段 -->
        <DesignFormField
          v-for="f in schema.commonFields"
          :key="f.key"
          :field="f"
          v-model="editorForm[f.key]"
        />

        <!-- 分类 / 源书 ID(只读显示) -->
        <el-form-item label="分类">
          <el-tag v-if="editorForm.categoryId" type="info">{{ editorForm.categoryId }}</el-tag>
          <span v-else class="muted">未选择(左侧分类树点击可绑定)</span>
        </el-form-item>
        <el-form-item v-if="moduleMeta.hasSourceBookScope" label="源书 ID">
          <el-tag v-if="editorForm.sourceBookId" type="info">{{ editorForm.sourceBookId }}</el-tag>
          <span v-else class="muted">未选择 — 全局共享</span>
        </el-form-item>

        <!-- Tab 字段 -->
        <el-tabs v-model="editorTab" class="editor-tabs">
          <el-tab-pane
            v-for="t in schema.tabs"
            :key="t.key"
            :name="t.key"
            :label="t.label"
          >
            <DesignFormField
              v-for="f in t.fields"
              :key="f.key"
              :field="f"
              v-model="editorForm[f.key]"
            />
          </el-tab-pane>
        </el-tabs>
      </el-form>

      <template #footer>
        <el-button @click="editorVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveEditor">保存</el-button>
      </template>
    </el-dialog>

    <!-- 快速新建源书 -->
    <el-dialog v-model="newSourceBookVisible" title="新建源书" width="400px">
      <el-form>
        <el-form-item label="名称" required>
          <el-input v-model="newSourceBookName" @keyup.enter="quickCreateSourceBook" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="newSourceBookVisible = false">取消</el-button>
        <el-button type="primary" @click="quickCreateSourceBook">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.design-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: calc(100vh - 92px);
}
.header-card :deep(.el-card__body) {
  padding: 10px 16px;
}
.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}
.module-tabs {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.module-tab {
  border: 1px solid var(--tm-border);
  background: var(--tm-bg-elevated);
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
  color: var(--tm-fg-primary);
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.15s;
}
.module-tab:hover {
  border-color: var(--tm-primary);
}
.module-tab.active {
  background: var(--tm-primary);
  color: #fff;
  border-color: var(--tm-primary);
}
.module-tab .icon {
  font-size: 14px;
}
.sourcebook-area {
  display: flex;
  align-items: center;
  gap: 6px;
}
.sourcebook-area .label {
  font-size: 12px;
  color: var(--tm-fg-secondary);
}
.main-layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 12px;
  flex: 1;
  min-height: 0;
}
.tree-panel,
.list-panel {
  display: flex;
  flex-direction: column;
}
.tree-panel :deep(.el-card__body),
.list-panel :deep(.el-card__body) {
  flex: 1;
  overflow: auto;
}
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 500;
}
.head-actions {
  display: flex;
  gap: 6px;
  align-items: center;
}
.tree-body {
  font-size: 13px;
}
.cat-item.all {
  padding: 6px 10px;
  border-radius: 4px;
  cursor: pointer;
  margin-bottom: 4px;
  color: var(--tm-fg-secondary);
}
.cat-item.all:hover,
.cat-item.all.active {
  background: var(--tm-bg-elevated);
  color: var(--tm-primary);
}
.cat-node {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 2px 0;
  font-size: 13px;
}
.cat-name {
  flex: 1;
  cursor: pointer;
}
.cat-count {
  color: var(--tm-fg-secondary);
  font-size: 12px;
}
.cat-actions {
  visibility: hidden;
  display: flex;
  gap: 0;
}
.cat-node:hover .cat-actions {
  visibility: visible;
}
.cat-node.active .cat-name {
  color: var(--tm-primary);
  font-weight: 500;
}
.muted {
  color: var(--tm-fg-secondary);
  font-size: 12px;
}
.editor-tabs {
  margin-top: 16px;
}
</style>
