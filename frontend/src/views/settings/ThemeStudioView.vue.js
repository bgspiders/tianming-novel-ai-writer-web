import { computed, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useI18n } from '@/composables/useI18n';
import { useThemeStore } from '@/stores/theme';
const themeStore = useThemeStore();
const { t } = useI18n();
const aiSeed = ref('');
const uploading = ref(false);
const presetFilter = ref('all');
const modeOptions = computed(() => [
    { label: t('themeStudio.mode.preset.label'), value: 'preset', hint: t('themeStudio.mode.preset.hint') },
    { label: t('themeStudio.mode.system.label'), value: 'system', hint: t('themeStudio.mode.system.hint') },
    { label: t('themeStudio.mode.schedule.label'), value: 'schedule', hint: t('themeStudio.mode.schedule.hint') }
]);
const themeOptions = computed(() => themeStore.availableThemes.map((item) => ({
    label: item.label,
    value: item.id,
    dark: item.dark
})));
const presetCount = computed(() => themeStore.availableThemes.length);
const filteredPresets = computed(() => themeStore.availableThemes.filter((item) => presetFilter.value === 'all' || item.category === presetFilter.value));
const holidayRows = computed(() => themeStore.holidayCatalog.map((item) => ({
    key: item.key,
    label: item.label,
    value: (themeStore.holiday.themeMap[item.key] ?? 'light')
})));
const currentTokens = computed(() => [
    { label: t('themeStudio.token.primary'), value: themeStore.effectiveTheme.tokens.primary },
    { label: t('themeStudio.token.background'), value: themeStore.effectiveTheme.tokens.bg },
    { label: t('themeStudio.token.surface'), value: themeStore.effectiveTheme.tokens.bgElevated },
    { label: t('themeStudio.token.text'), value: themeStore.effectiveTheme.tokens.fgPrimary },
    { label: t('themeStudio.token.border'), value: themeStore.effectiveTheme.tokens.border },
    { label: t('themeStudio.token.selection'), value: themeStore.effectiveTheme.tokens.selection }
]);
const presetStatCards = computed(() => [
    { label: t('themeStudio.presetStat.total'), value: themeStore.presetStats.total },
    { label: t('themeStudio.presetStat.light'), value: themeStore.presetStats.light },
    { label: t('themeStudio.presetStat.dark'), value: themeStore.presetStats.dark },
    { label: t('themeStudio.presetStat.seasonal'), value: themeStore.presetStats.seasonal },
    { label: t('themeStudio.presetStat.focus'), value: themeStore.presetStats.focus }
]);
function setMode(value) {
    themeStore.setMode(value);
}
function updateHolidayTheme(key, value) {
    themeStore.updateHoliday({
        themeMap: {
            [key]: value
        }
    });
}
async function onUploadImage(event) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file)
        return;
    uploading.value = true;
    try {
        await themeStore.generateThemeFromImage(file);
        ElMessage.success(t('themeStudio.generated.imageGenerated'));
    }
    catch (error) {
        ElMessage.error(error.message ?? t('themeStudio.generated.imageFailed'));
    }
    finally {
        uploading.value = false;
        input.value = '';
    }
}
function generateAiTheme() {
    themeStore.generateAiTheme(aiSeed.value);
    ElMessage.success(t('themeStudio.generated.aiGenerated'));
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['section-head']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['mode-card']} */ ;
/** @type {__VLS_StyleScopedClasses['mode-card']} */ ;
/** @type {__VLS_StyleScopedClasses['preset-card']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['preset-card']} */ ;
/** @type {__VLS_StyleScopedClasses['preset-meta']} */ ;
/** @type {__VLS_StyleScopedClasses['mode-card']} */ ;
/** @type {__VLS_StyleScopedClasses['form-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['switch-line']} */ ;
/** @type {__VLS_StyleScopedClasses['upload-box']} */ ;
/** @type {__VLS_StyleScopedClasses['hero']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['stats-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['mode-list']} */ ;
/** @type {__VLS_StyleScopedClasses['form-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['preset-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['token-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['span-2']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "theme-studio" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "hero tm-panel" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "eyebrow" },
});
(__VLS_ctx.t('themeStudio.eyebrow'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({});
(__VLS_ctx.t('themeStudio.title'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
(__VLS_ctx.t('themeStudio.description'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "hero-card" },
    ...{ style: ({ background: __VLS_ctx.themeStore.effectiveTheme.hero }) },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "hero-card-top" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "tm-chip" },
});
(__VLS_ctx.themeStore.themeLabel);
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "tm-chip" },
});
(__VLS_ctx.t(`themeStudio.source.${__VLS_ctx.themeStore.currentSource}`));
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "tm-chip" },
});
(__VLS_ctx.themeStore.scheduleSummary.basisLabel);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "hero-card-metrics" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "metric-label" },
});
(__VLS_ctx.t('themeStudio.hero.currentTheme'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
(__VLS_ctx.themeStore.effectiveTheme.label);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "metric-label" },
});
(__VLS_ctx.t('themeStudio.hero.nextSwitch'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
(__VLS_ctx.themeStore.nextScheduledThemeAt || __VLS_ctx.t('themeStudio.hero.notScheduled'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "metric-label" },
});
(__VLS_ctx.t('themeStudio.hero.holiday'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
(__VLS_ctx.themeStore.activeHoliday || __VLS_ctx.t('themeStudio.hero.none'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "metric-label" },
});
(__VLS_ctx.t('themeStudio.hero.sunTimes'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
(__VLS_ctx.themeStore.todaySunTimes.sunrise);
(__VLS_ctx.themeStore.todaySunTimes.sunset);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "grid" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "panel tm-panel span-2" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "section-head" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
(__VLS_ctx.t('themeStudio.paletteStats.title'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "muted" },
});
(__VLS_ctx.t('themeStudio.paletteStats.subtitle'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "stats-grid" },
});
for (const [item] of __VLS_getVForSourceType((__VLS_ctx.presetStatCards))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        key: (item.label),
        ...{ class: "stat-card" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (item.value);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (item.label);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "panel tm-panel" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "section-head" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
(__VLS_ctx.t('themeStudio.sections.mode.title'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "muted" },
});
(__VLS_ctx.t('themeStudio.sections.mode.subtitle'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "mode-list" },
});
for (const [option] of __VLS_getVForSourceType((__VLS_ctx.modeOptions))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.setMode(option.value);
            } },
        key: (option.value),
        ...{ class: (['mode-card', { active: __VLS_ctx.themeStore.mode === option.value }]) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (option.label);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (option.hint);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "panel tm-panel" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "section-head" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
(__VLS_ctx.t('themeStudio.sections.systemFollow.title'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "muted" },
});
(__VLS_ctx.t('themeStudio.sections.systemFollow.subtitle', { value: __VLS_ctx.themeStore.systemScheme }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "form-grid" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.t('themeStudio.systemFollow.lightMapping'));
const __VLS_0 = {}.ElSelect;
/** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ 'onUpdate:modelValue': {} },
    modelValue: (__VLS_ctx.themeStore.systemLightThemeId),
}));
const __VLS_2 = __VLS_1({
    ...{ 'onUpdate:modelValue': {} },
    modelValue: (__VLS_ctx.themeStore.systemLightThemeId),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
let __VLS_4;
let __VLS_5;
let __VLS_6;
const __VLS_7 = {
    'onUpdate:modelValue': (...[$event]) => {
        __VLS_ctx.themeStore.setSystemThemePair($event, __VLS_ctx.themeStore.systemDarkThemeId);
    }
};
__VLS_3.slots.default;
for (const [item] of __VLS_getVForSourceType((__VLS_ctx.themeOptions))) {
    const __VLS_8 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
        key: (item.value),
        label: (item.label),
        value: (item.value),
    }));
    const __VLS_10 = __VLS_9({
        key: (item.value),
        label: (item.label),
        value: (item.value),
    }, ...__VLS_functionalComponentArgsRest(__VLS_9));
}
var __VLS_3;
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.t('themeStudio.systemFollow.darkMapping'));
const __VLS_12 = {}.ElSelect;
/** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
    ...{ 'onUpdate:modelValue': {} },
    modelValue: (__VLS_ctx.themeStore.systemDarkThemeId),
}));
const __VLS_14 = __VLS_13({
    ...{ 'onUpdate:modelValue': {} },
    modelValue: (__VLS_ctx.themeStore.systemDarkThemeId),
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
let __VLS_16;
let __VLS_17;
let __VLS_18;
const __VLS_19 = {
    'onUpdate:modelValue': (...[$event]) => {
        __VLS_ctx.themeStore.setSystemThemePair(__VLS_ctx.themeStore.systemLightThemeId, $event);
    }
};
__VLS_15.slots.default;
for (const [item] of __VLS_getVForSourceType((__VLS_ctx.themeOptions))) {
    const __VLS_20 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
        key: (item.value),
        label: (item.label),
        value: (item.value),
    }));
    const __VLS_22 = __VLS_21({
        key: (item.value),
        label: (item.label),
        value: (item.value),
    }, ...__VLS_functionalComponentArgsRest(__VLS_21));
}
var __VLS_15;
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "panel tm-panel span-2" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "section-head" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
(__VLS_ctx.t('themeStudio.sections.presets.title'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "muted" },
});
(__VLS_ctx.t('themeStudio.sections.presets.subtitle', { count: __VLS_ctx.presetCount }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "filter-row" },
});
const __VLS_24 = {}.ElRadioGroup;
/** @type {[typeof __VLS_components.ElRadioGroup, typeof __VLS_components.elRadioGroup, typeof __VLS_components.ElRadioGroup, typeof __VLS_components.elRadioGroup, ]} */ ;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
    modelValue: (__VLS_ctx.presetFilter),
    size: "small",
}));
const __VLS_26 = __VLS_25({
    modelValue: (__VLS_ctx.presetFilter),
    size: "small",
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
__VLS_27.slots.default;
const __VLS_28 = {}.ElRadioButton;
/** @type {[typeof __VLS_components.ElRadioButton, typeof __VLS_components.elRadioButton, typeof __VLS_components.ElRadioButton, typeof __VLS_components.elRadioButton, ]} */ ;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
    label: "all",
}));
const __VLS_30 = __VLS_29({
    label: "all",
}, ...__VLS_functionalComponentArgsRest(__VLS_29));
__VLS_31.slots.default;
(__VLS_ctx.t('themeStudio.presetFilter.all'));
var __VLS_31;
const __VLS_32 = {}.ElRadioButton;
/** @type {[typeof __VLS_components.ElRadioButton, typeof __VLS_components.elRadioButton, typeof __VLS_components.ElRadioButton, typeof __VLS_components.elRadioButton, ]} */ ;
// @ts-ignore
const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
    label: "light",
}));
const __VLS_34 = __VLS_33({
    label: "light",
}, ...__VLS_functionalComponentArgsRest(__VLS_33));
__VLS_35.slots.default;
(__VLS_ctx.t('themeStudio.presetFilter.light'));
var __VLS_35;
const __VLS_36 = {}.ElRadioButton;
/** @type {[typeof __VLS_components.ElRadioButton, typeof __VLS_components.elRadioButton, typeof __VLS_components.ElRadioButton, typeof __VLS_components.elRadioButton, ]} */ ;
// @ts-ignore
const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
    label: "dark",
}));
const __VLS_38 = __VLS_37({
    label: "dark",
}, ...__VLS_functionalComponentArgsRest(__VLS_37));
__VLS_39.slots.default;
(__VLS_ctx.t('themeStudio.presetFilter.dark'));
var __VLS_39;
const __VLS_40 = {}.ElRadioButton;
/** @type {[typeof __VLS_components.ElRadioButton, typeof __VLS_components.elRadioButton, typeof __VLS_components.ElRadioButton, typeof __VLS_components.elRadioButton, ]} */ ;
// @ts-ignore
const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
    label: "seasonal",
}));
const __VLS_42 = __VLS_41({
    label: "seasonal",
}, ...__VLS_functionalComponentArgsRest(__VLS_41));
__VLS_43.slots.default;
(__VLS_ctx.t('themeStudio.presetFilter.seasonal'));
var __VLS_43;
const __VLS_44 = {}.ElRadioButton;
/** @type {[typeof __VLS_components.ElRadioButton, typeof __VLS_components.elRadioButton, typeof __VLS_components.ElRadioButton, typeof __VLS_components.elRadioButton, ]} */ ;
// @ts-ignore
const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
    label: "focus",
}));
const __VLS_46 = __VLS_45({
    label: "focus",
}, ...__VLS_functionalComponentArgsRest(__VLS_45));
__VLS_47.slots.default;
(__VLS_ctx.t('themeStudio.presetFilter.focus'));
var __VLS_47;
var __VLS_27;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "preset-grid" },
});
for (const [preset] of __VLS_getVForSourceType((__VLS_ctx.filteredPresets))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.themeStore.setTheme(preset.id);
            } },
        key: (preset.id),
        ...{ class: (['preset-card', { active: __VLS_ctx.themeStore.currentThemeId === preset.id }]) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "preset-preview" },
        ...{ style: ({ background: preset.hero }) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "preset-meta" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (preset.label);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (preset.description);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "panel tm-panel span-2" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "section-head" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
(__VLS_ctx.t('themeStudio.sections.schedule.title'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "muted" },
});
(__VLS_ctx.t('themeStudio.sections.schedule.subtitle', { value: __VLS_ctx.themeStore.nextScheduledThemeAt || __VLS_ctx.t('themeStudio.schedule.noNextSwitch') }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "schedule-summary" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "tm-chip" },
});
(__VLS_ctx.t('themeStudio.schedule.basis', { value: __VLS_ctx.themeStore.scheduleSummary.basisLabel }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "tm-chip" },
});
(__VLS_ctx.t('themeStudio.schedule.day', { value: __VLS_ctx.themeStore.scheduleSummary.dayStartsAt }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "tm-chip" },
});
(__VLS_ctx.t('themeStudio.schedule.night', { value: __VLS_ctx.themeStore.scheduleSummary.nightStartsAt }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "switch-line" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.t('themeStudio.schedule.enable'));
const __VLS_48 = {}.ElSwitch;
/** @type {[typeof __VLS_components.ElSwitch, typeof __VLS_components.elSwitch, ]} */ ;
// @ts-ignore
const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
    ...{ 'onUpdate:modelValue': {} },
    modelValue: (__VLS_ctx.themeStore.schedule.enabled),
}));
const __VLS_50 = __VLS_49({
    ...{ 'onUpdate:modelValue': {} },
    modelValue: (__VLS_ctx.themeStore.schedule.enabled),
}, ...__VLS_functionalComponentArgsRest(__VLS_49));
let __VLS_52;
let __VLS_53;
let __VLS_54;
const __VLS_55 = {
    'onUpdate:modelValue': (...[$event]) => {
        __VLS_ctx.themeStore.updateSchedule({ enabled: $event });
    }
};
var __VLS_51;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "switch-line" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.t('themeStudio.schedule.useSunTimes'));
const __VLS_56 = {}.ElSwitch;
/** @type {[typeof __VLS_components.ElSwitch, typeof __VLS_components.elSwitch, ]} */ ;
// @ts-ignore
const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
    ...{ 'onUpdate:modelValue': {} },
    modelValue: (__VLS_ctx.themeStore.schedule.basis === 'sun'),
}));
const __VLS_58 = __VLS_57({
    ...{ 'onUpdate:modelValue': {} },
    modelValue: (__VLS_ctx.themeStore.schedule.basis === 'sun'),
}, ...__VLS_functionalComponentArgsRest(__VLS_57));
let __VLS_60;
let __VLS_61;
let __VLS_62;
const __VLS_63 = {
    'onUpdate:modelValue': (...[$event]) => {
        __VLS_ctx.themeStore.updateSchedule({ basis: $event ? 'sun' : 'fixed' });
    }
};
var __VLS_59;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "form-grid" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.t('themeStudio.schedule.dayTheme'));
const __VLS_64 = {}.ElSelect;
/** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
// @ts-ignore
const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
    ...{ 'onUpdate:modelValue': {} },
    modelValue: (__VLS_ctx.themeStore.schedule.dayThemeId),
}));
const __VLS_66 = __VLS_65({
    ...{ 'onUpdate:modelValue': {} },
    modelValue: (__VLS_ctx.themeStore.schedule.dayThemeId),
}, ...__VLS_functionalComponentArgsRest(__VLS_65));
let __VLS_68;
let __VLS_69;
let __VLS_70;
const __VLS_71 = {
    'onUpdate:modelValue': (...[$event]) => {
        __VLS_ctx.themeStore.updateSchedule({ dayThemeId: $event });
    }
};
__VLS_67.slots.default;
for (const [item] of __VLS_getVForSourceType((__VLS_ctx.themeOptions))) {
    const __VLS_72 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
        key: (item.value),
        label: (item.label),
        value: (item.value),
    }));
    const __VLS_74 = __VLS_73({
        key: (item.value),
        label: (item.label),
        value: (item.value),
    }, ...__VLS_functionalComponentArgsRest(__VLS_73));
}
var __VLS_67;
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.t('themeStudio.schedule.nightTheme'));
const __VLS_76 = {}.ElSelect;
/** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
// @ts-ignore
const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({
    ...{ 'onUpdate:modelValue': {} },
    modelValue: (__VLS_ctx.themeStore.schedule.nightThemeId),
}));
const __VLS_78 = __VLS_77({
    ...{ 'onUpdate:modelValue': {} },
    modelValue: (__VLS_ctx.themeStore.schedule.nightThemeId),
}, ...__VLS_functionalComponentArgsRest(__VLS_77));
let __VLS_80;
let __VLS_81;
let __VLS_82;
const __VLS_83 = {
    'onUpdate:modelValue': (...[$event]) => {
        __VLS_ctx.themeStore.updateSchedule({ nightThemeId: $event });
    }
};
__VLS_79.slots.default;
for (const [item] of __VLS_getVForSourceType((__VLS_ctx.themeOptions))) {
    const __VLS_84 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({
        key: (item.value),
        label: (item.label),
        value: (item.value),
    }));
    const __VLS_86 = __VLS_85({
        key: (item.value),
        label: (item.label),
        value: (item.value),
    }, ...__VLS_functionalComponentArgsRest(__VLS_85));
}
var __VLS_79;
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.t('themeStudio.schedule.sunriseAccent'));
const __VLS_88 = {}.ElSelect;
/** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
// @ts-ignore
const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
    ...{ 'onUpdate:modelValue': {} },
    modelValue: (__VLS_ctx.themeStore.schedule.sunriseThemeId),
}));
const __VLS_90 = __VLS_89({
    ...{ 'onUpdate:modelValue': {} },
    modelValue: (__VLS_ctx.themeStore.schedule.sunriseThemeId),
}, ...__VLS_functionalComponentArgsRest(__VLS_89));
let __VLS_92;
let __VLS_93;
let __VLS_94;
const __VLS_95 = {
    'onUpdate:modelValue': (...[$event]) => {
        __VLS_ctx.themeStore.updateSchedule({ sunriseThemeId: $event });
    }
};
__VLS_91.slots.default;
for (const [item] of __VLS_getVForSourceType((__VLS_ctx.themeOptions))) {
    const __VLS_96 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
        key: (item.value),
        label: (item.label),
        value: (item.value),
    }));
    const __VLS_98 = __VLS_97({
        key: (item.value),
        label: (item.label),
        value: (item.value),
    }, ...__VLS_functionalComponentArgsRest(__VLS_97));
}
var __VLS_91;
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.t('themeStudio.schedule.sunsetAccent'));
const __VLS_100 = {}.ElSelect;
/** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
// @ts-ignore
const __VLS_101 = __VLS_asFunctionalComponent(__VLS_100, new __VLS_100({
    ...{ 'onUpdate:modelValue': {} },
    modelValue: (__VLS_ctx.themeStore.schedule.sunsetThemeId),
}));
const __VLS_102 = __VLS_101({
    ...{ 'onUpdate:modelValue': {} },
    modelValue: (__VLS_ctx.themeStore.schedule.sunsetThemeId),
}, ...__VLS_functionalComponentArgsRest(__VLS_101));
let __VLS_104;
let __VLS_105;
let __VLS_106;
const __VLS_107 = {
    'onUpdate:modelValue': (...[$event]) => {
        __VLS_ctx.themeStore.updateSchedule({ sunsetThemeId: $event });
    }
};
__VLS_103.slots.default;
for (const [item] of __VLS_getVForSourceType((__VLS_ctx.themeOptions))) {
    const __VLS_108 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_109 = __VLS_asFunctionalComponent(__VLS_108, new __VLS_108({
        key: (item.value),
        label: (item.label),
        value: (item.value),
    }));
    const __VLS_110 = __VLS_109({
        key: (item.value),
        label: (item.label),
        value: (item.value),
    }, ...__VLS_functionalComponentArgsRest(__VLS_109));
}
var __VLS_103;
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.t('themeStudio.schedule.dayStart'));
const __VLS_112 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_113 = __VLS_asFunctionalComponent(__VLS_112, new __VLS_112({
    ...{ 'onUpdate:modelValue': {} },
    modelValue: (__VLS_ctx.themeStore.schedule.dayStart),
}));
const __VLS_114 = __VLS_113({
    ...{ 'onUpdate:modelValue': {} },
    modelValue: (__VLS_ctx.themeStore.schedule.dayStart),
}, ...__VLS_functionalComponentArgsRest(__VLS_113));
let __VLS_116;
let __VLS_117;
let __VLS_118;
const __VLS_119 = {
    'onUpdate:modelValue': (...[$event]) => {
        __VLS_ctx.themeStore.updateSchedule({ dayStart: $event });
    }
};
var __VLS_115;
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.t('themeStudio.schedule.nightStart'));
const __VLS_120 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_121 = __VLS_asFunctionalComponent(__VLS_120, new __VLS_120({
    ...{ 'onUpdate:modelValue': {} },
    modelValue: (__VLS_ctx.themeStore.schedule.nightStart),
}));
const __VLS_122 = __VLS_121({
    ...{ 'onUpdate:modelValue': {} },
    modelValue: (__VLS_ctx.themeStore.schedule.nightStart),
}, ...__VLS_functionalComponentArgsRest(__VLS_121));
let __VLS_124;
let __VLS_125;
let __VLS_126;
const __VLS_127 = {
    'onUpdate:modelValue': (...[$event]) => {
        __VLS_ctx.themeStore.updateSchedule({ nightStart: $event });
    }
};
var __VLS_123;
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.t('themeStudio.schedule.latitude'));
const __VLS_128 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_129 = __VLS_asFunctionalComponent(__VLS_128, new __VLS_128({
    ...{ 'onUpdate:modelValue': {} },
    modelValue: (__VLS_ctx.themeStore.schedule.latitude),
    step: (0.01),
    min: (-90),
    max: (90),
}));
const __VLS_130 = __VLS_129({
    ...{ 'onUpdate:modelValue': {} },
    modelValue: (__VLS_ctx.themeStore.schedule.latitude),
    step: (0.01),
    min: (-90),
    max: (90),
}, ...__VLS_functionalComponentArgsRest(__VLS_129));
let __VLS_132;
let __VLS_133;
let __VLS_134;
const __VLS_135 = {
    'onUpdate:modelValue': (...[$event]) => {
        __VLS_ctx.themeStore.updateSchedule({ latitude: Number($event ?? 0) });
    }
};
var __VLS_131;
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.t('themeStudio.schedule.longitude'));
const __VLS_136 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_137 = __VLS_asFunctionalComponent(__VLS_136, new __VLS_136({
    ...{ 'onUpdate:modelValue': {} },
    modelValue: (__VLS_ctx.themeStore.schedule.longitude),
    step: (0.01),
    min: (-180),
    max: (180),
}));
const __VLS_138 = __VLS_137({
    ...{ 'onUpdate:modelValue': {} },
    modelValue: (__VLS_ctx.themeStore.schedule.longitude),
    step: (0.01),
    min: (-180),
    max: (180),
}, ...__VLS_functionalComponentArgsRest(__VLS_137));
let __VLS_140;
let __VLS_141;
let __VLS_142;
const __VLS_143 = {
    'onUpdate:modelValue': (...[$event]) => {
        __VLS_ctx.themeStore.updateSchedule({ longitude: Number($event ?? 0) });
    }
};
var __VLS_139;
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "panel tm-panel" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "section-head" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
(__VLS_ctx.t('themeStudio.sections.holidayOverride.title'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "muted" },
});
(__VLS_ctx.t('themeStudio.sections.holidayOverride.subtitle'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "switch-line" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.t('themeStudio.holiday.enableOverride'));
const __VLS_144 = {}.ElSwitch;
/** @type {[typeof __VLS_components.ElSwitch, typeof __VLS_components.elSwitch, ]} */ ;
// @ts-ignore
const __VLS_145 = __VLS_asFunctionalComponent(__VLS_144, new __VLS_144({
    ...{ 'onUpdate:modelValue': {} },
    modelValue: (__VLS_ctx.themeStore.holiday.enabled),
}));
const __VLS_146 = __VLS_145({
    ...{ 'onUpdate:modelValue': {} },
    modelValue: (__VLS_ctx.themeStore.holiday.enabled),
}, ...__VLS_functionalComponentArgsRest(__VLS_145));
let __VLS_148;
let __VLS_149;
let __VLS_150;
const __VLS_151 = {
    'onUpdate:modelValue': (...[$event]) => {
        __VLS_ctx.themeStore.updateHoliday({ enabled: $event });
    }
};
var __VLS_147;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "holiday-list" },
});
for (const [row] of __VLS_getVForSourceType((__VLS_ctx.holidayRows))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        key: (row.key),
        ...{ class: "holiday-row" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (row.label);
    const __VLS_152 = {}.ElSelect;
    /** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
    // @ts-ignore
    const __VLS_153 = __VLS_asFunctionalComponent(__VLS_152, new __VLS_152({
        ...{ 'onUpdate:modelValue': {} },
        modelValue: (row.value),
    }));
    const __VLS_154 = __VLS_153({
        ...{ 'onUpdate:modelValue': {} },
        modelValue: (row.value),
    }, ...__VLS_functionalComponentArgsRest(__VLS_153));
    let __VLS_156;
    let __VLS_157;
    let __VLS_158;
    const __VLS_159 = {
        'onUpdate:modelValue': (...[$event]) => {
            __VLS_ctx.updateHolidayTheme(row.key, $event);
        }
    };
    __VLS_155.slots.default;
    for (const [item] of __VLS_getVForSourceType((__VLS_ctx.themeOptions))) {
        const __VLS_160 = {}.ElOption;
        /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
        // @ts-ignore
        const __VLS_161 = __VLS_asFunctionalComponent(__VLS_160, new __VLS_160({
            key: (item.value),
            label: (item.label),
            value: (item.value),
        }));
        const __VLS_162 = __VLS_161({
            key: (item.value),
            label: (item.label),
            value: (item.value),
        }, ...__VLS_functionalComponentArgsRest(__VLS_161));
    }
    var __VLS_155;
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "panel tm-panel" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "section-head" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
(__VLS_ctx.t('themeStudio.sections.upcomingHolidays.title'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "muted" },
});
(__VLS_ctx.t('themeStudio.sections.upcomingHolidays.subtitle'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "holiday-list" },
});
for (const [item] of __VLS_getVForSourceType((__VLS_ctx.themeStore.upcomingHolidays))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        key: (`${item.key}-${item.date}`),
        ...{ class: "holiday-row" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (item.label);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "muted" },
    });
    (item.date);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "panel tm-panel" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "section-head" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
(__VLS_ctx.t('themeStudio.sections.generatedTheme.title'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "muted" },
});
(__VLS_ctx.t('themeStudio.sections.generatedTheme.subtitle'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "generated-actions" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
    ...{ class: "upload-box" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.t('themeStudio.generated.pickImage'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ onChange: (__VLS_ctx.onUploadImage) },
    type: "file",
    accept: "image/*",
    disabled: (__VLS_ctx.uploading),
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "ai-box" },
});
const __VLS_164 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_165 = __VLS_asFunctionalComponent(__VLS_164, new __VLS_164({
    modelValue: (__VLS_ctx.aiSeed),
    placeholder: (__VLS_ctx.t('themeStudio.generated.seedPlaceholder')),
}));
const __VLS_166 = __VLS_165({
    modelValue: (__VLS_ctx.aiSeed),
    placeholder: (__VLS_ctx.t('themeStudio.generated.seedPlaceholder')),
}, ...__VLS_functionalComponentArgsRest(__VLS_165));
const __VLS_168 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_169 = __VLS_asFunctionalComponent(__VLS_168, new __VLS_168({
    ...{ 'onClick': {} },
    type: "primary",
}));
const __VLS_170 = __VLS_169({
    ...{ 'onClick': {} },
    type: "primary",
}, ...__VLS_functionalComponentArgsRest(__VLS_169));
let __VLS_172;
let __VLS_173;
let __VLS_174;
const __VLS_175 = {
    onClick: (__VLS_ctx.generateAiTheme)
};
__VLS_171.slots.default;
(__VLS_ctx.t('themeStudio.generated.generate'));
var __VLS_171;
if (__VLS_ctx.themeStore.customTheme) {
    const __VLS_176 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_177 = __VLS_asFunctionalComponent(__VLS_176, new __VLS_176({
        ...{ 'onClick': {} },
        text: true,
        type: "danger",
    }));
    const __VLS_178 = __VLS_177({
        ...{ 'onClick': {} },
        text: true,
        type: "danger",
    }, ...__VLS_functionalComponentArgsRest(__VLS_177));
    let __VLS_180;
    let __VLS_181;
    let __VLS_182;
    const __VLS_183 = {
        onClick: (__VLS_ctx.themeStore.clearCustomTheme)
    };
    __VLS_179.slots.default;
    (__VLS_ctx.t('themeStudio.generated.clearCustom'));
    var __VLS_179;
}
if (__VLS_ctx.themeStore.customTheme) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "custom-preview" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "custom-swatch" },
        ...{ style: ({ background: __VLS_ctx.themeStore.customTheme.tokens.primary }) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.themeStore.customTheme.label);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "muted" },
    });
    (__VLS_ctx.themeStore.customTheme.source);
    (__VLS_ctx.themeStore.customTheme.dark ? __VLS_ctx.t('themeStudio.generated.dark') : __VLS_ctx.t('themeStudio.generated.light'));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "panel tm-panel span-2" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "section-head" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
(__VLS_ctx.t('themeStudio.sections.liveTokens.title'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "muted" },
});
(__VLS_ctx.t('themeStudio.sections.liveTokens.subtitle'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "token-grid" },
});
for (const [token] of __VLS_getVForSourceType((__VLS_ctx.currentTokens))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        key: (token.label),
        ...{ class: "token-card" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "token-swatch" },
        ...{ style: ({ background: token.value }) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (token.label);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "muted token-value" },
    });
    (token.value);
}
/** @type {__VLS_StyleScopedClasses['theme-studio']} */ ;
/** @type {__VLS_StyleScopedClasses['hero']} */ ;
/** @type {__VLS_StyleScopedClasses['tm-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['eyebrow']} */ ;
/** @type {__VLS_StyleScopedClasses['hero-card']} */ ;
/** @type {__VLS_StyleScopedClasses['hero-card-top']} */ ;
/** @type {__VLS_StyleScopedClasses['tm-chip']} */ ;
/** @type {__VLS_StyleScopedClasses['tm-chip']} */ ;
/** @type {__VLS_StyleScopedClasses['tm-chip']} */ ;
/** @type {__VLS_StyleScopedClasses['hero-card-metrics']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-label']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-label']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-label']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-label']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
/** @type {__VLS_StyleScopedClasses['tm-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['span-2']} */ ;
/** @type {__VLS_StyleScopedClasses['section-head']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['stats-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
/** @type {__VLS_StyleScopedClasses['tm-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['section-head']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['mode-list']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['mode-card']} */ ;
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
/** @type {__VLS_StyleScopedClasses['tm-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['section-head']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['form-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
/** @type {__VLS_StyleScopedClasses['tm-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['span-2']} */ ;
/** @type {__VLS_StyleScopedClasses['section-head']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['filter-row']} */ ;
/** @type {__VLS_StyleScopedClasses['preset-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['preset-card']} */ ;
/** @type {__VLS_StyleScopedClasses['preset-preview']} */ ;
/** @type {__VLS_StyleScopedClasses['preset-meta']} */ ;
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
/** @type {__VLS_StyleScopedClasses['tm-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['span-2']} */ ;
/** @type {__VLS_StyleScopedClasses['section-head']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['schedule-summary']} */ ;
/** @type {__VLS_StyleScopedClasses['tm-chip']} */ ;
/** @type {__VLS_StyleScopedClasses['tm-chip']} */ ;
/** @type {__VLS_StyleScopedClasses['tm-chip']} */ ;
/** @type {__VLS_StyleScopedClasses['switch-line']} */ ;
/** @type {__VLS_StyleScopedClasses['switch-line']} */ ;
/** @type {__VLS_StyleScopedClasses['form-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
/** @type {__VLS_StyleScopedClasses['tm-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['section-head']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['switch-line']} */ ;
/** @type {__VLS_StyleScopedClasses['holiday-list']} */ ;
/** @type {__VLS_StyleScopedClasses['holiday-row']} */ ;
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
/** @type {__VLS_StyleScopedClasses['tm-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['section-head']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['holiday-list']} */ ;
/** @type {__VLS_StyleScopedClasses['holiday-row']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
/** @type {__VLS_StyleScopedClasses['tm-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['section-head']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['generated-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['upload-box']} */ ;
/** @type {__VLS_StyleScopedClasses['ai-box']} */ ;
/** @type {__VLS_StyleScopedClasses['custom-preview']} */ ;
/** @type {__VLS_StyleScopedClasses['custom-swatch']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
/** @type {__VLS_StyleScopedClasses['tm-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['span-2']} */ ;
/** @type {__VLS_StyleScopedClasses['section-head']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['token-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['token-card']} */ ;
/** @type {__VLS_StyleScopedClasses['token-swatch']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['token-value']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            themeStore: themeStore,
            t: t,
            aiSeed: aiSeed,
            uploading: uploading,
            presetFilter: presetFilter,
            modeOptions: modeOptions,
            themeOptions: themeOptions,
            presetCount: presetCount,
            filteredPresets: filteredPresets,
            holidayRows: holidayRows,
            currentTokens: currentTokens,
            presetStatCards: presetStatCards,
            setMode: setMode,
            updateHolidayTheme: updateHolidayTheme,
            onUploadImage: onUploadImage,
            generateAiTheme: generateAiTheme,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
