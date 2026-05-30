import apiClient from './client'

export interface MoleculeData {
  id: string
  task_id: string
  smiles: string
  step_number: number
  total_score: number
  sdf_index?: number
  qed_score?: number
  sa_score?: number
  mol_weight?: number
  logp?: number
  component_scores?: Record<string, number>
  created_at?: string
}

export interface DockingPoseData {
  id: string
  target_id: string
  target_name?: string
  rank: number
  docking_score: number
}

export interface MoleculeDetailData extends MoleculeData {
  poses: DockingPoseData[]
  target_ids?: string[]
  target_names?: string[]
}

export interface MoleculeListPage {
  items: MoleculeData[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface ScoreStatistics {
  task_id: string
  total_molecules: number
  score_by_step: Array<{
    step: number
    max_score: number
    avg_score: number
    min_score: number
    count: number
  }>
  component_stats: Record<string, {
    min: number
    max: number
    avg: number
  }>
  score_distribution: Array<{
    range: string
    count: number
  }>
}

export async function fetchMolecules(
  taskId: string,
  params: {
    page?: number; page_size?: number; sort_by?: string; sort_order?: string
    min_score?: number; max_score?: number
  } = {},
): Promise<MoleculeListPage> {
  const { data } = await apiClient.get(`/tasks/${taskId}/molecules`, { params })
  return data
}

export async function fetchMolecule(id: string): Promise<MoleculeDetailData> {
  const { data } = await apiClient.get(`/molecules/${id}`)
  return data
}

export async function fetchMoleculePoses(id: string): Promise<DockingPoseData[]> {
  const { data } = await apiClient.get(`/molecules/${id}/poses`)
  return data
}

export async function downloadCsv(taskId: string): Promise<Blob> {
  const { data } = await apiClient.get(`/tasks/${taskId}/export/csv`, { responseType: 'blob' })
  return data
}

export async function fetchTaskStatistics(taskId: string): Promise<ScoreStatistics> {
  const { data } = await apiClient.get(`/tasks/${taskId}/statistics`)
  return data
}

export interface TaskComparisonItem {
  task_id: string
  task_number: number
  status: string
  total_molecules: number
  best_score: number | null
  avg_score: number | null
  max_steps: number
  current_step: number
}

export interface TaskComparisonData {
  tasks: TaskComparisonItem[]
}

export async function fetchTaskComparison(taskIds: string[]): Promise<TaskComparisonData> {
  const { data } = await apiClient.get('/tasks/comparison', {
    params: { task_ids: taskIds.join(',') }
  })
  return data
}
