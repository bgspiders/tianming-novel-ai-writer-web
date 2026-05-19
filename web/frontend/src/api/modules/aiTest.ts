import http from '../http'

export interface AiTestRequest {
  runId: string
  provider?: string
  endpoint: string
  apiKey: string
  model: string
  prompt: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
}

export interface AiTestResult {
  runId: string
  chunkCount: number
  charCount: number
  finishReason?: string
  elapsedMs: number
  model?: string
}

export async function postTestCompletion(req: AiTestRequest): Promise<AiTestResult> {
  const { data } = await http.post<AiTestResult>('/api/ai/test-completion', req)
  return data
}
