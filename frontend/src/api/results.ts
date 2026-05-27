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
