import http from '../http'

export interface DesignBase {
  id: string
  name: string
  category: string
  categoryId: string | null
  isEnabled: boolean
  sourceBookId: string | null
  projectId?: string | null
  createdAt: string
  updatedAt: string
}

export interface DesignListParams {
  categoryId?: string | null
  sourceBookId?: string | null
  keyword?: string | null
  isEnabled?: boolean | null
  updatedFrom?: string | null
  updatedTo?: string | null
  page?: number | null
  pageSize?: number | null
  includeUncategorized?: boolean | null
  projectId?: string | null
}

export interface PagedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

function buildParams(p?: DesignListParams): Record<string, string | boolean | number> | undefined {
  if (!p) return undefined
  const out: Record<string, string | boolean | number> = {}
  if (p.categoryId) out.categoryId = p.categoryId
  if (p.sourceBookId) out.sourceBookId = p.sourceBookId
  if (p.keyword) out.keyword = p.keyword
  if (p.isEnabled !== undefined && p.isEnabled !== null) out.isEnabled = p.isEnabled
  if (p.updatedFrom) out.updatedFrom = p.updatedFrom
  if (p.updatedTo) out.updatedTo = p.updatedTo
  if (p.page) out.page = p.page
  if (p.pageSize) out.pageSize = p.pageSize
  if (p.projectId) out.projectId = p.projectId
  if (p.includeUncategorized !== undefined && p.includeUncategorized !== null) {
    out.includeUncategorized = p.includeUncategorized
  }
  return Object.keys(out).length ? out : undefined
}

async function listPaged<T>(url: string, p: DesignListParams): Promise<PagedResult<T>> {
  return (await http.get<PagedResult<T>>(url, { params: buildParams(p) })).data
}

export interface WorldRule extends DesignBase {
  oneLineSummary: string
  powerSystem: string
  cosmology: string
  specialLaws: string
  hardRules: string
  softRules: string
  ancientEra: string
  keyEvents: string
  modernHistory: string
  statusQuo: string
}

export type WorldRuleUpsert = Omit<WorldRule, 'id' | 'createdAt' | 'updatedAt'>

export const worldRulesApi = {
  list: async (p?: DesignListParams): Promise<WorldRule[]> =>
    (await http.get<WorldRule[]>('/api/design/world-rules', { params: buildParams(p) })).data,
  listPaged: async (p: DesignListParams): Promise<PagedResult<WorldRule>> =>
    listPaged<WorldRule>('/api/design/world-rules', p),
  get: async (id: string): Promise<WorldRule> =>
    (await http.get<WorldRule>(`/api/design/world-rules/${id}`)).data,
  create: async (input: WorldRuleUpsert): Promise<WorldRule> =>
    (await http.post<WorldRule>('/api/design/world-rules', input)).data,
  update: async (id: string, input: WorldRuleUpsert): Promise<WorldRule> =>
    (await http.put<WorldRule>(`/api/design/world-rules/${id}`, input)).data,
  remove: async (id: string): Promise<void> => {
    await http.delete(`/api/design/world-rules/${id}`)
  }
}

export interface CharacterRule extends DesignBase {
  characterType: string
  gender: string
  age: string
  identity: string
  race: string
  appearance: string
  want: string
  need: string
  flawBelief: string
  growthPath: string
  targetCharacterName: string
  relationshipType: string
  emotionDynamic: string
  combatSkills: string
  nonCombatSkills: string
  specialAbilities: string
  signatureItems: string
  commonItems: string
  personalAssets: string
}

export type CharacterRuleUpsert = Omit<CharacterRule, 'id' | 'createdAt' | 'updatedAt'>

export const characterRulesApi = {
  list: async (p?: DesignListParams): Promise<CharacterRule[]> =>
    (await http.get<CharacterRule[]>('/api/design/character-rules', { params: buildParams(p) })).data,
  listPaged: async (p: DesignListParams): Promise<PagedResult<CharacterRule>> =>
    listPaged<CharacterRule>('/api/design/character-rules', p),
  get: async (id: string): Promise<CharacterRule> =>
    (await http.get<CharacterRule>(`/api/design/character-rules/${id}`)).data,
  create: async (input: CharacterRuleUpsert): Promise<CharacterRule> =>
    (await http.post<CharacterRule>('/api/design/character-rules', input)).data,
  update: async (id: string, input: CharacterRuleUpsert): Promise<CharacterRule> =>
    (await http.put<CharacterRule>(`/api/design/character-rules/${id}`, input)).data,
  remove: async (id: string): Promise<void> => {
    await http.delete(`/api/design/character-rules/${id}`)
  }
}

export interface FactionRule extends DesignBase {
  factionType: string
  goal: string
  strengthTerritory: string
  leader: string
  coreMembers: string
  memberTraits: string
  allies: string
  enemies: string
  neutralCompetitors: string
}

export type FactionRuleUpsert = Omit<FactionRule, 'id' | 'createdAt' | 'updatedAt'>

export const factionRulesApi = {
  list: async (p?: DesignListParams): Promise<FactionRule[]> =>
    (await http.get<FactionRule[]>('/api/design/faction-rules', { params: buildParams(p) })).data,
  listPaged: async (p: DesignListParams): Promise<PagedResult<FactionRule>> =>
    listPaged<FactionRule>('/api/design/faction-rules', p),
  get: async (id: string): Promise<FactionRule> =>
    (await http.get<FactionRule>(`/api/design/faction-rules/${id}`)).data,
  create: async (input: FactionRuleUpsert): Promise<FactionRule> =>
    (await http.post<FactionRule>('/api/design/faction-rules', input)).data,
  update: async (id: string, input: FactionRuleUpsert): Promise<FactionRule> =>
    (await http.put<FactionRule>(`/api/design/faction-rules/${id}`, input)).data,
  remove: async (id: string): Promise<void> => {
    await http.delete(`/api/design/faction-rules/${id}`)
  }
}

export interface LocationRule extends DesignBase {
  locationType: string
  description: string
  scale: string
  terrain: string
  climate: string
  landmarks: string[]
  resources: string[]
  historicalSignificance: string
  dangers: string[]
  factionId: string | null
}

export type LocationRuleUpsert = Omit<LocationRule, 'id' | 'createdAt' | 'updatedAt'>

export const locationRulesApi = {
  list: async (p?: DesignListParams): Promise<LocationRule[]> =>
    (await http.get<LocationRule[]>('/api/design/location-rules', { params: buildParams(p) })).data,
  listPaged: async (p: DesignListParams): Promise<PagedResult<LocationRule>> =>
    listPaged<LocationRule>('/api/design/location-rules', p),
  get: async (id: string): Promise<LocationRule> =>
    (await http.get<LocationRule>(`/api/design/location-rules/${id}`)).data,
  create: async (input: LocationRuleUpsert): Promise<LocationRule> =>
    (await http.post<LocationRule>('/api/design/location-rules', input)).data,
  update: async (id: string, input: LocationRuleUpsert): Promise<LocationRule> =>
    (await http.put<LocationRule>(`/api/design/location-rules/${id}`, input)).data,
  remove: async (id: string): Promise<void> => {
    await http.delete(`/api/design/location-rules/${id}`)
  }
}

export interface PlotRule extends DesignBase {
  targetVolume: string
  assignedVolume: string
  oneLineSummary: string
  eventType: string
  storyPhase: string
  prerequisitesTrigger: string
  mainCharacters: string
  keyNpcs: string
  location: string
  timeDuration: string
  stepTitle: string
  goal: string
  conflict: string
  result: string
  emotionCurve: string
  mainPlotPush: string
  characterGrowth: string
  worldReveal: string
  rewardsClues: string
}

export type PlotRuleUpsert = Omit<PlotRule, 'id' | 'createdAt' | 'updatedAt'>

export const plotRulesApi = {
  list: async (p?: DesignListParams): Promise<PlotRule[]> =>
    (await http.get<PlotRule[]>('/api/design/plot-rules', { params: buildParams(p) })).data,
  listPaged: async (p: DesignListParams): Promise<PagedResult<PlotRule>> =>
    listPaged<PlotRule>('/api/design/plot-rules', p),
  get: async (id: string): Promise<PlotRule> =>
    (await http.get<PlotRule>(`/api/design/plot-rules/${id}`)).data,
  create: async (input: PlotRuleUpsert): Promise<PlotRule> =>
    (await http.post<PlotRule>('/api/design/plot-rules', input)).data,
  update: async (id: string, input: PlotRuleUpsert): Promise<PlotRule> =>
    (await http.put<PlotRule>(`/api/design/plot-rules/${id}`, input)).data,
  remove: async (id: string): Promise<void> => {
    await http.delete(`/api/design/plot-rules/${id}`)
  }
}

export interface CreativeMaterial extends DesignBase {
  icon: string
  sourceBookName: string | null
  genre: string
  overallIdea: string
  worldBuildingMethod: string
  powerSystemDesign: string
  environmentDescription: string
  factionDesign: string
  worldviewHighlights: string
  protagonistDesign: string
  supportingRoles: string
  characterRelations: string
  goldenFingerDesign: string
  characterHighlights: string
  plotStructure: string
  conflictDesign: string
  climaxArrangement: string
  foreshadowingTechnique: string
  plotHighlights: string
}

export type CreativeMaterialUpsert = Omit<CreativeMaterial, 'id' | 'createdAt' | 'updatedAt'>

export interface SkeletonBuildResult {
  sourceBookId: string | null
  ruleCount: number
  outlineCount: number
  volumeDesignCount: number
  chapterPlanCount: number
  chapterBlueprintCount: number
}

export const creativeMaterialsApi = {
  list: async (p?: DesignListParams): Promise<CreativeMaterial[]> =>
    (await http.get<CreativeMaterial[]>('/api/design/creative-materials', { params: buildParams(p) })).data,
  listPaged: async (p: DesignListParams): Promise<PagedResult<CreativeMaterial>> =>
    listPaged<CreativeMaterial>('/api/design/creative-materials', p),
  get: async (id: string): Promise<CreativeMaterial> =>
    (await http.get<CreativeMaterial>(`/api/design/creative-materials/${id}`)).data,
  create: async (input: CreativeMaterialUpsert): Promise<CreativeMaterial> =>
    (await http.post<CreativeMaterial>('/api/design/creative-materials', input)).data,
  createFromBookAnalysis: async (bookAnalysisId: string): Promise<CreativeMaterial> =>
    (await http.post<CreativeMaterial>(`/api/design/creative-materials/from-book-analysis/${bookAnalysisId}`)).data,
  buildSkeleton: async (id: string): Promise<SkeletonBuildResult> =>
    (await http.post<SkeletonBuildResult>(`/api/design/creative-materials/${id}/build-skeleton`)).data,
  update: async (id: string, input: CreativeMaterialUpsert): Promise<CreativeMaterial> =>
    (await http.put<CreativeMaterial>(`/api/design/creative-materials/${id}`, input)).data,
  remove: async (id: string): Promise<void> => {
    await http.delete(`/api/design/creative-materials/${id}`)
  }
}

export interface BookAnalysis extends DesignBase {
  icon: string
  author: string
  genre: string
  sourceUrl: string
  sourceBookTitle: string
  sourceAuthor: string
  sourceGenre: string
  sourceKeywords: string
  sourceSite: string
  chapterCount: number
  totalWordCount: number
  crawledAt: string | null
  backgroundAiStatus: string
  backgroundAiJobId: string | null
  backgroundAiRequestedAt: string | null
  backgroundAiFinishedAt: string | null
  backgroundAiMessage: string
  worldBuildingMethod: string
  powerSystemDesign: string
  environmentDescription: string
  factionDesign: string
  worldviewHighlights: string
  protagonistDesign: string
  supportingRoles: string
  characterRelations: string
  goldenFingerDesign: string
  characterHighlights: string
  plotStructure: string
  conflictDesign: string
  climaxArrangement: string
  foreshadowingTechnique: string
  plotHighlights: string
}

export type BookAnalysisUpsert = Omit<BookAnalysis, 'id' | 'createdAt' | 'updatedAt'>

export interface BookAnalysisCrawlChapter {
  index: number
  title: string
  url: string
  summary: string
  wordCount: number
  content: string
}

export interface BookAnalysisCrawlPreview {
  sourceUrl: string
  sourceSite: string
  suggestedName: string
  title: string
  author: string
  genre: string
  keywords: string
  chapterCount: number
  totalWordCount: number
  crawledAt: string
  summary: string
  worldBuildingMethod: string
  powerSystemDesign: string
  environmentDescription: string
  factionDesign: string
  worldviewHighlights: string
  protagonistDesign: string
  supportingRoles: string
  characterRelations: string
  goldenFingerDesign: string
  characterHighlights: string
  plotStructure: string
  conflictDesign: string
  climaxArrangement: string
  foreshadowingTechnique: string
  plotHighlights: string
  chapters: BookAnalysisCrawlChapter[]
}

export interface BookAnalysisBackgroundAnalyzeAccepted {
  jobId: string
  bookAnalysisId: string
  status: string
}

export const bookAnalysesApi = {
  list: async (p?: DesignListParams): Promise<BookAnalysis[]> =>
    (await http.get<BookAnalysis[]>('/api/design/book-analyses', { params: buildParams(p) })).data,
  listPaged: async (p: DesignListParams): Promise<PagedResult<BookAnalysis>> =>
    listPaged<BookAnalysis>('/api/design/book-analyses', p),
  get: async (id: string): Promise<BookAnalysis> =>
    (await http.get<BookAnalysis>(`/api/design/book-analyses/${id}`)).data,
  crawlPreview: async (input: {
    url: string
    maxChapters?: number
    includeContent?: boolean
  }): Promise<BookAnalysisCrawlPreview> =>
    (await http.post<BookAnalysisCrawlPreview>('/api/design/book-analyses/crawl-preview', input)).data,
  aiAnalyze: async (input: {
    providerId: string
    apiKeyId?: string | null
    endpoint: string
    model: string
    preview: BookAnalysisCrawlPreview
    maxTokens?: number
  }): Promise<BookAnalysisCrawlPreview> =>
    (await http.post<BookAnalysisCrawlPreview>('/api/design/book-analyses/ai-analyze', input)).data,
  queueAiAnalyze: async (
    id: string,
    input: {
      providerId: string
      apiKeyId?: string | null
      endpoint: string
      model: string
      maxTokens?: number
    }
  ): Promise<BookAnalysisBackgroundAnalyzeAccepted> =>
    (await http.post<BookAnalysisBackgroundAnalyzeAccepted>(`/api/design/book-analyses/${id}/ai-analyze-jobs`, input)).data,
  create: async (input: BookAnalysisUpsert): Promise<BookAnalysis> =>
    (await http.post<BookAnalysis>('/api/design/book-analyses', input)).data,
  update: async (id: string, input: BookAnalysisUpsert): Promise<BookAnalysis> =>
    (await http.put<BookAnalysis>(`/api/design/book-analyses/${id}`, input)).data,
  remove: async (id: string): Promise<void> => {
    await http.delete(`/api/design/book-analyses/${id}`)
  }
}

export interface Outline extends DesignBase {
  dependencyModuleVersions: Record<string, number>
  totalChapterCount: number
  estimatedWordCount: string
  oneLineOutline: string
  emotionalTone: string
  philosophicalMotif: string
  theme: string
  coreConflict: string
  endingState: string
  volumeDivision: string
  outlineOverview: string
}

export type OutlineUpsert = Omit<Outline, 'id' | 'createdAt' | 'updatedAt'>

export const outlinesApi = {
  list: async (p?: DesignListParams): Promise<Outline[]> =>
    (await http.get<Outline[]>('/api/design/outlines', { params: buildParams(p) })).data,
  listPaged: async (p: DesignListParams): Promise<PagedResult<Outline>> =>
    listPaged<Outline>('/api/design/outlines', p),
  get: async (id: string): Promise<Outline> =>
    (await http.get<Outline>(`/api/design/outlines/${id}`)).data,
  create: async (input: OutlineUpsert): Promise<Outline> =>
    (await http.post<Outline>('/api/design/outlines', input)).data,
  update: async (id: string, input: OutlineUpsert): Promise<Outline> =>
    (await http.put<Outline>(`/api/design/outlines/${id}`, input)).data,
  remove: async (id: string): Promise<void> => {
    await http.delete(`/api/design/outlines/${id}`)
  }
}

export interface VolumeDesign extends DesignBase {
  dependencyModuleVersions: Record<string, number>
  volumeNumber: number
  volumeTitle: string
  volumeTheme: string
  stageGoal: string
  estimatedWordCount: string
  targetChapterCount: number
  startChapter: number
  endChapter: number
  mainConflict: string
  pressureSource: string
  keyEvents: string
  openingState: string
  endingState: string
  chapterAllocationOverview: string
  plotAllocation: string
  chapterGenerationHints: string
  referencedCharacterNames: string[]
  referencedFactionNames: string[]
  referencedLocationNames: string[]
}

export type VolumeDesignUpsert = Omit<VolumeDesign, 'id' | 'createdAt' | 'updatedAt'>

export const volumeDesignsApi = {
  list: async (p?: DesignListParams): Promise<VolumeDesign[]> =>
    (await http.get<VolumeDesign[]>('/api/design/volume-designs', { params: buildParams(p) })).data,
  listPaged: async (p: DesignListParams): Promise<PagedResult<VolumeDesign>> =>
    listPaged<VolumeDesign>('/api/design/volume-designs', p),
  get: async (id: string): Promise<VolumeDesign> =>
    (await http.get<VolumeDesign>(`/api/design/volume-designs/${id}`)).data,
  create: async (input: VolumeDesignUpsert): Promise<VolumeDesign> =>
    (await http.post<VolumeDesign>('/api/design/volume-designs', input)).data,
  update: async (id: string, input: VolumeDesignUpsert): Promise<VolumeDesign> =>
    (await http.put<VolumeDesign>(`/api/design/volume-designs/${id}`, input)).data,
  remove: async (id: string): Promise<void> => {
    await http.delete(`/api/design/volume-designs/${id}`)
  }
}

export interface ChapterPlan extends DesignBase {
  dependencyModuleVersions: Record<string, number>
  chapterTitle: string
  chapterNumber: number
  volume: string
  estimatedWordCount: string
  chapterTheme: string
  readerExperienceGoal: string
  mainGoal: string
  resistanceSource: string
  keyTurn: string
  hook: string
  worldInfoDrop: string
  characterArcProgress: string
  mainPlotProgress: string
  foreshadowing: string
  referencedCharacterNames: string[]
  referencedFactionNames: string[]
  referencedLocationNames: string[]
}

export type ChapterPlanUpsert = Omit<ChapterPlan, 'id' | 'createdAt' | 'updatedAt'>

export const chapterPlansApi = {
  list: async (p?: DesignListParams): Promise<ChapterPlan[]> =>
    (await http.get<ChapterPlan[]>('/api/design/chapter-plans', { params: buildParams(p) })).data,
  listPaged: async (p: DesignListParams): Promise<PagedResult<ChapterPlan>> =>
    listPaged<ChapterPlan>('/api/design/chapter-plans', p),
  get: async (id: string): Promise<ChapterPlan> =>
    (await http.get<ChapterPlan>(`/api/design/chapter-plans/${id}`)).data,
  create: async (input: ChapterPlanUpsert): Promise<ChapterPlan> =>
    (await http.post<ChapterPlan>('/api/design/chapter-plans', input)).data,
  update: async (id: string, input: ChapterPlanUpsert): Promise<ChapterPlan> =>
    (await http.put<ChapterPlan>(`/api/design/chapter-plans/${id}`, input)).data,
  remove: async (id: string): Promise<void> => {
    await http.delete(`/api/design/chapter-plans/${id}`)
  }
}

export interface ChapterBlueprint extends DesignBase {
  dependencyModuleVersions: Record<string, number>
  chapterId: string
  oneLineStructure: string
  pacingCurve: string
  sceneNumber: number
  sceneTitle: string
  povCharacter: string
  estimatedWordCount: string
  opening: string
  development: string
  turning: string
  ending: string
  infoDrop: string
  cast: string
  locations: string
  factions: string
  itemsClues: string
}

export type ChapterBlueprintUpsert = Omit<ChapterBlueprint, 'id' | 'createdAt' | 'updatedAt'>

export const chapterBlueprintsApi = {
  list: async (p?: DesignListParams): Promise<ChapterBlueprint[]> =>
    (await http.get<ChapterBlueprint[]>('/api/design/chapter-blueprints', { params: buildParams(p) })).data,
  listPaged: async (p: DesignListParams): Promise<PagedResult<ChapterBlueprint>> =>
    listPaged<ChapterBlueprint>('/api/design/chapter-blueprints', p),
  get: async (id: string): Promise<ChapterBlueprint> =>
    (await http.get<ChapterBlueprint>(`/api/design/chapter-blueprints/${id}`)).data,
  create: async (input: ChapterBlueprintUpsert): Promise<ChapterBlueprint> =>
    (await http.post<ChapterBlueprint>('/api/design/chapter-blueprints', input)).data,
  update: async (id: string, input: ChapterBlueprintUpsert): Promise<ChapterBlueprint> =>
    (await http.put<ChapterBlueprint>(`/api/design/chapter-blueprints/${id}`, input)).data,
  remove: async (id: string): Promise<void> => {
    await http.delete(`/api/design/chapter-blueprints/${id}`)
  }
}

export type DesignModuleKey =
  | 'world_rules'
  | 'character_rules'
  | 'faction_rules'
  | 'location_rules'
  | 'plot_rules'
  | 'creative_materials'
  | 'book_analyses'
  | 'outlines'
  | 'volume_designs'
  | 'chapter_plans'
  | 'chapter_blueprints'

export interface DesignModuleMeta {
  key: DesignModuleKey
  label: string
  icon: string
  hasSourceBookScope: boolean
}

export const DESIGN_MODULES: DesignModuleMeta[] = [
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
]
