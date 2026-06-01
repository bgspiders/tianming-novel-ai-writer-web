import http from '../http';
export async function listNotifications(params) {
    const { data } = await http.get('/api/notifications', {
        params: {
            take: params?.take,
            isRead: params?.isRead ?? undefined
        }
    });
    return data;
}
export async function createNotification(input) {
    const { data } = await http.post('/api/notifications', {
        type: input.type ?? 'info',
        title: input.title,
        body: input.body ?? '',
        routeLink: input.routeLink ?? null
    });
    return data;
}
export async function markNotificationRead(id, input) {
    const { data } = await http.put(`/api/notifications/${id}/read`, input);
    return data;
}
