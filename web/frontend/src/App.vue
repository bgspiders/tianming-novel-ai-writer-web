<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { ElConfigProvider } from 'element-plus'
import en from 'element-plus/es/locale/lang/en'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { RouterView } from 'vue-router'
import { useRoute } from 'vue-router'
import { buildDocumentTitle, syncDocumentLanguage } from '@/i18n'
import { useLocaleStore } from '@/stores/locale'

const route = useRoute()
const localeStore = useLocaleStore()

const elementLocale = computed(() => (localeStore.locale === 'zh-CN' ? zhCn : en))

watchEffect(() => {
  syncDocumentLanguage(localeStore.locale)
  document.title = buildDocumentTitle(route.meta?.titleKey as string | undefined, localeStore.locale)
})
</script>

<template>
  <el-config-provider :locale="elementLocale">
    <RouterView />
  </el-config-provider>
</template>

<style>
#app {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB',
    'Microsoft YaHei', '微软雅黑', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  height: 100%;
}
</style>
