import http from '../http'

export interface AiProvider {
  id: string
  code: string
  name: string
  defaultEndpoint: string | null
  iconUrl: string | null
  notes: string | null
  isBuiltIn: boolean
  isEnabled: boolean
  sortOrder: number
  modelCount: number
  keyCount: number
}

export interface AiProviderUpsert {
  code: string
  name: string
  defaultEndpoint?: string | null
  iconUrl?: string | null
  notes?: string | null
  isEnabled?: boolean
  sortOrder?: number
}

export interface AiModel {
  id: string
  providerId: string
  code: string
  name: string
  description: string | null
  contextWindow: number | null
  maxOutputTokens: number | null
  capabilities: string
  inputPricePerMillion: number | null
  outputPricePerMillion: number | null
  isEnabled: boolean
  sortOrder: number
}

export interface AiModelUpsert {
  code: string
  name: string
  description?: string | null
  contextWindow?: number | null
  maxOutputTokens?: number | null
  capabilities?: string
  inputPricePerMillion?: number | null
  outputPricePerMillion?: number | null
  isEnabled?: boolean
  sortOrder?: number
}

export interface AiApiKey {
  id: string
  providerId: string
  name: string
  maskedTail: string | null
  isEnabled: boolean
  rotationOrder: number
  lastUsedAt: string | null
  createdAt: string
}

export interface AiApiKeyCreate {
  providerId: string
  name: string
  plainKey: string
  isEnabled?: boolean
  rotationOrder?: number
}

export interface AiApiKeyUpdate {
  name: string
  plainKey?: string | null
  isEnabled: boolean
  rotationOrder: number
}

export interface AiApiKeyTestInput {
  endpoint: string
  modelCode: string
  prompt: string
}

export interface AiApiKeyTestResult {
  ok: boolean
  error: string | null
  outputChars: number | null
  elapsedMs: number | null
}

// --- Providers ---

export async function listProviders(): Promise<AiProvider[]> {
  const { data } = await http.get<AiProvider[]>('/api/ai-providers')
  return data
}

export async function createProvider(input: AiProviderUpsert): Promise<AiProvider> {
  const { data } = await http.post<AiProvider>('/api/ai-providers', input)
  return data
}

export async function updateProvider(id: string, input: AiProviderUpsert): Promise<AiProvider> {
  const { data } = await http.put<AiProvider>(`/api/ai-providers/${id}`, input)
  return data
}

export async function deleteProvider(id: string): Promise<void> {
  await http.delete(`/api/ai-providers/${id}`)
}

// --- Models ---

export async function listModels(providerId: string): Promise<AiModel[]> {
  const { data } = await http.get<AiModel[]>(`/api/ai-providers/${providerId}/models`)
  return data
}

export async function createModel(providerId: string, input: AiModelUpsert): Promise<AiModel> {
  const { data } = await http.post<AiModel>(`/api/ai-providers/${providerId}/models`, input)
  return data
}

export async function updateModel(providerId: string, modelId: string, input: AiModelUpsert): Promise<AiModel> {
  const { data } = await http.put<AiModel>(`/api/ai-providers/${providerId}/models/${modelId}`, input)
  return data
}

export async function deleteModel(providerId: string, modelId: string): Promise<void> {
  await http.delete(`/api/ai-providers/${providerId}/models/${modelId}`)
}

// --- Keys ---

export async function listKeys(providerId?: string): Promise<AiApiKey[]> {
  const { data } = await http.get<AiApiKey[]>('/api/ai-keys', {
    params: providerId ? { providerId } : undefined
  })
  return data
}

export async function createKey(input: AiApiKeyCreate): Promise<AiApiKey> {
  const { data } = await http.post<AiApiKey>('/api/ai-keys', input)
  return data
}

export async function updateKey(id: string, input: AiApiKeyUpdate): Promise<AiApiKey> {
  const { data } = await http.put<AiApiKey>(`/api/ai-keys/${id}`, input)
  return data
}

export async function deleteKey(id: string): Promise<void> {
  await http.delete(`/api/ai-keys/${id}`)
}

export async function testKey(id: string, input: AiApiKeyTestInput): Promise<AiApiKeyTestResult> {
  const { data } = await http.post<AiApiKeyTestResult>(`/api/ai-keys/${id}/test`, input)
  return data
}
