import http from '../http'

export interface NotificationItem {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  body: string
  routeLink: string | null
  isRead: boolean
  readAt: string | null
  createdAt: string
  updatedAt: string
}

export interface NotificationCreateInput {
  type?: NotificationItem['type']
  title: string
  body?: string
  routeLink?: string | null
}

export interface NotificationReadInput {
  isRead: boolean
}

export interface NotificationReadResult {
  id: string
  isRead: boolean
  readAt: string | null
  updatedAt: string
}

export async function listNotifications(params?: { take?: number; isRead?: boolean | null }): Promise<NotificationItem[]> {
  const { data } = await http.get<NotificationItem[]>('/api/notifications', {
    params: {
      take: params?.take,
      isRead: params?.isRead ?? undefined
    }
  })
  return data
}

export async function createNotification(input: NotificationCreateInput): Promise<NotificationItem> {
  const { data } = await http.post<NotificationItem>('/api/notifications', {
    type: input.type ?? 'info',
    title: input.title,
    body: input.body ?? '',
    routeLink: input.routeLink ?? null
  })
  return data
}

export async function markNotificationRead(id: string, input: NotificationReadInput): Promise<NotificationReadResult> {
  const { data } = await http.put<NotificationReadResult>(`/api/notifications/${id}/read`, input)
  return data
}
