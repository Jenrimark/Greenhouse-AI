import { api } from '../lib/api'

export interface Resume {
  id: string
  title: string
  templateId: string | null
  content: Record<string, unknown>
  fileUrl: string | null
  createdAt: string
  updatedAt: string
}

export async function listResumes(): Promise<Resume[]> {
  const response = await api.get<{ data: { items: Resume[] } }>('/api/resumes')
  return response.data.items ?? []
}

export async function getResume(id: string): Promise<Resume> {
  const response = await api.get<{ data: Resume }>(`/api/resumes/${id}`)
  return response.data
}

export async function createResume(input: { title: string; templateId?: string; content?: Record<string, unknown> }): Promise<Resume> {
  const response = await api.post<{ data: Resume }>('/api/resumes', input)
  return response.data
}

export async function updateResume(id: string, patch: { title?: string; content?: Record<string, unknown> }): Promise<Resume> {
  const response = await api.patch<{ data: Resume }>(`/api/resumes/${id}`, patch)
  return response.data
}
