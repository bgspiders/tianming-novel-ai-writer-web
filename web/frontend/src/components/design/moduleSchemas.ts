import type { DesignModuleKey } from '@/api/modules/design'

export type FieldType = 'text' | 'textarea' | 'select' | 'number' | 'switch' | 'tags' | 'date'
export type PickerSource = 'characters' | 'factions' | 'locations' | 'volumes'

export interface FieldDef {
  key: string
  label: string
  type: FieldType
  /** textarea 行数 */
  rows?: number
  /** select 选项 */
  options?: { label: string; value: string }[]
  /** 默认值 */
  default?: unknown
  /** 占位 */
  placeholder?: string
  /** 提示文字 */
  hint?: string
  /** 从设计数据或全局上下文加载候选项 */
  pickerSource?: PickerSource
  /** picker 写入 id;默认写入 name/title */
  pickerValue?: 'id' | 'name' | 'title' | 'volumeNumber'
}

export interface TabDef {
  key: string
  label: string
  fields: FieldDef[]
}

export interface ModuleSchema {
  module: DesignModuleKey
  /** 公共字段(不进 Tab 直接在表单顶部) */
  commonFields: FieldDef[]
  tabs: TabDef[]
  /** 列表展示列(除 name/category/updatedAt 默认列以外) */
  listColumns?: { key: string; label: string; width?: number | string }[]
}

const commonBase: FieldDef[] = [
  { key: 'name', label: '名称', type: 'text', placeholder: '必填' },
  { key: 'category', label: '分类(自由文本)', type: 'text', hint: '与左侧分类树独立。优先用左侧选择 CategoryId' },
  { key: 'isEnabled', label: '启用', type: 'switch', default: true }
]

export const MODULE_SCHEMAS: Record<DesignModuleKey, ModuleSchema> = {
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
          { key: 'targetCharacterName', label: '关联角色', type: 'select', pickerSource: 'characters', pickerValue: 'name', placeholder: '选择或输入角色名' },
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
          { key: 'factionId', label: '所属势力', type: 'select', pickerSource: 'factions', pickerValue: 'id', placeholder: '选择势力' }
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
          { key: 'targetVolume', label: '目标卷', type: 'select', pickerSource: 'volumes', pickerValue: 'title', placeholder: '选择或输入卷名' },
          { key: 'assignedVolume', label: '指派卷', type: 'select', pickerSource: 'volumes', pickerValue: 'title', placeholder: '选择或输入卷名' },
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
  },

  outlines: {
    module: 'outlines',
    commonFields: commonBase,
    tabs: [
      {
        key: 'positioning', label: '全书定位', fields: [
          { key: 'totalChapterCount', label: '总章节数', type: 'number' },
          { key: 'estimatedWordCount', label: '预计字数', type: 'text' },
          { key: 'oneLineOutline', label: '一句话大纲', type: 'textarea', rows: 2 },
          { key: 'emotionalTone', label: '情感基调', type: 'textarea', rows: 2 },
          { key: 'philosophicalMotif', label: '哲学母题', type: 'textarea', rows: 2 }
        ]
      },
      {
        key: 'theme', label: '主题内核', fields: [
          { key: 'theme', label: '主题', type: 'textarea', rows: 3 },
          { key: 'coreConflict', label: '核心冲突', type: 'textarea', rows: 3 },
          { key: 'endingState', label: '结局状态', type: 'textarea', rows: 3 }
        ]
      },
      {
        key: 'structure', label: '结构规划', fields: [
          { key: 'volumeDivision', label: '分卷规划', type: 'textarea', rows: 4 },
          { key: 'outlineOverview', label: '大纲总览', type: 'textarea', rows: 5 },
          { key: 'dependencyModuleVersions', label: '依赖模块版本(JSON)', type: 'textarea', rows: 4, hint: '格式示例: {"world_rules":1}' }
        ]
      }
    ],
    listColumns: [
      { key: 'totalChapterCount', label: '章节数', width: 90 },
      { key: 'oneLineOutline', label: '一句话大纲', width: 280 }
    ]
  },

  volume_designs: {
    module: 'volume_designs',
    commonFields: commonBase,
    tabs: [
      {
        key: 'positioning', label: '卷定位', fields: [
          { key: 'volumeNumber', label: '卷序号', type: 'number' },
          { key: 'volumeTitle', label: '卷标题', type: 'text' },
          { key: 'volumeTheme', label: '卷主题', type: 'textarea', rows: 2 },
          { key: 'stageGoal', label: '阶段目标', type: 'textarea', rows: 3 },
          { key: 'estimatedWordCount', label: '预计字数', type: 'text' },
          { key: 'targetChapterCount', label: '目标章节数', type: 'number' },
          { key: 'startChapter', label: '起始章节', type: 'number' },
          { key: 'endChapter', label: '结束章节', type: 'number' }
        ]
      },
      {
        key: 'conflict', label: '冲突', fields: [
          { key: 'mainConflict', label: '主冲突', type: 'textarea', rows: 3 },
          { key: 'pressureSource', label: '压力来源', type: 'textarea', rows: 3 },
          { key: 'keyEvents', label: '关键事件', type: 'textarea', rows: 3 },
          { key: 'openingState', label: '开局状态', type: 'textarea', rows: 2 },
          { key: 'endingState', label: '结尾状态', type: 'textarea', rows: 2 }
        ]
      },
      {
        key: 'allocation', label: '章节分配', fields: [
          { key: 'chapterAllocationOverview', label: '章节分配概览', type: 'textarea', rows: 4 },
          { key: 'plotAllocation', label: '情节分配', type: 'textarea', rows: 4 },
          { key: 'chapterGenerationHints', label: '生成提示', type: 'textarea', rows: 4 }
        ]
      },
      {
        key: 'refs', label: '出场实体', fields: [
          { key: 'referencedCharacterNames', label: '角色名', type: 'tags', pickerSource: 'characters', pickerValue: 'name' },
          { key: 'referencedFactionNames', label: '势力名', type: 'tags', pickerSource: 'factions', pickerValue: 'name' },
          { key: 'referencedLocationNames', label: '地点名', type: 'tags', pickerSource: 'locations', pickerValue: 'name' },
          { key: 'dependencyModuleVersions', label: '依赖模块版本(JSON)', type: 'textarea', rows: 4 }
        ]
      }
    ],
    listColumns: [
      { key: 'volumeNumber', label: '卷', width: 70 },
      { key: 'volumeTitle', label: '卷标题', width: 180 },
      { key: 'targetChapterCount', label: '目标章节', width: 100 }
    ]
  },

  chapter_plans: {
    module: 'chapter_plans',
    commonFields: commonBase,
    tabs: [
      {
        key: 'goal', label: '章节目标', fields: [
          { key: 'chapterTitle', label: '章节标题', type: 'text' },
          { key: 'chapterNumber', label: '章节号', type: 'number' },
          { key: 'volume', label: '所属卷', type: 'select', pickerSource: 'volumes', pickerValue: 'title', placeholder: '选择或输入卷名' },
          { key: 'estimatedWordCount', label: '预计字数', type: 'text' },
          { key: 'chapterTheme', label: '章节主题', type: 'textarea', rows: 2 },
          { key: 'readerExperienceGoal', label: '读者体验目标', type: 'textarea', rows: 2 },
          { key: 'mainGoal', label: '主要目标', type: 'textarea', rows: 2 }
        ]
      },
      {
        key: 'turning', label: '冲突与转折', fields: [
          { key: 'resistanceSource', label: '阻力来源', type: 'textarea', rows: 3 },
          { key: 'keyTurn', label: '关键转折', type: 'textarea', rows: 3 },
          { key: 'hook', label: '章节钩子', type: 'textarea', rows: 2 }
        ]
      },
      {
        key: 'deliverables', label: '交付物', fields: [
          { key: 'worldInfoDrop', label: '世界信息投放', type: 'textarea', rows: 2 },
          { key: 'characterArcProgress', label: '角色弧推进', type: 'textarea', rows: 2 },
          { key: 'mainPlotProgress', label: '主线推进', type: 'textarea', rows: 2 },
          { key: 'foreshadowing', label: '伏笔', type: 'textarea', rows: 2 }
        ]
      },
      {
        key: 'refs', label: '出场实体', fields: [
          { key: 'referencedCharacterNames', label: '角色名', type: 'tags', pickerSource: 'characters', pickerValue: 'name' },
          { key: 'referencedFactionNames', label: '势力名', type: 'tags', pickerSource: 'factions', pickerValue: 'name' },
          { key: 'referencedLocationNames', label: '地点名', type: 'tags', pickerSource: 'locations', pickerValue: 'name' },
          { key: 'dependencyModuleVersions', label: '依赖模块版本(JSON)', type: 'textarea', rows: 4 }
        ]
      }
    ],
    listColumns: [
      { key: 'chapterNumber', label: '章节号', width: 90 },
      { key: 'chapterTitle', label: '章节标题', width: 180 },
      { key: 'volume', label: '卷', width: 120 }
    ]
  },

  chapter_blueprints: {
    module: 'chapter_blueprints',
    commonFields: commonBase,
    tabs: [
      {
        key: 'overview', label: '蓝图概览', fields: [
          { key: 'chapterId', label: '章节 ID', type: 'text' },
          { key: 'oneLineStructure', label: '一句话结构', type: 'textarea', rows: 2 },
          { key: 'pacingCurve', label: '节奏曲线', type: 'textarea', rows: 2 },
          { key: 'dependencyModuleVersions', label: '依赖模块版本(JSON)', type: 'textarea', rows: 4 }
        ]
      },
      {
        key: 'scene', label: '场景列表', fields: [
          { key: 'sceneNumber', label: '场景序号', type: 'number' },
          { key: 'sceneTitle', label: '场景标题', type: 'text' },
          { key: 'povCharacter', label: 'POV 角色', type: 'select', pickerSource: 'characters', pickerValue: 'name', placeholder: '选择或输入角色名' },
          { key: 'estimatedWordCount', label: '预计字数', type: 'text' },
          { key: 'opening', label: '开场', type: 'textarea', rows: 2 },
          { key: 'development', label: '发展', type: 'textarea', rows: 2 },
          { key: 'turning', label: '转折', type: 'textarea', rows: 2 },
          { key: 'ending', label: '收束', type: 'textarea', rows: 2 },
          { key: 'infoDrop', label: '信息投放', type: 'textarea', rows: 2 }
        ]
      },
      {
        key: 'elements', label: '要素清单', fields: [
          { key: 'cast', label: '出场角色', type: 'textarea', rows: 2 },
          { key: 'locations', label: '地点', type: 'textarea', rows: 2 },
          { key: 'factions', label: '势力', type: 'textarea', rows: 2 },
          { key: 'itemsClues', label: '道具/线索', type: 'textarea', rows: 2 }
        ]
      }
    ],
    listColumns: [
      { key: 'sceneNumber', label: '场景', width: 70 },
      { key: 'sceneTitle', label: '场景标题', width: 180 },
      { key: 'povCharacter', label: 'POV', width: 120 }
    ]
  }
}

/** 按模块构造一个空白表单数据。 */
export function buildEmptyForm(module: DesignModuleKey): Record<string, unknown> {
  const schema = MODULE_SCHEMAS[module]
  const out: Record<string, unknown> = {
    categoryId: null,
    sourceBookId: null
  }
  const apply = (fields: FieldDef[]) => {
    for (const f of fields) {
      if (f.default !== undefined) {
        out[f.key] = f.default
      } else {
        switch (f.type) {
          case 'switch': out[f.key] = false; break
          case 'number': out[f.key] = null; break
          case 'tags': out[f.key] = []; break
          case 'date': out[f.key] = null; break
          default: out[f.key] = ''
        }
      }
    }
  }
  apply(schema.commonFields)
  for (const t of schema.tabs) apply(t.fields)
  return out
}
