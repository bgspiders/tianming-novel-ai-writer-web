<script setup lang="ts">
import type { FieldDef } from './moduleSchemas'
import { computed, ref } from 'vue'

const props = defineProps<{
  field: FieldDef
  modelValue: unknown
  pickerOptions?: { label: string; value: string | number }[]
  invalidMessage?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: unknown): void
  (e: 'clearInvalidReferences'): void
  (e: 'rematchReferences'): void
}>()

const value = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const previewMarkdown = ref(false)

const markdownHtml = computed(() => {
  const raw = String(value.value ?? '')
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^- (.*)$/gm, '<li>$1</li>')
    .replace(/\n/g, '<br>')
})

function wrapMarkdown(prefix: string, suffix = prefix) {
  const text = String(value.value ?? '')
  value.value = `${prefix}${text}${suffix}`
}
</script>

<template>
  <el-form-item :label="field.label">
    <template v-if="field.type === 'text'">
      <el-input v-model="value as string" :placeholder="field.placeholder" />
    </template>

    <template v-else-if="field.type === 'textarea'">
      <div class="markdown-tools">
        <span class="markdown-label">Markdown</span>
        <el-button text size="small" @click="wrapMarkdown('## ', '')">Heading</el-button>
        <el-button text size="small" @click="wrapMarkdown('**', '**')">Bold</el-button>
        <el-button text size="small" @click="wrapMarkdown('- ', '')">List</el-button>
        <el-switch v-model="previewMarkdown" size="small" active-text="Preview" />
      </div>
      <el-input
        v-if="!previewMarkdown"
        v-model="value as string"
        type="textarea"
        :rows="field.rows ?? 3"
        :placeholder="field.placeholder"
      />
      <div v-else class="markdown-preview" v-html="markdownHtml" />
    </template>

    <template v-else-if="field.type === 'select'">
      <el-select
        v-model="value as string"
        :placeholder="field.placeholder"
        clearable
        filterable
        :allow-create="!!field.pickerSource"
        default-first-option
        style="width: 100%"
      >
        <el-option
          v-for="o in pickerOptions ?? field.options ?? []"
          :key="o.value"
          :label="o.label"
          :value="o.value"
        />
      </el-select>
    </template>

    <template v-else-if="field.type === 'number'">
      <el-input-number v-model="value as number" :min="0" controls-position="right" style="width: 100%" />
    </template>

    <template v-else-if="field.type === 'switch'">
      <el-switch v-model="value as boolean" />
    </template>

    <template v-else-if="field.type === 'tags'">
      <el-select
        v-model="value as string[]"
        multiple
        filterable
        allow-create
        default-first-option
        :placeholder="field.placeholder ?? 'Press Enter to add'"
        style="width: 100%"
      >
        <el-option
          v-for="o in pickerOptions ?? []"
          :key="o.value"
          :label="o.label"
          :value="o.value"
        />
      </el-select>
    </template>

    <template v-else-if="field.type === 'date'">
      <el-date-picker
        v-model="value as string | null"
        type="datetime"
        value-format="YYYY-MM-DDTHH:mm:ss"
        style="width: 100%"
      />
    </template>

    <div v-if="invalidMessage" class="field-warning">
      <span>{{ invalidMessage }}</span>
      <span class="field-warning-actions">
        <el-button text size="small" type="warning" @click="emit('clearInvalidReferences')">Clear Invalid</el-button>
        <el-button text size="small" @click="emit('rematchReferences')">Retry Match</el-button>
      </span>
    </div>
    <div v-if="field.hint" class="field-hint">{{ field.hint }}</div>
  </el-form-item>
</template>

<style scoped>
.field-warning {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 8px;
  font-size: 12px;
  color: var(--el-color-warning);
  margin-top: 2px;
}
.field-warning-actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.field-warning-actions :deep(.el-button) {
  height: 20px;
  padding: 0 2px;
}
.field-hint {
  font-size: 12px;
  color: var(--tm-fg-secondary);
  margin-top: 2px;
}
.markdown-tools {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 6px;
}
.markdown-label {
  color: var(--tm-fg-secondary);
  font-size: 12px;
  margin-right: 4px;
}
.markdown-preview {
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  min-height: 96px;
  padding: 8px 11px;
  line-height: 1.65;
  background: var(--tm-bg-elevated);
  white-space: normal;
}
.markdown-preview :deep(h1),
.markdown-preview :deep(h2),
.markdown-preview :deep(h3) {
  margin: 4px 0 8px;
}
.markdown-preview :deep(code) {
  background: var(--el-fill-color-light);
  border-radius: 3px;
  padding: 1px 4px;
}
</style>
