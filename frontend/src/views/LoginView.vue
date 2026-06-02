<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Lock, User, Reading, MagicStick } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const submitting = ref(false)

const form = reactive({
  username: '',
  password: ''
})

const isSetup = computed(() => auth.needsSetup)
const title = computed(() => (isSetup.value ? '初始化管理员' : 'AI生成小说'))
const subtitle = computed(() => (isSetup.value ? '首次安装，请设置本地管理员账号' : '让想象力，成就你的故事'))
const actionText = computed(() => (isSetup.value ? '保存并进入' : '登录'))

async function submit() {
  if (!form.username.trim() || !form.password.trim()) {
    ElMessage.warning('请输入账号和密码。')
    return
  }

  submitting.value = true
  try {
    if (isSetup.value) {
      await auth.setup({ username: form.username.trim(), password: form.password })
      ElMessage.success('管理员账号已保存。')
    } else {
      await auth.signIn({ username: form.username.trim(), password: form.password })
      ElMessage.success('登录成功。')
    }
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await router.replace(redirect)
  } catch (err) {
    ElMessage.error((err as Error).message || '登录失败。')
  } finally {
    submitting.value = false
  }
}

</script>

<template>
  <div class="login-page">
    <div class="sky-layer sky-layer--one" />
    <div class="sky-layer sky-layer--two" />
    <div class="castle" aria-hidden="true">
      <span class="tower tower--main" />
      <span class="tower tower--left" />
      <span class="tower tower--right" />
      <span class="keep" />
    </div>
    <div class="open-book" aria-hidden="true" />

    <main class="login-card">
      <div class="brand-mark">
        <el-icon><Reading /></el-icon>
        <el-icon class="brand-mark__quill"><MagicStick /></el-icon>
      </div>
      <h1>{{ title }}</h1>
      <p>{{ subtitle }}</p>
      <el-alert
        v-if="auth.statusError"
        class="login-alert"
        type="warning"
        :title="auth.statusError"
        show-icon
        :closable="false"
      />

      <el-form class="login-form" @submit.prevent="submit">
        <el-form-item>
          <el-input
            v-model="form.username"
            size="large"
            :prefix-icon="User"
            placeholder="账号"
            autocomplete="username"
            @keyup.enter="submit"
          />
        </el-form-item>
        <el-form-item>
          <el-input
            v-model="form.password"
            size="large"
            :prefix-icon="Lock"
            type="password"
            show-password
            placeholder="密码"
            autocomplete="current-password"
            @keyup.enter="submit"
          />
        </el-form-item>
        <el-button class="login-button" type="primary" size="large" :loading="submitting || auth.loading" @click="submit">
          {{ actionText }}
        </el-button>
      </el-form>
    </main>
  </div>
</template>

<style scoped>
.login-page {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  display: grid;
  place-items: center;
  padding: 32px;
  background:
    radial-gradient(circle at 18% 18%, rgba(255, 255, 255, 0.92), transparent 18%),
    radial-gradient(circle at 74% 24%, rgba(255, 255, 255, 0.58), transparent 16%),
    linear-gradient(135deg, #e6f2ff 0%, #cdd9ff 48%, #f7f1ff 100%);
}
.sky-layer {
  position: absolute;
  inset: auto;
  border-radius: 999px;
  filter: blur(14px);
  opacity: 0.72;
  pointer-events: none;
}
.sky-layer--one {
  width: 620px;
  height: 180px;
  left: -80px;
  top: 120px;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 180px 24px 0 rgba(255, 255, 255, 0.5), 360px -28px 0 rgba(255, 255, 255, 0.35);
}
.sky-layer--two {
  width: 540px;
  height: 150px;
  right: -120px;
  bottom: 150px;
  background: rgba(255, 255, 255, 0.5);
  box-shadow: -220px 20px 0 rgba(255, 255, 255, 0.32);
}
.castle {
  position: absolute;
  left: 8vw;
  bottom: 12vh;
  width: 240px;
  height: 420px;
  opacity: 0.42;
  filter: drop-shadow(0 24px 34px rgba(92, 109, 178, 0.18));
}
.tower,
.keep {
  position: absolute;
  bottom: 0;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(159, 181, 238, 0.46));
  border: 1px solid rgba(255, 255, 255, 0.72);
}
.tower::before {
  content: '';
  position: absolute;
  left: 50%;
  top: -82px;
  transform: translateX(-50%);
  border-left: 22px solid transparent;
  border-right: 22px solid transparent;
  border-bottom: 86px solid rgba(255, 255, 255, 0.9);
}
.tower--main {
  left: 92px;
  width: 54px;
  height: 340px;
  border-radius: 28px 28px 4px 4px;
}
.tower--left {
  left: 24px;
  width: 46px;
  height: 230px;
  border-radius: 24px 24px 4px 4px;
}
.tower--right {
  right: 22px;
  width: 48px;
  height: 270px;
  border-radius: 24px 24px 4px 4px;
}
.keep {
  left: 48px;
  right: 42px;
  height: 150px;
  border-radius: 12px 12px 4px 4px;
}
.open-book {
  position: absolute;
  right: 8vw;
  bottom: 8vh;
  width: 360px;
  height: 120px;
  border-radius: 50% 50% 16px 16px;
  background:
    linear-gradient(92deg, transparent 49%, rgba(120, 110, 190, 0.22) 50%, transparent 51%),
    linear-gradient(8deg, rgba(255, 255, 255, 0.92), rgba(238, 236, 255, 0.78));
  box-shadow: 0 22px 42px rgba(92, 109, 178, 0.2);
  transform: rotate(-5deg);
  opacity: 0.78;
}
.login-card {
  position: relative;
  z-index: 1;
  width: min(560px, 92vw);
  padding: 52px 58px 48px;
  border: 1px solid rgba(255, 255, 255, 0.76);
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 32px 90px rgba(91, 99, 166, 0.26), inset 0 1px 0 rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(22px);
  text-align: center;
}
.brand-mark {
  position: relative;
  width: 82px;
  height: 70px;
  display: inline-grid;
  place-items: center;
  margin-bottom: 14px;
  color: #744ce6;
  font-size: 54px;
}
.brand-mark__quill {
  position: absolute;
  right: 4px;
  top: 0;
  font-size: 28px;
  transform: rotate(-20deg);
}
h1 {
  margin: 0;
  color: #241d55;
  font-family: Georgia, 'Songti SC', serif;
  font-size: 44px;
  font-weight: 500;
  letter-spacing: 0;
}
p {
  margin: 16px 0 34px;
  color: #77799a;
  font-size: 16px;
}
.login-form {
  display: grid;
  gap: 8px;
}
.login-alert {
  margin: -16px 0 18px;
  text-align: left;
}
.login-form :deep(.el-input__wrapper) {
  height: 56px;
  border-radius: 8px;
  box-shadow: 0 0 0 1px rgba(116, 76, 230, 0.1) inset;
}
.login-button {
  width: 100%;
  height: 58px;
  margin-top: 6px;
  border: 0;
  border-radius: 8px;
  font-size: 20px;
  background: linear-gradient(135deg, #8d63f2, #6847de);
  box-shadow: 0 12px 26px rgba(105, 71, 222, 0.3);
}
@media (max-width: 720px) {
  .login-page {
    padding: 20px;
  }
  .login-card {
    padding: 40px 24px 34px;
    border-radius: 22px;
  }
  h1 {
    font-size: 34px;
  }
  .castle,
  .open-book {
    opacity: 0.24;
  }
}
</style>
