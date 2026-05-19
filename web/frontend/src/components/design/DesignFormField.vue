<script setup lang="ts">
import type { FieldDef } from './moduleSchemas'
import { computed } from 'vue'

const props = defineProps<{
  field: FieldDef
  modelValue: unknown
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: unknown): void
}>()

const value = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})
</script>

<template>
  <el-form-item :label="field.label">
    <template v-if="field.type === 'text'">
      <el-input v-model="value as string" :placeholder="field.placeholder" />
    </template>

    <template v-else-if="field.type === 'textarea'">
      <el-input
        v-model="value as string"
        type="textarea"
        :rows="field.rows ?? 3"
        :placeholder="field.placeholder"
      />
    </template>

    <template v-else-if="field.type === 'select'">
      <el-select v-model="value as string" :placeholder="field.placeholder" clearable style="width: 100%">
        <el-option v-for="o in field.options" :key="o.value" :label="o.label" :value="o.value" />
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
        :placeholder="field.placeholder ?? '回车添加'"
        style="width: 100%"
      />
    </template>

    <template v-else-if="field.type === 'date'">
      <el-date-picker
        v-model="value as string | null"
        type="datetime"
        value-format="YYYY-MM-DDTHH:mm:ss"
        style="width: 100%"
      />
    </template>

    <div v-if="field.hint" class="field-hint">{{ field.hint }}</div>
  </el-form-item>
</template>

<style scoped>
.field-hint {
  font-size: 12px;
  color: var(--tm-fg-secondary);
  margin-top: 2px;
}
</style>
