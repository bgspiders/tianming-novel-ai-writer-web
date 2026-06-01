import { listChapters, type Chapter } from './chapters'
import http from '../http'

export interface EditorChapterVersion {
  id: string
  label: string
  content: string
  savedAt: string
}

export interface VectorRecallQuery {
  projectId: string
  chapterId?: string
  query: string
  topK: number
}

export interface VectorRecallResult {
  id: string
  source: string
  title: string
  excerpt: string
  score: number
  matchedKeywords?: string[]
}

export interface EditorChapterAssist {
  chapter: Chapter
  related: VectorRecallResult[]
}

export interface EditorIndexStatus {
  projectId: string
  indexedChapterCount: number
  totalChapterCount: number
  keywordCount: number
  lastBuiltAt?: string | null
  staleChapterCount?: number
  status?: 'empty' | 'ready' | 'stale' | 'building' | 'failed' | string
}

export interface EditorIndexRebuildResult extends EditorIndexStatus {
  rebuiltChapterCount?: number
}

interface EditorSearchResultDto {
  chapterId: string
  projectId: string
  volumeId: string
  chapterNumber: number
  title: string
  summary: string
  snippet: string
  score: number
  matchedKeywords: string[]
}

export async function listEditorChapters(projectId: string, volumeId?: string | null): Promise<Chapter[]> {
  return listChapters(projectId, volumeId)
}

export async function getEditorChapterAssist(id: string, relatedTopK = 6): Promise<EditorChapterAssist> {
  const { data } = await http.get<{ chapter: Chapter; related: EditorSearchResultDto[] }>(`/api/editor/chapters/${id}`, {
    params: { relatedTopK }
  })
  return {
    chapter: data.chapter,
    related: data.related.map(toVectorRecallResult)
  }
}

export async function saveEditorChapterContent(id: string, content: string, status = 'drafted'): Promise<Chapter> {
  const { data } = await http.put<Chapter>(`/api/editor/chapters/${id}/content`, { content, status })
  return data
}

export async function searchVectorRecall(input: VectorRecallQuery): Promise<VectorRecallResult[]> {
  const { data } = await http.post<EditorSearchResultDto[]>('/api/editor/search', {
    projectId: input.projectId,
    query: input.query,
    topK: input.topK
  })
  return data
    .filter((item) => item.chapterId !== input.chapterId)
    .map(toVectorRecallResult)
}

function toVectorRecallResult(item: EditorSearchResultDto): VectorRecallResult {
  return {
    id: item.chapterId,
    source: `第 ${item.chapterNumber} 章`,
    title: item.title,
    excerpt: item.snippet || item.summary,
    score: item.score,
    matchedKeywords: item.matchedKeywords
  }
}

export async function getEditorIndexStatus(projectId: string): Promise<EditorIndexStatus> {
  const { data } = await http.get<EditorIndexStatus>('/api/editor/index/status', {
    params: { projectId }
  })
  return data
}

export async function rebuildEditorIndex(projectId: string): Promise<EditorIndexRebuildResult> {
  const { data } = await http.post<EditorIndexRebuildResult>('/api/editor/index/rebuild', {
    projectId
  })
  return data
}
