import http from '../http';
export async function listCategories(moduleType, sourceBookId, projectId) {
    const params = { moduleType };
    if (sourceBookId)
        params.sourceBookId = sourceBookId;
    if (projectId)
        params.projectId = projectId;
    const { data } = await http.get('/api/categories', { params });
    return data;
}
export async function getCategoryTree(moduleType, sourceBookId, projectId) {
    const params = { moduleType };
    if (sourceBookId)
        params.sourceBookId = sourceBookId;
    if (projectId)
        params.projectId = projectId;
    const { data } = await http.get('/api/categories/tree', { params });
    return data;
}
export async function createCategory(input) {
    const { data } = await http.post('/api/categories', input);
    return data;
}
export async function updateCategory(id, input) {
    const { data } = await http.put(`/api/categories/${id}`, input);
    return data;
}
export async function reorderCategories(input) {
    await http.post('/api/categories/reorder', input);
}
export async function deleteCategory(id) {
    await http.delete(`/api/categories/${id}`);
}
