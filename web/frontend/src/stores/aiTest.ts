import { defineStore } from 'pinia'
import { ref } from 'vue'

const FORM_KEY = 'tm.aiTest.form'

export interface AiTestForm {
  endpoint: string
  apiKey: string
  model: string
  prompt: string
  systemPrompt: string
  temperature: number
  maxTokens: number
}

const DEFAULT_FORM: AiTestForm = {
  endpoint: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
  prompt: '用一句话介绍你自己。',
  systemPrompt: '',
  temperature: 0.7,
  maxTokens: 1024
}

export const useAiTestStore = defineStore('aiTest', () => {
  const form = ref<AiTestForm>({ ...DEFAULT_FORM })
  const output = ref<string>('')
  const status = ref<string>('idle')
  const error = ref<string>('')
  const isStreaming = ref<boolean>(false)

  // 上次成功填写过的 endpoint/model（不含 apiKey，apiKey 不持久化）
  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(FORM_KEY)
      if (!raw) return
      const saved = JSON.parse(raw) as Partial<AiTestForm>
      // 不还原 apiKey
      const { apiKey: _apiKey, ...rest } = saved
      form.value = { ...DEFAULT_FORM, ...rest, apiKey: '' }
    } catch {
      // 忽略损坏的本地数据
    }
  }

  function saveToStorage() {
    const { apiKey: _apiKey, ...rest } = form.value
    localStorage.setItem(FORM_KEY, JSON.stringify(rest))
  }

  function appendToken(token: string) {
    output.value += token
  }

  function reset() {
    output.value = ''
    status.value = 'idle'
    error.value = ''
    isStreaming.value = false
  }

  return {
    form,
    output,
    status,
    error,
    isStreaming,
    loadFromStorage,
    saveToStorage,
    appendToken,
    reset
  }
})
