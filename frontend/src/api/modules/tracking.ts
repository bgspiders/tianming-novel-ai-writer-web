import http from '../http'

export interface TrackingListParams {
  projectId: string
  sourceBookId?: string | null
  keyword?: string | null
  startChapterNumber?: number | null
  endChapterNumber?: number | null
}

export interface Foreshadowing {
  id: string
  projectId: string
  sourceBookId?: string | null
  name: string
  tier: string
  isSetup: boolean
  isResolved: boolean
  isOverdue: boolean
  expectedSetupChapter: string
  expectedPayoffChapter: string
  actualSetupChapter: string
  actualPayoffChapter: string
  overdueSuggestion: string
  createdAt: string
  updatedAt: string
}

export type ForeshadowingUpsert = Omit<Foreshadowing, 'id' | 'createdAt' | 'updatedAt'>

export interface Timeline {
  id: string
  projectId: string
  chapterId: string
  sourceBookId?: string | null
  chapterNumber: number
  chapterTitle: string
  timePeriod: string
  elapsedTime: string
  keyTimeEvent: string
  importance: string
  createdAt: string
  updatedAt: string
}

export interface TimelineUpsert {
  projectId: string
  chapterId: string
  sourceBookId?: string | null
  timePeriod: string
  elapsedTime: string
  keyTimeEvent: string
  importance: string
}

export interface LongNovelCompletenessItem {
  key: string
  label: string
  status: string
  count: number
  message: string
  route: string
}

export interface LongNovelCompleteness {
  projectId: string
  isReady: boolean
  readyCount: number
  missingCount: number
  fatalCount: number
  items: LongNovelCompletenessItem[]
}

export interface TrackingRebuildRequest {
  projectId: string
  sourceBookId?: string | null
}

export interface TrackingRebuildResult {
  projectId: string
  sourceBookId?: string | null
  chapterCount: number
  blueprintCount: number
  removedForeshadowingCount: number
  removedTimelineCount: number
  foreshadowingCount: number
  timelineCount: number
}

function buildParams(params: TrackingListParams): Record<string, string | number> {
  const out: Record<string, string | number> = { projectId: params.projectId }
  if (params.sourceBookId) out.sourceBookId = params.sourceBookId
  if (params.keyword) out.keyword = params.keyword
  if (params.startChapterNumber) out.startChapterNumber = params.startChapterNumber
  if (params.endChapterNumber) out.endChapterNumber = params.endChapterNumber
  return out
}

export async function listForeshadowings(params: TrackingListParams): Promise<Foreshadowing[]> {
  const { data } = await http.get<Foreshadowing[]>('/api/tracking/foreshadowings', { params: buildParams(params) })
  return data
}

export async function createForeshadowing(input: ForeshadowingUpsert): Promise<Foreshadowing> {
  const { data } = await http.post<Foreshadowing>('/api/tracking/foreshadowings', input)
  return data
}

export async function updateForeshadowing(id: string, input: ForeshadowingUpsert): Promise<Foreshadowing> {
  const { data } = await http.put<Foreshadowing>(`/api/tracking/foreshadowings/${id}`, input)
  return data
}

export async function deleteForeshadowing(id: string): Promise<void> {
  await http.delete(`/api/tracking/foreshadowings/${id}`)
}

export async function listTimelines(params: TrackingListParams): Promise<Timeline[]> {
  const { data } = await http.get<Timeline[]>('/api/tracking/timelines', { params: buildParams(params) })
  return data
}

export async function createTimeline(input: TimelineUpsert): Promise<Timeline> {
  const { data } = await http.post<Timeline>('/api/tracking/timelines', input)
  return data
}

export async function updateTimeline(id: string, input: TimelineUpsert): Promise<Timeline> {
  const { data } = await http.put<Timeline>(`/api/tracking/timelines/${id}`, input)
  return data
}

export async function deleteTimeline(id: string): Promise<void> {
  await http.delete(`/api/tracking/timelines/${id}`)
}

export async function getLongNovelCompleteness(projectId: string, sourceBookId?: string | null): Promise<LongNovelCompleteness> {
  const { data } = await http.get<LongNovelCompleteness>('/api/tracking/completeness', {
    params: { projectId, ...(sourceBookId ? { sourceBookId } : {}) }
  })
  return data
}

export async function rebuildTracking(input: TrackingRebuildRequest): Promise<TrackingRebuildResult> {
  const { data } = await http.post<TrackingRebuildResult>('/api/tracking/rebuild', input)
  return data
}
