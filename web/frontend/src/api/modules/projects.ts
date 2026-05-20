import http from '../http'

export interface Project {
  id: string
  name: string
  description: string | null
  currentSourceBookId: string | null
  version: number
  lastModifiedAt: string
  createdAt: string
  updatedAt: string
}

export interface ProjectUpsert {
  name: string
  description?: string | null
  currentSourceBookId?: string | null
}

export interface Volume {
  id: string
  projectId: string
  volumeNumber: number
  title: string
  theme: string | null
  milestoneText: string | null
  createdAt: string
  updatedAt: string
}

export interface VolumeUpsert {
  projectId: string
  volumeNumber: number
  title: string
  theme?: string | null
  milestoneText?: string | null
}

export async function listProjects(): Promise<Project[]> {
  const { data } = await http.get<Project[]>('/api/projects')
  return data
}

export async function createProject(input: ProjectUpsert): Promise<Project> {
  const { data } = await http.post<Project>('/api/projects', input)
  return data
}

export async function updateProject(id: string, input: ProjectUpsert): Promise<Project> {
  const { data } = await http.put<Project>(`/api/projects/${id}`, input)
  return data
}

export async function deleteProject(id: string): Promise<void> {
  await http.delete(`/api/projects/${id}`)
}

export async function listVolumes(projectId: string): Promise<Volume[]> {
  const { data } = await http.get<Volume[]>('/api/volumes', { params: { projectId } })
  return data
}

export async function createVolume(input: VolumeUpsert): Promise<Volume> {
  const { data } = await http.post<Volume>('/api/volumes', input)
  return data
}

export async function updateVolume(id: string, input: VolumeUpsert): Promise<Volume> {
  const { data } = await http.put<Volume>(`/api/volumes/${id}`, input)
  return data
}

export async function deleteVolume(id: string): Promise<void> {
  await http.delete(`/api/volumes/${id}`)
}
