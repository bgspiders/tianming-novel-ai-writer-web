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
        redirect: '/design/outlines'
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
