import http from '../http';
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
    const { data } = await http.post('/api/generation/chapter-draft', input);
    return data;
}
