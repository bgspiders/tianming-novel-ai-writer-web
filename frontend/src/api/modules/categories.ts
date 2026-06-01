import http from '../http'

export interface Category {
  id: string
  moduleType: string
  name: string
  parentId: string | null
  sortOrder: number
  isBuiltIn: boolean
  isEnabled: boolean
  sourceBookId: string | null
  itemCount: number
}

export interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[]
}

export interface CategoryUpsert {
  moduleType: string
  name: string
  parentId?: string | null
  sortOrder?: number
  isEnabled?: boolean
  sourceBookId?: string | null
  projectId?: string | null
}

export interface CategoryReorderItem {
  id: string
  parentId?: string | null
  sortOrder: number
}

export interface CategoryReorderInput {
  moduleType: string
  sourceBookId?: string | null
  projectId?: string | null
  items: CategoryReorderItem[]
}

export async function listCategories(moduleType: string, sourceBookId?: string | null, projectId?: string | null): Promise<Category[]> {
  const params: Record<string, string> = { moduleType }
  if (sourceBookId) params.sourceBookId = sourceBookId
  if (projectId) params.projectId = projectId
  const { data } = await http.get<Category[]>('/api/categories', { params })
  return data
}

export async function getCategoryTree(moduleType: string, sourceBookId?: string | null, projectId?: string | null): Promise<CategoryTreeNode[]> {
  const params: Record<string, string> = { moduleType }
  if (sourceBookId) params.sourceBookId = sourceBookId
  if (projectId) params.projectId = projectId
  const { data } = await http.get<CategoryTreeNode[]>('/api/categories/tree', { params })
  return data
}

export async function createCategory(input: CategoryUpsert): Promise<Category> {
  const { data } = await http.post<Category>('/api/categories', input)
  return data
}

export async function updateCategory(id: string, input: CategoryUpsert): Promise<Category> {
  const { data } = await http.put<Category>(`/api/categories/${id}`, input)
  return data
}

export async function reorderCategories(input: CategoryReorderInput): Promise<void> {
  await http.post('/api/categories/reorder', input)
}

export async function deleteCategory(id: string): Promise<void> {
  await http.delete(`/api/categories/${id}`)
}
