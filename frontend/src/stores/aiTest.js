import { defineStore } from 'pinia';
import { ref } from 'vue';
const FORM_KEY = 'tm.aiTest.form';
const DEFAULT_FORM = {
    configId: '',
    endpoint: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o-mini',
    prompt: 'Introduce yourself in one sentence.',
    systemPrompt: '',
    temperature: 0.7,
    maxTokens: 1024
};
export const useAiTestStore = defineStore('aiTest', () => {
    const form = ref({ ...DEFAULT_FORM });
    const output = ref('');
    const status = ref('idle');
    const error = ref('');
    const isStreaming = ref(false);
    function loadFromStorage() {
        try {
            const raw = localStorage.getItem(FORM_KEY);
            if (!raw) {
                return;
            }
            const saved = JSON.parse(raw);
            const { apiKey: _apiKey, ...rest } = saved;
            form.value = { ...DEFAULT_FORM, ...rest, apiKey: '' };
        }
        catch {
            // Ignore invalid persisted data.
        }
    }
    function saveToStorage() {
        const { apiKey: _apiKey, ...rest } = form.value;
        localStorage.setItem(FORM_KEY, JSON.stringify(rest));
    }
    function appendToken(token) {
        output.value += token;
    }
    function reset() {
        output.value = '';
        status.value = 'idle';
        error.value = '';
        isStreaming.value = false;
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
    };
});
