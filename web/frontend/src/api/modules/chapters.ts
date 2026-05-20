import http from '../http'

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

function buildListParams(params?: ChapterListParams): Record<string, string> | undefined {
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
    (await http.get<ChapterListItem[]>('/api/chapters', { params: buildListParams(params) })).data,

  get: async (id: string): Promise<ChapterDetail> =>
    (await http.get<ChapterDetail>(`/api/chapters/${id}`)).data,

  saveContent: async (id: string, payload: SaveChapterContentPayload): Promise<ChapterDetail> =>
    (await http.put<ChapterDetail>(`/api/chapters/${id}/content`, payload)).data,

  versions: async (id: string): Promise<ChapterVersionItem[]> =>
    (await http.get<ChapterVersionItem[]>(`/api/chapters/${id}/versions`)).data,

  version: async (id: string, versionId: string): Promise<ChapterVersionDetail> =>
    (await http.get<ChapterVersionDetail>(`/api/chapters/${id}/versions/${versionId}`)).data,

  restoreVersion: async (id: string, payload: RestoreChapterVersionPayload): Promise<ChapterDetail> =>
    (await http.post<ChapterDetail>(`/api/chapters/${id}/restore-version`, payload)).data,

  recall: async (id: string, params?: ChapterRecallParams): Promise<ChapterRecallResponse> =>
    (await http.get<ChapterRecallResponse>(`/api/chapters/${id}/recall`, { params: buildRecallParams(params) })).data
}
