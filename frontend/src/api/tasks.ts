import apiClient from './client'

export interface ScoringComponentSpec {
  type: string
  name: string
  weight: number
  transform?: Record<string, any>
  params?: Record<string, any>
}

export interface TaskSubmitBody {
  project_id: string
  mode?: string
  max_steps?: number
  batch_size?: number
  sigma?: number
  learning_rate?: number
  aggregation?: string
  device?: string
  docking_backend?: string
  target_overrides?: Record<string, any>
  extra_components?: ScoringComponentSpec[]
}

export interface TaskData {
  id: string
  project_id: string
  task_number: number
  status: string
  mode: string
  batch_size: number
  max_steps: number
  current_step: number
  best_score?: number
  total_molecules: number
  progress_pct: number
  queued_at?: string
  started_at?: string
  completed_at?: string
  error_message?: string
  toml_config?: string
  created_at: string
}

export interface QueueStatus {
  queue_length: number
  gpu_available: boolean
  current_task_id?: string
}

export async function fetchTasks(
  projectId?: string,
  status?: string,
  page = 1,
  pageSize = 20,
): Promise<TaskData[]> {
  const params: any = { page, page_size: pageSize }
  if (projectId) params.project_id = projectId
  if (status) params.status = status
  const { data } = await apiClient.get('/tasks', { params })
  return data
}

export async function fetchTask(id: string): Promise<TaskData> {
  const { data } = await apiClient.get(`/tasks/${id}`)
  return data
}

export async function submitTask(body: TaskSubmitBody): Promise<TaskData> {
  const { data } = await apiClient.post('/tasks', body)
  return data
}

export async function cancelTask(id: string): Promise<TaskData> {
  const { data } = await apiClient.post(`/tasks/${id}/cancel`)
  return data
}

export async function fetchQueueStatus(): Promise<QueueStatus> {
  const { data } = await apiClient.get('/tasks/queue-status')
  return data
}
