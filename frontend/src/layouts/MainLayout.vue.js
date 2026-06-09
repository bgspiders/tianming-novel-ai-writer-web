import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Bell, ChatDotRound, CircleCheck, Delete, Document, Edit, FolderOpened, MagicStick, Monitor, Moon, Notebook, Plus, Promotion, Sunny, SwitchButton, UserFilled } from '@element-plus/icons-vue';
import { useI18n } from '@/composables/useI18n';
import { useThemeStore } from '@/stores/theme';
import { useWorkContextStore } from '@/stores/workContext';
import { useAuthStore } from '@/stores/auth';
import { onboardingGuideSteps } from '@/onboarding/guideSteps';
const route = useRoute();
const router = useRouter();
const themeStore = useThemeStore();
const workContext = useWorkContextStore();
const authStore = useAuthStore();
const { localeStore, t, setLocale } = useI18n();
const activeMenu = computed(() => {
    if (route.path === '/generate/planning'
        || /^\/generate\/(outlines|volume_designs|chapter_plans|chapter_blueprints)/.test(route.path)) {
        return '/generate/planning';
    }
    if (route.path === '/generate/gate') {
        return '/generate/tracking';
    }
    return route.path;
});
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
const projectManagerVisible = ref(false);
const volumeDialogVisible = ref(false);
const creatingProject = ref(false);
const deletingProjectId = ref('');
const creatingVolume = ref(false);
const guideVisible = ref(false);
const guideCurrent = ref(0);
const minSidebarWidth = 188;
const maxSidebarWidth = 420;
const sidebarWidth = ref(readSidebarWidth());
const isSidebarResizing = ref(false);
let sidebarPointerMoveHandler = null;
let sidebarPointerUpHandler = null;
const sidebarStyle = computed(() => ({
    width: `${sidebarWidth.value}px`,
    flex: `0 0 ${sidebarWidth.value}px`
}));
const projectForm = reactive({
    name: '',
    description: ''
});
const volumeForm = reactive({
    volumeNumber: 1,
    title: '',
    theme: ''
});
function clampSidebarWidth(width) {
    return Math.min(maxSidebarWidth, Math.max(minSidebarWidth, Math.round(width)));
}
function readSidebarWidth() {
    const storedWidth = Number(localStorage.getItem('tm.sidebar.width'));
    return Number.isFinite(storedWidth) && storedWidth > 0 ? clampSidebarWidth(storedWidth) : 236;
}
function saveSidebarWidth() {
    localStorage.setItem('tm.sidebar.width', String(sidebarWidth.value));
}
function openProjectDialog() {
    projectForm.name = '';
    projectForm.description = '';
    projectDialogVisible.value = true;
}
function openProjectManager() {
    projectManagerVisible.value = true;
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
async function deleteManagedProject(projectId) {
    const project = workContext.projects.find((p) => p.id === projectId);
    if (!project)
        return;
    deletingProjectId.value = projectId;
    try {
        await workContext.removeProject(projectId);
        ElMessage.success(t('layout.messages.projectDeleted', { name: project.name }));
    }
    catch (err) {
        ElMessage.error(err.message ?? t('layout.messages.projectDeleteFailed'));
    }
    finally {
        deletingProjectId.value = '';
    }
}
function formatProjectTime(value) {
    if (!value)
        return '-';
    return new Intl.DateTimeFormat(localeStore.locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    }).format(new Date(value));
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
function startGuide() {
    guideCurrent.value = 0;
    guideVisible.value = true;
    router.push(onboardingGuideSteps[0].route);
}
function handleGuideChange(current) {
    const step = onboardingGuideSteps[current];
    if (!step)
        return;
    guideCurrent.value = current;
    if (route.path !== step.route) {
        router.push(step.route);
    }
}
function handleGuideClose() {
    guideVisible.value = false;
}
function clearSidebarResizeListeners() {
    if (sidebarPointerMoveHandler) {
        window.removeEventListener('pointermove', sidebarPointerMoveHandler);
        sidebarPointerMoveHandler = null;
    }
    if (sidebarPointerUpHandler) {
        window.removeEventListener('pointerup', sidebarPointerUpHandler);
        window.removeEventListener('pointercancel', sidebarPointerUpHandler);
        sidebarPointerUpHandler = null;
    }
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    isSidebarResizing.value = false;
}
function startSidebarResize(event) {
    event.preventDefault();
    isSidebarResizing.value = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    sidebarPointerMoveHandler = (moveEvent) => {
        sidebarWidth.value = clampSidebarWidth(moveEvent.clientX);
    };
    sidebarPointerUpHandler = () => {
        saveSidebarWidth();
        clearSidebarResizeListeners();
    };
    window.addEventListener('pointermove', sidebarPointerMoveHandler);
    window.addEventListener('pointerup', sidebarPointerUpHandler);
    window.addEventListener('pointercancel', sidebarPointerUpHandler);
}
onMounted(() => {
    workContext.init();
});
onBeforeUnmount(() => {
    clearSidebarResizeListeners();
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['brand']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar-resizer']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar-resizer']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar-resizer']} */ ;
/** @type {__VLS_StyleScopedClasses['layout-menu']} */ ;
/** @type {__VLS_StyleScopedClasses['layout-menu']} */ ;
/** @type {__VLS_StyleScopedClasses['layout-header']} */ ;
/** @type {__VLS_StyleScopedClasses['header-right']} */ ;
/** @type {__VLS_StyleScopedClasses['work-context']} */ ;
/** @type {__VLS_StyleScopedClasses['project-row']} */ ;
/** @type {__VLS_StyleScopedClasses['layout-aside']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar-resizer']} */ ;
/** @type {__VLS_StyleScopedClasses['layout-header']} */ ;
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
    width: (`${__VLS_ctx.sidebarWidth}px`),
    ...{ style: (__VLS_ctx.sidebarStyle) },
    ...{ class: "layout-aside" },
}));
const __VLS_6 = __VLS_5({
    width: (`${__VLS_ctx.sidebarWidth}px`),
    ...{ style: (__VLS_ctx.sidebarStyle) },
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
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    'data-guide': "ai-models",
});
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
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    'data-guide': "chapter-editor",
});
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
var __VLS_83;
const __VLS_120 = {}.ElSubMenu;
/** @type {[typeof __VLS_components.ElSubMenu, typeof __VLS_components.elSubMenu, typeof __VLS_components.ElSubMenu, typeof __VLS_components.elSubMenu, ]} */ ;
// @ts-ignore
const __VLS_121 = __VLS_asFunctionalComponent(__VLS_120, new __VLS_120({
    index: "generate",
}));
const __VLS_122 = __VLS_121({
    index: "generate",
}, ...__VLS_functionalComponentArgsRest(__VLS_121));
__VLS_123.slots.default;
{
    const { title: __VLS_thisSlot } = __VLS_123.slots;
    const __VLS_124 = {}.ElIcon;
    /** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
    // @ts-ignore
    const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({}));
    const __VLS_126 = __VLS_125({}, ...__VLS_functionalComponentArgsRest(__VLS_125));
    __VLS_127.slots.default;
    const __VLS_128 = {}.Notebook;
    /** @type {[typeof __VLS_components.Notebook, ]} */ ;
    // @ts-ignore
    const __VLS_129 = __VLS_asFunctionalComponent(__VLS_128, new __VLS_128({}));
    const __VLS_130 = __VLS_129({}, ...__VLS_functionalComponentArgsRest(__VLS_129));
    var __VLS_127;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.t('layout.menu.generate'));
}
const __VLS_132 = {}.ElMenuItem;
/** @type {[typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, ]} */ ;
// @ts-ignore
const __VLS_133 = __VLS_asFunctionalComponent(__VLS_132, new __VLS_132({
    index: "/generate",
}));
const __VLS_134 = __VLS_133({
    index: "/generate",
}, ...__VLS_functionalComponentArgsRest(__VLS_133));
__VLS_135.slots.default;
(__VLS_ctx.t('layout.menu.workbench'));
var __VLS_135;
const __VLS_136 = {}.ElMenuItem;
/** @type {[typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, ]} */ ;
// @ts-ignore
const __VLS_137 = __VLS_asFunctionalComponent(__VLS_136, new __VLS_136({
    index: "/generate/novel-seed",
}));
const __VLS_138 = __VLS_137({
    index: "/generate/novel-seed",
}, ...__VLS_functionalComponentArgsRest(__VLS_137));
__VLS_139.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    'data-guide': "novel-seed",
});
(__VLS_ctx.t('layout.menu.novelSeed'));
var __VLS_139;
const __VLS_140 = {}.ElMenuItem;
/** @type {[typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, ]} */ ;
// @ts-ignore
const __VLS_141 = __VLS_asFunctionalComponent(__VLS_140, new __VLS_140({
    index: "/generate/planning",
}));
const __VLS_142 = __VLS_141({
    index: "/generate/planning",
}, ...__VLS_functionalComponentArgsRest(__VLS_141));
__VLS_143.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    'data-guide': "chapter-plans",
});
(__VLS_ctx.t('layout.menu.generationPlanning'));
var __VLS_143;
const __VLS_144 = {}.ElMenuItem;
/** @type {[typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, ]} */ ;
// @ts-ignore
const __VLS_145 = __VLS_asFunctionalComponent(__VLS_144, new __VLS_144({
    index: "/generate/chapters",
}));
const __VLS_146 = __VLS_145({
    index: "/generate/chapters",
}, ...__VLS_functionalComponentArgsRest(__VLS_145));
__VLS_147.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    'data-guide': "chapter-generation",
});
(__VLS_ctx.t('layout.menu.chapterWriting'));
var __VLS_147;
const __VLS_148 = {}.ElMenuItem;
/** @type {[typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, ]} */ ;
// @ts-ignore
const __VLS_149 = __VLS_asFunctionalComponent(__VLS_148, new __VLS_148({
    index: "/generate/tracking",
}));
const __VLS_150 = __VLS_149({
    index: "/generate/tracking",
}, ...__VLS_functionalComponentArgsRest(__VLS_149));
__VLS_151.slots.default;
(__VLS_ctx.t('layout.menu.trackingAndValidation'));
var __VLS_151;
var __VLS_123;
const __VLS_152 = {}.ElMenuItem;
/** @type {[typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, ]} */ ;
// @ts-ignore
const __VLS_153 = __VLS_asFunctionalComponent(__VLS_152, new __VLS_152({
    index: "/editor",
}));
const __VLS_154 = __VLS_153({
    index: "/editor",
}, ...__VLS_functionalComponentArgsRest(__VLS_153));
__VLS_155.slots.default;
const __VLS_156 = {}.ElIcon;
/** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
// @ts-ignore
const __VLS_157 = __VLS_asFunctionalComponent(__VLS_156, new __VLS_156({}));
const __VLS_158 = __VLS_157({}, ...__VLS_functionalComponentArgsRest(__VLS_157));
__VLS_159.slots.default;
const __VLS_160 = {}.Document;
/** @type {[typeof __VLS_components.Document, ]} */ ;
// @ts-ignore
const __VLS_161 = __VLS_asFunctionalComponent(__VLS_160, new __VLS_160({}));
const __VLS_162 = __VLS_161({}, ...__VLS_functionalComponentArgsRest(__VLS_161));
var __VLS_159;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.t('layout.menu.writerEditor'));
var __VLS_155;
const __VLS_164 = {}.ElMenuItem;
/** @type {[typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, ]} */ ;
// @ts-ignore
const __VLS_165 = __VLS_asFunctionalComponent(__VLS_164, new __VLS_164({
    index: "/validate",
}));
const __VLS_166 = __VLS_165({
    index: "/validate",
}, ...__VLS_functionalComponentArgsRest(__VLS_165));
__VLS_167.slots.default;
const __VLS_168 = {}.ElIcon;
/** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
// @ts-ignore
const __VLS_169 = __VLS_asFunctionalComponent(__VLS_168, new __VLS_168({}));
const __VLS_170 = __VLS_169({}, ...__VLS_functionalComponentArgsRest(__VLS_169));
__VLS_171.slots.default;
const __VLS_172 = {}.CircleCheck;
/** @type {[typeof __VLS_components.CircleCheck, ]} */ ;
// @ts-ignore
const __VLS_173 = __VLS_asFunctionalComponent(__VLS_172, new __VLS_172({}));
const __VLS_174 = __VLS_173({}, ...__VLS_functionalComponentArgsRest(__VLS_173));
var __VLS_171;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    'data-guide': "validation",
});
(__VLS_ctx.t('layout.menu.validation'));
var __VLS_167;
const __VLS_176 = {}.ElMenuItem;
/** @type {[typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, ]} */ ;
// @ts-ignore
const __VLS_177 = __VLS_asFunctionalComponent(__VLS_176, new __VLS_176({
    index: "/ai-assistant",
}));
const __VLS_178 = __VLS_177({
    index: "/ai-assistant",
}, ...__VLS_functionalComponentArgsRest(__VLS_177));
__VLS_179.slots.default;
const __VLS_180 = {}.ElIcon;
/** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
// @ts-ignore
const __VLS_181 = __VLS_asFunctionalComponent(__VLS_180, new __VLS_180({}));
const __VLS_182 = __VLS_181({}, ...__VLS_functionalComponentArgsRest(__VLS_181));
__VLS_183.slots.default;
const __VLS_184 = {}.ChatDotRound;
/** @type {[typeof __VLS_components.ChatDotRound, ]} */ ;
// @ts-ignore
const __VLS_185 = __VLS_asFunctionalComponent(__VLS_184, new __VLS_184({}));
const __VLS_186 = __VLS_185({}, ...__VLS_functionalComponentArgsRest(__VLS_185));
var __VLS_183;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.t('routes.aiAssistant'));
var __VLS_179;
var __VLS_15;
var __VLS_7;
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onPointerdown: (__VLS_ctx.startSidebarResize) },
    ...{ class: "sidebar-resizer" },
    ...{ class: ({ 'is-resizing': __VLS_ctx.isSidebarResizing }) },
    type: "button",
    'aria-label': (__VLS_ctx.t('layout.resizeSidebar')),
});
const __VLS_188 = {}.ElContainer;
/** @type {[typeof __VLS_components.ElContainer, typeof __VLS_components.elContainer, typeof __VLS_components.ElContainer, typeof __VLS_components.elContainer, ]} */ ;
// @ts-ignore
const __VLS_189 = __VLS_asFunctionalComponent(__VLS_188, new __VLS_188({
    ...{ class: "layout-content" },
}));
const __VLS_190 = __VLS_189({
    ...{ class: "layout-content" },
}, ...__VLS_functionalComponentArgsRest(__VLS_189));
__VLS_191.slots.default;
const __VLS_192 = {}.ElHeader;
/** @type {[typeof __VLS_components.ElHeader, typeof __VLS_components.elHeader, typeof __VLS_components.ElHeader, typeof __VLS_components.elHeader, ]} */ ;
// @ts-ignore
const __VLS_193 = __VLS_asFunctionalComponent(__VLS_192, new __VLS_192({
    height: "60px",
    ...{ class: "layout-header" },
}));
const __VLS_194 = __VLS_193({
    height: "60px",
    ...{ class: "layout-header" },
}, ...__VLS_functionalComponentArgsRest(__VLS_193));
__VLS_195.slots.default;
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
    'data-guide': "work-context",
});
if (!__VLS_ctx.workContext.projects.length) {
    const __VLS_196 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_197 = __VLS_asFunctionalComponent(__VLS_196, new __VLS_196({
        ...{ 'onClick': {} },
        type: "primary",
        size: "small",
        icon: (__VLS_ctx.Plus),
        ...{ class: "primary-project-entry" },
    }));
    const __VLS_198 = __VLS_197({
        ...{ 'onClick': {} },
        type: "primary",
        size: "small",
        icon: (__VLS_ctx.Plus),
        ...{ class: "primary-project-entry" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_197));
    let __VLS_200;
    let __VLS_201;
    let __VLS_202;
    const __VLS_203 = {
        onClick: (__VLS_ctx.openProjectDialog)
    };
    __VLS_199.slots.default;
    (__VLS_ctx.t('layout.dialogs.newProject'));
    var __VLS_199;
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "context-label" },
});
(__VLS_ctx.t('layout.project'));
const __VLS_204 = {}.ElSelect;
/** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
// @ts-ignore
const __VLS_205 = __VLS_asFunctionalComponent(__VLS_204, new __VLS_204({
    modelValue: (__VLS_ctx.workContext.selectedProjectId),
    loading: (__VLS_ctx.workContext.loadingProjects),
    placeholder: (__VLS_ctx.t('layout.placeholders.selectProject')),
    size: "small",
    filterable: true,
    ...{ style: {} },
}));
const __VLS_206 = __VLS_205({
    modelValue: (__VLS_ctx.workContext.selectedProjectId),
    loading: (__VLS_ctx.workContext.loadingProjects),
    placeholder: (__VLS_ctx.t('layout.placeholders.selectProject')),
    size: "small",
    filterable: true,
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_205));
__VLS_207.slots.default;
for (const [project] of __VLS_getVForSourceType((__VLS_ctx.workContext.projects))) {
    const __VLS_208 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_209 = __VLS_asFunctionalComponent(__VLS_208, new __VLS_208({
        key: (project.id),
        label: (project.name),
        value: (project.id),
    }));
    const __VLS_210 = __VLS_209({
        key: (project.id),
        label: (project.name),
        value: (project.id),
    }, ...__VLS_functionalComponentArgsRest(__VLS_209));
}
var __VLS_207;
const __VLS_212 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_213 = __VLS_asFunctionalComponent(__VLS_212, new __VLS_212({
    ...{ 'onClick': {} },
    size: "small",
    icon: (__VLS_ctx.Plus),
}));
const __VLS_214 = __VLS_213({
    ...{ 'onClick': {} },
    size: "small",
    icon: (__VLS_ctx.Plus),
}, ...__VLS_functionalComponentArgsRest(__VLS_213));
let __VLS_216;
let __VLS_217;
let __VLS_218;
const __VLS_219 = {
    onClick: (__VLS_ctx.openProjectDialog)
};
__VLS_215.slots.default;
(__VLS_ctx.t('layout.dialogs.newProject'));
var __VLS_215;
const __VLS_220 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_221 = __VLS_asFunctionalComponent(__VLS_220, new __VLS_220({
    ...{ 'onClick': {} },
    size: "small",
    icon: (__VLS_ctx.FolderOpened),
}));
const __VLS_222 = __VLS_221({
    ...{ 'onClick': {} },
    size: "small",
    icon: (__VLS_ctx.FolderOpened),
}, ...__VLS_functionalComponentArgsRest(__VLS_221));
let __VLS_224;
let __VLS_225;
let __VLS_226;
const __VLS_227 = {
    onClick: (__VLS_ctx.openProjectManager)
};
__VLS_223.slots.default;
(__VLS_ctx.t('layout.projectManage'));
var __VLS_223;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "context-label" },
});
(__VLS_ctx.t('layout.volume'));
const __VLS_228 = {}.ElSelect;
/** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
// @ts-ignore
const __VLS_229 = __VLS_asFunctionalComponent(__VLS_228, new __VLS_228({
    modelValue: (__VLS_ctx.workContext.selectedVolumeId),
    disabled: (!__VLS_ctx.workContext.selectedProjectId),
    loading: (__VLS_ctx.workContext.loadingVolumes),
    placeholder: (__VLS_ctx.t('layout.placeholders.selectVolume')),
    size: "small",
    filterable: true,
    clearable: true,
    ...{ style: {} },
}));
const __VLS_230 = __VLS_229({
    modelValue: (__VLS_ctx.workContext.selectedVolumeId),
    disabled: (!__VLS_ctx.workContext.selectedProjectId),
    loading: (__VLS_ctx.workContext.loadingVolumes),
    placeholder: (__VLS_ctx.t('layout.placeholders.selectVolume')),
    size: "small",
    filterable: true,
    clearable: true,
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_229));
__VLS_231.slots.default;
for (const [volume] of __VLS_getVForSourceType((__VLS_ctx.workContext.volumes))) {
    const __VLS_232 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_233 = __VLS_asFunctionalComponent(__VLS_232, new __VLS_232({
        key: (volume.id),
        label: (__VLS_ctx.t('layout.volumeOption', { number: volume.volumeNumber, title: volume.title })),
        value: (volume.id),
    }));
    const __VLS_234 = __VLS_233({
        key: (volume.id),
        label: (__VLS_ctx.t('layout.volumeOption', { number: volume.volumeNumber, title: volume.title })),
        value: (volume.id),
    }, ...__VLS_functionalComponentArgsRest(__VLS_233));
}
var __VLS_231;
const __VLS_236 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_237 = __VLS_asFunctionalComponent(__VLS_236, new __VLS_236({
    ...{ 'onClick': {} },
    text: true,
    size: "small",
    icon: (__VLS_ctx.Plus),
}));
const __VLS_238 = __VLS_237({
    ...{ 'onClick': {} },
    text: true,
    size: "small",
    icon: (__VLS_ctx.Plus),
}, ...__VLS_functionalComponentArgsRest(__VLS_237));
let __VLS_240;
let __VLS_241;
let __VLS_242;
const __VLS_243 = {
    onClick: (__VLS_ctx.openVolumeDialog)
};
var __VLS_239;
const __VLS_244 = {}.ElSelect;
/** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
// @ts-ignore
const __VLS_245 = __VLS_asFunctionalComponent(__VLS_244, new __VLS_244({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.localeStore.locale),
    size: "small",
    ...{ style: {} },
}));
const __VLS_246 = __VLS_245({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.localeStore.locale),
    size: "small",
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_245));
let __VLS_248;
let __VLS_249;
let __VLS_250;
const __VLS_251 = {
    onChange: (...[$event]) => {
        __VLS_ctx.setLocale($event);
    }
};
__VLS_247.slots.default;
for (const [option] of __VLS_getVForSourceType((__VLS_ctx.localeOptions))) {
    const __VLS_252 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_253 = __VLS_asFunctionalComponent(__VLS_252, new __VLS_252({
        key: (option.value),
        label: (option.label),
        value: (option.value),
    }));
    const __VLS_254 = __VLS_253({
        key: (option.value),
        label: (option.label),
        value: (option.value),
    }, ...__VLS_functionalComponentArgsRest(__VLS_253));
}
var __VLS_247;
const __VLS_256 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_257 = __VLS_asFunctionalComponent(__VLS_256, new __VLS_256({
    ...{ 'onClick': {} },
    type: "primary",
    plain: true,
    size: "small",
    ...{ class: "guide-trigger" },
}));
const __VLS_258 = __VLS_257({
    ...{ 'onClick': {} },
    type: "primary",
    plain: true,
    size: "small",
    ...{ class: "guide-trigger" },
}, ...__VLS_functionalComponentArgsRest(__VLS_257));
let __VLS_260;
let __VLS_261;
let __VLS_262;
const __VLS_263 = {
    onClick: (__VLS_ctx.startGuide)
};
__VLS_259.slots.default;
(__VLS_ctx.t('layout.guide.start'));
var __VLS_259;
const __VLS_264 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_265 = __VLS_asFunctionalComponent(__VLS_264, new __VLS_264({
    ...{ 'onClick': {} },
    text: true,
    size: "small",
}));
const __VLS_266 = __VLS_265({
    ...{ 'onClick': {} },
    text: true,
    size: "small",
}, ...__VLS_functionalComponentArgsRest(__VLS_265));
let __VLS_268;
let __VLS_269;
let __VLS_270;
const __VLS_271 = {
    onClick: (__VLS_ctx.cycleTheme)
};
__VLS_267.slots.default;
const __VLS_272 = {}.ElIcon;
/** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
// @ts-ignore
const __VLS_273 = __VLS_asFunctionalComponent(__VLS_272, new __VLS_272({
    ...{ class: "mr-4" },
}));
const __VLS_274 = __VLS_273({
    ...{ class: "mr-4" },
}, ...__VLS_functionalComponentArgsRest(__VLS_273));
__VLS_275.slots.default;
const __VLS_276 = ((__VLS_ctx.themeIcon));
// @ts-ignore
const __VLS_277 = __VLS_asFunctionalComponent(__VLS_276, new __VLS_276({}));
const __VLS_278 = __VLS_277({}, ...__VLS_functionalComponentArgsRest(__VLS_277));
var __VLS_275;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.themeLabel);
var __VLS_267;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "user-chip" },
});
const __VLS_280 = {}.ElIcon;
/** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
// @ts-ignore
const __VLS_281 = __VLS_asFunctionalComponent(__VLS_280, new __VLS_280({}));
const __VLS_282 = __VLS_281({}, ...__VLS_functionalComponentArgsRest(__VLS_281));
__VLS_283.slots.default;
const __VLS_284 = {}.UserFilled;
/** @type {[typeof __VLS_components.UserFilled, ]} */ ;
// @ts-ignore
const __VLS_285 = __VLS_asFunctionalComponent(__VLS_284, new __VLS_284({}));
const __VLS_286 = __VLS_285({}, ...__VLS_functionalComponentArgsRest(__VLS_285));
var __VLS_283;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.authStore.username || 'Admin');
const __VLS_288 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_289 = __VLS_asFunctionalComponent(__VLS_288, new __VLS_288({
    ...{ 'onClick': {} },
    text: true,
    size: "small",
    icon: (__VLS_ctx.SwitchButton),
}));
const __VLS_290 = __VLS_289({
    ...{ 'onClick': {} },
    text: true,
    size: "small",
    icon: (__VLS_ctx.SwitchButton),
}, ...__VLS_functionalComponentArgsRest(__VLS_289));
let __VLS_292;
let __VLS_293;
let __VLS_294;
const __VLS_295 = {
    onClick: (__VLS_ctx.signOut)
};
__VLS_291.slots.default;
(__VLS_ctx.t('layout.logout'));
var __VLS_291;
var __VLS_195;
const __VLS_296 = {}.ElMain;
/** @type {[typeof __VLS_components.ElMain, typeof __VLS_components.elMain, typeof __VLS_components.ElMain, typeof __VLS_components.elMain, ]} */ ;
// @ts-ignore
const __VLS_297 = __VLS_asFunctionalComponent(__VLS_296, new __VLS_296({
    ...{ class: "layout-main" },
}));
const __VLS_298 = __VLS_297({
    ...{ class: "layout-main" },
}, ...__VLS_functionalComponentArgsRest(__VLS_297));
__VLS_299.slots.default;
const __VLS_300 = {}.RouterView;
/** @type {[typeof __VLS_components.RouterView, ]} */ ;
// @ts-ignore
const __VLS_301 = __VLS_asFunctionalComponent(__VLS_300, new __VLS_300({}));
const __VLS_302 = __VLS_301({}, ...__VLS_functionalComponentArgsRest(__VLS_301));
var __VLS_299;
var __VLS_191;
var __VLS_3;
const __VLS_304 = {}.ElTour;
/** @type {[typeof __VLS_components.ElTour, typeof __VLS_components.elTour, typeof __VLS_components.ElTour, typeof __VLS_components.elTour, ]} */ ;
// @ts-ignore
const __VLS_305 = __VLS_asFunctionalComponent(__VLS_304, new __VLS_304({
    ...{ 'onChange': {} },
    ...{ 'onClose': {} },
    ...{ 'onFinish': {} },
    modelValue: (__VLS_ctx.guideVisible),
    current: (__VLS_ctx.guideCurrent),
    type: "primary",
    showClose: (true),
    mask: ({ color: 'rgba(8, 12, 24, 0.56)' }),
    gap: ({ offset: 8, radius: 8 }),
    scrollIntoViewOptions: ({ block: 'center', behavior: 'smooth' }),
}));
const __VLS_306 = __VLS_305({
    ...{ 'onChange': {} },
    ...{ 'onClose': {} },
    ...{ 'onFinish': {} },
    modelValue: (__VLS_ctx.guideVisible),
    current: (__VLS_ctx.guideCurrent),
    type: "primary",
    showClose: (true),
    mask: ({ color: 'rgba(8, 12, 24, 0.56)' }),
    gap: ({ offset: 8, radius: 8 }),
    scrollIntoViewOptions: ({ block: 'center', behavior: 'smooth' }),
}, ...__VLS_functionalComponentArgsRest(__VLS_305));
let __VLS_308;
let __VLS_309;
let __VLS_310;
const __VLS_311 = {
    onChange: (__VLS_ctx.handleGuideChange)
};
const __VLS_312 = {
    onClose: (__VLS_ctx.handleGuideClose)
};
const __VLS_313 = {
    onFinish: (__VLS_ctx.handleGuideClose)
};
__VLS_307.slots.default;
for (const [step] of __VLS_getVForSourceType((__VLS_ctx.onboardingGuideSteps))) {
    const __VLS_314 = {}.ElTourStep;
    /** @type {[typeof __VLS_components.ElTourStep, typeof __VLS_components.elTourStep, ]} */ ;
    // @ts-ignore
    const __VLS_315 = __VLS_asFunctionalComponent(__VLS_314, new __VLS_314({
        key: (step.id),
        target: (step.target),
        title: (step.title),
        description: (step.description),
        placement: (step.placement),
        prevButtonProps: ({ children: __VLS_ctx.t('layout.guide.previous') }),
        nextButtonProps: ({ children: __VLS_ctx.t('layout.guide.next') }),
    }));
    const __VLS_316 = __VLS_315({
        key: (step.id),
        target: (step.target),
        title: (step.title),
        description: (step.description),
        placement: (step.placement),
        prevButtonProps: ({ children: __VLS_ctx.t('layout.guide.previous') }),
        nextButtonProps: ({ children: __VLS_ctx.t('layout.guide.next') }),
    }, ...__VLS_functionalComponentArgsRest(__VLS_315));
}
var __VLS_307;
const __VLS_318 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_319 = __VLS_asFunctionalComponent(__VLS_318, new __VLS_318({
    modelValue: (__VLS_ctx.projectDialogVisible),
    title: (__VLS_ctx.t('layout.dialogs.newProject')),
    width: "420px",
}));
const __VLS_320 = __VLS_319({
    modelValue: (__VLS_ctx.projectDialogVisible),
    title: (__VLS_ctx.t('layout.dialogs.newProject')),
    width: "420px",
}, ...__VLS_functionalComponentArgsRest(__VLS_319));
__VLS_321.slots.default;
const __VLS_322 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_323 = __VLS_asFunctionalComponent(__VLS_322, new __VLS_322({
    model: (__VLS_ctx.projectForm),
    labelWidth: "80px",
}));
const __VLS_324 = __VLS_323({
    model: (__VLS_ctx.projectForm),
    labelWidth: "80px",
}, ...__VLS_functionalComponentArgsRest(__VLS_323));
__VLS_325.slots.default;
const __VLS_326 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_327 = __VLS_asFunctionalComponent(__VLS_326, new __VLS_326({
    label: (__VLS_ctx.t('layout.dialogs.name')),
    required: true,
}));
const __VLS_328 = __VLS_327({
    label: (__VLS_ctx.t('layout.dialogs.name')),
    required: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_327));
__VLS_329.slots.default;
const __VLS_330 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_331 = __VLS_asFunctionalComponent(__VLS_330, new __VLS_330({
    ...{ 'onKeyup': {} },
    modelValue: (__VLS_ctx.projectForm.name),
}));
const __VLS_332 = __VLS_331({
    ...{ 'onKeyup': {} },
    modelValue: (__VLS_ctx.projectForm.name),
}, ...__VLS_functionalComponentArgsRest(__VLS_331));
let __VLS_334;
let __VLS_335;
let __VLS_336;
const __VLS_337 = {
    onKeyup: (__VLS_ctx.submitProject)
};
var __VLS_333;
var __VLS_329;
const __VLS_338 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_339 = __VLS_asFunctionalComponent(__VLS_338, new __VLS_338({
    label: (__VLS_ctx.t('layout.dialogs.summary')),
}));
const __VLS_340 = __VLS_339({
    label: (__VLS_ctx.t('layout.dialogs.summary')),
}, ...__VLS_functionalComponentArgsRest(__VLS_339));
__VLS_341.slots.default;
const __VLS_342 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_343 = __VLS_asFunctionalComponent(__VLS_342, new __VLS_342({
    modelValue: (__VLS_ctx.projectForm.description),
    type: "textarea",
    rows: (3),
}));
const __VLS_344 = __VLS_343({
    modelValue: (__VLS_ctx.projectForm.description),
    type: "textarea",
    rows: (3),
}, ...__VLS_functionalComponentArgsRest(__VLS_343));
var __VLS_341;
var __VLS_325;
{
    const { footer: __VLS_thisSlot } = __VLS_321.slots;
    const __VLS_346 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_347 = __VLS_asFunctionalComponent(__VLS_346, new __VLS_346({
        ...{ 'onClick': {} },
    }));
    const __VLS_348 = __VLS_347({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_347));
    let __VLS_350;
    let __VLS_351;
    let __VLS_352;
    const __VLS_353 = {
        onClick: (...[$event]) => {
            __VLS_ctx.projectDialogVisible = false;
        }
    };
    __VLS_349.slots.default;
    (__VLS_ctx.t('layout.dialogs.cancel'));
    var __VLS_349;
    const __VLS_354 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_355 = __VLS_asFunctionalComponent(__VLS_354, new __VLS_354({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.creatingProject),
    }));
    const __VLS_356 = __VLS_355({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.creatingProject),
    }, ...__VLS_functionalComponentArgsRest(__VLS_355));
    let __VLS_358;
    let __VLS_359;
    let __VLS_360;
    const __VLS_361 = {
        onClick: (__VLS_ctx.submitProject)
    };
    __VLS_357.slots.default;
    (__VLS_ctx.t('layout.dialogs.create'));
    var __VLS_357;
}
var __VLS_321;
const __VLS_362 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_363 = __VLS_asFunctionalComponent(__VLS_362, new __VLS_362({
    modelValue: (__VLS_ctx.projectManagerVisible),
    title: (__VLS_ctx.t('layout.dialogs.projectManager')),
    width: "720px",
}));
const __VLS_364 = __VLS_363({
    modelValue: (__VLS_ctx.projectManagerVisible),
    title: (__VLS_ctx.t('layout.dialogs.projectManager')),
    width: "720px",
}, ...__VLS_functionalComponentArgsRest(__VLS_363));
__VLS_365.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "project-manager" },
});
if (!__VLS_ctx.workContext.projects.length) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "project-empty" },
    });
    (__VLS_ctx.t('layout.projectManager.empty'));
}
for (const [project] of __VLS_getVForSourceType((__VLS_ctx.workContext.projects))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        key: (project.id),
        ...{ class: "project-row" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "project-row-main" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "project-row-title" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (project.name);
    if (project.id === __VLS_ctx.workContext.selectedProjectId) {
        const __VLS_366 = {}.ElTag;
        /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
        // @ts-ignore
        const __VLS_367 = __VLS_asFunctionalComponent(__VLS_366, new __VLS_366({
            size: "small",
            type: "success",
        }));
        const __VLS_368 = __VLS_367({
            size: "small",
            type: "success",
        }, ...__VLS_functionalComponentArgsRest(__VLS_367));
        __VLS_369.slots.default;
        (__VLS_ctx.t('layout.projectManager.current'));
        var __VLS_369;
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "project-row-desc" },
    });
    (project.description || __VLS_ctx.t('layout.projectManager.noDescription'));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "project-row-meta" },
    });
    (__VLS_ctx.t('layout.projectManager.updatedAt', { time: __VLS_ctx.formatProjectTime(project.updatedAt) }));
    const __VLS_370 = {}.ElPopconfirm;
    /** @type {[typeof __VLS_components.ElPopconfirm, typeof __VLS_components.elPopconfirm, typeof __VLS_components.ElPopconfirm, typeof __VLS_components.elPopconfirm, ]} */ ;
    // @ts-ignore
    const __VLS_371 = __VLS_asFunctionalComponent(__VLS_370, new __VLS_370({
        ...{ 'onConfirm': {} },
        width: "320",
        title: (__VLS_ctx.t('layout.projectManager.deleteConfirm', { name: project.name })),
        confirmButtonText: (__VLS_ctx.t('layout.dialogs.delete')),
        cancelButtonText: (__VLS_ctx.t('layout.dialogs.cancel')),
        confirmButtonType: "danger",
    }));
    const __VLS_372 = __VLS_371({
        ...{ 'onConfirm': {} },
        width: "320",
        title: (__VLS_ctx.t('layout.projectManager.deleteConfirm', { name: project.name })),
        confirmButtonText: (__VLS_ctx.t('layout.dialogs.delete')),
        cancelButtonText: (__VLS_ctx.t('layout.dialogs.cancel')),
        confirmButtonType: "danger",
    }, ...__VLS_functionalComponentArgsRest(__VLS_371));
    let __VLS_374;
    let __VLS_375;
    let __VLS_376;
    const __VLS_377 = {
        onConfirm: (...[$event]) => {
            __VLS_ctx.deleteManagedProject(project.id);
        }
    };
    __VLS_373.slots.default;
    {
        const { reference: __VLS_thisSlot } = __VLS_373.slots;
        const __VLS_378 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_379 = __VLS_asFunctionalComponent(__VLS_378, new __VLS_378({
            type: "danger",
            plain: true,
            size: "small",
            icon: (__VLS_ctx.Delete),
            loading: (__VLS_ctx.deletingProjectId === project.id),
        }));
        const __VLS_380 = __VLS_379({
            type: "danger",
            plain: true,
            size: "small",
            icon: (__VLS_ctx.Delete),
            loading: (__VLS_ctx.deletingProjectId === project.id),
        }, ...__VLS_functionalComponentArgsRest(__VLS_379));
        __VLS_381.slots.default;
        (__VLS_ctx.t('layout.dialogs.delete'));
        var __VLS_381;
    }
    var __VLS_373;
}
{
    const { footer: __VLS_thisSlot } = __VLS_365.slots;
    const __VLS_382 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_383 = __VLS_asFunctionalComponent(__VLS_382, new __VLS_382({
        ...{ 'onClick': {} },
    }));
    const __VLS_384 = __VLS_383({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_383));
    let __VLS_386;
    let __VLS_387;
    let __VLS_388;
    const __VLS_389 = {
        onClick: (...[$event]) => {
            __VLS_ctx.projectManagerVisible = false;
        }
    };
    __VLS_385.slots.default;
    (__VLS_ctx.t('layout.dialogs.close'));
    var __VLS_385;
    const __VLS_390 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_391 = __VLS_asFunctionalComponent(__VLS_390, new __VLS_390({
        ...{ 'onClick': {} },
        type: "primary",
        icon: (__VLS_ctx.Plus),
    }));
    const __VLS_392 = __VLS_391({
        ...{ 'onClick': {} },
        type: "primary",
        icon: (__VLS_ctx.Plus),
    }, ...__VLS_functionalComponentArgsRest(__VLS_391));
    let __VLS_394;
    let __VLS_395;
    let __VLS_396;
    const __VLS_397 = {
        onClick: (__VLS_ctx.openProjectDialog)
    };
    __VLS_393.slots.default;
    (__VLS_ctx.t('layout.dialogs.newProject'));
    var __VLS_393;
}
var __VLS_365;
const __VLS_398 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_399 = __VLS_asFunctionalComponent(__VLS_398, new __VLS_398({
    modelValue: (__VLS_ctx.volumeDialogVisible),
    title: (__VLS_ctx.t('layout.dialogs.newVolume')),
    width: "420px",
}));
const __VLS_400 = __VLS_399({
    modelValue: (__VLS_ctx.volumeDialogVisible),
    title: (__VLS_ctx.t('layout.dialogs.newVolume')),
    width: "420px",
}, ...__VLS_functionalComponentArgsRest(__VLS_399));
__VLS_401.slots.default;
const __VLS_402 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_403 = __VLS_asFunctionalComponent(__VLS_402, new __VLS_402({
    model: (__VLS_ctx.volumeForm),
    labelWidth: "90px",
}));
const __VLS_404 = __VLS_403({
    model: (__VLS_ctx.volumeForm),
    labelWidth: "90px",
}, ...__VLS_functionalComponentArgsRest(__VLS_403));
__VLS_405.slots.default;
const __VLS_406 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_407 = __VLS_asFunctionalComponent(__VLS_406, new __VLS_406({
    label: (__VLS_ctx.t('layout.dialogs.number')),
    required: true,
}));
const __VLS_408 = __VLS_407({
    label: (__VLS_ctx.t('layout.dialogs.number')),
    required: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_407));
__VLS_409.slots.default;
const __VLS_410 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_411 = __VLS_asFunctionalComponent(__VLS_410, new __VLS_410({
    modelValue: (__VLS_ctx.volumeForm.volumeNumber),
    min: (1),
    controlsPosition: "right",
}));
const __VLS_412 = __VLS_411({
    modelValue: (__VLS_ctx.volumeForm.volumeNumber),
    min: (1),
    controlsPosition: "right",
}, ...__VLS_functionalComponentArgsRest(__VLS_411));
var __VLS_409;
const __VLS_414 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_415 = __VLS_asFunctionalComponent(__VLS_414, new __VLS_414({
    label: (__VLS_ctx.t('layout.dialogs.title')),
    required: true,
}));
const __VLS_416 = __VLS_415({
    label: (__VLS_ctx.t('layout.dialogs.title')),
    required: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_415));
__VLS_417.slots.default;
const __VLS_418 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_419 = __VLS_asFunctionalComponent(__VLS_418, new __VLS_418({
    ...{ 'onKeyup': {} },
    modelValue: (__VLS_ctx.volumeForm.title),
}));
const __VLS_420 = __VLS_419({
    ...{ 'onKeyup': {} },
    modelValue: (__VLS_ctx.volumeForm.title),
}, ...__VLS_functionalComponentArgsRest(__VLS_419));
let __VLS_422;
let __VLS_423;
let __VLS_424;
const __VLS_425 = {
    onKeyup: (__VLS_ctx.submitVolume)
};
var __VLS_421;
var __VLS_417;
const __VLS_426 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_427 = __VLS_asFunctionalComponent(__VLS_426, new __VLS_426({
    label: (__VLS_ctx.t('layout.dialogs.theme')),
}));
const __VLS_428 = __VLS_427({
    label: (__VLS_ctx.t('layout.dialogs.theme')),
}, ...__VLS_functionalComponentArgsRest(__VLS_427));
__VLS_429.slots.default;
const __VLS_430 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_431 = __VLS_asFunctionalComponent(__VLS_430, new __VLS_430({
    modelValue: (__VLS_ctx.volumeForm.theme),
    type: "textarea",
    rows: (3),
}));
const __VLS_432 = __VLS_431({
    modelValue: (__VLS_ctx.volumeForm.theme),
    type: "textarea",
    rows: (3),
}, ...__VLS_functionalComponentArgsRest(__VLS_431));
var __VLS_429;
var __VLS_405;
{
    const { footer: __VLS_thisSlot } = __VLS_401.slots;
    const __VLS_434 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_435 = __VLS_asFunctionalComponent(__VLS_434, new __VLS_434({
        ...{ 'onClick': {} },
    }));
    const __VLS_436 = __VLS_435({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_435));
    let __VLS_438;
    let __VLS_439;
    let __VLS_440;
    const __VLS_441 = {
        onClick: (...[$event]) => {
            __VLS_ctx.volumeDialogVisible = false;
        }
    };
    __VLS_437.slots.default;
    (__VLS_ctx.t('layout.dialogs.cancel'));
    var __VLS_437;
    const __VLS_442 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_443 = __VLS_asFunctionalComponent(__VLS_442, new __VLS_442({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.creatingVolume),
    }));
    const __VLS_444 = __VLS_443({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.creatingVolume),
    }, ...__VLS_functionalComponentArgsRest(__VLS_443));
    let __VLS_446;
    let __VLS_447;
    let __VLS_448;
    const __VLS_449 = {
        onClick: (__VLS_ctx.submitVolume)
    };
    __VLS_445.slots.default;
    (__VLS_ctx.t('layout.dialogs.create'));
    var __VLS_445;
}
var __VLS_401;
/** @type {__VLS_StyleScopedClasses['layout']} */ ;
/** @type {__VLS_StyleScopedClasses['layout-aside']} */ ;
/** @type {__VLS_StyleScopedClasses['brand']} */ ;
/** @type {__VLS_StyleScopedClasses['brand-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['brand-copy']} */ ;
/** @type {__VLS_StyleScopedClasses['brand-text']} */ ;
/** @type {__VLS_StyleScopedClasses['brand-sub']} */ ;
/** @type {__VLS_StyleScopedClasses['layout-menu']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar-resizer']} */ ;
/** @type {__VLS_StyleScopedClasses['is-resizing']} */ ;
/** @type {__VLS_StyleScopedClasses['layout-content']} */ ;
/** @type {__VLS_StyleScopedClasses['layout-header']} */ ;
/** @type {__VLS_StyleScopedClasses['header-title']} */ ;
/** @type {__VLS_StyleScopedClasses['header-sub']} */ ;
/** @type {__VLS_StyleScopedClasses['header-right']} */ ;
/** @type {__VLS_StyleScopedClasses['work-context']} */ ;
/** @type {__VLS_StyleScopedClasses['primary-project-entry']} */ ;
/** @type {__VLS_StyleScopedClasses['context-label']} */ ;
/** @type {__VLS_StyleScopedClasses['context-label']} */ ;
/** @type {__VLS_StyleScopedClasses['guide-trigger']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-4']} */ ;
/** @type {__VLS_StyleScopedClasses['user-chip']} */ ;
/** @type {__VLS_StyleScopedClasses['layout-main']} */ ;
/** @type {__VLS_StyleScopedClasses['project-manager']} */ ;
/** @type {__VLS_StyleScopedClasses['project-empty']} */ ;
/** @type {__VLS_StyleScopedClasses['project-row']} */ ;
/** @type {__VLS_StyleScopedClasses['project-row-main']} */ ;
/** @type {__VLS_StyleScopedClasses['project-row-title']} */ ;
/** @type {__VLS_StyleScopedClasses['project-row-desc']} */ ;
/** @type {__VLS_StyleScopedClasses['project-row-meta']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Bell: Bell,
            ChatDotRound: ChatDotRound,
            CircleCheck: CircleCheck,
            Delete: Delete,
            Document: Document,
            Edit: Edit,
            FolderOpened: FolderOpened,
            MagicStick: MagicStick,
            Notebook: Notebook,
            Plus: Plus,
            Promotion: Promotion,
            Sunny: Sunny,
            SwitchButton: SwitchButton,
            UserFilled: UserFilled,
            onboardingGuideSteps: onboardingGuideSteps,
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
            projectManagerVisible: projectManagerVisible,
            volumeDialogVisible: volumeDialogVisible,
            creatingProject: creatingProject,
            deletingProjectId: deletingProjectId,
            creatingVolume: creatingVolume,
            guideVisible: guideVisible,
            guideCurrent: guideCurrent,
            sidebarWidth: sidebarWidth,
            isSidebarResizing: isSidebarResizing,
            sidebarStyle: sidebarStyle,
            projectForm: projectForm,
            volumeForm: volumeForm,
            openProjectDialog: openProjectDialog,
            openProjectManager: openProjectManager,
            openVolumeDialog: openVolumeDialog,
            submitProject: submitProject,
            deleteManagedProject: deleteManagedProject,
            formatProjectTime: formatProjectTime,
            submitVolume: submitVolume,
            signOut: signOut,
            startGuide: startGuide,
            handleGuideChange: handleGuideChange,
            handleGuideClose: handleGuideClose,
            startSidebarResize: startSidebarResize,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
