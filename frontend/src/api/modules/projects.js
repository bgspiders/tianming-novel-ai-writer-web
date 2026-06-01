import http from '../http';
export async function listProjects() {
    const { data } = await http.get('/api/projects');
    return data;
}
export async function createProject(input) {
    const { data } = await http.post('/api/projects', input);
    return data;
}
export async function updateProject(id, input) {
    const { data } = await http.put(`/api/projects/${id}`, input);
    return data;
}
export async function deleteProject(id) {
    await http.delete(`/api/projects/${id}`);
}
export async function listVolumes(projectId) {
    const { data } = await http.get('/api/volumes', { params: { projectId } });
    return data;
}
export async function createVolume(input) {
    const { data } = await http.post('/api/volumes', input);
    return data;
}
export async function updateVolume(id, input) {
    const { data } = await http.put(`/api/volumes/${id}`, input);
    return data;
}
export async function deleteVolume(id) {
    await http.delete(`/api/volumes/${id}`);
}
