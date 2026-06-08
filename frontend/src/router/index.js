import { createRouter, createWebHistory } from 'vue-router';
import { buildDocumentTitle } from '@/i18n';
import { useLocaleStore } from '@/stores/locale';
import { useAuthStore } from '@/stores/auth';
const routes = [
    {
        path: '/login',
        name: 'login',
        component: () => import('@/views/LoginView.vue'),
        meta: { titleKey: 'routes.login', public: true }
    },
    {
        path: '/',
        component: () => import('@/layouts/MainLayout.vue'),
        children: [
            {
                path: '',
                name: 'home',
                component: () => import('@/views/HomeView.vue'),
                meta: { titleKey: 'routes.home' }
            },
            {
                path: 'settings/ai-models',
                name: 'ai-models',
                component: () => import('@/views/AiModelsView.vue'),
                meta: { titleKey: 'routes.aiModels' }
            },
            {
                path: 'settings/themes',
                name: 'theme-studio',
                component: () => import('@/views/settings/ThemeStudioView.vue'),
                meta: { titleKey: 'routes.themeStudio' }
            },
            {
                path: 'settings/notifications',
                name: 'notification-center',
                component: () => import('@/views/settings/NotificationCenterView.vue'),
                meta: { titleKey: 'routes.notificationCenter' }
            },
            {
                path: 'editor/chapters',
                name: 'chapter-editor',
                component: () => import('@/views/editor/EditorChaptersView.vue'),
                meta: { titleKey: 'routes.chapterEditor' }
            },
            {
                path: 'design',
                redirect: '/design/world_rules'
            },
            {
                path: 'design/:module',
                name: 'design-module',
                component: () => import('@/views/design/DesignView.vue'),
                meta: { titleKey: 'routes.designModules' }
            },
            {
                path: 'generate',
                name: 'generation-workbench',
                component: () => import('@/views/generate/GenerationWorkbenchView.vue'),
                meta: { titleKey: 'routes.generationWorkbench' }
            },
            {
                path: 'generate/novel-seed',
                name: 'novel-seed',
                component: () => import('@/views/generate/NovelSeedView.vue'),
                meta: { titleKey: 'routes.novelSeed' }
            },
            {
                path: 'generate/tianming-protocol',
                name: 'tianming-protocol',
                component: () => import('@/views/generate/TianmingProtocolView.vue'),
                meta: { titleKey: 'routes.tianmingProtocol' }
            },
            {
                path: 'generate/chapters',
                name: 'chapter-generation',
                component: () => import('@/views/generate/ChapterGenerationView.vue'),
                meta: { titleKey: 'routes.chapterGeneration' }
            },
            {
                path: 'generate/gate',
                name: 'generation-gate',
                component: () => import('@/views/generate/GenerationGateView.vue'),
                meta: { titleKey: 'routes.generationGate' }
            },
            {
                path: 'generate/tracking',
                name: 'narrative-tracking',
                component: () => import('@/views/generate/NarrativeTrackingView.vue'),
                meta: { titleKey: 'routes.narrativeTracking' }
            },
            {
                path: 'generate/volume-designs',
                redirect: '/generate/volume_designs'
            },
            {
                path: 'generate/volumes',
                redirect: '/generate/volume_designs'
            },
            {
                path: 'generate/chapter-plans',
                redirect: '/generate/chapter_plans'
            },
            {
                path: 'generate/chapter-blueprints',
                redirect: '/generate/chapter_blueprints'
            },
            {
                path: 'generate/:module(outlines|volume_designs|chapter_plans|chapter_blueprints)',
                name: 'generation-planning-module',
                component: () => import('@/views/design/DesignView.vue'),
                meta: { titleKey: 'routes.generationPlanning' }
            },
            {
                path: 'editor',
                name: 'editor',
                component: () => import('@/views/editor/EditorView.vue'),
                meta: { titleKey: 'routes.editorWorkspace' }
            },
            {
                path: 'validate',
                name: 'validation-workbench',
                component: () => import('@/views/validate/ValidationView.vue'),
                meta: { titleKey: 'routes.validationWorkbench' }
            },
            {
                path: 'ai-assistant',
                name: 'ai-assistant',
                component: () => import('@/views/AiAssistantView.vue'),
                meta: { titleKey: 'routes.aiAssistant' }
            }
        ]
    },
    {
        path: '/:pathMatch(.*)*',
        redirect: '/'
    }
];
const router = createRouter({
    history: createWebHistory(),
    routes,
    scrollBehavior: () => ({ top: 0 })
});
router.beforeEach(async (to) => {
    const authStore = useAuthStore();
    if (!authStore.initialized) {
        try {
            await authStore.refresh();
        }
        catch {
            if (to.name !== 'login') {
                return { name: 'login', query: { redirect: to.fullPath } };
            }
            return true;
        }
    }
    if (to.name === 'login') {
        return authStore.authenticated ? '/' : true;
    }
    if (!to.meta?.public && !authStore.authenticated) {
        return { name: 'login', query: { redirect: to.fullPath } };
    }
    return true;
});
router.afterEach((to) => {
    const localeStore = useLocaleStore();
    const titleKey = to.meta?.titleKey ?? undefined;
    document.title = buildDocumentTitle(titleKey, localeStore.locale);
});
export default router;
