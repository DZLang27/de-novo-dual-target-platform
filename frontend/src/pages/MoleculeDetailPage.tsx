import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Card, Descriptions, Tag, Typography, Spin, Space, Select } from 'antd'
import { fetchMolecule, type MoleculeDetailData } from '../api/results'
import MoleculeViewer from '../components/molecule/MoleculeViewer'

const { Title, Text } = Typography

export default function MoleculeDetailPage() {
  const { moleculeId } = useParams<{ moleculeId: string }>()
  const [molecule, setMolecule] = useState<MoleculeDetailData | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTarget, setActiveTarget] = useState(0)

  useEffect(() => {
    if (moleculeId) loadData()
  }, [moleculeId])

  async function loadData() {
    if (!moleculeId) return
    setLoading(true)
    try {
      const data = await fetchMolecule(moleculeId)
      setMolecule(data)
    } finally { setLoading(false) }
  }

  if (loading || !molecule) {
    return <Card><Spin size="large" style={{ display: 'block', margin: '100px auto' }} /></Card>
  }

  // Use target_ids and target_names from the response
  const targetIds: string[] = (molecule as any).target_ids || []
  const targetNames: string[] = (molecule as any).target_names || []

  const targetOptions = targetNames.map((name, i) => ({
    value: i,
    label: name,
  }))

  return (
    <div>
      <Title level={3} style={{ color: '#fff', marginBottom: 24 }}>分子详情</Title>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 24 }}>
        <div>
          <Card title="SMILES" size="small" style={{ marginBottom: 16 }}>
            <div style={{
              background: '#0d0d0d', padding: 12, borderRadius: 8,
              fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-all',
            }}>
              {molecule.smiles}
            </div>
          </Card>

          <Card title="评分信息" size="small" style={{ marginBottom: 16 }}>
            <Descriptions column={1} size="small" colon={false}>
              <Descriptions.Item label="总分">
                <Tag color="blue">{molecule.total_score.toFixed(4)}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="生成步骤">{molecule.step_number}</Descriptions.Item>
            </Descriptions>
          </Card>

          {molecule.component_scores && Object.keys(molecule.component_scores).length > 0 && (
            <Card title="组分分数" size="small" style={{ marginBottom: 16 }}>
              {Object.entries(molecule.component_scores).map(([key, val]) => (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>{key}</Text>
                  <Text style={{ fontSize: 12, fontFamily: 'monospace' }}>
                    {(val as number).toFixed(4)}
                  </Text>
                </div>
              ))}
            </Card>
          )}

          <Card title="3D 视图控制" size="small">
            {targetOptions.length > 0 && (
              <Select
                style={{ width: '100%' }}
                value={activeTarget}
                onChange={setActiveTarget}
                options={targetOptions}
              />
            )}
            {targetOptions.length === 0 && (
              <Text type="secondary">无对接构象数据</Text>
            )}
            <div style={{ marginTop: 12 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                蛋白: cartoon + surface | 配体: licorice (元素着色)
              </Text>
            </div>
          </Card>
        </div>

        <Card title="3D 蛋白-配体结合视图" size="small" styles={{ body: { padding: 0 } }}>
          <MoleculeViewer
            taskId={molecule.task_id}
            stepNumber={molecule.step_number}
            smiles={molecule.smiles}
            targetIds={targetIds}
            activeTargetIndex={activeTarget}
          />
        </Card>
      </div>
    </div>
  )
}
