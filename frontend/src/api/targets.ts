import apiClient from './client'

export interface TargetData {
  id: string
  name: string
  protein_name?: string
  pdbqt_filename: string
  pdbqt_file_size?: number
  center_x: number
  center_y: number
  center_z: number
  size_x: number
  size_y: number
  size_z: number
  exhaustiveness: number
  created_at: string
}

export interface ProteinPreparationResult {
  success: boolean
  input_filename: string
  output_filename?: string
  stats?: {
    num_atoms: number
    num_residues: number
    center_x: number
    center_y: number
    center_z: number
    size_x: number
    size_y: number
    size_z: number
  }
  error?: string
}

export async function fetchTargets(page = 1, pageSize = 20): Promise<TargetData[]> {
  const { data } = await apiClient.get('/targets', { params: { page, page_size: pageSize } })
  return data
}

export async function fetchTarget(id: string): Promise<TargetData> {
  const { data } = await apiClient.get(`/targets/${id}`)
  return data
}

export async function createTarget(formData: FormData): Promise<TargetData> {
  const { data } = await apiClient.post('/targets', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function deleteTarget(id: string): Promise<void> {
  await apiClient.delete(`/targets/${id}`)
}

export async function updateTarget(id: string, body: Record<string, any>): Promise<TargetData> {
  const { data } = await apiClient.patch(`/targets/${id}`, body)
  return data
}

export async function prepareProtein(formData: FormData): Promise<ProteinPreparationResult> {
  const { data } = await apiClient.post('/targets/prepare', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export interface PDBDownloadRequest {
  pdb_id: string
  name?: string
  remove_heterogens?: boolean
  fix_missing_heavy_atoms?: boolean
  fix_missing_hydrogens?: boolean
  standardize?: boolean
  pH?: number
}

export async function prepareFromPDB(request: PDBDownloadRequest): Promise<TargetData> {
  const { data } = await apiClient.post('/targets/prepare-from-pdb', request)
  return data
}
