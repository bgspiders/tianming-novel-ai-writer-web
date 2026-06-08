import http from '../http';
function buildEditorListParams(params) {
    if (!params)
        return undefined;
    const query = {};
    if (params.projectId)
        query.projectId = params.projectId;
    if (params.sourceBookId)
        query.sourceBookId = params.sourceBookId;
    if (params.keyword)
        query.keyword = params.keyword;
    return Object.keys(query).length ? query : undefined;
}
function buildRecallParams(params) {
    if (!params)
        return undefined;
    const query = {};
    if (params.query)
        query.query = params.query;
    if (params.topK && params.topK > 0)
        query.topK = params.topK;
    return Object.keys(query).length ? query : undefined;
}
export const chaptersApi = {
    list: async (params) => (await http.get('/api/chapters/editor-list', { params: buildEditorListParams(params) })).data,
    get: async (id) => (await http.get(`/api/chapters/${id}/editor`)).data,
    saveContent: async (id, payload) => (await http.put(`/api/chapters/${id}/editor-content`, payload)).data,
    versions: async (id) => (await http.get(`/api/chapters/${id}/versions`)).data,
    version: async (id, versionId) => (await http.get(`/api/chapters/${id}/versions/${versionId}`)).data,
    restoreVersion: async (id, payload) => (await http.post(`/api/chapters/${id}/restore-version`, payload)).data,
    recall: async (id, params) => (await http.get(`/api/chapters/${id}/recall`, { params: buildRecallParams(params) })).data
};
export async function listChapters(projectId, volumeId) {
    const params = { projectId };
    if (volumeId)
        params.volumeId = volumeId;
    const { data } = await http.get('/api/chapters', { params });
    return data;
}
export async function getChapter(id) {
    const { data } = await http.get(`/api/chapters/${id}`);
    return data;
}
export async function createChapter(input) {
    const { data } = await http.post('/api/chapters', input);
    return data;
}
export async function updateChapter(id, input) {
    const { data } = await http.put(`/api/chapters/${id}`, input);
    return data;
}
export async function saveChapterContent(id, content, status = 'drafted') {
    const { data } = await http.put(`/api/chapters/${id}/content`, { content, status });
    return data;
}
export async function deleteChapter(id) {
    await http.delete(`/api/chapters/${id}`);
}
export async function generateChapterDraft(input) {
    const { data } = await http.post('/api/generation/chapter-draft', input, {
        timeout: 10 * 60_000
    });
    return data;
}
export async function queueChapterBatchGeneration(input) {
    const { data } = await http.post('/api/generation/chapter-batch-jobs', input);
    return data;
}
export async function previewChapterBatchGeneration(input) {
    const { data } = await http.post('/api/generation/chapter-batch-preview', input);
    return data;
}
export async function getChapterBatchGenerationStatus(jobId) {
    const { data } = await http.get(`/api/generation/chapter-batch-jobs/${jobId}`);
    return data;
}
export async function listChapterBatchGenerationJobs(projectId) {
    const params = projectId ? { projectId } : undefined;
    const { data } = await http.get('/api/generation/chapter-batch-jobs', { params });
    return data;
}
export async function cancelChapterBatchGeneration(jobId) {
    await http.post(`/api/generation/chapter-batch-jobs/${jobId}/cancel`);
}
export async function runGenerationPreflight(input) {
    const { data } = await http.post('/api/generation/preflight', input);
    return data;
}
export async function ensureSceneBlueprints(input) {
    const { data } = await http.post(`/api/generation/chapters/${input.chapterId}/scene-blueprints/ensure`, input);
    return data;
}
export async function confirmChapterGenerationPreview(input) {
    const { data } = await http.post(`/api/generation/chapters/${input.chapterId}/preview/confirm`, input);
    return data;
}
export async function generateSceneDraft(input) {
    const { data } = await http.post(`/api/generation/chapters/${input.chapterId}/scene-draft`, input, {
        timeout: 3 * 60_000
    });
    return data;
}
export async function composeSceneDrafts(input) {
    const { data } = await http.post(`/api/generation/chapters/${input.chapterId}/scene-compose`, input);
    return data;
}
export async function analyzeGeneratedChapter(input) {
    const { data } = await http.post(`/api/generation/chapters/${input.chapterId}/analysis`, input);
    return data;
}
