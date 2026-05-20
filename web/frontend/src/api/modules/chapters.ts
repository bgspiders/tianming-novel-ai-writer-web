import http from '../http'
import type { AiTestResult } from './aiTest'

export interface Chapter {
  id: string
  projectId: string
  volumeId: string
  chapterNumber: number
  title: string
  wordCount: number
  summary: string
  content: string
  contentFilePath: string
  status: string
  createdAt: string
  updatedAt: string
}

export interface ChapterUpsert {
  projectId: string
  volumeId: string
  chapterNumber: number
  title: string
  summary?: string
  content?: string
  status?: string
}

export interface ChapterDraftRequest {
  runId: string
  projectId: string
  volumeId: string
  chapterId: string
  endpoint: string
  providerId?: string | null
  apiKeyId?: string | null
  apiKey: string
  model: string
  systemPrompt?: string
  prompt: string
  temperature?: number
  maxTokens?: number
  maxRewriteAttempts?: number
  saveToChapter?: boolean
}

export interface ChapterDraftResult extends AiTestResult {
  chapterId: string
  contentFilePath?: string | null
  wordCount: number
  savedToChapter: boolean
  generationRecordId?: string | null
}

export async function listChapters(projectId: string, volumeId?: string | null): Promise<Chapter[]> {
  const params: Record<string, string> = { projectId }
  if (volumeId) params.volumeId = volumeId
  const { data } = await http.get<Chapter[]>('/api/chapters', { params })
  return data
}

export async function getChapter(id: string): Promise<Chapter> {
  const { data } = await http.get<Chapter>(`/api/chapters/${id}`)
  return data
}

export async function createChapter(input: ChapterUpsert): Promise<Chapter> {
  const { data } = await http.post<Chapter>('/api/chapters', input)
  return data
}

export async function updateChapter(id: string, input: ChapterUpsert): Promise<Chapter> {
  const { data } = await http.put<Chapter>(`/api/chapters/${id}`, input)
  return data
}

export async function saveChapterContent(id: string, content: string, status = 'drafted'): Promise<Chapter> {
  const { data } = await http.put<Chapter>(`/api/chapters/${id}/content`, { content, status })
  return data
}

export async function deleteChapter(id: string): Promise<void> {
  await http.delete(`/api/chapters/${id}`)
}

export async function generateChapterDraft(input: ChapterDraftRequest): Promise<ChapterDraftResult> {
  const { data } = await http.post<ChapterDraftResult>('/api/generation/chapter-draft', input)
  return data
}
