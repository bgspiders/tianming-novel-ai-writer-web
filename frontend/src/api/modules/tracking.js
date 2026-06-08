import http from '../http';
function buildParams(params) {
    const out = { projectId: params.projectId };
    if (params.sourceBookId)
        out.sourceBookId = params.sourceBookId;
    if (params.keyword)
        out.keyword = params.keyword;
    if (params.startChapterNumber)
        out.startChapterNumber = params.startChapterNumber;
    if (params.endChapterNumber)
        out.endChapterNumber = params.endChapterNumber;
    return out;
}
export async function listForeshadowings(params) {
    const { data } = await http.get('/api/tracking/foreshadowings', { params: buildParams(params) });
    return data;
}
export async function createForeshadowing(input) {
    const { data } = await http.post('/api/tracking/foreshadowings', input);
    return data;
}
export async function updateForeshadowing(id, input) {
    const { data } = await http.put(`/api/tracking/foreshadowings/${id}`, input);
    return data;
}
export async function deleteForeshadowing(id) {
    await http.delete(`/api/tracking/foreshadowings/${id}`);
}
export async function listTimelines(params) {
    const { data } = await http.get('/api/tracking/timelines', { params: buildParams(params) });
    return data;
}
export async function createTimeline(input) {
    const { data } = await http.post('/api/tracking/timelines', input);
    return data;
}
export async function updateTimeline(id, input) {
    const { data } = await http.put(`/api/tracking/timelines/${id}`, input);
    return data;
}
export async function deleteTimeline(id) {
    await http.delete(`/api/tracking/timelines/${id}`);
}
export async function getLongNovelCompleteness(projectId, sourceBookId) {
    const { data } = await http.get('/api/tracking/completeness', {
        params: { projectId, ...(sourceBookId ? { sourceBookId } : {}) }
    });
    return data;
}
export async function rebuildTracking(input) {
    const { data } = await http.post('/api/tracking/rebuild', input);
    return data;
}
