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
  document.title = title ? `${title} · 天命 Web` : '天命 Web'
})

export default router
