import { computed } from 'vue';
const props = defineProps();
const emit = defineEmits();
const value = computed({
    get: () => props.modelValue,
    set: (v) => emit('update:modelValue', v)
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
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
    const __VLS_9 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_10 = __VLS_asFunctionalComponent(__VLS_9, new __VLS_9({
        modelValue: __VLS_ctx.value,
        type: "textarea",
        rows: (__VLS_ctx.field.rows ?? 3),
        placeholder: (__VLS_ctx.field.placeholder),
    }));
    const __VLS_11 = __VLS_10({
        modelValue: __VLS_ctx.value,
        type: "textarea",
        rows: (__VLS_ctx.field.rows ?? 3),
        placeholder: (__VLS_ctx.field.placeholder),
    }, ...__VLS_functionalComponentArgsRest(__VLS_10));
}
else if (__VLS_ctx.field.type === 'select') {
    const __VLS_13 = {}.ElSelect;
    /** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
    // @ts-ignore
    const __VLS_14 = __VLS_asFunctionalComponent(__VLS_13, new __VLS_13({
        modelValue: __VLS_ctx.value,
        placeholder: (__VLS_ctx.field.placeholder),
        clearable: true,
        ...{ style: {} },
    }));
    const __VLS_15 = __VLS_14({
        modelValue: __VLS_ctx.value,
        placeholder: (__VLS_ctx.field.placeholder),
        clearable: true,
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_14));
    __VLS_16.slots.default;
    for (const [o] of __VLS_getVForSourceType((__VLS_ctx.field.options))) {
        const __VLS_17 = {}.ElOption;
        /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
        // @ts-ignore
        const __VLS_18 = __VLS_asFunctionalComponent(__VLS_17, new __VLS_17({
            key: (o.value),
            label: (o.label),
            value: (o.value),
        }));
        const __VLS_19 = __VLS_18({
            key: (o.value),
            label: (o.label),
            value: (o.value),
        }, ...__VLS_functionalComponentArgsRest(__VLS_18));
    }
    var __VLS_16;
}
else if (__VLS_ctx.field.type === 'number') {
    const __VLS_21 = {}.ElInputNumber;
    /** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
    // @ts-ignore
    const __VLS_22 = __VLS_asFunctionalComponent(__VLS_21, new __VLS_21({
        modelValue: __VLS_ctx.value,
        min: (0),
        controlsPosition: "right",
        ...{ style: {} },
    }));
    const __VLS_23 = __VLS_22({
        modelValue: __VLS_ctx.value,
        min: (0),
        controlsPosition: "right",
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_22));
}
else if (__VLS_ctx.field.type === 'switch') {
    const __VLS_25 = {}.ElSwitch;
    /** @type {[typeof __VLS_components.ElSwitch, typeof __VLS_components.elSwitch, ]} */ ;
    // @ts-ignore
    const __VLS_26 = __VLS_asFunctionalComponent(__VLS_25, new __VLS_25({
        modelValue: __VLS_ctx.value,
    }));
    const __VLS_27 = __VLS_26({
        modelValue: __VLS_ctx.value,
    }, ...__VLS_functionalComponentArgsRest(__VLS_26));
}
else if (__VLS_ctx.field.type === 'tags') {
    const __VLS_29 = {}.ElSelect;
    /** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
    // @ts-ignore
    const __VLS_30 = __VLS_asFunctionalComponent(__VLS_29, new __VLS_29({
        modelValue: __VLS_ctx.value,
        multiple: true,
        filterable: true,
        allowCreate: true,
        defaultFirstOption: true,
        placeholder: (__VLS_ctx.field.placeholder ?? '回车添加'),
        ...{ style: {} },
    }));
    const __VLS_31 = __VLS_30({
        modelValue: __VLS_ctx.value,
        multiple: true,
        filterable: true,
        allowCreate: true,
        defaultFirstOption: true,
        placeholder: (__VLS_ctx.field.placeholder ?? '回车添加'),
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_30));
}
else if (__VLS_ctx.field.type === 'date') {
    const __VLS_33 = {}.ElDatePicker;
    /** @type {[typeof __VLS_components.ElDatePicker, typeof __VLS_components.elDatePicker, ]} */ ;
    // @ts-ignore
    const __VLS_34 = __VLS_asFunctionalComponent(__VLS_33, new __VLS_33({
        modelValue: __VLS_ctx.value,
        type: "datetime",
        valueFormat: "YYYY-MM-DDTHH:mm:ss",
        ...{ style: {} },
    }));
    const __VLS_35 = __VLS_34({
        modelValue: __VLS_ctx.value,
        type: "datetime",
        valueFormat: "YYYY-MM-DDTHH:mm:ss",
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_34));
}
if (__VLS_ctx.field.hint) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "field-hint" },
    });
    (__VLS_ctx.field.hint);
}
var __VLS_3;
/** @type {__VLS_StyleScopedClasses['field-hint']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            value: value,
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
