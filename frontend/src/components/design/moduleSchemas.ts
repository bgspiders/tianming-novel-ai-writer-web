import type { DesignModuleKey } from '@/api/modules/design'

export type FieldType = 'text' | 'textarea' | 'select' | 'number' | 'switch' | 'tags' | 'date'
export type PickerSource = 'characters' | 'factions' | 'locations' | 'volumes'

export interface FieldDef {
  key: string
  label: string
  type: FieldType
  rows?: number
  options?: { label: string; value: string }[]
  default?: unknown
  placeholder?: string
  hint?: string
  pickerSource?: PickerSource
  pickerValue?: 'id' | 'name' | 'title' | 'volumeNumber'
}

export interface TabDef {
  key: string
  label: string
  fields: FieldDef[]
}

export interface ModuleSchema {
  module: DesignModuleKey
  commonFields: FieldDef[]
  tabs: TabDef[]
  listColumns?: { key: string; label: string; width?: number | string }[]
}

const commonBase: FieldDef[] = [
  { key: 'name', label: '名称', type: 'text', placeholder: '必填' },
  {
    key: 'category',
    label: '分类文本',
    type: 'text',
    hint: '除分类树绑定外，可额外填写自由文本分类。'
  },
  { key: 'isEnabled', label: '启用', type: 'switch', default: true }
]

export const MODULE_SCHEMAS: Record<DesignModuleKey, ModuleSchema> = {
  world_rules: {
    module: 'world_rules',
    commonFields: commonBase,
    tabs: [
      {
        key: 'core',
        label: 'Core',
        fields: [
          { key: 'oneLineSummary', label: 'One Line Summary', type: 'textarea', rows: 2 },
          { key: 'powerSystem', label: 'Power System', type: 'textarea', rows: 4 },
          { key: 'cosmology', label: 'Cosmology', type: 'textarea', rows: 4 },
          { key: 'specialLaws', label: 'Special Laws', type: 'textarea', rows: 3 },
          { key: 'hardRules', label: 'Hard Rules', type: 'textarea', rows: 3 },
          { key: 'softRules', label: 'Soft Rules', type: 'textarea', rows: 3 }
        ]
      },
      {
        key: 'history',
        label: 'History',
        fields: [
          { key: 'ancientEra', label: 'Ancient Era', type: 'textarea', rows: 3 },
          { key: 'keyEvents', label: 'Key Events', type: 'textarea', rows: 3 },
          { key: 'modernHistory', label: 'Modern History', type: 'textarea', rows: 3 },
          { key: 'statusQuo', label: 'Status Quo', type: 'textarea', rows: 3 }
        ]
      }
    ],
    listColumns: [{ key: 'oneLineSummary', label: 'Summary', width: 280 }]
  },

  character_rules: {
    module: 'character_rules',
    commonFields: commonBase,
    tabs: [
      {
        key: 'identity',
        label: 'Identity',
        fields: [
          {
            key: 'characterType',
            label: 'Character Type',
            type: 'select',
            options: [
              { label: 'Lead', value: 'Lead' },
              { label: 'Support', value: 'Support' },
              { label: 'NPC', value: 'NPC' },
              { label: 'Antagonist', value: 'Antagonist' }
            ]
          },
          { key: 'gender', label: 'Gender', type: 'text' },
          { key: 'age', label: 'Age', type: 'text' },
          { key: 'identity', label: 'Identity', type: 'text' },
          { key: 'race', label: 'Race', type: 'text' },
          { key: 'appearance', label: 'Appearance', type: 'textarea', rows: 3 }
        ]
      },
      {
        key: 'arc',
        label: 'Arc',
        fields: [
          { key: 'want', label: 'Want', type: 'textarea', rows: 2 },
          { key: 'need', label: 'Need', type: 'textarea', rows: 2 },
          { key: 'flawBelief', label: 'Flaw / Belief', type: 'textarea', rows: 2 },
          { key: 'growthPath', label: 'Growth Path', type: 'textarea', rows: 3 }
        ]
      },
      {
        key: 'relation',
        label: 'Relation',
        fields: [
          {
            key: 'targetCharacterName',
            label: 'Target Character',
            type: 'select',
            pickerSource: 'characters',
            pickerValue: 'name',
            placeholder: 'Select or type a character'
          },
          { key: 'relationshipType', label: 'Relationship Type', type: 'text' },
          { key: 'emotionDynamic', label: 'Emotion Dynamic', type: 'textarea', rows: 3 }
        ]
      },
      {
        key: 'skills',
        label: 'Skills',
        fields: [
          { key: 'combatSkills', label: 'Combat Skills', type: 'textarea', rows: 2 },
          { key: 'nonCombatSkills', label: 'Non-Combat Skills', type: 'textarea', rows: 2 },
          { key: 'specialAbilities', label: 'Special Abilities', type: 'textarea', rows: 2 }
        ]
      },
      {
        key: 'items',
        label: 'Items',
        fields: [
          { key: 'signatureItems', label: 'Signature Items', type: 'textarea', rows: 2 },
          { key: 'commonItems', label: 'Common Items', type: 'textarea', rows: 2 },
          { key: 'personalAssets', label: 'Personal Assets', type: 'textarea', rows: 2 }
        ]
      }
    ],
    listColumns: [
      { key: 'characterType', label: 'Type', width: 80 },
      { key: 'identity', label: 'Identity', width: 160 }
    ]
  },

  faction_rules: {
    module: 'faction_rules',
    commonFields: commonBase,
    tabs: [
      {
        key: 'basic',
        label: 'Basic',
        fields: [
          { key: 'factionType', label: 'Faction Type', type: 'text' },
          { key: 'goal', label: 'Goal', type: 'textarea', rows: 3 },
          { key: 'strengthTerritory', label: 'Strength / Territory', type: 'textarea', rows: 3 }
        ]
      },
      {
        key: 'members',
        label: 'Members',
        fields: [
          { key: 'leader', label: 'Leader', type: 'textarea', rows: 2 },
          { key: 'coreMembers', label: 'Core Members', type: 'textarea', rows: 3 },
          { key: 'memberTraits', label: 'Member Traits', type: 'textarea', rows: 2 }
        ]
      },
      {
        key: 'external',
        label: 'External',
        fields: [
          { key: 'allies', label: 'Allies', type: 'textarea', rows: 2 },
          { key: 'enemies', label: 'Enemies', type: 'textarea', rows: 2 },
          { key: 'neutralCompetitors', label: 'Neutral Competitors', type: 'textarea', rows: 2 }
        ]
      }
    ],
    listColumns: [
      { key: 'factionType', label: 'Type', width: 80 },
      { key: 'leader', label: 'Leader', width: 160 }
    ]
  },

  location_rules: {
    module: 'location_rules',
    commonFields: commonBase,
    tabs: [
      {
        key: 'basic',
        label: 'Basic',
        fields: [
          { key: 'locationType', label: 'Location Type', type: 'text' },
          { key: 'description', label: 'Description', type: 'textarea', rows: 4 },
          { key: 'scale', label: 'Scale', type: 'text' }
        ]
      },
      {
        key: 'geo',
        label: 'Geo',
        fields: [
          { key: 'terrain', label: 'Terrain', type: 'textarea', rows: 2 },
          { key: 'climate', label: 'Climate', type: 'textarea', rows: 2 },
          { key: 'landmarks', label: 'Landmarks', type: 'tags' },
          { key: 'resources', label: 'Resources', type: 'tags' }
        ]
      },
      {
        key: 'story',
        label: 'Story',
        fields: [
          { key: 'historicalSignificance', label: 'Historical Significance', type: 'textarea', rows: 3 },
          { key: 'dangers', label: 'Dangers', type: 'tags' },
          {
            key: 'factionId',
            label: 'Faction',
            type: 'select',
            pickerSource: 'factions',
            pickerValue: 'id',
            placeholder: 'Select a faction'
          }
        ]
      }
    ],
    listColumns: [
      { key: 'locationType', label: 'Type', width: 100 },
      { key: 'scale', label: 'Scale', width: 100 }
    ]
  },

  plot_rules: {
    module: 'plot_rules',
    commonFields: commonBase,
    tabs: [
      {
        key: 'overview',
        label: 'Overview',
        fields: [
          {
            key: 'targetVolume',
            label: 'Target Volume',
            type: 'select',
            pickerSource: 'volumes',
            pickerValue: 'title',
            placeholder: 'Select or type a volume'
          },
          {
            key: 'assignedVolume',
            label: 'Assigned Volume',
            type: 'select',
            pickerSource: 'volumes',
            pickerValue: 'title',
            placeholder: 'Select or type a volume'
          },
          { key: 'oneLineSummary', label: 'One Line Summary', type: 'textarea', rows: 2 },
          { key: 'eventType', label: 'Event Type', type: 'text' },
          { key: 'storyPhase', label: 'Story Phase', type: 'text' },
          { key: 'prerequisitesTrigger', label: 'Prerequisites / Trigger', type: 'textarea', rows: 3 }
        ]
      },
      {
        key: 'parties',
        label: 'Parties',
        fields: [
          { key: 'mainCharacters', label: 'Main Characters', type: 'textarea', rows: 2 },
          { key: 'keyNpcs', label: 'Key NPCs', type: 'textarea', rows: 2 },
          { key: 'location', label: 'Location', type: 'textarea', rows: 2 },
          { key: 'timeDuration', label: 'Time / Duration', type: 'text' }
        ]
      },
      {
        key: 'flow',
        label: 'Flow',
        fields: [
          { key: 'stepTitle', label: 'Step Title', type: 'textarea', rows: 2 },
          { key: 'goal', label: 'Goal', type: 'textarea', rows: 2 },
          { key: 'conflict', label: 'Conflict', type: 'textarea', rows: 3 },
          { key: 'result', label: 'Result', type: 'textarea', rows: 2 },
          { key: 'emotionCurve', label: 'Emotion Curve', type: 'textarea', rows: 2 }
        ]
      },
      {
        key: 'impact',
        label: 'Impact',
        fields: [
          { key: 'mainPlotPush', label: 'Main Plot Push', type: 'textarea', rows: 2 },
          { key: 'characterGrowth', label: 'Character Growth', type: 'textarea', rows: 2 },
          { key: 'worldReveal', label: 'World Reveal', type: 'textarea', rows: 2 },
          { key: 'rewardsClues', label: 'Rewards / Clues', type: 'textarea', rows: 2 }
        ]
      }
    ],
    listColumns: [
      { key: 'eventType', label: 'Event Type', width: 100 },
      { key: 'storyPhase', label: 'Phase', width: 100 },
      { key: 'oneLineSummary', label: 'Summary', width: 240 }
    ]
  },

  creative_materials: {
    module: 'creative_materials',
    commonFields: [
      ...commonBase,
      { key: 'icon', label: 'Icon', type: 'text', default: 'IDEA' },
      { key: 'genre', label: 'Genre', type: 'text' },
      { key: 'sourceBookName', label: 'Source Book Name', type: 'text', hint: 'Human-readable source field.' }
    ],
    tabs: [
      {
        key: 'overall',
        label: 'Overall',
        fields: [{ key: 'overallIdea', label: 'Overall Idea', type: 'textarea', rows: 4 }]
      },
      {
        key: 'world',
        label: 'World',
        fields: [
          { key: 'worldBuildingMethod', label: 'World Building Method', type: 'textarea', rows: 3 },
          { key: 'powerSystemDesign', label: 'Power System Design', type: 'textarea', rows: 3 },
          { key: 'environmentDescription', label: 'Environment Description', type: 'textarea', rows: 3 },
          { key: 'factionDesign', label: 'Faction Design', type: 'textarea', rows: 3 },
          { key: 'worldviewHighlights', label: 'Worldview Highlights', type: 'textarea', rows: 3 }
        ]
      },
      {
        key: 'character',
        label: 'Character',
        fields: [
          { key: 'protagonistDesign', label: 'Protagonist Design', type: 'textarea', rows: 3 },
          { key: 'supportingRoles', label: 'Supporting Roles', type: 'textarea', rows: 3 },
          { key: 'characterRelations', label: 'Character Relations', type: 'textarea', rows: 3 },
          { key: 'goldenFingerDesign', label: 'Golden Finger Design', type: 'textarea', rows: 3 },
          { key: 'characterHighlights', label: 'Character Highlights', type: 'textarea', rows: 3 }
        ]
      },
      {
        key: 'plot',
        label: 'Plot',
        fields: [
          { key: 'plotStructure', label: 'Plot Structure', type: 'textarea', rows: 3 },
          { key: 'conflictDesign', label: 'Conflict Design', type: 'textarea', rows: 3 },
          { key: 'climaxArrangement', label: 'Climax Arrangement', type: 'textarea', rows: 3 },
          { key: 'foreshadowingTechnique', label: 'Foreshadowing Technique', type: 'textarea', rows: 3 },
          { key: 'plotHighlights', label: 'Plot Highlights', type: 'textarea', rows: 3 }
        ]
      }
    ],
    listColumns: [
      { key: 'icon', label: 'Icon', width: 70 },
      { key: 'genre', label: 'Genre', width: 100 }
    ]
  },

  book_analyses: {
    module: 'book_analyses',
    commonFields: [
      ...commonBase,
      { key: 'icon', label: '图标', type: 'text', default: 'BOOK' }
    ],
    tabs: [
      {
        key: 'meta',
        label: '来源信息',
        fields: [
          { key: 'author', label: '作者', type: 'text' },
          { key: 'genre', label: '类型', type: 'text' },
          { key: 'sourceUrl', label: '来源 URL', type: 'text' },
          { key: 'sourceBookTitle', label: '原书标题', type: 'text' },
          { key: 'sourceAuthor', label: '原书作者', type: 'text' },
          { key: 'sourceGenre', label: '原书类型', type: 'text' },
          { key: 'sourceKeywords', label: '关键词', type: 'text' },
          { key: 'sourceSite', label: '来源站点', type: 'text' },
          { key: 'chapterCount', label: '章节数', type: 'number' },
          { key: 'totalWordCount', label: '总字数', type: 'number' },
          { key: 'crawledAt', label: '导入时间', type: 'date' }
        ]
      },
      {
        key: 'world',
        label: '世界观',
        fields: [
          { key: 'worldBuildingMethod', label: '世界构建方法', type: 'textarea', rows: 3 },
          { key: 'powerSystemDesign', label: '力量体系设计', type: 'textarea', rows: 3 },
          { key: 'environmentDescription', label: '环境描写', type: 'textarea', rows: 3 },
          { key: 'factionDesign', label: '势力设计', type: 'textarea', rows: 3 },
          { key: 'worldviewHighlights', label: '世界观亮点', type: 'textarea', rows: 3 }
        ]
      },
      {
        key: 'character',
        label: '角色',
        fields: [
          { key: 'protagonistDesign', label: '主角设计', type: 'textarea', rows: 3 },
          { key: 'supportingRoles', label: '配角设计', type: 'textarea', rows: 3 },
          { key: 'characterRelations', label: '角色关系', type: 'textarea', rows: 3 },
          { key: 'goldenFingerDesign', label: '金手指设计', type: 'textarea', rows: 3 },
          { key: 'characterHighlights', label: '角色亮点', type: 'textarea', rows: 3 }
        ]
      },
      {
        key: 'plot',
        label: '剧情',
        fields: [
          { key: 'plotStructure', label: '剧情结构', type: 'textarea', rows: 3 },
          { key: 'conflictDesign', label: '冲突设计', type: 'textarea', rows: 3 },
          { key: 'climaxArrangement', label: '高潮安排', type: 'textarea', rows: 3 },
          { key: 'foreshadowingTechnique', label: '伏笔手法', type: 'textarea', rows: 3 },
          { key: 'plotHighlights', label: '剧情亮点', type: 'textarea', rows: 3 }
        ]
      }
    ],
    listColumns: [
      { key: 'icon', label: '图标', width: 70 },
      { key: 'author', label: '作者', width: 120 },
      { key: 'chapterCount', label: '章节数', width: 90 }
    ]
  },

  outlines: {
    module: 'outlines',
    commonFields: commonBase,
    tabs: [
      {
        key: 'positioning',
        label: '定位',
        fields: [
          { key: 'totalChapterCount', label: '总章节数', type: 'number' },
          { key: 'estimatedWordCount', label: '预计字数', type: 'text' },
          { key: 'oneLineOutline', label: '一句话大纲', type: 'textarea', rows: 2 },
          { key: 'emotionalTone', label: '情绪基调', type: 'textarea', rows: 2 },
          { key: 'philosophicalMotif', label: '哲学母题', type: 'textarea', rows: 2 }
        ]
      },
      {
        key: 'theme',
        label: '主题',
        fields: [
          { key: 'theme', label: '主题', type: 'textarea', rows: 3 },
          { key: 'coreConflict', label: '核心冲突', type: 'textarea', rows: 3 },
          { key: 'endingState', label: '结局状态', type: 'textarea', rows: 3 }
        ]
      },
      {
        key: 'structure',
        label: '结构',
        fields: [
          { key: 'volumeDivision', label: '分卷规划', type: 'textarea', rows: 4 },
          { key: 'outlineOverview', label: '大纲总览', type: 'textarea', rows: 5 },
          { key: 'dependencyModuleVersions', label: '依赖模块版本（JSON）', type: 'textarea', rows: 4 }
        ]
      }
    ],
    listColumns: [
      { key: 'totalChapterCount', label: '章节数', width: 90 },
      { key: 'oneLineOutline', label: '大纲摘要', width: 280 }
    ]
  },

  volume_designs: {
    module: 'volume_designs',
    commonFields: commonBase,
    tabs: [
      {
        key: 'positioning',
        label: 'Positioning',
        fields: [
          { key: 'volumeNumber', label: 'Volume Number', type: 'number' },
          { key: 'volumeTitle', label: 'Volume Title', type: 'text' },
          { key: 'volumeTheme', label: 'Volume Theme', type: 'textarea', rows: 2 },
          { key: 'stageGoal', label: 'Stage Goal', type: 'textarea', rows: 3 },
          { key: 'estimatedWordCount', label: 'Estimated Word Count', type: 'text' },
          { key: 'targetChapterCount', label: 'Target Chapter Count', type: 'number' },
          { key: 'startChapter', label: 'Start Chapter', type: 'number' },
          { key: 'endChapter', label: 'End Chapter', type: 'number' }
        ]
      },
      {
        key: 'conflict',
        label: 'Conflict',
        fields: [
          { key: 'mainConflict', label: 'Main Conflict', type: 'textarea', rows: 3 },
          { key: 'pressureSource', label: 'Pressure Source', type: 'textarea', rows: 3 },
          { key: 'keyEvents', label: 'Key Events', type: 'textarea', rows: 3 },
          { key: 'openingState', label: 'Opening State', type: 'textarea', rows: 2 },
          { key: 'endingState', label: 'Ending State', type: 'textarea', rows: 2 }
        ]
      },
      {
        key: 'allocation',
        label: 'Allocation',
        fields: [
          { key: 'chapterAllocationOverview', label: 'Chapter Allocation Overview', type: 'textarea', rows: 4 },
          { key: 'plotAllocation', label: 'Plot Allocation', type: 'textarea', rows: 4 },
          { key: 'chapterGenerationHints', label: 'Chapter Generation Hints', type: 'textarea', rows: 4 }
        ]
      },
      {
        key: 'refs',
        label: 'References',
        fields: [
          { key: 'referencedCharacterNames', label: 'Character Names', type: 'tags', pickerSource: 'characters', pickerValue: 'name' },
          { key: 'referencedFactionNames', label: 'Faction Names', type: 'tags', pickerSource: 'factions', pickerValue: 'name' },
          { key: 'referencedLocationNames', label: 'Location Names', type: 'tags', pickerSource: 'locations', pickerValue: 'name' },
          { key: 'dependencyModuleVersions', label: 'Dependency Module Versions (JSON)', type: 'textarea', rows: 4 }
        ]
      }
    ],
    listColumns: [
      { key: 'volumeNumber', label: 'Volume', width: 70 },
      { key: 'volumeTitle', label: 'Title', width: 180 },
      { key: 'targetChapterCount', label: 'Target Chapters', width: 100 }
    ]
  },

  chapter_plans: {
    module: 'chapter_plans',
    commonFields: commonBase,
    tabs: [
      {
        key: 'goal',
        label: 'Goal',
        fields: [
          { key: 'chapterTitle', label: 'Chapter Title', type: 'text' },
          { key: 'chapterNumber', label: 'Chapter Number', type: 'number' },
          {
            key: 'volume',
            label: 'Volume',
            type: 'select',
            pickerSource: 'volumes',
            pickerValue: 'title',
            placeholder: 'Select or type a volume'
          },
          { key: 'estimatedWordCount', label: 'Estimated Word Count', type: 'text' },
          { key: 'chapterTheme', label: 'Chapter Theme', type: 'textarea', rows: 2 },
          { key: 'readerExperienceGoal', label: 'Reader Experience Goal', type: 'textarea', rows: 2 },
          { key: 'mainGoal', label: 'Main Goal', type: 'textarea', rows: 2 }
        ]
      },
      {
        key: 'turning',
        label: 'Turning',
        fields: [
          { key: 'resistanceSource', label: 'Resistance Source', type: 'textarea', rows: 3 },
          { key: 'keyTurn', label: 'Key Turn', type: 'textarea', rows: 3 },
          { key: 'hook', label: 'Hook', type: 'textarea', rows: 2 }
        ]
      },
      {
        key: 'deliverables',
        label: 'Deliverables',
        fields: [
          { key: 'worldInfoDrop', label: 'World Info Drop', type: 'textarea', rows: 2 },
          { key: 'characterArcProgress', label: 'Character Arc Progress', type: 'textarea', rows: 2 },
          { key: 'mainPlotProgress', label: 'Main Plot Progress', type: 'textarea', rows: 2 },
          { key: 'foreshadowing', label: 'Foreshadowing', type: 'textarea', rows: 2 }
        ]
      },
      {
        key: 'refs',
        label: 'References',
        fields: [
          { key: 'referencedCharacterNames', label: 'Character Names', type: 'tags', pickerSource: 'characters', pickerValue: 'name' },
          { key: 'referencedFactionNames', label: 'Faction Names', type: 'tags', pickerSource: 'factions', pickerValue: 'name' },
          { key: 'referencedLocationNames', label: 'Location Names', type: 'tags', pickerSource: 'locations', pickerValue: 'name' },
          { key: 'dependencyModuleVersions', label: 'Dependency Module Versions (JSON)', type: 'textarea', rows: 4 }
        ]
      }
    ],
    listColumns: [
      { key: 'chapterNumber', label: 'Chapter', width: 90 },
      { key: 'chapterTitle', label: 'Title', width: 180 },
      { key: 'volume', label: 'Volume', width: 120 }
    ]
  },

  chapter_blueprints: {
    module: 'chapter_blueprints',
    commonFields: commonBase,
    tabs: [
      {
        key: 'overview',
        label: 'Overview',
        fields: [
          { key: 'chapterId', label: 'Chapter ID', type: 'text' },
          { key: 'oneLineStructure', label: 'One Line Structure', type: 'textarea', rows: 2 },
          { key: 'pacingCurve', label: 'Pacing Curve', type: 'textarea', rows: 2 },
          { key: 'dependencyModuleVersions', label: 'Dependency Module Versions (JSON)', type: 'textarea', rows: 4 }
        ]
      },
      {
        key: 'scene',
        label: 'Scene',
        fields: [
          { key: 'sceneNumber', label: 'Scene Number', type: 'number' },
          { key: 'sceneTitle', label: 'Scene Title', type: 'text' },
          {
            key: 'povCharacter',
            label: 'POV Character',
            type: 'select',
            pickerSource: 'characters',
            pickerValue: 'name',
            placeholder: 'Select or type a character'
          },
          { key: 'estimatedWordCount', label: 'Estimated Word Count', type: 'text' },
          { key: 'opening', label: 'Opening', type: 'textarea', rows: 2 },
          { key: 'development', label: 'Development', type: 'textarea', rows: 2 },
          { key: 'turning', label: 'Turning', type: 'textarea', rows: 2 },
          { key: 'ending', label: 'Ending', type: 'textarea', rows: 2 },
          { key: 'infoDrop', label: 'Info Drop', type: 'textarea', rows: 2 }
        ]
      },
      {
        key: 'elements',
        label: 'Elements',
        fields: [
          { key: 'cast', label: 'Cast', type: 'textarea', rows: 2 },
          { key: 'locations', label: 'Locations', type: 'textarea', rows: 2 },
          { key: 'factions', label: 'Factions', type: 'textarea', rows: 2 },
          { key: 'itemsClues', label: 'Items / Clues', type: 'textarea', rows: 2 }
        ]
      }
    ],
    listColumns: [
      { key: 'sceneNumber', label: 'Scene', width: 70 },
      { key: 'sceneTitle', label: 'Title', width: 180 },
      { key: 'povCharacter', label: 'POV', width: 120 }
    ]
  }
}

export function buildEmptyForm(module: DesignModuleKey): Record<string, unknown> {
  const schema = MODULE_SCHEMAS[module]
  const out: Record<string, unknown> = {
    categoryId: null,
    sourceBookId: null
  }

  const apply = (fields: FieldDef[]) => {
    for (const field of fields) {
      if (field.default !== undefined) {
        out[field.key] = field.default
        continue
      }

      switch (field.type) {
        case 'switch':
          out[field.key] = false
          break
        case 'number':
          out[field.key] = null
          break
        case 'tags':
          out[field.key] = []
          break
        case 'date':
          out[field.key] = null
          break
        default:
          out[field.key] = ''
          break
      }
    }
  }

  apply(schema.commonFields)
  for (const tab of schema.tabs) apply(tab.fields)
  return out
}
