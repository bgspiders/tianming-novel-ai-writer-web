import http from '../http';
export async function listChatSessions(projectId) {
    const params = {};
    if (projectId)
        params.projectId = projectId;
    const { data } = await http.get('/api/chat-assistant/sessions', { params });
    return data;
}
export async function createChatSession(input) {
    const { data } = await http.post('/api/chat-assistant/sessions', input);
    return data;
}
export async function updateChatSession(id, input) {
    const { data } = await http.put(`/api/chat-assistant/sessions/${id}`, input);
    return data;
}
export async function deleteChatSession(id) {
    await http.delete(`/api/chat-assistant/sessions/${id}`);
}
export async function listChatMessages(sessionId) {
    const { data } = await http.get(`/api/chat-assistant/sessions/${sessionId}/messages`);
    return data;
}
export async function sendChatMessage(sessionId, input) {
    const { data } = await http.post(`/api/chat-assistant/sessions/${sessionId}/messages`, input);
    return data;
}
export async function executeChatPlan(sessionId, messageId, input) {
    const { data } = await http.post(`/api/chat-assistant/sessions/${sessionId}/messages/${messageId}/execute`, input);
    return data;
}
