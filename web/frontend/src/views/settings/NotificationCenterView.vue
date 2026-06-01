<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useI18n } from '@/composables/useI18n'
import {
  createNotification,
  listNotifications,
  markNotificationRead,
  type NotificationItem
} from '@/api/modules/notifications'

type PermissionState = NotificationPermission | 'unsupported'

const checking = ref(false)
const requesting = ref(false)
const sending = ref(false)
const loadingHistory = ref(false)
const { t } = useI18n()
const lastAction = ref(t('notifications.messages.notRequested'))
const permission = ref<PermissionState>('default')
const notifications = ref<NotificationItem[]>([])

const supported = computed(() => typeof window !== 'undefined' && 'Notification' in window)
const permissionLabel = computed(() => {
  if (permission.value === 'granted') return t('notifications.permissionState.granted')
  if (permission.value === 'denied') return t('notifications.permissionState.denied')
  if (permission.value === 'unsupported') return t('notifications.permissionState.unsupported')
  return t('notifications.permissionState.default')
})
const permissionType = computed(() => {
  if (permission.value === 'granted') return 'success'
  if (permission.value === 'denied') return 'danger'
  if (permission.value === 'unsupported') return 'info'
  return 'warning'
})

watch(
  () => t('notifications.messages.notRequested'),
  (value, previous) => {
    if (lastAction.value === previous) {
      lastAction.value = value
    }
  }
)

function refreshPermission() {
  checking.value = true
  try {
    permission.value = supported.value ? Notification.permission : 'unsupported'
  } finally {
    checking.value = false
  }
}

async function loadNotifications() {
  loadingHistory.value = true
  try {
    notifications.value = await listNotifications({ take: 20 })
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : t('notifications.messages.loadFailed'))
  } finally {
    loadingHistory.value = false
  }
}

async function requestPermission() {
  if (!supported.value) {
    lastAction.value = t('notifications.messages.unsupported')
    ElMessage.warning(lastAction.value)
    return
  }

  requesting.value = true
  try {
    const result = await Notification.requestPermission()
    permission.value = result
    lastAction.value = t('notifications.messages.permissionFinished', { result })
    ElMessage.success(lastAction.value)
  } catch (error) {
    lastAction.value = error instanceof Error ? error.message : t('notifications.messages.permissionFailed')
    ElMessage.error(lastAction.value)
  } finally {
    requesting.value = false
  }
}

async function sendTestNotification() {
  if (!supported.value) {
    lastAction.value = t('notifications.messages.browserUnavailable')
    ElMessage.warning(lastAction.value)
    return
  }

  if (Notification.permission !== 'granted') {
    lastAction.value = t('notifications.messages.grantFirst')
    ElMessage.warning(lastAction.value)
    return
  }

  sending.value = true
  try {
    const saved = await createNotification({
      type: 'info',
      title: t('notifications.messages.testTitle'),
      body: t('notifications.messages.testBody'),
      routeLink: '/settings/notifications'
    })

    const notification = new Notification(t('notifications.messages.testTitle'), {
      body: t('notifications.messages.testBody'),
      tag: 'tm-web-stage-10-test',
      requireInteraction: false
    })

    notification.onclick = () => {
      window.focus()
      notification.close()
    }

    lastAction.value = t('notifications.messages.sentAt', { time: new Date().toLocaleTimeString() })
    notifications.value = [saved, ...notifications.value]
    ElMessage.success(lastAction.value)
  } catch (error) {
    lastAction.value = error instanceof Error ? error.message : t('notifications.messages.sendFailed')
    ElMessage.error(lastAction.value)
  } finally {
    sending.value = false
  }
}

async function toggleRead(item: NotificationItem) {
  try {
    const result = await markNotificationRead(item.id, { isRead: !item.isRead })
    notifications.value = notifications.value.map((row) =>
      row.id === item.id
        ? { ...row, isRead: result.isRead, readAt: result.readAt, updatedAt: result.updatedAt }
        : row
    )
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : t('notifications.messages.updateFailed'))
  }
}

onMounted(() => {
  refreshPermission()
  void loadNotifications()
})
</script>

<template>
  <div class="notifications-view">
    <section class="hero tm-panel">
      <div class="hero-copy">
        <div class="eyebrow">{{ t('notifications.eyebrow') }}</div>
        <h1>{{ t('notifications.title') }}</h1>
        <p>{{ t('notifications.description') }}</p>
      </div>

      <div class="status-card">
        <div class="status-top">
          <span class="status-label">{{ t('notifications.statusCard.title') }}</span>
          <el-tag :type="permissionType" effect="plain">{{ permissionLabel }}</el-tag>
        </div>
        <div class="status-line">
          {{ t('notifications.statusCard.support', { value: supported ? t('notifications.statusCard.available') : t('notifications.statusCard.unavailable') }) }}
        </div>
        <div class="status-line">{{ t('notifications.statusCard.lastAction', { value: lastAction }) }}</div>
      </div>
    </section>

    <section class="grid">
      <el-card shadow="never" class="panel">
        <template #header>
          <div class="panel-title">{{ t('notifications.permission.title') }}</div>
        </template>

        <div class="panel-stack">
          <el-alert
            :title="supported ? t('notifications.permission.canRequest') : t('notifications.permission.unsupported')"
            :type="supported ? 'info' : 'warning'"
            :closable="false"
            show-icon
          />

          <div class="actions">
            <el-button :loading="checking" @click="refreshPermission">{{ t('notifications.permission.refresh') }}</el-button>
            <el-button type="primary" :loading="requesting" @click="requestPermission">
              {{ t('notifications.permission.request') }}
            </el-button>
          </div>
        </div>
      </el-card>

      <el-card shadow="never" class="panel">
        <template #header>
          <div class="panel-title">{{ t('notifications.delivery.title') }}</div>
        </template>

        <div class="panel-stack">
          <p class="muted">{{ t('notifications.delivery.hint') }}</p>

          <div class="actions">
            <el-button
              type="success"
              :disabled="permission !== 'granted'"
              :loading="sending"
              @click="sendTestNotification"
            >
              {{ t('notifications.delivery.send') }}
            </el-button>
          </div>
        </div>
      </el-card>

      <el-card shadow="never" class="panel span-2">
        <template #header>
          <div class="panel-title">{{ t('notifications.history.title') }}</div>
        </template>

        <el-skeleton :rows="4" animated :loading="loadingHistory">
          <el-empty v-if="!notifications.length" :description="t('notifications.history.empty')" />

          <div v-else class="history-list">
            <div v-for="item in notifications" :key="item.id" class="history-item">
              <div class="history-top">
                <div class="history-title">
                  <strong>{{ item.title }}</strong>
                  <el-tag :type="item.isRead ? 'info' : 'success'" size="small" effect="plain">
                    {{ item.isRead ? t('notifications.history.read') : t('notifications.history.unread') }}
                  </el-tag>
                </div>
                <el-button text size="small" @click="toggleRead(item)">
                  {{ item.isRead ? t('notifications.history.markUnread') : t('notifications.history.markRead') }}
                </el-button>
              </div>
              <div class="history-body">{{ item.body || t('notifications.history.noBody') }}</div>
              <div class="history-meta">
                <span>{{ item.type }}</span>
                <span>{{ item.routeLink || t('notifications.history.noRoute') }}</span>
                <span>{{ item.createdAt }}</span>
              </div>
            </div>
          </div>
        </el-skeleton>
      </el-card>
    </section>
  </div>
</template>

<style scoped>
.notifications-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.hero {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 18px;
  padding: 24px;
  border-radius: 24px;
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-size: 11px;
  color: var(--tm-primary);
  margin-bottom: 10px;
}

.hero-copy h1 {
  margin: 0 0 12px;
  font-size: 34px;
}

.hero-copy p,
.muted,
.status-line,
.checklist {
  color: var(--tm-fg-secondary);
  line-height: 1.8;
}

.status-card {
  border-radius: 20px;
  padding: 18px;
  background: color-mix(in srgb, var(--tm-bg-elevated) 92%, transparent);
  border: 1px solid color-mix(in srgb, var(--tm-border) 70%, transparent);
  display: flex;
  flex-direction: column;
  gap: 12px;
  justify-content: space-between;
}

.status-top,
.actions {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.status-label,
.panel-title {
  font-weight: 700;
  color: var(--tm-fg-primary);
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.span-2 {
  grid-column: span 2;
}

.panel {
  border-radius: 20px;
  background: color-mix(in srgb, var(--tm-bg-elevated) 92%, transparent);
  border: 1px solid color-mix(in srgb, var(--tm-border) 70%, transparent);
}

.panel-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-item {
  border: 1px solid color-mix(in srgb, var(--tm-border) 70%, transparent);
  border-radius: 14px;
  padding: 14px;
  background: color-mix(in srgb, var(--tm-bg) 92%, transparent);
}

.history-top,
.history-title,
.history-meta {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
}

.history-body,
.history-meta {
  color: var(--tm-fg-secondary);
  line-height: 1.7;
}

.history-body {
  margin-top: 8px;
}

.history-meta {
  margin-top: 8px;
  font-size: 12px;
}

@media (max-width: 1100px) {
  .hero,
  .grid {
    grid-template-columns: 1fr;
  }

  .span-2 {
    grid-column: span 1;
  }
}
</style>
