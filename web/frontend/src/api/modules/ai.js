import http from '../http';
// --- Providers ---
export async function listProviders() {
    const { data } = await http.get('/api/ai-providers');
    return data;
}
export async function createProvider(input) {
    const { data } = await http.post('/api/ai-providers', input);
    return data;
}
export async function updateProvider(id, input) {
    const { data } = await http.put(`/api/ai-providers/${id}`, input);
    return data;
}
export async function deleteProvider(id) {
    await http.delete(`/api/ai-providers/${id}`);
}
// --- Models ---
export async function listModels(providerId) {
    const { data } = await http.get(`/api/ai-providers/${providerId}/models`);
    return data;
}
export async function createModel(providerId, input) {
    const { data } = await http.post(`/api/ai-providers/${providerId}/models`, input);
    return data;
}
export async function updateModel(providerId, modelId, input) {
    const { data } = await http.put(`/api/ai-providers/${providerId}/models/${modelId}`, input);
    return data;
}
export async function deleteModel(providerId, modelId) {
    await http.delete(`/api/ai-providers/${providerId}/models/${modelId}`);
}
// --- Keys ---
export async function listKeys(providerId) {
    const { data } = await http.get('/api/ai-keys', {
        params: providerId ? { providerId } : undefined
    });
    return data;
}
export async function createKey(input) {
    const { data } = await http.post('/api/ai-keys', input);
    return data;
}
export async function updateKey(id, input) {
    const { data } = await http.put(`/api/ai-keys/${id}`, input);
    return data;
}
export async function deleteKey(id) {
    await http.delete(`/api/ai-keys/${id}`);
}
export async function testKey(id, input) {
    const { data } = await http.post(`/api/ai-keys/${id}/test`, input);
    return data;
}
export async function listProviderConfigs() {
    const { data } = await http.get('/api/ai-provider-configs');
    return data;
}
export async function createProviderConfig(input) {
    const { data } = await http.post('/api/ai-provider-configs', input);
    return data;
}
export async function updateProviderConfig(providerId, input) {
    const { data } = await http.put(`/api/ai-provider-configs/${providerId}`, input);
    return data;
}
export async function deleteProviderConfig(providerId) {
    await http.delete(`/api/ai-provider-configs/${providerId}`);
}
export async function discoverRemoteModels(input) {
    const { data } = await http.post('/api/ai-provider-configs/discover-models', input);
    return data;
}
