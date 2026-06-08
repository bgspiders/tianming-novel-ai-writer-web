import http from '../http'

export interface GenerationRecord {
  id: string
  projectId: string
  chapterId: string
  success: boolean
  totalAttempts: number
  rewriteCount: number
  failureStages: string
  attempts: string
  startedAt: string
  finishedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface GenerationStatistics {
  id: string
  projectId: string
  totalGenerations: number
  firstPassCount: number
  rewriteCount: number
  failureCount: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCostMicros: number
  lastUpdatedAt: string
}

export interface PackageContextResult {
  manifestId: string
  projectId: string
  version: number
  sourceBookId?: string | null
  publishedAt: string
  fileCount: number
  enabledModuleCount: number
  statistics: string
}

export interface GenerationFlowStepStatus {
  key: string
  title: string
  status: string
  count: number
  message: string
  path: string
  lastUpdatedAt?: string | null
}

export interface GenerationFlowStatus {
  projectId: string
  sourceBookId?: string | null
  steps: GenerationFlowStepStatus[]
  nextSuggestion: string
}

export interface PromptRunSnapshot {
  id: string
  runId: string
  projectId: string
  chapterId?: string | null
  workflowId?: string | null
  stepKey?: string | null
  source: string
  model: string
  temperature?: number | null
  maxTokens?: number | null
  contextHash: string
  contextSummary: string
  promptSummary: string
  outputSummary: string
  success: boolean
  error: string
  elapsedMs: number
  createdAt: string
}

export async function listGenerationRecords(projectId: string, chapterId?: string | null, take = 50): Promise<GenerationRecord[]> {
  const params: Record<string, string | number> = { projectId, take }
  if (chapterId) params.chapterId = chapterId
  const { data } = await http.get<GenerationRecord[]>('/api/generation/records', { params })
  return data
}

export async function getGenerationStatistics(projectId: string): Promise<GenerationStatistics> {
  const { data } = await http.get<GenerationStatistics>('/api/generation/statistics', { params: { projectId } })
  return data
}

export async function packageGenerationContext(projectId: string, sourceBookId?: string | null): Promise<PackageContextResult> {
  const { data } = await http.post<PackageContextResult>('/api/generation/package-context', {
    projectId,
    sourceBookId: sourceBookId || null
  })
  return data
}

export async function getGenerationFlowStatus(projectId: string): Promise<GenerationFlowStatus> {
  const { data } = await http.get<GenerationFlowStatus>('/api/generation/flow-status', {
    params: { projectId }
  })
  return data
}

export async function listPromptRunSnapshots(params: {
  projectId?: string | null
  chapterId?: string | null
  workflowId?: string | null
  take?: number
}): Promise<PromptRunSnapshot[]> {
  const { data } = await http.get<PromptRunSnapshot[]>('/api/generation/prompt-snapshots', { params })
  return data
}

export async function getPromptRunSnapshot(id: string): Promise<PromptRunSnapshot> {
  const { data } = await http.get<PromptRunSnapshot>(`/api/generation/prompt-snapshots/${id}`)
  return data
}
