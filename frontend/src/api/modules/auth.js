import http from '../http';
export async function getAuthStatus() {
    const { data } = await http.get('/api/auth/status');
    return data;
}
export async function setupAdmin(input) {
    const { data } = await http.post('/api/auth/setup', input);
    return data;
}
export async function login(input) {
    const { data } = await http.post('/api/auth/login', input);
    return data;
}
export async function logout() {
    await http.post('/api/auth/logout');
}
