import http from '../http'

export interface TianmingProtocolDescriptor {
  key: string
  command: string
  apiId: string
  label: string
  description: string
  requiredInputs: string[]
}

export interface TianmingProtocolRequest {
  command: string
  projectId?: string | null
  sourceBookId?: string | null
  volumeId?: string | null
  volumeNumber?: number | null
  chapterNumber?: number | null
  startChapterNumber?: number | null
  endChapterNumber?: number | null
  chapterId?: string | null
  prompt?: string | null
  systemPrompt?: string | null
  configId?: string | null
  providerId?: string | null
  apiKeyId?: string | null
  apiKey?: string | null
  endpoint?: string | null
  model?: string | null
  temperature?: number | null
  maxTokens?: number | null
  saveToChapter?: boolean
}

export interface TianmingProtocolResult {
  key: string
  command: string
  apiId: string
  status: string
  title: string
  content: string
  metadata: Record<string, string>
  generatedAt: string
}

export interface TianmingKnowledgeBaseFile {
  key: string
  fileName: string
  title: string
  description: string
  isBound: boolean
  isMissing: boolean
  characterCount: number
  generatedAt: string
  content: string
}

export interface TianmingKnowledgeBaseBindingStatus {
  projectId: string
  sourceBookId: string | null
  files: TianmingKnowledgeBaseFile[]
  allRequiredBound: boolean
  missingRequiredFiles: string[]
}

export async function listTianmingProtocols(): Promise<TianmingProtocolDescriptor[]> {
  return (await http.get<TianmingProtocolDescriptor[]>('/api/tianming/protocols')).data
}

export async function runTianmingProtocol(input: TianmingProtocolRequest): Promise<TianmingProtocolResult> {
  return (await http.post<TianmingProtocolResult>('/api/tianming/protocols/run', input)).data
}

export async function listTianmingKnowledgeBaseFiles(): Promise<TianmingKnowledgeBaseFile[]> {
  return (await http.get<TianmingKnowledgeBaseFile[]>('/api/tianming/protocols/knowledge-base')).data
}

export async function getTianmingKnowledgeBaseStatus(
  projectId: string,
  sourceBookId?: string | null
): Promise<TianmingKnowledgeBaseBindingStatus> {
  return (
    await http.get<TianmingKnowledgeBaseBindingStatus>('/api/tianming/protocols/knowledge-base/status', {
      params: { projectId, sourceBookId }
    })
  ).data
}

export async function getTianmingKnowledgeBaseFile(
  key: string,
  projectId: string,
  sourceBookId?: string | null
): Promise<TianmingKnowledgeBaseFile> {
  return (
    await http.get<TianmingKnowledgeBaseFile>(`/api/tianming/protocols/knowledge-base/${key}`, {
      params: { projectId, sourceBookId }
    })
  ).data
}

export async function exportTianmingKnowledgeBase(
  projectId: string,
  sourceBookId?: string | null
): Promise<TianmingKnowledgeBaseFile[]> {
  return (
    await http.get<TianmingKnowledgeBaseFile[]>('/api/tianming/protocols/knowledge-base/export', {
      params: { projectId, sourceBookId }
    })
  ).data
}

export async function importTianmingKnowledgeBaseFile(input: {
  projectId: string
  sourceBookId?: string | null
  key: string
  content: string
}): Promise<TianmingKnowledgeBaseFile> {
  return (await http.post<TianmingKnowledgeBaseFile>('/api/tianming/protocols/knowledge-base/import', input)).data
}
