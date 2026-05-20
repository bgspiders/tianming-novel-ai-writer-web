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
