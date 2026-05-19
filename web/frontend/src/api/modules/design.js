import http from '../http';
function buildParams(p) {
    if (!p)
        return undefined;
    const out = {};
    if (p.categoryId)
        out.categoryId = p.categoryId;
    if (p.sourceBookId)
        out.sourceBookId = p.sourceBookId;
    if (p.keyword)
        out.keyword = p.keyword;
    if (p.isEnabled !== undefined && p.isEnabled !== null)
        out.isEnabled = p.isEnabled;
    return Object.keys(out).length ? out : undefined;
}
export const worldRulesApi = {
    list: async (p) => (await http.get('/api/design/world-rules', { params: buildParams(p) })).data,
    get: async (id) => (await http.get(`/api/design/world-rules/${id}`)).data,
    create: async (input) => (await http.post('/api/design/world-rules', input)).data,
    update: async (id, input) => (await http.put(`/api/design/world-rules/${id}`, input)).data,
    remove: async (id) => {
        await http.delete(`/api/design/world-rules/${id}`);
    }
};
export const characterRulesApi = {
    list: async (p) => (await http.get('/api/design/character-rules', { params: buildParams(p) })).data,
    get: async (id) => (await http.get(`/api/design/character-rules/${id}`)).data,
    create: async (input) => (await http.post('/api/design/character-rules', input)).data,
    update: async (id, input) => (await http.put(`/api/design/character-rules/${id}`, input)).data,
    remove: async (id) => {
        await http.delete(`/api/design/character-rules/${id}`);
    }
};
export const factionRulesApi = {
    list: async (p) => (await http.get('/api/design/faction-rules', { params: buildParams(p) })).data,
    get: async (id) => (await http.get(`/api/design/faction-rules/${id}`)).data,
    create: async (input) => (await http.post('/api/design/faction-rules', input)).data,
    update: async (id, input) => (await http.put(`/api/design/faction-rules/${id}`, input)).data,
    remove: async (id) => {
        await http.delete(`/api/design/faction-rules/${id}`);
    }
};
export const locationRulesApi = {
    list: async (p) => (await http.get('/api/design/location-rules', { params: buildParams(p) })).data,
    get: async (id) => (await http.get(`/api/design/location-rules/${id}`)).data,
    create: async (input) => (await http.post('/api/design/location-rules', input)).data,
    update: async (id, input) => (await http.put(`/api/design/location-rules/${id}`, input)).data,
    remove: async (id) => {
        await http.delete(`/api/design/location-rules/${id}`);
    }
};
export const plotRulesApi = {
    list: async (p) => (await http.get('/api/design/plot-rules', { params: buildParams(p) })).data,
    get: async (id) => (await http.get(`/api/design/plot-rules/${id}`)).data,
    create: async (input) => (await http.post('/api/design/plot-rules', input)).data,
    update: async (id, input) => (await http.put(`/api/design/plot-rules/${id}`, input)).data,
    remove: async (id) => {
        await http.delete(`/api/design/plot-rules/${id}`);
    }
};
export const creativeMaterialsApi = {
    list: async (p) => (await http.get('/api/design/creative-materials', { params: buildParams(p) })).data,
    get: async (id) => (await http.get(`/api/design/creative-materials/${id}`)).data,
    create: async (input) => (await http.post('/api/design/creative-materials', input)).data,
    update: async (id, input) => (await http.put(`/api/design/creative-materials/${id}`, input)).data,
    remove: async (id) => {
        await http.delete(`/api/design/creative-materials/${id}`);
    }
};
export const bookAnalysesApi = {
    list: async (p) => (await http.get('/api/design/book-analyses', { params: buildParams(p) })).data,
    get: async (id) => (await http.get(`/api/design/book-analyses/${id}`)).data,
    create: async (input) => (await http.post('/api/design/book-analyses', input)).data,
    update: async (id, input) => (await http.put(`/api/design/book-analyses/${id}`, input)).data,
    remove: async (id) => {
        await http.delete(`/api/design/book-analyses/${id}`);
    }
};
export const DESIGN_MODULES = [
    { key: 'world_rules', label: '世界规则', icon: '🌍', hasSourceBookScope: true },
    { key: 'character_rules', label: '角色规则', icon: '🧑', hasSourceBookScope: true },
    { key: 'faction_rules', label: '势力规则', icon: '⚔️', hasSourceBookScope: true },
    { key: 'location_rules', label: '地点规则', icon: '🗺️', hasSourceBookScope: true },
    { key: 'plot_rules', label: '剧情规则', icon: '📜', hasSourceBookScope: true },
    { key: 'creative_materials', label: '创意素材', icon: '💡', hasSourceBookScope: true },
    { key: 'book_analyses', label: '智能拆书', icon: '📖', hasSourceBookScope: false }
];
