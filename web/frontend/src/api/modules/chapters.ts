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

export interface ChapterListParams {
  projectId?: string | null
  sourceBookId?: string | null
  keyword?: string | null
}

export interface ChapterListItem {
  id: string
  projectId: string
  projectName: string | null
  sourceBookId: string | null
  volumeId: string
  volumeNumber: number
  volumeTitle: string | null
  chapterNumber: number
  title: string
  summary: string
  wordCount: number
  status: string
  contentFilePath: string
  createdAt: string
  updatedAt: string
}

export interface ChapterDetail extends ChapterListItem {
  content: string
}

export interface SaveChapterContentPayload {
  content: string
}

export interface RestoreChapterVersionPayload {
  versionId: string
}

export interface ChapterVersionItem {
  versionId: string
  label: string
  fileName: string
  createdAt: string
  size: number
  isCurrent: boolean
}

export interface ChapterVersionDetail {
  versionId: string
  label: string
  fileName: string
  createdAt: string
  size: number
  content: string
}

export interface ChapterRecallResult {
  chapterId: string
  chapterTitle: string
  chapterNumber: number
  volumeId: string
  summary: string
  score: number
  matchedKeywords: string[]
  reason: string
}

export interface ChapterRecallResponse {
  chapterId: string
  query: string
  querySource: string
  topK: number
  results: ChapterRecallResult[]
}

export interface ChapterRecallParams {
  query?: string | null
  topK?: number | null
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
  configId?: string | null
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
  validationReportId?: string | null
  rerunValidationAfterSave?: boolean
  saveToChapter?: boolean
}

export interface ChapterDraftResult extends AiTestResult {
  chapterId: string
  contentFilePath?: string | null
  wordCount: number
  savedToChapter: boolean
  generationRecordId?: string | null
}

function buildEditorListParams(params?: ChapterListParams): Record<string, string> | undefined {
  if (!params) return undefined

  const query: Record<string, string> = {}
  if (params.projectId) query.projectId = params.projectId
  if (params.sourceBookId) query.sourceBookId = params.sourceBookId
  if (params.keyword) query.keyword = params.keyword

  return Object.keys(query).length ? query : undefined
}

function buildRecallParams(params?: ChapterRecallParams): Record<string, string | number> | undefined {
  if (!params) return undefined

  const query: Record<string, string | number> = {}
  if (params.query) query.query = params.query
  if (params.topK && params.topK > 0) query.topK = params.topK

  return Object.keys(query).length ? query : undefined
}

export const chaptersApi = {
  list: async (params?: ChapterListParams): Promise<ChapterListItem[]> =>
    (await http.get<ChapterListItem[]>('/api/chapters/editor-list', { params: buildEditorListParams(params) })).data,

  get: async (id: string): Promise<ChapterDetail> =>
    (await http.get<ChapterDetail>(`/api/chapters/${id}/editor`)).data,

  saveContent: async (id: string, payload: SaveChapterContentPayload): Promise<ChapterDetail> =>
    (await http.put<ChapterDetail>(`/api/chapters/${id}/editor-content`, payload)).data,

  versions: async (id: string): Promise<ChapterVersionItem[]> =>
    (await http.get<ChapterVersionItem[]>(`/api/chapters/${id}/versions`)).data,

  version: async (id: string, versionId: string): Promise<ChapterVersionDetail> =>
    (await http.get<ChapterVersionDetail>(`/api/chapters/${id}/versions/${versionId}`)).data,

  restoreVersion: async (id: string, payload: RestoreChapterVersionPayload): Promise<ChapterDetail> =>
    (await http.post<ChapterDetail>(`/api/chapters/${id}/restore-version`, payload)).data,

  recall: async (id: string, params?: ChapterRecallParams): Promise<ChapterRecallResponse> =>
    (await http.get<ChapterRecallResponse>(`/api/chapters/${id}/recall`, { params: buildRecallParams(params) })).data
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
  const { data } = await http.post<ChapterDraftResult>('/api/generation/chapter-draft', input, {
    timeout: 10 * 60_000
  })
  return data
}
