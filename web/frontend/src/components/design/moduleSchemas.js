const commonBase = [
    { key: 'name', label: '名称', type: 'text', placeholder: '必填' },
    { key: 'category', label: '分类(自由文本)', type: 'text', hint: '与左侧分类树独立。优先用左侧选择 CategoryId' },
    { key: 'isEnabled', label: '启用', type: 'switch', default: true }
];
export const MODULE_SCHEMAS = {
    world_rules: {
        module: 'world_rules',
        commonFields: commonBase,
        tabs: [
            {
                key: 'core', label: '核心设定', fields: [
                    { key: 'oneLineSummary', label: '一句话设定', type: 'textarea', rows: 2 },
                    { key: 'powerSystem', label: '力量体系', type: 'textarea', rows: 4 },
                    { key: 'cosmology', label: '宇宙观', type: 'textarea', rows: 4 },
                    { key: 'specialLaws', label: '特殊法则', type: 'textarea', rows: 3 },
                    { key: 'hardRules', label: '硬性规则', type: 'textarea', rows: 3 },
                    { key: 'softRules', label: '软性规则', type: 'textarea', rows: 3 }
                ]
            },
            {
                key: 'history', label: '历史/时间线', fields: [
                    { key: 'ancientEra', label: '远古时代', type: 'textarea', rows: 3 },
                    { key: 'keyEvents', label: '关键事件', type: 'textarea', rows: 3 },
                    { key: 'modernHistory', label: '近代史', type: 'textarea', rows: 3 },
                    { key: 'statusQuo', label: '当前现状', type: 'textarea', rows: 3 }
                ]
            }
        ],
        listColumns: [
            { key: 'oneLineSummary', label: '一句话设定', width: 280 }
        ]
    },
    character_rules: {
        module: 'character_rules',
        commonFields: commonBase,
        tabs: [
            {
                key: 'identity', label: '基本信息', fields: [
                    {
                        key: 'characterType', label: '角色类型', type: 'select', options: [
                            { label: '主角', value: '主角' },
                            { label: '配角', value: '配角' },
                            { label: 'NPC', value: 'NPC' },
                            { label: '反派', value: '反派' }
                        ]
                    },
                    { key: 'gender', label: '性别', type: 'text' },
                    { key: 'age', label: '年龄', type: 'text' },
                    { key: 'identity', label: '身份', type: 'text' },
                    { key: 'race', label: '种族', type: 'text' },
                    { key: 'appearance', label: '外貌', type: 'textarea', rows: 3 }
                ]
            },
            {
                key: 'arc', label: '人物弧光', fields: [
                    { key: 'want', label: 'Want(表面渴望)', type: 'textarea', rows: 2 },
                    { key: 'need', label: 'Need(内心需要)', type: 'textarea', rows: 2 },
                    { key: 'flawBelief', label: '缺陷与执念', type: 'textarea', rows: 2 },
                    { key: 'growthPath', label: '成长路径', type: 'textarea', rows: 3 }
                ]
            },
            {
                key: 'relation', label: '关系', fields: [
                    { key: 'targetCharacterName', label: '关联角色', type: 'text' },
                    { key: 'relationshipType', label: '关系类型', type: 'text' },
                    { key: 'emotionDynamic', label: '情感动力', type: 'textarea', rows: 3 }
                ]
            },
            {
                key: 'skills', label: '能力', fields: [
                    { key: 'combatSkills', label: '战斗技能', type: 'textarea', rows: 2 },
                    { key: 'nonCombatSkills', label: '非战斗技能', type: 'textarea', rows: 2 },
                    { key: 'specialAbilities', label: '特殊能力', type: 'textarea', rows: 2 }
                ]
            },
            {
                key: 'items', label: '装备', fields: [
                    { key: 'signatureItems', label: '标志性物品', type: 'textarea', rows: 2 },
                    { key: 'commonItems', label: '常用物品', type: 'textarea', rows: 2 },
                    { key: 'personalAssets', label: '个人资产', type: 'textarea', rows: 2 }
                ]
            }
        ],
        listColumns: [
            { key: 'characterType', label: '类型', width: 80 },
            { key: 'identity', label: '身份', width: 160 }
        ]
    },
    faction_rules: {
        module: 'faction_rules',
        commonFields: commonBase,
        tabs: [
            {
                key: 'basic', label: '基本信息', fields: [
                    { key: 'factionType', label: '势力类型', type: 'text' },
                    { key: 'goal', label: '势力目标', type: 'textarea', rows: 3 },
                    { key: 'strengthTerritory', label: '实力/领地', type: 'textarea', rows: 3 }
                ]
            },
            {
                key: 'members', label: '核心成员', fields: [
                    { key: 'leader', label: '领袖', type: 'textarea', rows: 2 },
                    { key: 'coreMembers', label: '核心成员', type: 'textarea', rows: 3 },
                    { key: 'memberTraits', label: '成员特征', type: 'textarea', rows: 2 }
                ]
            },
            {
                key: 'external', label: '对外关系', fields: [
                    { key: 'allies', label: '盟友', type: 'textarea', rows: 2 },
                    { key: 'enemies', label: '敌人', type: 'textarea', rows: 2 },
                    { key: 'neutralCompetitors', label: '中立/竞争者', type: 'textarea', rows: 2 }
                ]
            }
        ],
        listColumns: [
            { key: 'factionType', label: '类型', width: 80 },
            { key: 'leader', label: '领袖', width: 160 }
        ]
    },
    location_rules: {
        module: 'location_rules',
        commonFields: commonBase,
        tabs: [
            {
                key: 'basic', label: '基本信息', fields: [
                    { key: 'locationType', label: '地点类型', type: 'text' },
                    { key: 'description', label: '描述', type: 'textarea', rows: 4 },
                    { key: 'scale', label: '规模', type: 'text' }
                ]
            },
            {
                key: 'geo', label: '地理特征', fields: [
                    { key: 'terrain', label: '地形', type: 'textarea', rows: 2 },
                    { key: 'climate', label: '气候', type: 'textarea', rows: 2 },
                    { key: 'landmarks', label: '地标', type: 'tags' },
                    { key: 'resources', label: '资源', type: 'tags' }
                ]
            },
            {
                key: 'story', label: '故事关联', fields: [
                    { key: 'historicalSignificance', label: '历史意义', type: 'textarea', rows: 3 },
                    { key: 'dangers', label: '危险', type: 'tags' },
                    { key: 'factionId', label: '所属势力 ID', type: 'text', hint: '关联到 FactionRule.Id;暂无 picker,可先复制粘贴' }
                ]
            }
        ],
        listColumns: [
            { key: 'locationType', label: '类型', width: 100 },
            { key: 'scale', label: '规模', width: 100 }
        ]
    },
    plot_rules: {
        module: 'plot_rules',
        commonFields: commonBase,
        tabs: [
            {
                key: 'overview', label: '事件概览', fields: [
                    { key: 'targetVolume', label: '目标卷', type: 'text' },
                    { key: 'assignedVolume', label: '指派卷', type: 'text' },
                    { key: 'oneLineSummary', label: '一句话概要', type: 'textarea', rows: 2 },
                    { key: 'eventType', label: '事件类型', type: 'text' },
                    { key: 'storyPhase', label: '故事阶段', type: 'text' },
                    { key: 'prerequisitesTrigger', label: '前置/触发', type: 'textarea', rows: 3 }
                ]
            },
            {
                key: 'parties', label: '参与方', fields: [
                    { key: 'mainCharacters', label: '主要角色', type: 'textarea', rows: 2 },
                    { key: 'keyNpcs', label: '关键 NPC', type: 'textarea', rows: 2 },
                    { key: 'location', label: '事件地点', type: 'textarea', rows: 2 },
                    { key: 'timeDuration', label: '时间/时长', type: 'text' }
                ]
            },
            {
                key: 'flow', label: '情节流程', fields: [
                    { key: 'stepTitle', label: '步骤标题', type: 'textarea', rows: 2 },
                    { key: 'goal', label: '目标', type: 'textarea', rows: 2 },
                    { key: 'conflict', label: '冲突', type: 'textarea', rows: 3 },
                    { key: 'result', label: '结果', type: 'textarea', rows: 2 },
                    { key: 'emotionCurve', label: '情感曲线', type: 'textarea', rows: 2 }
                ]
            },
            {
                key: 'impact', label: '事件影响', fields: [
                    { key: 'mainPlotPush', label: '主线推动', type: 'textarea', rows: 2 },
                    { key: 'characterGrowth', label: '角色成长', type: 'textarea', rows: 2 },
                    { key: 'worldReveal', label: '世界揭示', type: 'textarea', rows: 2 },
                    { key: 'rewardsClues', label: '奖励/线索', type: 'textarea', rows: 2 }
                ]
            }
        ],
        listColumns: [
            { key: 'eventType', label: '事件类型', width: 100 },
            { key: 'storyPhase', label: '阶段', width: 100 },
            { key: 'oneLineSummary', label: '概要', width: 240 }
        ]
    },
    creative_materials: {
        module: 'creative_materials',
        commonFields: [
            ...commonBase,
            { key: 'icon', label: '图标', type: 'text', default: '💡' },
            { key: 'genre', label: '题材', type: 'text' },
            { key: 'sourceBookName', label: '来源书籍', type: 'text', hint: '描述性字段,与 sourceBookId 解耦' }
        ],
        tabs: [
            {
                key: 'overall', label: '总览', fields: [
                    { key: 'overallIdea', label: '整体构思', type: 'textarea', rows: 4 }
                ]
            },
            {
                key: 'world', label: '世界构建', fields: [
                    { key: 'worldBuildingMethod', label: '构建方法', type: 'textarea', rows: 3 },
                    { key: 'powerSystemDesign', label: '力量体系设计', type: 'textarea', rows: 3 },
                    { key: 'environmentDescription', label: '环境描写', type: 'textarea', rows: 3 },
                    { key: 'factionDesign', label: '势力设计', type: 'textarea', rows: 3 },
                    { key: 'worldviewHighlights', label: '世界观亮点', type: 'textarea', rows: 3 }
                ]
            },
            {
                key: 'character', label: '角色', fields: [
                    { key: 'protagonistDesign', label: '主角设计', type: 'textarea', rows: 3 },
                    { key: 'supportingRoles', label: '配角', type: 'textarea', rows: 3 },
                    { key: 'characterRelations', label: '人物关系', type: 'textarea', rows: 3 },
                    { key: 'goldenFingerDesign', label: '金手指设计', type: 'textarea', rows: 3 },
                    { key: 'characterHighlights', label: '角色亮点', type: 'textarea', rows: 3 }
                ]
            },
            {
                key: 'plot', label: '剧情', fields: [
                    { key: 'plotStructure', label: '剧情结构', type: 'textarea', rows: 3 },
                    { key: 'conflictDesign', label: '冲突设计', type: 'textarea', rows: 3 },
                    { key: 'climaxArrangement', label: '高潮安排', type: 'textarea', rows: 3 },
                    { key: 'foreshadowingTechnique', label: '伏笔技巧', type: 'textarea', rows: 3 },
                    { key: 'plotHighlights', label: '剧情亮点', type: 'textarea', rows: 3 }
                ]
            }
        ],
        listColumns: [
            { key: 'icon', label: '', width: 50 },
            { key: 'genre', label: '题材', width: 100 }
        ]
    },
    book_analyses: {
        module: 'book_analyses',
        commonFields: [
            ...commonBase,
            { key: 'icon', label: '图标', type: 'text', default: '📖' }
        ],
        tabs: [
            {
                key: 'meta', label: '书籍元信息', fields: [
                    { key: 'author', label: '作者', type: 'text' },
                    { key: 'genre', label: '题材', type: 'text' },
                    { key: 'sourceUrl', label: '来源 URL', type: 'text' },
                    { key: 'sourceBookTitle', label: '原书名', type: 'text' },
                    { key: 'sourceAuthor', label: '原作者', type: 'text' },
                    { key: 'sourceGenre', label: '原题材', type: 'text' },
                    { key: 'sourceKeywords', label: '关键词', type: 'text' },
                    { key: 'sourceSite', label: '来源站点', type: 'text' },
                    { key: 'chapterCount', label: '章节数', type: 'number' },
                    { key: 'totalWordCount', label: '总字数', type: 'number' },
                    { key: 'crawledAt', label: '爬取时间', type: 'date' }
                ]
            },
            {
                key: 'world', label: '世界结论', fields: [
                    { key: 'worldBuildingMethod', label: '构建方法', type: 'textarea', rows: 3 },
                    { key: 'powerSystemDesign', label: '力量体系', type: 'textarea', rows: 3 },
                    { key: 'environmentDescription', label: '环境描写', type: 'textarea', rows: 3 },
                    { key: 'factionDesign', label: '势力设计', type: 'textarea', rows: 3 },
                    { key: 'worldviewHighlights', label: '世界观亮点', type: 'textarea', rows: 3 }
                ]
            },
            {
                key: 'character', label: '角色结论', fields: [
                    { key: 'protagonistDesign', label: '主角设计', type: 'textarea', rows: 3 },
                    { key: 'supportingRoles', label: '配角', type: 'textarea', rows: 3 },
                    { key: 'characterRelations', label: '人物关系', type: 'textarea', rows: 3 },
                    { key: 'goldenFingerDesign', label: '金手指', type: 'textarea', rows: 3 },
                    { key: 'characterHighlights', label: '角色亮点', type: 'textarea', rows: 3 }
                ]
            },
            {
                key: 'plot', label: '剧情结论', fields: [
                    { key: 'plotStructure', label: '剧情结构', type: 'textarea', rows: 3 },
                    { key: 'conflictDesign', label: '冲突', type: 'textarea', rows: 3 },
                    { key: 'climaxArrangement', label: '高潮', type: 'textarea', rows: 3 },
                    { key: 'foreshadowingTechnique', label: '伏笔', type: 'textarea', rows: 3 },
                    { key: 'plotHighlights', label: '剧情亮点', type: 'textarea', rows: 3 }
                ]
            }
        ],
        listColumns: [
            { key: 'icon', label: '', width: 50 },
            { key: 'author', label: '作者', width: 120 },
            { key: 'chapterCount', label: '章节', width: 80 }
        ]
    }
};
/** 按模块构造一个空白表单数据。 */
export function buildEmptyForm(module) {
    const schema = MODULE_SCHEMAS[module];
    const out = {
        categoryId: null,
        sourceBookId: null
    };
    const apply = (fields) => {
        for (const f of fields) {
            if (f.default !== undefined) {
                out[f.key] = f.default;
            }
            else {
                switch (f.type) {
                    case 'switch':
                        out[f.key] = false;
                        break;
                    case 'number':
                        out[f.key] = null;
                        break;
                    case 'tags':
                        out[f.key] = [];
                        break;
                    case 'date':
                        out[f.key] = null;
                        break;
                    default: out[f.key] = '';
                }
            }
        }
    };
    apply(schema.commonFields);
    for (const t of schema.tabs)
        apply(t.fields);
    return out;
}
