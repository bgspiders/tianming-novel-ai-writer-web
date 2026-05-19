import http from '../http';
export async function listSourceBooks() {
    const { data } = await http.get('/api/source-books');
    return data;
}
export async function createSourceBook(input) {
    const { data } = await http.post('/api/source-books', input);
    return data;
}
export async function updateSourceBook(id, input) {
    const { data } = await http.put(`/api/source-books/${id}`, input);
    return data;
}
export async function deleteSourceBook(id) {
    await http.delete(`/api/source-books/${id}`);
}
