import http from '../http'

export type ChatMode = 'agent' | 'plan' | 'edit'

export interface ChatSession {
  id: string
  projectId?: string | null
  title: string
  mode: ChatMode
  modelCode?: string | null
  providerId?: string | null
  lastMessageAt: string
  createdAt: string
  updatedAt: string
}

export interface ChatMessage {
  id: string
  chatSessionId: string
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  summary?: string | null
  thinkingContent?: string | null
  analysisBlocksJson?: string | null
  toolPayload?: string | null
  inputTokens?: number | null
  outputTokens?: number | null
  createdAt: string
  updatedAt: string
}

export interface ChatToolPayload {
  type?: string
  targetPanel?: string | null
  hideRawContentInBubble?: boolean | null
  analysisExpandedByDefault?: boolean | null
  requiresExecutionEngine?: boolean | null
  description?: string | null
  steps?: PlanStepPayload[] | null
  stepCount?: number | null
  executionTrace?: ToolCallRecordPayload[] | null
  executionTraceSummary?: ExecutionTraceSummaryPayload | null
  toolCalls?: ToolCallRecordPayload[] | null
  thinkingBlocks?: ThinkingBlockPayload[] | null
  directive?: ChapterDirectivePayload | null
  chapterRange?: ChapterRangePayload | null
  normalization?: string | null
}

export interface PlanStepPayload {
  index: number
  title: string
  detail?: string | null
  chapterNumber?: number | null
  continueFromChapterId?: string | null
  rewriteTargetChapterId?: string | null
}

export interface ThinkingBlockPayload {
  index: number
  title: string
  detail: string
}

export type ToolCallStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | string

export interface ToolCallRecordPayload {
  stepIndex?: number | null
  pluginName?: string | null
  functionName?: string | null
  title?: string | null
  description?: string | null
  arguments?: string | Record<string, unknown> | unknown[] | null
  result?: string | Record<string, unknown> | unknown[] | null
  status?: ToolCallStatus | null
  startTime?: string | null
  endTime?: string | null
  durationSeconds?: number | null
  durationMs?: number | null
  errorMessage?: string | null
}

export interface ExecutionTraceSummaryPayload {
  totalSteps?: number | null
  completedSteps?: number | null
  failedSteps?: number | null
  totalDurationSeconds?: number | null
  failedStepSummaries?: string[] | null
  summaryText?: string | null
}

export interface ChapterDirectivePayload {
  kind: 'continue' | 'rewrite' | string
  chapterId: string
}

export interface ChapterRangePayload {
  start: number
  end: number
}

export interface ChatSessionCreateRequest {
  projectId?: string | null
  mode: ChatMode
  title?: string | null
  providerId?: string | null
  modelCode?: string | null
}

export interface ChatSessionUpdateRequest {
  title?: string | null
  mode?: ChatMode | null
  providerId?: string | null
  modelCode?: string | null
}

export interface SendChatMessageRequest {
  runId: string
  content: string
  endpoint: string
  model: string
  providerId?: string | null
  apiKeyId?: string | null
  apiKey?: string | null
  temperature?: number | null
  maxTokens?: number | null
}

export interface SendChatMessageResult {
  runId: string
  sessionId: string
  userMessageId: string
  assistantMessageId: string
  finishReason: string
  chunkCount: number
  charCount: number
  elapsedMs: number
}

export interface ExecuteChatPlanRequest {
  runId: string
}

export interface ExecuteChatPlanResult {
  runId: string
  sessionId: string
  messageId: string
  finishReason: string
  traceCount: number
  executionTraceSummary?: ExecutionTraceSummaryPayload | null
  message: ChatMessage
}

export async function listChatSessions(projectId?: string | null): Promise<ChatSession[]> {
  const params: Record<string, string> = {}
  if (projectId) params.projectId = projectId
  const { data } = await http.get<ChatSession[]>('/api/chat-assistant/sessions', { params })
  return data
}

export async function createChatSession(input: ChatSessionCreateRequest): Promise<ChatSession> {
  const { data } = await http.post<ChatSession>('/api/chat-assistant/sessions', input)
  return data
}

export async function updateChatSession(id: string, input: ChatSessionUpdateRequest): Promise<ChatSession> {
  const { data } = await http.put<ChatSession>(`/api/chat-assistant/sessions/${id}`, input)
  return data
}

export async function deleteChatSession(id: string): Promise<void> {
  await http.delete(`/api/chat-assistant/sessions/${id}`)
}

export async function listChatMessages(sessionId: string): Promise<ChatMessage[]> {
  const { data } = await http.get<ChatMessage[]>(`/api/chat-assistant/sessions/${sessionId}/messages`)
  return data
}

export async function sendChatMessage(sessionId: string, input: SendChatMessageRequest): Promise<SendChatMessageResult> {
  const { data } = await http.post<SendChatMessageResult>(`/api/chat-assistant/sessions/${sessionId}/messages`, input)
  return data
}

export async function executeChatPlan(
  sessionId: string,
  messageId: string,
  input: ExecuteChatPlanRequest
): Promise<ExecuteChatPlanResult> {
  const { data } = await http.post<ExecuteChatPlanResult>(
    `/api/chat-assistant/sessions/${sessionId}/messages/${messageId}/execute`,
    input
  )
  return data
}
