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
  foreshadowingCount: number
  timelineCount: number
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

export interface NovelSeedWorkflowStep {
  id: string
  workflowId: string
  stepKey: string
  title: string
  sortOrder: number
  status: string
  isConfirmed: boolean
  prompt: string
  output: string
  error?: string | null
  startedAt?: string | null
  finishedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface NovelSeedWorkflow {
  id: string
  status: string
  request: NovelSeedRequest
  projectId?: string | null
  error?: string | null
  steps: NovelSeedWorkflowStep[]
  createdAt: string
  updatedAt: string
}

export interface NovelSeedWorkflowPreviewItem {
  key: string
  title: string
  summary: string
  rawJson: string
}

export interface NovelSeedWorkflowStepPreview {
  workflowId: string
  stepKey: string
  status: string
  items: NovelSeedWorkflowPreviewItem[]
}

export interface NovelSeedWorkflowCreateRequest {
  request: NovelSeedRequest
}

export interface NovelSeedWorkflowUpdateRequest {
  request: NovelSeedRequest
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

export async function createNovelSeedWorkflow(input: NovelSeedWorkflowCreateRequest): Promise<NovelSeedWorkflow> {
  const { data } = await http.post<NovelSeedWorkflow>('/api/novel-seed/workflows', input)
  return data
}

export async function updateNovelSeedWorkflowRequest(
  workflowId: string,
  input: NovelSeedWorkflowUpdateRequest
): Promise<NovelSeedWorkflow> {
  const { data } = await http.put<NovelSeedWorkflow>(`/api/novel-seed/workflows/${workflowId}/request`, input)
  return data
}

export async function listNovelSeedWorkflows(take = 20): Promise<NovelSeedWorkflow[]> {
  const { data } = await http.get<NovelSeedWorkflow[]>('/api/novel-seed/workflows', {
    params: { take }
  })
  return data
}

export async function getNovelSeedWorkflow(workflowId: string): Promise<NovelSeedWorkflow> {
  const { data } = await http.get<NovelSeedWorkflow>(`/api/novel-seed/workflows/${workflowId}`)
  return data
}

export async function runNovelSeedWorkflowStep(workflowId: string, stepKey: string): Promise<NovelSeedWorkflowStep> {
  const { data } = await http.post<NovelSeedWorkflowStep>(`/api/novel-seed/workflows/${workflowId}/steps/${stepKey}/run`, null, {
    timeout: 10 * 60_000
  })
  return data
}

export async function confirmNovelSeedWorkflowStep(
  workflowId: string,
  stepKey: string,
  confirmed: boolean
): Promise<NovelSeedWorkflowStep> {
  const { data } = await http.post<NovelSeedWorkflowStep>(
    `/api/novel-seed/workflows/${workflowId}/steps/${stepKey}/confirm`,
    null,
    { params: { confirmed } }
  )
  return data
}

export async function previewNovelSeedWorkflowStep(workflowId: string, stepKey: string): Promise<NovelSeedWorkflowStepPreview> {
  const { data } = await http.get<NovelSeedWorkflowStepPreview>(
    `/api/novel-seed/workflows/${workflowId}/steps/${stepKey}/preview`
  )
  return data
}

export async function rewriteNovelSeedWorkflowStepFragment(
  workflowId: string,
  stepKey: string,
  itemKey: string,
  instruction: string
): Promise<NovelSeedWorkflowStep> {
  const { data } = await http.post<NovelSeedWorkflowStep>(
    `/api/novel-seed/workflows/${workflowId}/steps/${stepKey}/rewrite`,
    { itemKey, instruction },
    { timeout: 10 * 60_000 }
  )
  return data
}

export async function deleteNovelSeedWorkflow(workflowId: string): Promise<void> {
  await http.delete(`/api/novel-seed/workflows/${workflowId}`)
}
