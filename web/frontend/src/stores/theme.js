import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
const STORAGE_KEY = 'tm.theme';
function applyTheme(effective) {
    document.documentElement.setAttribute('data-theme', effective);
}
function getSystemPrefer() {
    if (typeof window === 'undefined' || !window.matchMedia) {
        return 'light';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
export const useThemeStore = defineStore('theme', () => {
    const mode = ref('auto');
    const effective = ref('light');
    function init() {
        const saved = localStorage.getItem(STORAGE_KEY);
        mode.value = saved ?? 'auto';
        // 同步当前 effective 值
        effective.value = mode.value === 'auto' ? getSystemPrefer() : mode.value;
        applyTheme(effective.value);
        // 监听系统明暗变化（仅在 auto 模式下生效）
        if (typeof window !== 'undefined' && window.matchMedia) {
            const mq = window.matchMedia('(prefers-color-scheme: dark)');
            mq.addEventListener('change', (e) => {
                if (mode.value === 'auto') {
                    effective.value = e.matches ? 'dark' : 'light';
                    applyTheme(effective.value);
                }
            });
        }
    }
    function setMode(newMode) {
        mode.value = newMode;
    }
    function toggle() {
        if (mode.value === 'auto') {
            mode.value = effective.value === 'dark' ? 'light' : 'dark';
        }
        else {
            mode.value = mode.value === 'dark' ? 'light' : 'dark';
        }
    }
    watch(mode, (v) => {
        localStorage.setItem(STORAGE_KEY, v);
        effective.value = v === 'auto' ? getSystemPrefer() : v;
        applyTheme(effective.value);
    });
    return { mode, effective, init, setMode, toggle };
});
