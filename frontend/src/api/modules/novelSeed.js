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
export async function createNovelSeedWorkflow(input) {
    const { data } = await http.post('/api/novel-seed/workflows', input);
    return data;
}
export async function updateNovelSeedWorkflowRequest(workflowId, input) {
    const { data } = await http.put(`/api/novel-seed/workflows/${workflowId}/request`, input);
    return data;
}
export async function listNovelSeedWorkflows(take = 20) {
    const { data } = await http.get('/api/novel-seed/workflows', {
        params: { take }
    });
    return data;
}
export async function getNovelSeedWorkflow(workflowId) {
    const { data } = await http.get(`/api/novel-seed/workflows/${workflowId}`);
    return data;
}
export async function runNovelSeedWorkflowStep(workflowId, stepKey) {
    const { data } = await http.post(`/api/novel-seed/workflows/${workflowId}/steps/${stepKey}/run`, null, {
        timeout: 10 * 60_000
    });
    return data;
}
export async function confirmNovelSeedWorkflowStep(workflowId, stepKey, confirmed) {
    const { data } = await http.post(`/api/novel-seed/workflows/${workflowId}/steps/${stepKey}/confirm`, null, { params: { confirmed } });
    return data;
}
export async function previewNovelSeedWorkflowStep(workflowId, stepKey) {
    const { data } = await http.get(`/api/novel-seed/workflows/${workflowId}/steps/${stepKey}/preview`);
    return data;
}
export async function rewriteNovelSeedWorkflowStepFragment(workflowId, stepKey, itemKey, instruction) {
    const { data } = await http.post(`/api/novel-seed/workflows/${workflowId}/steps/${stepKey}/rewrite`, { itemKey, instruction }, { timeout: 10 * 60_000 });
    return data;
}
export async function deleteNovelSeedWorkflow(workflowId) {
    await http.delete(`/api/novel-seed/workflows/${workflowId}`);
}
