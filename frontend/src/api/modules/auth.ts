import http from '../http'

export interface AuthStatus {
  isInitialized: boolean
  isAuthenticated: boolean
  username?: string | null
  expiresAt?: string | null
}

export interface AuthCredentials {
  username: string
  password: string
}

export interface AuthResult {
  username: string
  expiresAt: string
}

export async function getAuthStatus(): Promise<AuthStatus> {
  const { data } = await http.get<AuthStatus>('/api/auth/status')
  return data
}

export async function setupAdmin(input: AuthCredentials): Promise<AuthResult> {
  const { data } = await http.post<AuthResult>('/api/auth/setup', input)
  return data
}

export async function login(input: AuthCredentials): Promise<AuthResult> {
  const { data } = await http.post<AuthResult>('/api/auth/login', input)
  return data
}

export async function logout(): Promise<void> {
  await http.post('/api/auth/logout')
}

