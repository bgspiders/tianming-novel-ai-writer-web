import http from '../http'

export interface SourceBook {
  id: string
  name: string
  author: string
  genre: string
  site: string | null
  url: string | null
  chapterCount: number
  totalWordCount: number
  crawledAt: string | null
  createdAt: string
  updatedAt: string
}

export interface SourceBookUpsert {
  name: string
  author?: string
  genre?: string
  site?: string | null
  url?: string | null
  chapterCount?: number
  totalWordCount?: number
  crawledAt?: string | null
}

export async function listSourceBooks(): Promise<SourceBook[]> {
  const { data } = await http.get<SourceBook[]>('/api/source-books')
  return data
}

export async function createSourceBook(input: SourceBookUpsert): Promise<SourceBook> {
  const { data } = await http.post<SourceBook>('/api/source-books', input)
  return data
}

export async function updateSourceBook(id: string, input: SourceBookUpsert): Promise<SourceBook> {
  const { data } = await http.put<SourceBook>(`/api/source-books/${id}`, input)
  return data
}

export async function deleteSourceBook(id: string): Promise<void> {
  await http.delete(`/api/source-books/${id}`)
}
