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
    if (p.updatedFrom)
        out.updatedFrom = p.updatedFrom;
    if (p.updatedTo)
        out.updatedTo = p.updatedTo;
    if (p.page)
        out.page = p.page;
    if (p.pageSize)
        out.pageSize = p.pageSize;
    if (p.projectId)
        out.projectId = p.projectId;
    if (p.includeUncategorized !== undefined && p.includeUncategorized !== null) {
        out.includeUncategorized = p.includeUncategorized;
    }
    return Object.keys(out).length ? out : undefined;
}
async function listPaged(url, p) {
    return (await http.get(url, { params: buildParams(p) })).data;
}
export const worldRulesApi = {
    list: async (p) => (await http.get('/api/design/world-rules', { params: buildParams(p) })).data,
    listPaged: async (p) => listPaged('/api/design/world-rules', p),
    get: async (id) => (await http.get(`/api/design/world-rules/${id}`)).data,
    create: async (input) => (await http.post('/api/design/world-rules', input)).data,
    update: async (id, input) => (await http.put(`/api/design/world-rules/${id}`, input)).data,
    remove: async (id) => {
        await http.delete(`/api/design/world-rules/${id}`);
    }
};
export const characterRulesApi = {
    list: async (p) => (await http.get('/api/design/character-rules', { params: buildParams(p) })).data,
    listPaged: async (p) => listPaged('/api/design/character-rules', p),
    get: async (id) => (await http.get(`/api/design/character-rules/${id}`)).data,
    create: async (input) => (await http.post('/api/design/character-rules', input)).data,
    update: async (id, input) => (await http.put(`/api/design/character-rules/${id}`, input)).data,
    remove: async (id) => {
        await http.delete(`/api/design/character-rules/${id}`);
    }
};
export const factionRulesApi = {
    list: async (p) => (await http.get('/api/design/faction-rules', { params: buildParams(p) })).data,
    listPaged: async (p) => listPaged('/api/design/faction-rules', p),
    get: async (id) => (await http.get(`/api/design/faction-rules/${id}`)).data,
    create: async (input) => (await http.post('/api/design/faction-rules', input)).data,
    update: async (id, input) => (await http.put(`/api/design/faction-rules/${id}`, input)).data,
    remove: async (id) => {
        await http.delete(`/api/design/faction-rules/${id}`);
    }
};
export const locationRulesApi = {
    list: async (p) => (await http.get('/api/design/location-rules', { params: buildParams(p) })).data,
    listPaged: async (p) => listPaged('/api/design/location-rules', p),
    get: async (id) => (await http.get(`/api/design/location-rules/${id}`)).data,
    create: async (input) => (await http.post('/api/design/location-rules', input)).data,
    update: async (id, input) => (await http.put(`/api/design/location-rules/${id}`, input)).data,
    remove: async (id) => {
        await http.delete(`/api/design/location-rules/${id}`);
    }
};
export const plotRulesApi = {
    list: async (p) => (await http.get('/api/design/plot-rules', { params: buildParams(p) })).data,
    listPaged: async (p) => listPaged('/api/design/plot-rules', p),
    get: async (id) => (await http.get(`/api/design/plot-rules/${id}`)).data,
    create: async (input) => (await http.post('/api/design/plot-rules', input)).data,
    update: async (id, input) => (await http.put(`/api/design/plot-rules/${id}`, input)).data,
    remove: async (id) => {
        await http.delete(`/api/design/plot-rules/${id}`);
    }
};
export const creativeMaterialsApi = {
    list: async (p) => (await http.get('/api/design/creative-materials', { params: buildParams(p) })).data,
    listPaged: async (p) => listPaged('/api/design/creative-materials', p),
    get: async (id) => (await http.get(`/api/design/creative-materials/${id}`)).data,
    create: async (input) => (await http.post('/api/design/creative-materials', input)).data,
    createFromBookAnalysis: async (bookAnalysisId) => (await http.post(`/api/design/creative-materials/from-book-analysis/${bookAnalysisId}`)).data,
    buildSkeleton: async (id) => (await http.post(`/api/design/creative-materials/${id}/build-skeleton`)).data,
    update: async (id, input) => (await http.put(`/api/design/creative-materials/${id}`, input)).data,
    remove: async (id) => {
        await http.delete(`/api/design/creative-materials/${id}`);
    }
};
export const bookAnalysesApi = {
    list: async (p) => (await http.get('/api/design/book-analyses', { params: buildParams(p) })).data,
    listPaged: async (p) => listPaged('/api/design/book-analyses', p),
    get: async (id) => (await http.get(`/api/design/book-analyses/${id}`)).data,
    crawlPreview: async (input) => (await http.post('/api/design/book-analyses/crawl-preview', input)).data,
    aiAnalyze: async (input) => (await http.post('/api/design/book-analyses/ai-analyze', input)).data,
    queueAiAnalyze: async (id, input) => (await http.post(`/api/design/book-analyses/${id}/ai-analyze-jobs`, input)).data,
    create: async (input) => (await http.post('/api/design/book-analyses', input)).data,
    update: async (id, input) => (await http.put(`/api/design/book-analyses/${id}`, input)).data,
    remove: async (id) => {
        await http.delete(`/api/design/book-analyses/${id}`);
    }
};
export const outlinesApi = {
    list: async (p) => (await http.get('/api/design/outlines', { params: buildParams(p) })).data,
    listPaged: async (p) => listPaged('/api/design/outlines', p),
    get: async (id) => (await http.get(`/api/design/outlines/${id}`)).data,
    create: async (input) => (await http.post('/api/design/outlines', input)).data,
    update: async (id, input) => (await http.put(`/api/design/outlines/${id}`, input)).data,
    remove: async (id) => {
        await http.delete(`/api/design/outlines/${id}`);
    }
};
export const volumeDesignsApi = {
    list: async (p) => (await http.get('/api/design/volume-designs', { params: buildParams(p) })).data,
    listPaged: async (p) => listPaged('/api/design/volume-designs', p),
    get: async (id) => (await http.get(`/api/design/volume-designs/${id}`)).data,
    create: async (input) => (await http.post('/api/design/volume-designs', input)).data,
    update: async (id, input) => (await http.put(`/api/design/volume-designs/${id}`, input)).data,
    remove: async (id) => {
        await http.delete(`/api/design/volume-designs/${id}`);
    }
};
export const chapterPlansApi = {
    list: async (p) => (await http.get('/api/design/chapter-plans', { params: buildParams(p) })).data,
    listPaged: async (p) => listPaged('/api/design/chapter-plans', p),
    get: async (id) => (await http.get(`/api/design/chapter-plans/${id}`)).data,
    create: async (input) => (await http.post('/api/design/chapter-plans', input)).data,
    update: async (id, input) => (await http.put(`/api/design/chapter-plans/${id}`, input)).data,
    remove: async (id) => {
        await http.delete(`/api/design/chapter-plans/${id}`);
    }
};
export const chapterBlueprintsApi = {
    list: async (p) => (await http.get('/api/design/chapter-blueprints', { params: buildParams(p) })).data,
    listPaged: async (p) => listPaged('/api/design/chapter-blueprints', p),
    get: async (id) => (await http.get(`/api/design/chapter-blueprints/${id}`)).data,
    create: async (input) => (await http.post('/api/design/chapter-blueprints', input)).data,
    update: async (id, input) => (await http.put(`/api/design/chapter-blueprints/${id}`, input)).data,
    remove: async (id) => {
        await http.delete(`/api/design/chapter-blueprints/${id}`);
    }
};
export const DESIGN_MODULES = [
    { key: 'world_rules', label: '世界规则', icon: '世', hasSourceBookScope: true },
    { key: 'character_rules', label: '角色规则', icon: '角', hasSourceBookScope: true },
    { key: 'faction_rules', label: '势力规则', icon: '势', hasSourceBookScope: true },
    { key: 'location_rules', label: '地点规则', icon: '地', hasSourceBookScope: true },
    { key: 'plot_rules', label: '剧情规则', icon: '剧', hasSourceBookScope: true },
    { key: 'creative_materials', label: '创意素材', icon: '材', hasSourceBookScope: true },
    { key: 'book_analyses', label: '拆书分析', icon: '拆', hasSourceBookScope: false },
    { key: 'outlines', label: '大纲', icon: '纲', hasSourceBookScope: true },
    { key: 'volume_designs', label: '卷设计', icon: '卷', hasSourceBookScope: true },
    { key: 'chapter_plans', label: '章节计划', icon: '章', hasSourceBookScope: true },
    { key: 'chapter_blueprints', label: '章节蓝图', icon: '图', hasSourceBookScope: true }
];
