import http from '../http';
export async function postTestCompletion(req) {
    const { data } = await http.post('/api/ai/test-completion', req);
    return data;
}
