import http from '../http';
export async function listGenerationRecords(projectId, chapterId, take = 50) {
    const params = { projectId, take };
    if (chapterId)
        params.chapterId = chapterId;
    const { data } = await http.get('/api/generation/records', { params });
    return data;
}
export async function getGenerationStatistics(projectId) {
    const { data } = await http.get('/api/generation/statistics', { params: { projectId } });
    return data;
}
export async function packageGenerationContext(projectId, sourceBookId) {
    const { data } = await http.post('/api/generation/package-context', {
        projectId,
        sourceBookId: sourceBookId || null
    });
    return data;
}
export async function getGenerationFlowStatus(projectId) {
    const { data } = await http.get('/api/generation/flow-status', {
        params: { projectId }
    });
    return data;
}
export async function listPromptRunSnapshots(params) {
    const { data } = await http.get('/api/generation/prompt-snapshots', { params });
    return data;
}
export async function getPromptRunSnapshot(id) {
    const { data } = await http.get(`/api/generation/prompt-snapshots/${id}`);
    return data;
}
