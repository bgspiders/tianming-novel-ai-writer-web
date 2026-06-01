<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: string
    language?: string
    height?: string
    placeholder?: string
    disabled?: boolean
  }>(),
  {
    language: 'markdown',
    height: '100%',
    placeholder: '',
    disabled: false
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'ready'): void
  (e: 'fallback'): void
}>()

const editorRoot = ref<HTMLDivElement | null>(null)
const editorInstance = shallowRef<any | null>(null)
const monacoModule = shallowRef<any | null>(null)
const loadFailed = ref(false)
const loadingMonaco = ref(true)
const usingFallback = computed(() => loadFailed.value)
let resizeObserver: ResizeObserver | null = null
const monacoModuleName = 'monaco-editor'

async function setupMonaco() {
  if (!editorRoot.value) {
    return
  }

  try {
    const monaco = await import(/* @vite-ignore */ monacoModuleName)
    monacoModule.value = monaco

    const model = monaco.editor.createModel(props.modelValue, props.language)
    const instance = monaco.editor.create(editorRoot.value, {
      model,
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      fontSize: 14,
      lineNumbers: 'on',
      wordWrap: 'on',
      wrappingStrategy: 'advanced',
      tabSize: 2,
      readOnly: props.disabled,
      placeholder: props.placeholder
    })

    instance.onDidChangeModelContent(() => {
      const nextValue = instance.getValue()
      if (nextValue !== props.modelValue) {
        emit('update:modelValue', nextValue)
      }
    })

    editorInstance.value = instance
    resizeObserver = new ResizeObserver(() => {
      instance.layout()
    })
    resizeObserver.observe(editorRoot.value)
    emit('ready')
  } catch {
    loadFailed.value = true
    emit('fallback')
  } finally {
    loadingMonaco.value = false
  }
}

watch(
  () => props.modelValue,
  (value) => {
    const instance = editorInstance.value
    if (!instance) return
    if (instance.getValue() === value) return
    instance.setValue(value)
  }
)

watch(
  () => props.disabled,
  (disabled) => {
    editorInstance.value?.updateOptions({ readOnly: disabled })
  }
)

onMounted(() => {
  void setupMonaco()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null

  const instance = editorInstance.value
  if (instance) {
    const model = instance.getModel()
    instance.dispose()
    model?.dispose()
  }
})
</script>

<template>
  <div class="monaco-host" :style="{ height }">
    <div v-show="!usingFallback" ref="editorRoot" class="monaco-surface"></div>
    <div v-if="loadingMonaco && !usingFallback" class="monaco-loading">Loading editor...</div>
    <el-input
      v-if="usingFallback"
      :model-value="modelValue"
      type="textarea"
      resize="none"
      :rows="20"
      :placeholder="placeholder"
      :disabled="disabled"
      class="fallback-textarea"
      @update:model-value="emit('update:modelValue', $event)"
    />
  </div>
</template>

<style scoped>
.monaco-host {
  min-height: 320px;
  width: 100%;
}

.monaco-surface {
  width: 100%;
  height: 100%;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--tm-bg-elevated);
}

.monaco-loading {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  min-height: 320px;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  color: var(--tm-fg-secondary);
  background: var(--tm-bg-elevated);
}

.fallback-textarea :deep(.el-textarea__inner) {
  min-height: 320px !important;
  height: 100%;
  font-family: 'SF Mono', Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  line-height: 1.7;
}
</style>
