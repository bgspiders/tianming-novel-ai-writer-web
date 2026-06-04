import http from '../http';
export async function listTianmingProtocols() {
    return (await http.get('/api/tianming/protocols')).data;
}
export async function runTianmingProtocol(input) {
    return (await http.post('/api/tianming/protocols/run', input)).data;
}
export async function listTianmingKnowledgeBaseFiles() {
    return (await http.get('/api/tianming/protocols/knowledge-base')).data;
}
export async function getTianmingKnowledgeBaseStatus(projectId, sourceBookId) {
    return (await http.get('/api/tianming/protocols/knowledge-base/status', {
        params: { projectId, sourceBookId }
    })).data;
}
export async function getTianmingKnowledgeBaseFile(key, projectId, sourceBookId) {
    return (await http.get(`/api/tianming/protocols/knowledge-base/${key}`, {
        params: { projectId, sourceBookId }
    })).data;
}
export async function exportTianmingKnowledgeBase(projectId, sourceBookId) {
    return (await http.get('/api/tianming/protocols/knowledge-base/export', {
        params: { projectId, sourceBookId }
    })).data;
}
export async function importTianmingKnowledgeBaseFile(input) {
    return (await http.post('/api/tianming/protocols/knowledge-base/import', input)).data;
}
