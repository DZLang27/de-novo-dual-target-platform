import apiClient from './client'
import type { TargetData } from './targets'

export interface ProjectTargetData {
  id: string
  target_id: string
  target_name: string
  weight: number
  center_x?: number
  center_y?: number
  center_z?: number
  size_x?: number
  size_y?: number
  size_z?: number
  exhaustiveness?: number
}

export interface ProjectData {
  id: string
  name: string
  description?: string
  created_at: string
  targets: ProjectTargetData[]
  task_count?: number
}

export async function fetchProjects(page = 1, pageSize = 20): Promise<ProjectData[]> {
  const { data } = await apiClient.get('/projects', { params: { page, page_size: pageSize } })
  return data
}

export async function fetchProject(id: string): Promise<ProjectData> {
  const { data } = await apiClient.get(`/projects/${id}`)
  return data
}

export async function createProject(body: { name: string; description?: string }): Promise<ProjectData> {
  const { data } = await apiClient.post('/projects', body)
  return data
}

export async function linkTarget(projectId: string, body: {
  target_id: string
  weight?: number
  center_x?: number; center_y?: number; center_z?: number
  size_x?: number; size_y?: number; size_z?: number
  exhaustiveness?: number
}): Promise<ProjectData> {
  const { data } = await apiClient.post(`/projects/${projectId}/targets`, body)
  return data
}

export async function unlinkTarget(projectId: string, targetId: string): Promise<void> {
  await apiClient.delete(`/projects/${projectId}/targets/${targetId}`)
}

export async function deleteProject(id: string): Promise<void> {
  await apiClient.delete(`/projects/${id}`)
}

export async function updateProject(id: string, body: { name?: string; description?: string }): Promise<ProjectData> {
  const { data } = await apiClient.patch(`/projects/${id}`, body)
  return data
}
