import http from '../http'
import type { Project, Volume } from './projects'
import type { Chapter } from './chapters'

export interface NovelSeedRequest {
  runId?: string | null
  description: string
  genre?: string | null
  tone?: string | null
  targetAudience?: string | null
  volumeCount: number
  chaptersPerVolume: number
  initialChapterPlanCount: number
  estimatedWordsPerChapter: number
  createChapters: boolean
  createDesignData: boolean
  configId?: string | null
  providerId?: string | null
  apiKeyId?: string | null
  apiKey: string
  endpoint: string
  model: string
  temperature?: number | null
  maxTokens?: number | null
}

export interface NovelSeedResult {
  project: Project
  volumes: Volume[]
  chapters: Chapter[]
  worldRuleCount: number
  characterRuleCount: number
  factionRuleCount: number
  locationRuleCount: number
  outlineCount: number
  volumeDesignCount: number
  chapterPlanCount: number
  chapterBlueprintCount: number
  creativeMaterialCount: number
  totalPlannedChapterCount: number
  initialChapterPlanCount: number
  rawPlan: string
}

export interface NovelSeedPlanSummary {
  projectId: string
  projectName: string
  description?: string | null
  sourceBookId?: string | null
  sourceBookName: string
  genre: string
  volumeCount: number
  chapterCount: number
  totalPlannedChapterCount: number
  initialChapterPlanCount: number
  worldRuleCount: number
  characterRuleCount: number
  factionRuleCount: number
  locationRuleCount: number
  outlineCount: number
  volumeDesignCount: number
  chapterPlanCount: number
  chapterBlueprintCount: number
  creativeMaterialCount: number
  announcement: string
  createdAt: string
  updatedAt: string
}

export interface NovelSeedConversation {
  sessionId: string
  projectId: string
  title: string
  mode: string
  lastMessageAt: string
}

export async function generateNovelSeed(input: NovelSeedRequest): Promise<NovelSeedResult> {
  const { data } = await http.post<NovelSeedResult>('/api/novel-seed', input, {
    timeout: 10 * 60_000
  })
  return data
}

export async function listNovelSeedPlans(): Promise<NovelSeedPlanSummary[]> {
  const { data } = await http.get<NovelSeedPlanSummary[]>('/api/novel-seed/plans')
  return data
}

export async function getOrCreateNovelSeedConversation(
  projectId: string,
  providerId?: string | null,
  modelCode?: string | null
): Promise<NovelSeedConversation> {
  const { data } = await http.post<NovelSeedConversation>(`/api/novel-seed/plans/${projectId}/conversation`, null, {
    params: { providerId, modelCode }
  })
  return data
}
