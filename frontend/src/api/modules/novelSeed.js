import http from '../http';
export async function generateNovelSeed(input) {
    const { data } = await http.post('/api/novel-seed', input, {
        timeout: 10 * 60_000
    });
    return data;
}
export async function listNovelSeedPlans() {
    const { data } = await http.get('/api/novel-seed/plans');
    return data;
}
export async function getOrCreateNovelSeedConversation(projectId, providerId, modelCode) {
    const { data } = await http.post(`/api/novel-seed/plans/${projectId}/conversation`, null, {
        params: { providerId, modelCode }
    });
    return data;
}
