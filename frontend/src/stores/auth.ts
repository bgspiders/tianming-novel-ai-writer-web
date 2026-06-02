import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  getAuthStatus,
  login,
  logout,
  setupAdmin,
  type AuthCredentials,
  type AuthStatus
} from '@/api/modules/auth'

export const useAuthStore = defineStore('auth', () => {
  const initialized = ref(false)
  const authenticated = ref(false)
  const username = ref('')
  const expiresAt = ref<string | null>(null)
  const loading = ref(false)
  const serverInitialized = ref(false)
  const statusError = ref('')

  const needsSetup = computed(() => initialized.value && !serverInitialized.value)

  function applyStatus(status: AuthStatus) {
    serverInitialized.value = status.isInitialized
    authenticated.value = status.isAuthenticated
    username.value = status.username ?? ''
    expiresAt.value = status.expiresAt ?? null
    initialized.value = true
  }

  async function refresh() {
    loading.value = true
    statusError.value = ''
    try {
      applyStatus(await getAuthStatus())
    } catch (err) {
      initialized.value = true
      authenticated.value = false
      statusError.value = (err as Error).message || '认证状态加载失败。'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function setup(input: AuthCredentials) {
    const result = await setupAdmin(input)
    applyStatus({
      isInitialized: true,
      isAuthenticated: true,
      username: result.username,
      expiresAt: result.expiresAt
    })
  }

  async function signIn(input: AuthCredentials) {
    const result = await login(input)
    applyStatus({
      isInitialized: true,
      isAuthenticated: true,
      username: result.username,
      expiresAt: result.expiresAt
    })
  }

  async function signOut() {
    await logout()
    applyStatus({
      isInitialized: true,
      isAuthenticated: false,
      username: null,
      expiresAt: null
    })
  }

  return {
    initialized,
    serverInitialized,
    authenticated,
    username,
    expiresAt,
    loading,
    statusError,
    needsSetup,
    refresh,
    setup,
    signIn,
    signOut
  }
})
