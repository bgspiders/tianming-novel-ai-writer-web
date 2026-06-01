import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
const props = withDefaults(defineProps(), {
    language: 'markdown',
    height: '100%',
    placeholder: '',
    disabled: false
});
const emit = defineEmits();
const editorRoot = ref(null);
const editorInstance = shallowRef(null);
const monacoModule = shallowRef(null);
const loadFailed = ref(false);
const loadingMonaco = ref(true);
const usingFallback = computed(() => loadFailed.value);
let resizeObserver = null;
const monacoModuleName = 'monaco-editor';
async function setupMonaco() {
    if (!editorRoot.value) {
        return;
    }
    try {
        const monaco = await import(/* @vite-ignore */ monacoModuleName);
        monacoModule.value = monaco;
        const model = monaco.editor.createModel(props.modelValue, props.language);
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
        });
        instance.onDidChangeModelContent(() => {
            const nextValue = instance.getValue();
            if (nextValue !== props.modelValue) {
                emit('update:modelValue', nextValue);
            }
        });
        editorInstance.value = instance;
        resizeObserver = new ResizeObserver(() => {
            instance.layout();
        });
        resizeObserver.observe(editorRoot.value);
        emit('ready');
    }
    catch {
        loadFailed.value = true;
        emit('fallback');
    }
    finally {
        loadingMonaco.value = false;
    }
}
watch(() => props.modelValue, (value) => {
    const instance = editorInstance.value;
    if (!instance)
        return;
    if (instance.getValue() === value)
        return;
    instance.setValue(value);
});
watch(() => props.disabled, (disabled) => {
    editorInstance.value?.updateOptions({ readOnly: disabled });
});
onMounted(() => {
    void setupMonaco();
});
onBeforeUnmount(() => {
    resizeObserver?.disconnect();
    resizeObserver = null;
    const instance = editorInstance.value;
    if (instance) {
        const model = instance.getModel();
        instance.dispose();
        model?.dispose();
    }
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_withDefaultsArg = (function (t) { return t; })({
    language: 'markdown',
    height: '100%',
    placeholder: '',
    disabled: false
});
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "monaco-host" },
    ...{ style: ({ height: __VLS_ctx.height }) },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ref: "editorRoot",
    ...{ class: "monaco-surface" },
});
__VLS_asFunctionalDirective(__VLS_directives.vShow)(null, { ...__VLS_directiveBindingRestFields, value: (!__VLS_ctx.usingFallback) }, null, null);
/** @type {typeof __VLS_ctx.editorRoot} */ ;
if (__VLS_ctx.loadingMonaco && !__VLS_ctx.usingFallback) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "monaco-loading" },
    });
}
if (__VLS_ctx.usingFallback) {
    const __VLS_0 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
        ...{ 'onUpdate:modelValue': {} },
        modelValue: (__VLS_ctx.modelValue),
        type: "textarea",
        resize: "none",
        rows: (20),
        placeholder: (__VLS_ctx.placeholder),
        disabled: (__VLS_ctx.disabled),
        ...{ class: "fallback-textarea" },
    }));
    const __VLS_2 = __VLS_1({
        ...{ 'onUpdate:modelValue': {} },
        modelValue: (__VLS_ctx.modelValue),
        type: "textarea",
        resize: "none",
        rows: (20),
        placeholder: (__VLS_ctx.placeholder),
        disabled: (__VLS_ctx.disabled),
        ...{ class: "fallback-textarea" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    let __VLS_4;
    let __VLS_5;
    let __VLS_6;
    const __VLS_7 = {
        'onUpdate:modelValue': (...[$event]) => {
            if (!(__VLS_ctx.usingFallback))
                return;
            __VLS_ctx.emit('update:modelValue', $event);
        }
    };
    var __VLS_3;
}
/** @type {__VLS_StyleScopedClasses['monaco-host']} */ ;
/** @type {__VLS_StyleScopedClasses['monaco-surface']} */ ;
/** @type {__VLS_StyleScopedClasses['monaco-loading']} */ ;
/** @type {__VLS_StyleScopedClasses['fallback-textarea']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            emit: emit,
            editorRoot: editorRoot,
            loadingMonaco: loadingMonaco,
            usingFallback: usingFallback,
        };
    },
    __typeEmits: {},
    __typeProps: {},
    props: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeEmits: {},
    __typeProps: {},
    props: {},
});
; /* PartiallyEnd: #4569/main.vue */
