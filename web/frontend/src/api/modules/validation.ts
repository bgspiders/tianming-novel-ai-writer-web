import http from '../http'

export interface ValidationRunRequest {
  projectId: string
  volumeNumber?: number | null
}

export interface ValidationSummary {
  id: string
  projectId: string
  targetVolumeNumber: number
  lastRunId: string
  overallResult: string
  moduleResults: string
  problemItems: string
  lastValidatedAt: string
  createdAt: string
  updatedAt: string
}

export interface ValidationItem {
  id: string
  validationType: string
  name: string
  result: string
  details: string
  suggestion: string
}

export interface ValidationReport {
  id: string
  projectId: string
  chapterId: string
  runId: string
  chapterNumber: number
  chapterTitle: string
  chapterStatus: string
  validatedAt: string
  result: string
  summary: string
  items: ValidationItem[]
  createdAt: string
  updatedAt: string
}

export interface ValidationReportStatusUpdateResult {
  reportId: string
  projectId: string
  chapterId: string
  chapterStatus: string
  note?: string | null
  updatedAt: string
}

export interface FactTimeline {
  id: string
  chapterId: string
  chapterNumber: number
  chapterTitle: string
  timePeriod: string
  elapsedTime: string
  keyTimeEvent: string
  importance: string
}

export interface VolumeFactArchive {
  id: string
  volumeId: string
  volumeNumber: number
  lastChapterId: string
  archivedAt: string
  snapshotPayload: string
}

export interface FactSnapshotOverview {
  chapterCount: number
  timelineCount: number
  characterStateCount: number
  characterStatePointCount: number
  characterDescriptionCount: number
  conflictProgressCount: number
  conflictProgressPointCount: number
  factionStateCount: number
  factionStatePointCount: number
  locationStateCount: number
  locationStatePointCount: number
  locationDescriptionCount: number
  worldRuleConstraintCount: number
  characterLocationCount: number
  characterMovementCount: number
  itemStateCount: number
  itemStatePointCount: number
  foreshadowingCount: number
  unresolvedForeshadowingCount: number
  overdueForeshadowingCount: number
  plotPointCount: number
  volumeArchiveCount: number
}

export interface FactSnapshotItem {
  id: string
  name: string
  status: string
  detail: string
  chapterNumber?: number | null
  importance: string
}

export interface FactSnapshotSection {
  key: string
  title: string
  totalCount: number
  summary: string
  items: FactSnapshotItem[]
}

export interface FactSnapshot {
  projectId: string
  volumeNumber?: number | null
  overview: FactSnapshotOverview
  sections: FactSnapshotSection[]
  timelines: FactTimeline[]
  volumeArchives: VolumeFactArchive[]
}

export async function runValidation(input: ValidationRunRequest): Promise<ValidationSummary> {
  const { data } = await http.post<ValidationSummary>('/api/validation/run', input)
  return data
}

export async function listValidationSummaries(projectId: string, volumeNumber?: number | null): Promise<ValidationSummary[]> {
  const params: Record<string, string | number> = { projectId }
  if (volumeNumber) params.volumeNumber = volumeNumber
  const { data } = await http.get<ValidationSummary[]>('/api/validation/summaries', { params })
  return data
}

export async function listValidationReports(
  projectId: string,
  volumeNumber?: number | null,
  chapterId?: string | null,
  take = 100
): Promise<ValidationReport[]> {
  const params: Record<string, string | number> = { projectId, take }
  if (volumeNumber) params.volumeNumber = volumeNumber
  if (chapterId) params.chapterId = chapterId
  const { data } = await http.get<ValidationReport[]>('/api/validation/reports', { params })
  return data
}

export async function updateValidationReportChapterStatus(
  reportId: string,
  status: string,
  note?: string
): Promise<ValidationReportStatusUpdateResult> {
  const { data } = await http.put<ValidationReportStatusUpdateResult>(
    `/api/validation/reports/${reportId}/chapter-status`,
    { status, note }
  )
  return data
}

export async function getFactSnapshot(projectId: string, volumeNumber?: number | null): Promise<FactSnapshot> {
  const params: Record<string, string | number> = { projectId }
  if (volumeNumber) params.volumeNumber = volumeNumber
  const { data } = await http.get<FactSnapshot>('/api/validation/facts', { params })
  return data
}
