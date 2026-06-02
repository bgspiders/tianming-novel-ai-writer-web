import http from '../http';
export async function generateNovelSeed(input) {
    const { data } = await http.post('/api/novel-seed', input, {
        timeout: 10 * 60_000
    });
    return data;
}
