import { computed, ref } from 'vue';
const props = defineProps();
const emit = defineEmits();
const value = computed({
    get: () => props.modelValue,
    set: (v) => emit('update:modelValue', v)
});
const previewMarkdown = ref(false);
const markdownHtml = computed(() => {
    const raw = String(value.value ?? '');
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
        .replace(/\n/g, '<br>');
});
function wrapMarkdown(prefix, suffix = prefix) {
    const text = String(value.value ?? '');
    value.value = `${prefix}${text}${suffix}`;
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['field-warning-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['markdown-preview']} */ ;
/** @type {__VLS_StyleScopedClasses['markdown-preview']} */ ;
/** @type {__VLS_StyleScopedClasses['markdown-preview']} */ ;
/** @type {__VLS_StyleScopedClasses['markdown-preview']} */ ;
// CSS variable injection 
// CSS variable injection end 
const __VLS_0 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    label: (__VLS_ctx.field.label),
}));
const __VLS_2 = __VLS_1({
    label: (__VLS_ctx.field.label),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
var __VLS_4 = {};
__VLS_3.slots.default;
if (__VLS_ctx.field.type === 'text') {
    const __VLS_5 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_6 = __VLS_asFunctionalComponent(__VLS_5, new __VLS_5({
        modelValue: __VLS_ctx.value,
        placeholder: (__VLS_ctx.field.placeholder),
    }));
    const __VLS_7 = __VLS_6({
        modelValue: __VLS_ctx.value,
        placeholder: (__VLS_ctx.field.placeholder),
    }, ...__VLS_functionalComponentArgsRest(__VLS_6));
}
else if (__VLS_ctx.field.type === 'textarea') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "markdown-tools" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "markdown-label" },
    });
    const __VLS_9 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_10 = __VLS_asFunctionalComponent(__VLS_9, new __VLS_9({
        ...{ 'onClick': {} },
        text: true,
        size: "small",
    }));
    const __VLS_11 = __VLS_10({
        ...{ 'onClick': {} },
        text: true,
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_10));
    let __VLS_13;
    let __VLS_14;
    let __VLS_15;
    const __VLS_16 = {
        onClick: (...[$event]) => {
            if (!!(__VLS_ctx.field.type === 'text'))
                return;
            if (!(__VLS_ctx.field.type === 'textarea'))
                return;
            __VLS_ctx.wrapMarkdown('## ', '');
        }
    };
    __VLS_12.slots.default;
    var __VLS_12;
    const __VLS_17 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_18 = __VLS_asFunctionalComponent(__VLS_17, new __VLS_17({
        ...{ 'onClick': {} },
        text: true,
        size: "small",
    }));
    const __VLS_19 = __VLS_18({
        ...{ 'onClick': {} },
        text: true,
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_18));
    let __VLS_21;
    let __VLS_22;
    let __VLS_23;
    const __VLS_24 = {
        onClick: (...[$event]) => {
            if (!!(__VLS_ctx.field.type === 'text'))
                return;
            if (!(__VLS_ctx.field.type === 'textarea'))
                return;
            __VLS_ctx.wrapMarkdown('**', '**');
        }
    };
    __VLS_20.slots.default;
    var __VLS_20;
    const __VLS_25 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_26 = __VLS_asFunctionalComponent(__VLS_25, new __VLS_25({
        ...{ 'onClick': {} },
        text: true,
        size: "small",
    }));
    const __VLS_27 = __VLS_26({
        ...{ 'onClick': {} },
        text: true,
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_26));
    let __VLS_29;
    let __VLS_30;
    let __VLS_31;
    const __VLS_32 = {
        onClick: (...[$event]) => {
            if (!!(__VLS_ctx.field.type === 'text'))
                return;
            if (!(__VLS_ctx.field.type === 'textarea'))
                return;
            __VLS_ctx.wrapMarkdown('- ', '');
        }
    };
    __VLS_28.slots.default;
    var __VLS_28;
    const __VLS_33 = {}.ElSwitch;
    /** @type {[typeof __VLS_components.ElSwitch, typeof __VLS_components.elSwitch, ]} */ ;
    // @ts-ignore
    const __VLS_34 = __VLS_asFunctionalComponent(__VLS_33, new __VLS_33({
        modelValue: (__VLS_ctx.previewMarkdown),
        size: "small",
        activeText: "预览",
    }));
    const __VLS_35 = __VLS_34({
        modelValue: (__VLS_ctx.previewMarkdown),
        size: "small",
        activeText: "预览",
    }, ...__VLS_functionalComponentArgsRest(__VLS_34));
    if (!__VLS_ctx.previewMarkdown) {
        const __VLS_37 = {}.ElInput;
        /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
        // @ts-ignore
        const __VLS_38 = __VLS_asFunctionalComponent(__VLS_37, new __VLS_37({
            modelValue: __VLS_ctx.value,
            type: "textarea",
            rows: (__VLS_ctx.field.rows ?? 3),
            placeholder: (__VLS_ctx.field.placeholder),
        }));
        const __VLS_39 = __VLS_38({
            modelValue: __VLS_ctx.value,
            type: "textarea",
            rows: (__VLS_ctx.field.rows ?? 3),
            placeholder: (__VLS_ctx.field.placeholder),
        }, ...__VLS_functionalComponentArgsRest(__VLS_38));
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div)({
            ...{ class: "markdown-preview" },
        });
        __VLS_asFunctionalDirective(__VLS_directives.vHtml)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.markdownHtml) }, null, null);
    }
}
else if (__VLS_ctx.field.type === 'select') {
    const __VLS_41 = {}.ElSelect;
    /** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
    // @ts-ignore
    const __VLS_42 = __VLS_asFunctionalComponent(__VLS_41, new __VLS_41({
        modelValue: __VLS_ctx.value,
        placeholder: (__VLS_ctx.field.placeholder),
        clearable: true,
        filterable: true,
        allowCreate: (!!__VLS_ctx.field.pickerSource),
        defaultFirstOption: true,
        ...{ style: {} },
    }));
    const __VLS_43 = __VLS_42({
        modelValue: __VLS_ctx.value,
        placeholder: (__VLS_ctx.field.placeholder),
        clearable: true,
        filterable: true,
        allowCreate: (!!__VLS_ctx.field.pickerSource),
        defaultFirstOption: true,
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_42));
    __VLS_44.slots.default;
    for (const [o] of __VLS_getVForSourceType((__VLS_ctx.pickerOptions ?? __VLS_ctx.field.options ?? []))) {
        const __VLS_45 = {}.ElOption;
        /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
        // @ts-ignore
        const __VLS_46 = __VLS_asFunctionalComponent(__VLS_45, new __VLS_45({
            key: (o.value),
            label: (o.label),
            value: (o.value),
        }));
        const __VLS_47 = __VLS_46({
            key: (o.value),
            label: (o.label),
            value: (o.value),
        }, ...__VLS_functionalComponentArgsRest(__VLS_46));
    }
    var __VLS_44;
}
else if (__VLS_ctx.field.type === 'number') {
    const __VLS_49 = {}.ElInputNumber;
    /** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
    // @ts-ignore
    const __VLS_50 = __VLS_asFunctionalComponent(__VLS_49, new __VLS_49({
        modelValue: __VLS_ctx.value,
        min: (0),
        controlsPosition: "right",
        ...{ style: {} },
    }));
    const __VLS_51 = __VLS_50({
        modelValue: __VLS_ctx.value,
        min: (0),
        controlsPosition: "right",
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_50));
}
else if (__VLS_ctx.field.type === 'switch') {
    const __VLS_53 = {}.ElSwitch;
    /** @type {[typeof __VLS_components.ElSwitch, typeof __VLS_components.elSwitch, ]} */ ;
    // @ts-ignore
    const __VLS_54 = __VLS_asFunctionalComponent(__VLS_53, new __VLS_53({
        modelValue: __VLS_ctx.value,
    }));
    const __VLS_55 = __VLS_54({
        modelValue: __VLS_ctx.value,
    }, ...__VLS_functionalComponentArgsRest(__VLS_54));
}
else if (__VLS_ctx.field.type === 'tags') {
    const __VLS_57 = {}.ElSelect;
    /** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
    // @ts-ignore
    const __VLS_58 = __VLS_asFunctionalComponent(__VLS_57, new __VLS_57({
        modelValue: __VLS_ctx.value,
        multiple: true,
        filterable: true,
        allowCreate: true,
        defaultFirstOption: true,
        placeholder: (__VLS_ctx.field.placeholder ?? '回车添加'),
        ...{ style: {} },
    }));
    const __VLS_59 = __VLS_58({
        modelValue: __VLS_ctx.value,
        multiple: true,
        filterable: true,
        allowCreate: true,
        defaultFirstOption: true,
        placeholder: (__VLS_ctx.field.placeholder ?? '回车添加'),
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_58));
    __VLS_60.slots.default;
    for (const [o] of __VLS_getVForSourceType((__VLS_ctx.pickerOptions ?? []))) {
        const __VLS_61 = {}.ElOption;
        /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
        // @ts-ignore
        const __VLS_62 = __VLS_asFunctionalComponent(__VLS_61, new __VLS_61({
            key: (o.value),
            label: (o.label),
            value: (o.value),
        }));
        const __VLS_63 = __VLS_62({
            key: (o.value),
            label: (o.label),
            value: (o.value),
        }, ...__VLS_functionalComponentArgsRest(__VLS_62));
    }
    var __VLS_60;
}
else if (__VLS_ctx.field.type === 'date') {
    const __VLS_65 = {}.ElDatePicker;
    /** @type {[typeof __VLS_components.ElDatePicker, typeof __VLS_components.elDatePicker, ]} */ ;
    // @ts-ignore
    const __VLS_66 = __VLS_asFunctionalComponent(__VLS_65, new __VLS_65({
        modelValue: __VLS_ctx.value,
        type: "datetime",
        valueFormat: "YYYY-MM-DDTHH:mm:ss",
        ...{ style: {} },
    }));
    const __VLS_67 = __VLS_66({
        modelValue: __VLS_ctx.value,
        type: "datetime",
        valueFormat: "YYYY-MM-DDTHH:mm:ss",
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_66));
}
if (__VLS_ctx.invalidMessage) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "field-warning" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.invalidMessage);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "field-warning-actions" },
    });
    const __VLS_69 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_70 = __VLS_asFunctionalComponent(__VLS_69, new __VLS_69({
        ...{ 'onClick': {} },
        text: true,
        size: "small",
        type: "warning",
    }));
    const __VLS_71 = __VLS_70({
        ...{ 'onClick': {} },
        text: true,
        size: "small",
        type: "warning",
    }, ...__VLS_functionalComponentArgsRest(__VLS_70));
    let __VLS_73;
    let __VLS_74;
    let __VLS_75;
    const __VLS_76 = {
        onClick: (...[$event]) => {
            if (!(__VLS_ctx.invalidMessage))
                return;
            __VLS_ctx.emit('clearInvalidReferences');
        }
    };
    __VLS_72.slots.default;
    var __VLS_72;
    const __VLS_77 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_78 = __VLS_asFunctionalComponent(__VLS_77, new __VLS_77({
        ...{ 'onClick': {} },
        text: true,
        size: "small",
    }));
    const __VLS_79 = __VLS_78({
        ...{ 'onClick': {} },
        text: true,
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_78));
    let __VLS_81;
    let __VLS_82;
    let __VLS_83;
    const __VLS_84 = {
        onClick: (...[$event]) => {
            if (!(__VLS_ctx.invalidMessage))
                return;
            __VLS_ctx.emit('rematchReferences');
        }
    };
    __VLS_80.slots.default;
    var __VLS_80;
}
if (__VLS_ctx.field.hint) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "field-hint" },
    });
    (__VLS_ctx.field.hint);
}
var __VLS_3;
/** @type {__VLS_StyleScopedClasses['markdown-tools']} */ ;
/** @type {__VLS_StyleScopedClasses['markdown-label']} */ ;
/** @type {__VLS_StyleScopedClasses['markdown-preview']} */ ;
/** @type {__VLS_StyleScopedClasses['field-warning']} */ ;
/** @type {__VLS_StyleScopedClasses['field-warning-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['field-hint']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            emit: emit,
            value: value,
            previewMarkdown: previewMarkdown,
            markdownHtml: markdownHtml,
            wrapMarkdown: wrapMarkdown,
        };
    },
    __typeEmits: {},
    __typeProps: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeEmits: {},
    __typeProps: {},
});
; /* PartiallyEnd: #4569/main.vue */
