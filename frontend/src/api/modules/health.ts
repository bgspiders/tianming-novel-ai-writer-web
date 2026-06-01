import http from '../http'

export interface HealthResult {
  status: string
  version: string
  env: string
  time: string
  timeUtc: string
}

export async function getHealth(): Promise<HealthResult> {
  const { data } = await http.get<HealthResult>('/api/health')
  return data
}
