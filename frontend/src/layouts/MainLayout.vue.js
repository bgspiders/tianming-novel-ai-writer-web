import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Bell, ChatDotRound, CircleCheck, Document, Edit, MagicStick, Monitor, Moon, Notebook, Plus, Promotion, Sunny, SwitchButton, UserFilled } from '@element-plus/icons-vue';
import { useI18n } from '@/composables/useI18n';
import { useThemeStore } from '@/stores/theme';
import { useWorkContextStore } from '@/stores/workContext';
import { useAuthStore } from '@/stores/auth';
const route = useRoute();
const router = useRouter();
const themeStore = useThemeStore();
const workContext = useWorkContextStore();
const authStore = useAuthStore();
const { localeStore, t, setLocale } = useI18n();
const activeMenu = computed(() => route.path);
const headerTitle = computed(() => {
    const titleKey = route.meta.titleKey;
    return titleKey ? t(titleKey) : t('app.title');
});
function navigate(index) {
    router.push(index);
}
function cycleTheme() {
    if (themeStore.mode === 'preset') {
        themeStore.setMode('system');
        return;
    }
    if (themeStore.mode === 'system') {
        themeStore.setMode('schedule');
        return;
    }
    themeStore.setMode('preset');
}
const themeIcon = computed(() => {
    if (themeStore.mode === 'system')
        return Monitor;
    if (themeStore.isDark)
        return Moon;
    return Sunny;
});
const themeLabel = computed(() => {
    if (themeStore.mode === 'system')
        return t('layout.followSystem');
    if (themeStore.mode === 'schedule')
        return t('layout.scheduled');
    return themeStore.themeLabel;
});
const sourceLabel = computed(() => t(`layout.source.${themeStore.currentSource}`));
const localeOptions = [
    { label: '中文', value: 'zh-CN' },
    { label: 'English', value: 'en' }
];
const projectDialogVisible = ref(false);
const volumeDialogVisible = ref(false);
const creatingProject = ref(false);
const creatingVolume = ref(false);
const projectForm = reactive({
    name: '',
    description: ''
});
const volumeForm = reactive({
    volumeNumber: 1,
    title: '',
    theme: ''
});
function openProjectDialog() {
    projectForm.name = '';
    projectForm.description = '';
    projectDialogVisible.value = true;
}
function openVolumeDialog() {
    if (!workContext.selectedProjectId) {
        ElMessage.warning(t('layout.messages.selectProjectFirst'));
        return;
    }
    volumeForm.volumeNumber = (workContext.volumes.at(-1)?.volumeNumber ?? 0) + 1;
    volumeForm.title = '';
    volumeForm.theme = '';
    volumeDialogVisible.value = true;
}
async function submitProject() {
    if (!projectForm.name.trim()) {
        ElMessage.warning(t('layout.messages.projectNameRequired'));
        return;
    }
    creatingProject.value = true;
    try {
        await workContext.addProject({
            name: projectForm.name.trim(),
            description: projectForm.description.trim() || null
        });
        projectDialogVisible.value = false;
        ElMessage.success(t('layout.messages.projectCreated'));
    }
    catch (err) {
        ElMessage.error(err.message ?? t('layout.messages.projectCreateFailed'));
    }
    finally {
        creatingProject.value = false;
    }
}
async function submitVolume() {
    if (!volumeForm.title.trim()) {
        ElMessage.warning(t('layout.messages.volumeTitleRequired'));
        return;
    }
    creatingVolume.value = true;
    try {
        await workContext.addVolume({
            volumeNumber: volumeForm.volumeNumber,
            title: volumeForm.title.trim(),
            theme: volumeForm.theme.trim() || null
        });
        volumeDialogVisible.value = false;
        ElMessage.success(t('layout.messages.volumeCreated'));
    }
    catch (err) {
        ElMessage.error(err.message ?? t('layout.messages.volumeCreateFailed'));
    }
    finally {
        creatingVolume.value = false;
    }
}
async function signOut() {
    try {
        await authStore.signOut();
        await router.replace('/login');
    }
    catch (err) {
        ElMessage.error(err.message ?? t('layout.messages.logoutFailed'));
    }
}
onMounted(() => {
    workContext.init();
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['header-right']} */ ;
/** @type {__VLS_StyleScopedClasses['work-context']} */ ;
// CSS variable injection 
// CSS variable injection end 
const __VLS_0 = {}.ElContainer;
/** @type {[typeof __VLS_components.ElContainer, typeof __VLS_components.elContainer, typeof __VLS_components.ElContainer, typeof __VLS_components.elContainer, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ class: "layout" },
}));
const __VLS_2 = __VLS_1({
    ...{ class: "layout" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_3.slots.default;
const __VLS_4 = {}.ElAside;
/** @type {[typeof __VLS_components.ElAside, typeof __VLS_components.elAside, typeof __VLS_components.ElAside, typeof __VLS_components.elAside, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
    width: "236px",
    ...{ class: "layout-aside" },
}));
const __VLS_6 = __VLS_5({
    width: "236px",
    ...{ class: "layout-aside" },
}, ...__VLS_functionalComponentArgsRest(__VLS_5));
__VLS_7.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "brand" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "brand-dot" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "brand-copy" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "brand-text" },
});
(__VLS_ctx.t('app.title'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "brand-sub" },
});
(__VLS_ctx.t('layout.stageBadge'));
const __VLS_8 = {}.ElTag;
/** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    size: "small",
    effect: "dark",
    type: "primary",
}));
const __VLS_10 = __VLS_9({
    size: "small",
    effect: "dark",
    type: "primary",
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
__VLS_11.slots.default;
(__VLS_ctx.t('layout.stageTag'));
var __VLS_11;
const __VLS_12 = {}.ElMenu;
/** @type {[typeof __VLS_components.ElMenu, typeof __VLS_components.elMenu, typeof __VLS_components.ElMenu, typeof __VLS_components.elMenu, ]} */ ;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
    ...{ 'onSelect': {} },
    defaultActive: (__VLS_ctx.activeMenu),
    ...{ class: "layout-menu" },
    backgroundColor: "transparent",
    textColor: "var(--tm-fg-secondary)",
    activeTextColor: "var(--tm-primary)",
}));
const __VLS_14 = __VLS_13({
    ...{ 'onSelect': {} },
    defaultActive: (__VLS_ctx.activeMenu),
    ...{ class: "layout-menu" },
    backgroundColor: "transparent",
    textColor: "var(--tm-fg-secondary)",
    activeTextColor: "var(--tm-primary)",
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
let __VLS_16;
let __VLS_17;
let __VLS_18;
const __VLS_19 = {
    onSelect: (__VLS_ctx.navigate)
};
__VLS_15.slots.default;
const __VLS_20 = {}.ElMenuItem;
/** @type {[typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, ]} */ ;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
    index: "/",
}));
const __VLS_22 = __VLS_21({
    index: "/",
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
__VLS_23.slots.default;
const __VLS_24 = {}.ElIcon;
/** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({}));
const __VLS_26 = __VLS_25({}, ...__VLS_functionalComponentArgsRest(__VLS_25));
__VLS_27.slots.default;
const __VLS_28 = {}.Promotion;
/** @type {[typeof __VLS_components.Promotion, ]} */ ;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({}));
const __VLS_30 = __VLS_29({}, ...__VLS_functionalComponentArgsRest(__VLS_29));
var __VLS_27;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.t('routes.home'));
var __VLS_23;
const __VLS_32 = {}.ElMenuItem;
/** @type {[typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, ]} */ ;
// @ts-ignore
const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
    index: "/settings/ai-models",
}));
const __VLS_34 = __VLS_33({
    index: "/settings/ai-models",
}, ...__VLS_functionalComponentArgsRest(__VLS_33));
__VLS_35.slots.default;
const __VLS_36 = {}.ElIcon;
/** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
// @ts-ignore
const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({}));
const __VLS_38 = __VLS_37({}, ...__VLS_functionalComponentArgsRest(__VLS_37));
__VLS_39.slots.default;
const __VLS_40 = {}.MagicStick;
/** @type {[typeof __VLS_components.MagicStick, ]} */ ;
// @ts-ignore
const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({}));
const __VLS_42 = __VLS_41({}, ...__VLS_functionalComponentArgsRest(__VLS_41));
var __VLS_39;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.t('routes.aiModels'));
var __VLS_35;
const __VLS_44 = {}.ElMenuItem;
/** @type {[typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, ]} */ ;
// @ts-ignore
const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
    index: "/settings/themes",
}));
const __VLS_46 = __VLS_45({
    index: "/settings/themes",
}, ...__VLS_functionalComponentArgsRest(__VLS_45));
__VLS_47.slots.default;
const __VLS_48 = {}.ElIcon;
/** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
// @ts-ignore
const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({}));
const __VLS_50 = __VLS_49({}, ...__VLS_functionalComponentArgsRest(__VLS_49));
__VLS_51.slots.default;
const __VLS_52 = {}.Sunny;
/** @type {[typeof __VLS_components.Sunny, ]} */ ;
// @ts-ignore
const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({}));
const __VLS_54 = __VLS_53({}, ...__VLS_functionalComponentArgsRest(__VLS_53));
var __VLS_51;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.t('routes.themeStudio'));
var __VLS_47;
const __VLS_56 = {}.ElMenuItem;
/** @type {[typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, ]} */ ;
// @ts-ignore
const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
    index: "/settings/notifications",
}));
const __VLS_58 = __VLS_57({
    index: "/settings/notifications",
}, ...__VLS_functionalComponentArgsRest(__VLS_57));
__VLS_59.slots.default;
const __VLS_60 = {}.ElIcon;
/** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
// @ts-ignore
const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({}));
const __VLS_62 = __VLS_61({}, ...__VLS_functionalComponentArgsRest(__VLS_61));
__VLS_63.slots.default;
const __VLS_64 = {}.Bell;
/** @type {[typeof __VLS_components.Bell, ]} */ ;
// @ts-ignore
const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({}));
const __VLS_66 = __VLS_65({}, ...__VLS_functionalComponentArgsRest(__VLS_65));
var __VLS_63;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.t('routes.notificationCenter'));
var __VLS_59;
const __VLS_68 = {}.ElMenuItem;
/** @type {[typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, ]} */ ;
// @ts-ignore
const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
    index: "/editor/chapters",
}));
const __VLS_70 = __VLS_69({
    index: "/editor/chapters",
}, ...__VLS_functionalComponentArgsRest(__VLS_69));
__VLS_71.slots.default;
const __VLS_72 = {}.ElIcon;
/** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
// @ts-ignore
const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({}));
const __VLS_74 = __VLS_73({}, ...__VLS_functionalComponentArgsRest(__VLS_73));
__VLS_75.slots.default;
const __VLS_76 = {}.Document;
/** @type {[typeof __VLS_components.Document, ]} */ ;
// @ts-ignore
const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({}));
const __VLS_78 = __VLS_77({}, ...__VLS_functionalComponentArgsRest(__VLS_77));
var __VLS_75;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.t('routes.chapterEditor'));
var __VLS_71;
const __VLS_80 = {}.ElSubMenu;
/** @type {[typeof __VLS_components.ElSubMenu, typeof __VLS_components.elSubMenu, typeof __VLS_components.ElSubMenu, typeof __VLS_components.elSubMenu, ]} */ ;
// @ts-ignore
const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
    index: "design",
}));
const __VLS_82 = __VLS_81({
    index: "design",
}, ...__VLS_functionalComponentArgsRest(__VLS_81));
__VLS_83.slots.default;
{
    const { title: __VLS_thisSlot } = __VLS_83.slots;
    const __VLS_84 = {}.ElIcon;
    /** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
    // @ts-ignore
    const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({}));
    const __VLS_86 = __VLS_85({}, ...__VLS_functionalComponentArgsRest(__VLS_85));
    __VLS_87.slots.default;
    const __VLS_88 = {}.Edit;
    /** @type {[typeof __VLS_components.Edit, ]} */ ;
    // @ts-ignore
    const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({}));
    const __VLS_90 = __VLS_89({}, ...__VLS_functionalComponentArgsRest(__VLS_89));
    var __VLS_87;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.t('routes.designModules'));
}
const __VLS_92 = {}.ElMenuItem;
/** @type {[typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, ]} */ ;
// @ts-ignore
const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({
    index: "/design/world_rules",
}));
const __VLS_94 = __VLS_93({
    index: "/design/world_rules",
}, ...__VLS_functionalComponentArgsRest(__VLS_93));
__VLS_95.slots.default;
(__VLS_ctx.t('layout.menu.worldRules'));
var __VLS_95;
const __VLS_96 = {}.ElMenuItem;
/** @type {[typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, ]} */ ;
// @ts-ignore
const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
    index: "/design/character_rules",
}));
const __VLS_98 = __VLS_97({
    index: "/design/character_rules",
}, ...__VLS_functionalComponentArgsRest(__VLS_97));
__VLS_99.slots.default;
(__VLS_ctx.t('layout.menu.characterRules'));
var __VLS_99;
const __VLS_100 = {}.ElMenuItem;
/** @type {[typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, ]} */ ;
// @ts-ignore
const __VLS_101 = __VLS_asFunctionalComponent(__VLS_100, new __VLS_100({
    index: "/design/faction_rules",
}));
const __VLS_102 = __VLS_101({
    index: "/design/faction_rules",
}, ...__VLS_functionalComponentArgsRest(__VLS_101));
__VLS_103.slots.default;
(__VLS_ctx.t('layout.menu.factionRules'));
var __VLS_103;
const __VLS_104 = {}.ElMenuItem;
/** @type {[typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, ]} */ ;
// @ts-ignore
const __VLS_105 = __VLS_asFunctionalComponent(__VLS_104, new __VLS_104({
    index: "/design/location_rules",
}));
const __VLS_106 = __VLS_105({
    index: "/design/location_rules",
}, ...__VLS_functionalComponentArgsRest(__VLS_105));
__VLS_107.slots.default;
(__VLS_ctx.t('layout.menu.locationRules'));
var __VLS_107;
const __VLS_108 = {}.ElMenuItem;
/** @type {[typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, ]} */ ;
// @ts-ignore
const __VLS_109 = __VLS_asFunctionalComponent(__VLS_108, new __VLS_108({
    index: "/design/plot_rules",
}));
const __VLS_110 = __VLS_109({
    index: "/design/plot_rules",
}, ...__VLS_functionalComponentArgsRest(__VLS_109));
__VLS_111.slots.default;
(__VLS_ctx.t('layout.menu.plotRules'));
var __VLS_111;
const __VLS_112 = {}.ElMenuItem;
/** @type {[typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, ]} */ ;
// @ts-ignore
const __VLS_113 = __VLS_asFunctionalComponent(__VLS_112, new __VLS_112({
    index: "/design/creative_materials",
}));
const __VLS_114 = __VLS_113({
    index: "/design/creative_materials",
}, ...__VLS_functionalComponentArgsRest(__VLS_113));
__VLS_115.slots.default;
(__VLS_ctx.t('layout.menu.creativeMaterials'));
var __VLS_115;
const __VLS_116 = {}.ElMenuItem;
/** @type {[typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, ]} */ ;
// @ts-ignore
const __VLS_117 = __VLS_asFunctionalComponent(__VLS_116, new __VLS_116({
    index: "/design/book_analyses",
}));
const __VLS_118 = __VLS_117({
    index: "/design/book_analyses",
}, ...__VLS_functionalComponentArgsRest(__VLS_117));
__VLS_119.slots.default;
(__VLS_ctx.t('layout.menu.bookAnalyses'));
var __VLS_119;
const __VLS_120 = {}.ElMenuItem;
/** @type {[typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, ]} */ ;
// @ts-ignore
const __VLS_121 = __VLS_asFunctionalComponent(__VLS_120, new __VLS_120({
    index: "/design/outlines",
}));
const __VLS_122 = __VLS_121({
    index: "/design/outlines",
}, ...__VLS_functionalComponentArgsRest(__VLS_121));
__VLS_123.slots.default;
(__VLS_ctx.t('layout.menu.outlines'));
var __VLS_123;
const __VLS_124 = {}.ElMenuItem;
/** @type {[typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, ]} */ ;
// @ts-ignore
const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({
    index: "/design/volume_designs",
}));
const __VLS_126 = __VLS_125({
    index: "/design/volume_designs",
}, ...__VLS_functionalComponentArgsRest(__VLS_125));
__VLS_127.slots.default;
(__VLS_ctx.t('layout.menu.volumeDesigns'));
var __VLS_127;
const __VLS_128 = {}.ElMenuItem;
/** @type {[typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, ]} */ ;
// @ts-ignore
const __VLS_129 = __VLS_asFunctionalComponent(__VLS_128, new __VLS_128({
    index: "/design/chapter_plans",
}));
const __VLS_130 = __VLS_129({
    index: "/design/chapter_plans",
}, ...__VLS_functionalComponentArgsRest(__VLS_129));
__VLS_131.slots.default;
(__VLS_ctx.t('layout.menu.chapterPlans'));
var __VLS_131;
const __VLS_132 = {}.ElMenuItem;
/** @type {[typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, ]} */ ;
// @ts-ignore
const __VLS_133 = __VLS_asFunctionalComponent(__VLS_132, new __VLS_132({
    index: "/design/chapter_blueprints",
}));
const __VLS_134 = __VLS_133({
    index: "/design/chapter_blueprints",
}, ...__VLS_functionalComponentArgsRest(__VLS_133));
__VLS_135.slots.default;
(__VLS_ctx.t('layout.menu.chapterBlueprints'));
var __VLS_135;
var __VLS_83;
const __VLS_136 = {}.ElSubMenu;
/** @type {[typeof __VLS_components.ElSubMenu, typeof __VLS_components.elSubMenu, typeof __VLS_components.ElSubMenu, typeof __VLS_components.elSubMenu, ]} */ ;
// @ts-ignore
const __VLS_137 = __VLS_asFunctionalComponent(__VLS_136, new __VLS_136({
    index: "generate",
}));
const __VLS_138 = __VLS_137({
    index: "generate",
}, ...__VLS_functionalComponentArgsRest(__VLS_137));
__VLS_139.slots.default;
{
    const { title: __VLS_thisSlot } = __VLS_139.slots;
    const __VLS_140 = {}.ElIcon;
    /** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
    // @ts-ignore
    const __VLS_141 = __VLS_asFunctionalComponent(__VLS_140, new __VLS_140({}));
    const __VLS_142 = __VLS_141({}, ...__VLS_functionalComponentArgsRest(__VLS_141));
    __VLS_143.slots.default;
    const __VLS_144 = {}.Notebook;
    /** @type {[typeof __VLS_components.Notebook, ]} */ ;
    // @ts-ignore
    const __VLS_145 = __VLS_asFunctionalComponent(__VLS_144, new __VLS_144({}));
    const __VLS_146 = __VLS_145({}, ...__VLS_functionalComponentArgsRest(__VLS_145));
    var __VLS_143;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.t('layout.menu.generate'));
}
const __VLS_148 = {}.ElMenuItem;
/** @type {[typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, ]} */ ;
// @ts-ignore
const __VLS_149 = __VLS_asFunctionalComponent(__VLS_148, new __VLS_148({
    index: "/generate",
}));
const __VLS_150 = __VLS_149({
    index: "/generate",
}, ...__VLS_functionalComponentArgsRest(__VLS_149));
__VLS_151.slots.default;
(__VLS_ctx.t('layout.menu.workbench'));
var __VLS_151;
const __VLS_152 = {}.ElMenuItem;
/** @type {[typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, ]} */ ;
// @ts-ignore
const __VLS_153 = __VLS_asFunctionalComponent(__VLS_152, new __VLS_152({
    index: "/generate/novel-seed",
}));
const __VLS_154 = __VLS_153({
    index: "/generate/novel-seed",
}, ...__VLS_functionalComponentArgsRest(__VLS_153));
__VLS_155.slots.default;
(__VLS_ctx.t('layout.menu.novelSeed'));
var __VLS_155;
const __VLS_156 = {}.ElMenuItem;
/** @type {[typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, ]} */ ;
// @ts-ignore
const __VLS_157 = __VLS_asFunctionalComponent(__VLS_156, new __VLS_156({
    index: "/generate/tianming-protocol",
}));
const __VLS_158 = __VLS_157({
    index: "/generate/tianming-protocol",
}, ...__VLS_functionalComponentArgsRest(__VLS_157));
__VLS_159.slots.default;
(__VLS_ctx.t('layout.menu.tianmingProtocol'));
var __VLS_159;
const __VLS_160 = {}.ElMenuItem;
/** @type {[typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, ]} */ ;
// @ts-ignore
const __VLS_161 = __VLS_asFunctionalComponent(__VLS_160, new __VLS_160({
    index: "/generate/outlines",
}));
const __VLS_162 = __VLS_161({
    index: "/generate/outlines",
}, ...__VLS_functionalComponentArgsRest(__VLS_161));
__VLS_163.slots.default;
(__VLS_ctx.t('layout.menu.outlines'));
var __VLS_163;
const __VLS_164 = {}.ElMenuItem;
/** @type {[typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, ]} */ ;
// @ts-ignore
const __VLS_165 = __VLS_asFunctionalComponent(__VLS_164, new __VLS_164({
    index: "/generate/volume_designs",
}));
const __VLS_166 = __VLS_165({
    index: "/generate/volume_designs",
}, ...__VLS_functionalComponentArgsRest(__VLS_165));
__VLS_167.slots.default;
(__VLS_ctx.t('layout.menu.volumeDesigns'));
var __VLS_167;
const __VLS_168 = {}.ElMenuItem;
/** @type {[typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, ]} */ ;
// @ts-ignore
const __VLS_169 = __VLS_asFunctionalComponent(__VLS_168, new __VLS_168({
    index: "/generate/chapter_plans",
}));
const __VLS_170 = __VLS_169({
    index: "/generate/chapter_plans",
}, ...__VLS_functionalComponentArgsRest(__VLS_169));
__VLS_171.slots.default;
(__VLS_ctx.t('layout.menu.chapterPlans'));
var __VLS_171;
const __VLS_172 = {}.ElMenuItem;
/** @type {[typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, ]} */ ;
// @ts-ignore
const __VLS_173 = __VLS_asFunctionalComponent(__VLS_172, new __VLS_172({
    index: "/generate/chapter_blueprints",
}));
const __VLS_174 = __VLS_173({
    index: "/generate/chapter_blueprints",
}, ...__VLS_functionalComponentArgsRest(__VLS_173));
__VLS_175.slots.default;
(__VLS_ctx.t('layout.menu.chapterBlueprints'));
var __VLS_175;
const __VLS_176 = {}.ElMenuItem;
/** @type {[typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, ]} */ ;
// @ts-ignore
const __VLS_177 = __VLS_asFunctionalComponent(__VLS_176, new __VLS_176({
    index: "/generate/chapters",
}));
const __VLS_178 = __VLS_177({
    index: "/generate/chapters",
}, ...__VLS_functionalComponentArgsRest(__VLS_177));
__VLS_179.slots.default;
(__VLS_ctx.t('layout.menu.chapterDrafts'));
var __VLS_179;
const __VLS_180 = {}.ElMenuItem;
/** @type {[typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, ]} */ ;
// @ts-ignore
const __VLS_181 = __VLS_asFunctionalComponent(__VLS_180, new __VLS_180({
    index: "/generate/gate",
}));
const __VLS_182 = __VLS_181({
    index: "/generate/gate",
}, ...__VLS_functionalComponentArgsRest(__VLS_181));
__VLS_183.slots.default;
(__VLS_ctx.t('layout.menu.generationGate'));
var __VLS_183;
var __VLS_139;
const __VLS_184 = {}.ElMenuItem;
/** @type {[typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, ]} */ ;
// @ts-ignore
const __VLS_185 = __VLS_asFunctionalComponent(__VLS_184, new __VLS_184({
    index: "/editor",
}));
const __VLS_186 = __VLS_185({
    index: "/editor",
}, ...__VLS_functionalComponentArgsRest(__VLS_185));
__VLS_187.slots.default;
const __VLS_188 = {}.ElIcon;
/** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
// @ts-ignore
const __VLS_189 = __VLS_asFunctionalComponent(__VLS_188, new __VLS_188({}));
const __VLS_190 = __VLS_189({}, ...__VLS_functionalComponentArgsRest(__VLS_189));
__VLS_191.slots.default;
const __VLS_192 = {}.Document;
/** @type {[typeof __VLS_components.Document, ]} */ ;
// @ts-ignore
const __VLS_193 = __VLS_asFunctionalComponent(__VLS_192, new __VLS_192({}));
const __VLS_194 = __VLS_193({}, ...__VLS_functionalComponentArgsRest(__VLS_193));
var __VLS_191;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.t('layout.menu.writerEditor'));
var __VLS_187;
const __VLS_196 = {}.ElMenuItem;
/** @type {[typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, ]} */ ;
// @ts-ignore
const __VLS_197 = __VLS_asFunctionalComponent(__VLS_196, new __VLS_196({
    index: "/validate",
}));
const __VLS_198 = __VLS_197({
    index: "/validate",
}, ...__VLS_functionalComponentArgsRest(__VLS_197));
__VLS_199.slots.default;
const __VLS_200 = {}.ElIcon;
/** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
// @ts-ignore
const __VLS_201 = __VLS_asFunctionalComponent(__VLS_200, new __VLS_200({}));
const __VLS_202 = __VLS_201({}, ...__VLS_functionalComponentArgsRest(__VLS_201));
__VLS_203.slots.default;
const __VLS_204 = {}.CircleCheck;
/** @type {[typeof __VLS_components.CircleCheck, ]} */ ;
// @ts-ignore
const __VLS_205 = __VLS_asFunctionalComponent(__VLS_204, new __VLS_204({}));
const __VLS_206 = __VLS_205({}, ...__VLS_functionalComponentArgsRest(__VLS_205));
var __VLS_203;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.t('layout.menu.validation'));
var __VLS_199;
const __VLS_208 = {}.ElMenuItem;
/** @type {[typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, ]} */ ;
// @ts-ignore
const __VLS_209 = __VLS_asFunctionalComponent(__VLS_208, new __VLS_208({
    index: "/ai-assistant",
}));
const __VLS_210 = __VLS_209({
    index: "/ai-assistant",
}, ...__VLS_functionalComponentArgsRest(__VLS_209));
__VLS_211.slots.default;
const __VLS_212 = {}.ElIcon;
/** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
// @ts-ignore
const __VLS_213 = __VLS_asFunctionalComponent(__VLS_212, new __VLS_212({}));
const __VLS_214 = __VLS_213({}, ...__VLS_functionalComponentArgsRest(__VLS_213));
__VLS_215.slots.default;
const __VLS_216 = {}.ChatDotRound;
/** @type {[typeof __VLS_components.ChatDotRound, ]} */ ;
// @ts-ignore
const __VLS_217 = __VLS_asFunctionalComponent(__VLS_216, new __VLS_216({}));
const __VLS_218 = __VLS_217({}, ...__VLS_functionalComponentArgsRest(__VLS_217));
var __VLS_215;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.t('routes.aiAssistant'));
var __VLS_211;
var __VLS_15;
var __VLS_7;
const __VLS_220 = {}.ElContainer;
/** @type {[typeof __VLS_components.ElContainer, typeof __VLS_components.elContainer, typeof __VLS_components.ElContainer, typeof __VLS_components.elContainer, ]} */ ;
// @ts-ignore
const __VLS_221 = __VLS_asFunctionalComponent(__VLS_220, new __VLS_220({}));
const __VLS_222 = __VLS_221({}, ...__VLS_functionalComponentArgsRest(__VLS_221));
__VLS_223.slots.default;
const __VLS_224 = {}.ElHeader;
/** @type {[typeof __VLS_components.ElHeader, typeof __VLS_components.elHeader, typeof __VLS_components.ElHeader, typeof __VLS_components.elHeader, ]} */ ;
// @ts-ignore
const __VLS_225 = __VLS_asFunctionalComponent(__VLS_224, new __VLS_224({
    height: "60px",
    ...{ class: "layout-header" },
}));
const __VLS_226 = __VLS_225({
    height: "60px",
    ...{ class: "layout-header" },
}, ...__VLS_functionalComponentArgsRest(__VLS_225));
__VLS_227.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "header-title" },
});
(__VLS_ctx.headerTitle);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "header-sub" },
});
(__VLS_ctx.t('layout.currentThemeAndSource', { theme: __VLS_ctx.themeStore.effectiveTheme.label, source: __VLS_ctx.sourceLabel }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "header-right" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "work-context" },
});
if (!__VLS_ctx.workContext.projects.length) {
    const __VLS_228 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_229 = __VLS_asFunctionalComponent(__VLS_228, new __VLS_228({
        ...{ 'onClick': {} },
        type: "primary",
        size: "small",
        icon: (__VLS_ctx.Plus),
        ...{ class: "primary-project-entry" },
    }));
    const __VLS_230 = __VLS_229({
        ...{ 'onClick': {} },
        type: "primary",
        size: "small",
        icon: (__VLS_ctx.Plus),
        ...{ class: "primary-project-entry" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_229));
    let __VLS_232;
    let __VLS_233;
    let __VLS_234;
    const __VLS_235 = {
        onClick: (__VLS_ctx.openProjectDialog)
    };
    __VLS_231.slots.default;
    (__VLS_ctx.t('layout.dialogs.newProject'));
    var __VLS_231;
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "context-label" },
});
(__VLS_ctx.t('layout.project'));
const __VLS_236 = {}.ElSelect;
/** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
// @ts-ignore
const __VLS_237 = __VLS_asFunctionalComponent(__VLS_236, new __VLS_236({
    modelValue: (__VLS_ctx.workContext.selectedProjectId),
    loading: (__VLS_ctx.workContext.loadingProjects),
    placeholder: (__VLS_ctx.t('layout.placeholders.selectProject')),
    size: "small",
    filterable: true,
    ...{ style: {} },
}));
const __VLS_238 = __VLS_237({
    modelValue: (__VLS_ctx.workContext.selectedProjectId),
    loading: (__VLS_ctx.workContext.loadingProjects),
    placeholder: (__VLS_ctx.t('layout.placeholders.selectProject')),
    size: "small",
    filterable: true,
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_237));
__VLS_239.slots.default;
for (const [project] of __VLS_getVForSourceType((__VLS_ctx.workContext.projects))) {
    const __VLS_240 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_241 = __VLS_asFunctionalComponent(__VLS_240, new __VLS_240({
        key: (project.id),
        label: (project.name),
        value: (project.id),
    }));
    const __VLS_242 = __VLS_241({
        key: (project.id),
        label: (project.name),
        value: (project.id),
    }, ...__VLS_functionalComponentArgsRest(__VLS_241));
}
var __VLS_239;
const __VLS_244 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_245 = __VLS_asFunctionalComponent(__VLS_244, new __VLS_244({
    ...{ 'onClick': {} },
    size: "small",
    icon: (__VLS_ctx.Plus),
}));
const __VLS_246 = __VLS_245({
    ...{ 'onClick': {} },
    size: "small",
    icon: (__VLS_ctx.Plus),
}, ...__VLS_functionalComponentArgsRest(__VLS_245));
let __VLS_248;
let __VLS_249;
let __VLS_250;
const __VLS_251 = {
    onClick: (__VLS_ctx.openProjectDialog)
};
__VLS_247.slots.default;
(__VLS_ctx.t('layout.dialogs.newProject'));
var __VLS_247;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "context-label" },
});
(__VLS_ctx.t('layout.volume'));
const __VLS_252 = {}.ElSelect;
/** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
// @ts-ignore
const __VLS_253 = __VLS_asFunctionalComponent(__VLS_252, new __VLS_252({
    modelValue: (__VLS_ctx.workContext.selectedVolumeId),
    disabled: (!__VLS_ctx.workContext.selectedProjectId),
    loading: (__VLS_ctx.workContext.loadingVolumes),
    placeholder: (__VLS_ctx.t('layout.placeholders.selectVolume')),
    size: "small",
    filterable: true,
    clearable: true,
    ...{ style: {} },
}));
const __VLS_254 = __VLS_253({
    modelValue: (__VLS_ctx.workContext.selectedVolumeId),
    disabled: (!__VLS_ctx.workContext.selectedProjectId),
    loading: (__VLS_ctx.workContext.loadingVolumes),
    placeholder: (__VLS_ctx.t('layout.placeholders.selectVolume')),
    size: "small",
    filterable: true,
    clearable: true,
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_253));
__VLS_255.slots.default;
for (const [volume] of __VLS_getVForSourceType((__VLS_ctx.workContext.volumes))) {
    const __VLS_256 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_257 = __VLS_asFunctionalComponent(__VLS_256, new __VLS_256({
        key: (volume.id),
        label: (__VLS_ctx.t('layout.volumeOption', { number: volume.volumeNumber, title: volume.title })),
        value: (volume.id),
    }));
    const __VLS_258 = __VLS_257({
        key: (volume.id),
        label: (__VLS_ctx.t('layout.volumeOption', { number: volume.volumeNumber, title: volume.title })),
        value: (volume.id),
    }, ...__VLS_functionalComponentArgsRest(__VLS_257));
}
var __VLS_255;
const __VLS_260 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_261 = __VLS_asFunctionalComponent(__VLS_260, new __VLS_260({
    ...{ 'onClick': {} },
    text: true,
    size: "small",
    icon: (__VLS_ctx.Plus),
}));
const __VLS_262 = __VLS_261({
    ...{ 'onClick': {} },
    text: true,
    size: "small",
    icon: (__VLS_ctx.Plus),
}, ...__VLS_functionalComponentArgsRest(__VLS_261));
let __VLS_264;
let __VLS_265;
let __VLS_266;
const __VLS_267 = {
    onClick: (__VLS_ctx.openVolumeDialog)
};
var __VLS_263;
const __VLS_268 = {}.ElSelect;
/** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
// @ts-ignore
const __VLS_269 = __VLS_asFunctionalComponent(__VLS_268, new __VLS_268({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.localeStore.locale),
    size: "small",
    ...{ style: {} },
}));
const __VLS_270 = __VLS_269({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.localeStore.locale),
    size: "small",
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_269));
let __VLS_272;
let __VLS_273;
let __VLS_274;
const __VLS_275 = {
    onChange: (...[$event]) => {
        __VLS_ctx.setLocale($event);
    }
};
__VLS_271.slots.default;
for (const [option] of __VLS_getVForSourceType((__VLS_ctx.localeOptions))) {
    const __VLS_276 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_277 = __VLS_asFunctionalComponent(__VLS_276, new __VLS_276({
        key: (option.value),
        label: (option.label),
        value: (option.value),
    }));
    const __VLS_278 = __VLS_277({
        key: (option.value),
        label: (option.label),
        value: (option.value),
    }, ...__VLS_functionalComponentArgsRest(__VLS_277));
}
var __VLS_271;
const __VLS_280 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_281 = __VLS_asFunctionalComponent(__VLS_280, new __VLS_280({
    ...{ 'onClick': {} },
    ...{ class: "theme-trigger" },
}));
const __VLS_282 = __VLS_281({
    ...{ 'onClick': {} },
    ...{ class: "theme-trigger" },
}, ...__VLS_functionalComponentArgsRest(__VLS_281));
let __VLS_284;
let __VLS_285;
let __VLS_286;
const __VLS_287 = {
    onClick: (...[$event]) => {
        __VLS_ctx.router.push('/settings/themes');
    }
};
__VLS_283.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "theme-pill" },
    ...{ style: ({ background: __VLS_ctx.themeStore.effectiveTheme.hero }) },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.t('layout.themeStudio'));
var __VLS_283;
const __VLS_288 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_289 = __VLS_asFunctionalComponent(__VLS_288, new __VLS_288({
    ...{ 'onClick': {} },
    text: true,
    size: "small",
}));
const __VLS_290 = __VLS_289({
    ...{ 'onClick': {} },
    text: true,
    size: "small",
}, ...__VLS_functionalComponentArgsRest(__VLS_289));
let __VLS_292;
let __VLS_293;
let __VLS_294;
const __VLS_295 = {
    onClick: (__VLS_ctx.cycleTheme)
};
__VLS_291.slots.default;
const __VLS_296 = {}.ElIcon;
/** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
// @ts-ignore
const __VLS_297 = __VLS_asFunctionalComponent(__VLS_296, new __VLS_296({
    ...{ class: "mr-4" },
}));
const __VLS_298 = __VLS_297({
    ...{ class: "mr-4" },
}, ...__VLS_functionalComponentArgsRest(__VLS_297));
__VLS_299.slots.default;
const __VLS_300 = ((__VLS_ctx.themeIcon));
// @ts-ignore
const __VLS_301 = __VLS_asFunctionalComponent(__VLS_300, new __VLS_300({}));
const __VLS_302 = __VLS_301({}, ...__VLS_functionalComponentArgsRest(__VLS_301));
var __VLS_299;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.themeLabel);
var __VLS_291;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "user-chip" },
});
const __VLS_304 = {}.ElIcon;
/** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
// @ts-ignore
const __VLS_305 = __VLS_asFunctionalComponent(__VLS_304, new __VLS_304({}));
const __VLS_306 = __VLS_305({}, ...__VLS_functionalComponentArgsRest(__VLS_305));
__VLS_307.slots.default;
const __VLS_308 = {}.UserFilled;
/** @type {[typeof __VLS_components.UserFilled, ]} */ ;
// @ts-ignore
const __VLS_309 = __VLS_asFunctionalComponent(__VLS_308, new __VLS_308({}));
const __VLS_310 = __VLS_309({}, ...__VLS_functionalComponentArgsRest(__VLS_309));
var __VLS_307;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.authStore.username || 'Admin');
const __VLS_312 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_313 = __VLS_asFunctionalComponent(__VLS_312, new __VLS_312({
    ...{ 'onClick': {} },
    text: true,
    size: "small",
    icon: (__VLS_ctx.SwitchButton),
}));
const __VLS_314 = __VLS_313({
    ...{ 'onClick': {} },
    text: true,
    size: "small",
    icon: (__VLS_ctx.SwitchButton),
}, ...__VLS_functionalComponentArgsRest(__VLS_313));
let __VLS_316;
let __VLS_317;
let __VLS_318;
const __VLS_319 = {
    onClick: (__VLS_ctx.signOut)
};
__VLS_315.slots.default;
(__VLS_ctx.t('layout.logout'));
var __VLS_315;
var __VLS_227;
const __VLS_320 = {}.ElMain;
/** @type {[typeof __VLS_components.ElMain, typeof __VLS_components.elMain, typeof __VLS_components.ElMain, typeof __VLS_components.elMain, ]} */ ;
// @ts-ignore
const __VLS_321 = __VLS_asFunctionalComponent(__VLS_320, new __VLS_320({
    ...{ class: "layout-main" },
}));
const __VLS_322 = __VLS_321({
    ...{ class: "layout-main" },
}, ...__VLS_functionalComponentArgsRest(__VLS_321));
__VLS_323.slots.default;
const __VLS_324 = {}.RouterView;
/** @type {[typeof __VLS_components.RouterView, ]} */ ;
// @ts-ignore
const __VLS_325 = __VLS_asFunctionalComponent(__VLS_324, new __VLS_324({}));
const __VLS_326 = __VLS_325({}, ...__VLS_functionalComponentArgsRest(__VLS_325));
var __VLS_323;
var __VLS_223;
var __VLS_3;
const __VLS_328 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_329 = __VLS_asFunctionalComponent(__VLS_328, new __VLS_328({
    modelValue: (__VLS_ctx.projectDialogVisible),
    title: (__VLS_ctx.t('layout.dialogs.newProject')),
    width: "420px",
}));
const __VLS_330 = __VLS_329({
    modelValue: (__VLS_ctx.projectDialogVisible),
    title: (__VLS_ctx.t('layout.dialogs.newProject')),
    width: "420px",
}, ...__VLS_functionalComponentArgsRest(__VLS_329));
__VLS_331.slots.default;
const __VLS_332 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_333 = __VLS_asFunctionalComponent(__VLS_332, new __VLS_332({
    model: (__VLS_ctx.projectForm),
    labelWidth: "80px",
}));
const __VLS_334 = __VLS_333({
    model: (__VLS_ctx.projectForm),
    labelWidth: "80px",
}, ...__VLS_functionalComponentArgsRest(__VLS_333));
__VLS_335.slots.default;
const __VLS_336 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_337 = __VLS_asFunctionalComponent(__VLS_336, new __VLS_336({
    label: (__VLS_ctx.t('layout.dialogs.name')),
    required: true,
}));
const __VLS_338 = __VLS_337({
    label: (__VLS_ctx.t('layout.dialogs.name')),
    required: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_337));
__VLS_339.slots.default;
const __VLS_340 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_341 = __VLS_asFunctionalComponent(__VLS_340, new __VLS_340({
    ...{ 'onKeyup': {} },
    modelValue: (__VLS_ctx.projectForm.name),
}));
const __VLS_342 = __VLS_341({
    ...{ 'onKeyup': {} },
    modelValue: (__VLS_ctx.projectForm.name),
}, ...__VLS_functionalComponentArgsRest(__VLS_341));
let __VLS_344;
let __VLS_345;
let __VLS_346;
const __VLS_347 = {
    onKeyup: (__VLS_ctx.submitProject)
};
var __VLS_343;
var __VLS_339;
const __VLS_348 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_349 = __VLS_asFunctionalComponent(__VLS_348, new __VLS_348({
    label: (__VLS_ctx.t('layout.dialogs.summary')),
}));
const __VLS_350 = __VLS_349({
    label: (__VLS_ctx.t('layout.dialogs.summary')),
}, ...__VLS_functionalComponentArgsRest(__VLS_349));
__VLS_351.slots.default;
const __VLS_352 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_353 = __VLS_asFunctionalComponent(__VLS_352, new __VLS_352({
    modelValue: (__VLS_ctx.projectForm.description),
    type: "textarea",
    rows: (3),
}));
const __VLS_354 = __VLS_353({
    modelValue: (__VLS_ctx.projectForm.description),
    type: "textarea",
    rows: (3),
}, ...__VLS_functionalComponentArgsRest(__VLS_353));
var __VLS_351;
var __VLS_335;
{
    const { footer: __VLS_thisSlot } = __VLS_331.slots;
    const __VLS_356 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_357 = __VLS_asFunctionalComponent(__VLS_356, new __VLS_356({
        ...{ 'onClick': {} },
    }));
    const __VLS_358 = __VLS_357({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_357));
    let __VLS_360;
    let __VLS_361;
    let __VLS_362;
    const __VLS_363 = {
        onClick: (...[$event]) => {
            __VLS_ctx.projectDialogVisible = false;
        }
    };
    __VLS_359.slots.default;
    (__VLS_ctx.t('layout.dialogs.cancel'));
    var __VLS_359;
    const __VLS_364 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_365 = __VLS_asFunctionalComponent(__VLS_364, new __VLS_364({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.creatingProject),
    }));
    const __VLS_366 = __VLS_365({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.creatingProject),
    }, ...__VLS_functionalComponentArgsRest(__VLS_365));
    let __VLS_368;
    let __VLS_369;
    let __VLS_370;
    const __VLS_371 = {
        onClick: (__VLS_ctx.submitProject)
    };
    __VLS_367.slots.default;
    (__VLS_ctx.t('layout.dialogs.create'));
    var __VLS_367;
}
var __VLS_331;
const __VLS_372 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_373 = __VLS_asFunctionalComponent(__VLS_372, new __VLS_372({
    modelValue: (__VLS_ctx.volumeDialogVisible),
    title: (__VLS_ctx.t('layout.dialogs.newVolume')),
    width: "420px",
}));
const __VLS_374 = __VLS_373({
    modelValue: (__VLS_ctx.volumeDialogVisible),
    title: (__VLS_ctx.t('layout.dialogs.newVolume')),
    width: "420px",
}, ...__VLS_functionalComponentArgsRest(__VLS_373));
__VLS_375.slots.default;
const __VLS_376 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_377 = __VLS_asFunctionalComponent(__VLS_376, new __VLS_376({
    model: (__VLS_ctx.volumeForm),
    labelWidth: "90px",
}));
const __VLS_378 = __VLS_377({
    model: (__VLS_ctx.volumeForm),
    labelWidth: "90px",
}, ...__VLS_functionalComponentArgsRest(__VLS_377));
__VLS_379.slots.default;
const __VLS_380 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_381 = __VLS_asFunctionalComponent(__VLS_380, new __VLS_380({
    label: (__VLS_ctx.t('layout.dialogs.number')),
    required: true,
}));
const __VLS_382 = __VLS_381({
    label: (__VLS_ctx.t('layout.dialogs.number')),
    required: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_381));
__VLS_383.slots.default;
const __VLS_384 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_385 = __VLS_asFunctionalComponent(__VLS_384, new __VLS_384({
    modelValue: (__VLS_ctx.volumeForm.volumeNumber),
    min: (1),
    controlsPosition: "right",
}));
const __VLS_386 = __VLS_385({
    modelValue: (__VLS_ctx.volumeForm.volumeNumber),
    min: (1),
    controlsPosition: "right",
}, ...__VLS_functionalComponentArgsRest(__VLS_385));
var __VLS_383;
const __VLS_388 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_389 = __VLS_asFunctionalComponent(__VLS_388, new __VLS_388({
    label: (__VLS_ctx.t('layout.dialogs.title')),
    required: true,
}));
const __VLS_390 = __VLS_389({
    label: (__VLS_ctx.t('layout.dialogs.title')),
    required: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_389));
__VLS_391.slots.default;
const __VLS_392 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_393 = __VLS_asFunctionalComponent(__VLS_392, new __VLS_392({
    ...{ 'onKeyup': {} },
    modelValue: (__VLS_ctx.volumeForm.title),
}));
const __VLS_394 = __VLS_393({
    ...{ 'onKeyup': {} },
    modelValue: (__VLS_ctx.volumeForm.title),
}, ...__VLS_functionalComponentArgsRest(__VLS_393));
let __VLS_396;
let __VLS_397;
let __VLS_398;
const __VLS_399 = {
    onKeyup: (__VLS_ctx.submitVolume)
};
var __VLS_395;
var __VLS_391;
const __VLS_400 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_401 = __VLS_asFunctionalComponent(__VLS_400, new __VLS_400({
    label: (__VLS_ctx.t('layout.dialogs.theme')),
}));
const __VLS_402 = __VLS_401({
    label: (__VLS_ctx.t('layout.dialogs.theme')),
}, ...__VLS_functionalComponentArgsRest(__VLS_401));
__VLS_403.slots.default;
const __VLS_404 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_405 = __VLS_asFunctionalComponent(__VLS_404, new __VLS_404({
    modelValue: (__VLS_ctx.volumeForm.theme),
    type: "textarea",
    rows: (3),
}));
const __VLS_406 = __VLS_405({
    modelValue: (__VLS_ctx.volumeForm.theme),
    type: "textarea",
    rows: (3),
}, ...__VLS_functionalComponentArgsRest(__VLS_405));
var __VLS_403;
var __VLS_379;
{
    const { footer: __VLS_thisSlot } = __VLS_375.slots;
    const __VLS_408 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_409 = __VLS_asFunctionalComponent(__VLS_408, new __VLS_408({
        ...{ 'onClick': {} },
    }));
    const __VLS_410 = __VLS_409({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_409));
    let __VLS_412;
    let __VLS_413;
    let __VLS_414;
    const __VLS_415 = {
        onClick: (...[$event]) => {
            __VLS_ctx.volumeDialogVisible = false;
        }
    };
    __VLS_411.slots.default;
    (__VLS_ctx.t('layout.dialogs.cancel'));
    var __VLS_411;
    const __VLS_416 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_417 = __VLS_asFunctionalComponent(__VLS_416, new __VLS_416({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.creatingVolume),
    }));
    const __VLS_418 = __VLS_417({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.creatingVolume),
    }, ...__VLS_functionalComponentArgsRest(__VLS_417));
    let __VLS_420;
    let __VLS_421;
    let __VLS_422;
    const __VLS_423 = {
        onClick: (__VLS_ctx.submitVolume)
    };
    __VLS_419.slots.default;
    (__VLS_ctx.t('layout.dialogs.create'));
    var __VLS_419;
}
var __VLS_375;
/** @type {__VLS_StyleScopedClasses['layout']} */ ;
/** @type {__VLS_StyleScopedClasses['layout-aside']} */ ;
/** @type {__VLS_StyleScopedClasses['brand']} */ ;
/** @type {__VLS_StyleScopedClasses['brand-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['brand-copy']} */ ;
/** @type {__VLS_StyleScopedClasses['brand-text']} */ ;
/** @type {__VLS_StyleScopedClasses['brand-sub']} */ ;
/** @type {__VLS_StyleScopedClasses['layout-menu']} */ ;
/** @type {__VLS_StyleScopedClasses['layout-header']} */ ;
/** @type {__VLS_StyleScopedClasses['header-title']} */ ;
/** @type {__VLS_StyleScopedClasses['header-sub']} */ ;
/** @type {__VLS_StyleScopedClasses['header-right']} */ ;
/** @type {__VLS_StyleScopedClasses['work-context']} */ ;
/** @type {__VLS_StyleScopedClasses['primary-project-entry']} */ ;
/** @type {__VLS_StyleScopedClasses['context-label']} */ ;
/** @type {__VLS_StyleScopedClasses['context-label']} */ ;
/** @type {__VLS_StyleScopedClasses['theme-trigger']} */ ;
/** @type {__VLS_StyleScopedClasses['theme-pill']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-4']} */ ;
/** @type {__VLS_StyleScopedClasses['user-chip']} */ ;
/** @type {__VLS_StyleScopedClasses['layout-main']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Bell: Bell,
            ChatDotRound: ChatDotRound,
            CircleCheck: CircleCheck,
            Document: Document,
            Edit: Edit,
            MagicStick: MagicStick,
            Notebook: Notebook,
            Plus: Plus,
            Promotion: Promotion,
            Sunny: Sunny,
            SwitchButton: SwitchButton,
            UserFilled: UserFilled,
            router: router,
            themeStore: themeStore,
            workContext: workContext,
            authStore: authStore,
            localeStore: localeStore,
            t: t,
            setLocale: setLocale,
            activeMenu: activeMenu,
            headerTitle: headerTitle,
            navigate: navigate,
            cycleTheme: cycleTheme,
            themeIcon: themeIcon,
            themeLabel: themeLabel,
            sourceLabel: sourceLabel,
            localeOptions: localeOptions,
            projectDialogVisible: projectDialogVisible,
            volumeDialogVisible: volumeDialogVisible,
            creatingProject: creatingProject,
            creatingVolume: creatingVolume,
            projectForm: projectForm,
            volumeForm: volumeForm,
            openProjectDialog: openProjectDialog,
            openVolumeDialog: openVolumeDialog,
            submitProject: submitProject,
            submitVolume: submitVolume,
            signOut: signOut,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
