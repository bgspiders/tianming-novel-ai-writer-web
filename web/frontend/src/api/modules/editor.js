import { listChapters } from './chapters';
import http from '../http';
export async function listEditorChapters(projectId, volumeId) {
    return listChapters(projectId, volumeId);
}
export async function getEditorChapterAssist(id, relatedTopK = 6) {
    const { data } = await http.get(`/api/editor/chapters/${id}`, {
        params: { relatedTopK }
    });
    return {
        chapter: data.chapter,
        related: data.related.map(toVectorRecallResult)
    };
}
export async function saveEditorChapterContent(id, content, status = 'drafted') {
    const { data } = await http.put(`/api/editor/chapters/${id}/content`, { content, status });
    return data;
}
export async function searchVectorRecall(input) {
    const { data } = await http.post('/api/editor/search', {
        projectId: input.projectId,
        query: input.query,
        topK: input.topK
    });
    return data
        .filter((item) => item.chapterId !== input.chapterId)
        .map(toVectorRecallResult);
}
function toVectorRecallResult(item) {
    return {
        id: item.chapterId,
        source: `第 ${item.chapterNumber} 章`,
        title: item.title,
        excerpt: item.snippet || item.summary,
        score: item.score,
        matchedKeywords: item.matchedKeywords
    };
}
export async function getEditorIndexStatus(projectId) {
    const { data } = await http.get('/api/editor/index/status', {
        params: { projectId }
    });
    return data;
}
export async function rebuildEditorIndex(projectId) {
    const { data } = await http.post('/api/editor/index/rebuild', {
        projectId
    });
    return data;
}
