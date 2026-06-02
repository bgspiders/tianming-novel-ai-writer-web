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

export async function generateNovelSeed(input: NovelSeedRequest): Promise<NovelSeedResult> {
  const { data } = await http.post<NovelSeedResult>('/api/novel-seed', input, {
    timeout: 10 * 60_000
  })
  return data
}
