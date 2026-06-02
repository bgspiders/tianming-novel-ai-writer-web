import { computed, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Lock, User, Reading, MagicStick } from '@element-plus/icons-vue';
import { useAuthStore } from '@/stores/auth';
const router = useRouter();
const route = useRoute();
const auth = useAuthStore();
const submitting = ref(false);
const form = reactive({
    username: '',
    password: ''
});
const isSetup = computed(() => auth.needsSetup);
const title = computed(() => (isSetup.value ? '初始化管理员' : 'AI生成小说'));
const subtitle = computed(() => (isSetup.value ? '首次安装，请设置本地管理员账号' : '让想象力，成就你的故事'));
const actionText = computed(() => (isSetup.value ? '保存并进入' : '登录'));
async function submit() {
    if (!form.username.trim() || !form.password.trim()) {
        ElMessage.warning('请输入账号和密码。');
        return;
    }
    submitting.value = true;
    try {
        if (isSetup.value) {
            await auth.setup({ username: form.username.trim(), password: form.password });
            ElMessage.success('管理员账号已保存。');
        }
        else {
            await auth.signIn({ username: form.username.trim(), password: form.password });
            ElMessage.success('登录成功。');
        }
        const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
        await router.replace(redirect);
    }
    catch (err) {
        ElMessage.error(err.message || '登录失败。');
    }
    finally {
        submitting.value = false;
    }
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['tower']} */ ;
/** @type {__VLS_StyleScopedClasses['keep']} */ ;
/** @type {__VLS_StyleScopedClasses['login-form']} */ ;
/** @type {__VLS_StyleScopedClasses['login-page']} */ ;
/** @type {__VLS_StyleScopedClasses['login-card']} */ ;
/** @type {__VLS_StyleScopedClasses['castle']} */ ;
/** @type {__VLS_StyleScopedClasses['open-book']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "login-page" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div)({
    ...{ class: "sky-layer sky-layer--one" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div)({
    ...{ class: "sky-layer sky-layer--two" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "castle" },
    'aria-hidden': "true",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span)({
    ...{ class: "tower tower--main" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span)({
    ...{ class: "tower tower--left" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span)({
    ...{ class: "tower tower--right" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span)({
    ...{ class: "keep" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div)({
    ...{ class: "open-book" },
    'aria-hidden': "true",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.main, __VLS_intrinsicElements.main)({
    ...{ class: "login-card" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "brand-mark" },
});
const __VLS_0 = {}.ElIcon;
/** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_3.slots.default;
const __VLS_4 = {}.Reading;
/** @type {[typeof __VLS_components.Reading, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({}));
const __VLS_6 = __VLS_5({}, ...__VLS_functionalComponentArgsRest(__VLS_5));
var __VLS_3;
const __VLS_8 = {}.ElIcon;
/** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    ...{ class: "brand-mark__quill" },
}));
const __VLS_10 = __VLS_9({
    ...{ class: "brand-mark__quill" },
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
__VLS_11.slots.default;
const __VLS_12 = {}.MagicStick;
/** @type {[typeof __VLS_components.MagicStick, ]} */ ;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({}));
const __VLS_14 = __VLS_13({}, ...__VLS_functionalComponentArgsRest(__VLS_13));
var __VLS_11;
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({});
(__VLS_ctx.title);
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
(__VLS_ctx.subtitle);
if (__VLS_ctx.auth.statusError) {
    const __VLS_16 = {}.ElAlert;
    /** @type {[typeof __VLS_components.ElAlert, typeof __VLS_components.elAlert, ]} */ ;
    // @ts-ignore
    const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
        ...{ class: "login-alert" },
        type: "warning",
        title: (__VLS_ctx.auth.statusError),
        showIcon: true,
        closable: (false),
    }));
    const __VLS_18 = __VLS_17({
        ...{ class: "login-alert" },
        type: "warning",
        title: (__VLS_ctx.auth.statusError),
        showIcon: true,
        closable: (false),
    }, ...__VLS_functionalComponentArgsRest(__VLS_17));
}
const __VLS_20 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
    ...{ 'onSubmit': {} },
    ...{ class: "login-form" },
}));
const __VLS_22 = __VLS_21({
    ...{ 'onSubmit': {} },
    ...{ class: "login-form" },
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
let __VLS_24;
let __VLS_25;
let __VLS_26;
const __VLS_27 = {
    onSubmit: (__VLS_ctx.submit)
};
__VLS_23.slots.default;
const __VLS_28 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({}));
const __VLS_30 = __VLS_29({}, ...__VLS_functionalComponentArgsRest(__VLS_29));
__VLS_31.slots.default;
const __VLS_32 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
    ...{ 'onKeyup': {} },
    modelValue: (__VLS_ctx.form.username),
    size: "large",
    prefixIcon: (__VLS_ctx.User),
    placeholder: "账号",
    autocomplete: "username",
}));
const __VLS_34 = __VLS_33({
    ...{ 'onKeyup': {} },
    modelValue: (__VLS_ctx.form.username),
    size: "large",
    prefixIcon: (__VLS_ctx.User),
    placeholder: "账号",
    autocomplete: "username",
}, ...__VLS_functionalComponentArgsRest(__VLS_33));
let __VLS_36;
let __VLS_37;
let __VLS_38;
const __VLS_39 = {
    onKeyup: (__VLS_ctx.submit)
};
var __VLS_35;
var __VLS_31;
const __VLS_40 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({}));
const __VLS_42 = __VLS_41({}, ...__VLS_functionalComponentArgsRest(__VLS_41));
__VLS_43.slots.default;
const __VLS_44 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
    ...{ 'onKeyup': {} },
    modelValue: (__VLS_ctx.form.password),
    size: "large",
    prefixIcon: (__VLS_ctx.Lock),
    type: "password",
    showPassword: true,
    placeholder: "密码",
    autocomplete: "current-password",
}));
const __VLS_46 = __VLS_45({
    ...{ 'onKeyup': {} },
    modelValue: (__VLS_ctx.form.password),
    size: "large",
    prefixIcon: (__VLS_ctx.Lock),
    type: "password",
    showPassword: true,
    placeholder: "密码",
    autocomplete: "current-password",
}, ...__VLS_functionalComponentArgsRest(__VLS_45));
let __VLS_48;
let __VLS_49;
let __VLS_50;
const __VLS_51 = {
    onKeyup: (__VLS_ctx.submit)
};
var __VLS_47;
var __VLS_43;
const __VLS_52 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
    ...{ 'onClick': {} },
    ...{ class: "login-button" },
    type: "primary",
    size: "large",
    loading: (__VLS_ctx.submitting || __VLS_ctx.auth.loading),
}));
const __VLS_54 = __VLS_53({
    ...{ 'onClick': {} },
    ...{ class: "login-button" },
    type: "primary",
    size: "large",
    loading: (__VLS_ctx.submitting || __VLS_ctx.auth.loading),
}, ...__VLS_functionalComponentArgsRest(__VLS_53));
let __VLS_56;
let __VLS_57;
let __VLS_58;
const __VLS_59 = {
    onClick: (__VLS_ctx.submit)
};
__VLS_55.slots.default;
(__VLS_ctx.actionText);
var __VLS_55;
var __VLS_23;
/** @type {__VLS_StyleScopedClasses['login-page']} */ ;
/** @type {__VLS_StyleScopedClasses['sky-layer']} */ ;
/** @type {__VLS_StyleScopedClasses['sky-layer--one']} */ ;
/** @type {__VLS_StyleScopedClasses['sky-layer']} */ ;
/** @type {__VLS_StyleScopedClasses['sky-layer--two']} */ ;
/** @type {__VLS_StyleScopedClasses['castle']} */ ;
/** @type {__VLS_StyleScopedClasses['tower']} */ ;
/** @type {__VLS_StyleScopedClasses['tower--main']} */ ;
/** @type {__VLS_StyleScopedClasses['tower']} */ ;
/** @type {__VLS_StyleScopedClasses['tower--left']} */ ;
/** @type {__VLS_StyleScopedClasses['tower']} */ ;
/** @type {__VLS_StyleScopedClasses['tower--right']} */ ;
/** @type {__VLS_StyleScopedClasses['keep']} */ ;
/** @type {__VLS_StyleScopedClasses['open-book']} */ ;
/** @type {__VLS_StyleScopedClasses['login-card']} */ ;
/** @type {__VLS_StyleScopedClasses['brand-mark']} */ ;
/** @type {__VLS_StyleScopedClasses['brand-mark__quill']} */ ;
/** @type {__VLS_StyleScopedClasses['login-alert']} */ ;
/** @type {__VLS_StyleScopedClasses['login-form']} */ ;
/** @type {__VLS_StyleScopedClasses['login-button']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Lock: Lock,
            User: User,
            Reading: Reading,
            MagicStick: MagicStick,
            auth: auth,
            submitting: submitting,
            form: form,
            title: title,
            subtitle: subtitle,
            actionText: actionText,
            submit: submit,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
