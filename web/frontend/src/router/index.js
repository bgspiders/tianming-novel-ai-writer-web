import { createRouter, createWebHistory } from 'vue-router';
const routes = [
    {
        path: '/',
        component: () => import('@/layouts/MainLayout.vue'),
        children: [
            {
                path: '',
                name: 'home',
                component: () => import('@/views/HomeView.vue'),
                meta: { title: '首页' }
            },
            {
                path: 'health',
                name: 'health',
                component: () => import('@/views/HealthView.vue'),
                meta: { title: '健康检查' }
            },
            {
                path: 'ai-test',
                name: 'ai-test',
                component: () => import('@/views/AiTestView.vue'),
                meta: { title: 'AI 流式测试' }
            },
            {
                path: 'settings/ai-models',
                name: 'ai-models',
                component: () => import('@/views/AiModelsView.vue'),
                meta: { title: 'AI 模型管理' }
            },
            {
                path: 'design',
                redirect: '/design/world_rules'
            },
            {
                path: 'design/:module',
                name: 'design-module',
                component: () => import('@/views/design/DesignView.vue'),
                meta: { title: '设计模块' }
            },
            {
                path: 'generate',
                name: 'generation-workbench',
                component: () => import('@/views/generate/GenerationWorkbenchView.vue'),
                meta: { title: '生成工作台' }
            },
            {
                path: 'generate/chapters',
                name: 'chapter-generation',
                component: () => import('@/views/generate/ChapterGenerationView.vue'),
                meta: { title: '章节生成' }
            },
            {
                path: 'generate/gate',
                name: 'generation-gate',
                component: () => import('@/views/generate/GenerationGateView.vue'),
                meta: { title: '生成门禁' }
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
                meta: { title: '生成规划' }
            },
            {
                path: 'editor',
                name: 'editor',
                component: () => import('@/views/editor/EditorView.vue'),
                meta: { title: '章节编辑器' }
            },
            {
                path: 'validate',
                name: 'validation-workbench',
                component: () => import('@/views/validate/ValidationView.vue'),
                meta: { title: '校验工作台' }
            },
            {
                path: 'ai-assistant',
                name: 'ai-assistant',
                component: () => import('@/views/AiAssistantView.vue'),
                meta: { title: 'AI 助手' }
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
router.afterEach((to) => {
    const title = to.meta?.title ?? '';
    document.title = title ? `${title} · 天命 Web` : '天命 Web';
});
export default router;
