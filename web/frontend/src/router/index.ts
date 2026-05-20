import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    children: [
      {
        path: '',
        name: 'home',
        component: () => import('@/views/HomeView.vue'),
        meta: { title: 'Home' }
      },
      {
        path: 'health',
        name: 'health',
        component: () => import('@/views/HealthView.vue'),
        meta: { title: 'Health Check' }
      },
      {
        path: 'ai-test',
        name: 'ai-test',
        component: () => import('@/views/AiTestView.vue'),
        meta: { title: 'AI Streaming Test' }
      },
      {
        path: 'settings/ai-models',
        name: 'ai-models',
        component: () => import('@/views/AiModelsView.vue'),
        meta: { title: 'AI Models' }
      },
      {
        path: 'settings/themes',
        name: 'theme-studio',
        component: () => import('@/views/settings/ThemeStudioView.vue'),
        meta: { title: 'Theme Studio' }
      },
      {
        path: 'editor/chapters',
        name: 'chapter-editor',
        component: () => import('@/views/editor/EditorChaptersView.vue'),
        meta: { title: 'Chapter Editor' }
      },
      {
        path: 'design',
        redirect: '/design/world_rules'
      },
      {
        path: 'design/:module',
        name: 'design-module',
        component: () => import('@/views/design/DesignView.vue'),
        meta: { title: 'Design Modules' }
      },
      {
        path: 'generate',
        name: 'generation-workbench',
        component: () => import('@/views/generate/GenerationWorkbenchView.vue'),
        meta: { title: 'Generation Workbench' }
      },
      {
        path: 'generate/chapters',
        name: 'chapter-generation',
        component: () => import('@/views/generate/ChapterGenerationView.vue'),
        meta: { title: 'Chapter Generation' }
      },
      {
        path: 'generate/gate',
        name: 'generation-gate',
        component: () => import('@/views/generate/GenerationGateView.vue'),
        meta: { title: 'Generation Gate' }
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
        meta: { title: 'Generation Planning' }
      },
      {
        path: 'editor',
        name: 'editor',
        component: () => import('@/views/editor/EditorView.vue'),
        meta: { title: 'Editor Workspace' }
      },
      {
        path: 'validate',
        name: 'validation-workbench',
        component: () => import('@/views/validate/ValidationView.vue'),
        meta: { title: 'Validation Workbench' }
      },
      {
        path: 'ai-assistant',
        name: 'ai-assistant',
        component: () => import('@/views/AiAssistantView.vue'),
        meta: { title: 'AI Assistant' }
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
})

router.afterEach((to) => {
  const title = (to.meta?.title as string | undefined) ?? ''
  document.title = title ? `${title} | TM Web` : 'TM Web'
})

export default router
