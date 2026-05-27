import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Card, Steps, Button, Form, Input, Select, Space, InputNumber,
  Typography, message, Divider, Slider, Tag, Checkbox,
} from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { createProject, fetchProject, linkTarget, type ProjectData } from '../api/projects'
import type { TargetData } from '../api/targets'
import { fetchTargets } from '../api/targets'
import type { ScoringComponentSpec } from '../api/tasks'
import { submitTask } from '../api/tasks'

const { Title, Text } = Typography

const AVAILABLE_COMPONENTS = [
  { value: 'QED', label: 'QED 类药性', defaultWeight: 0.5 },
  { value: 'SAscore', label: 'SAscore 合成可及性', defaultWeight: 0.3 },
  { value: 'MolecularWeight', label: '分子量 (MW)', defaultWeight: 0.5 },
  { value: 'SlogP', label: '脂溶性 (LogP)', defaultWeight: 0.5 },
  { value: 'TPSA', label: '极性表面积 (TPSA)', defaultWeight: 0.3 },
  { value: 'HBondAcceptors', label: '氢键受体数', defaultWeight: 0.3 },
  { value: 'HBondDonors', label: '氢键供体数', defaultWeight: 0.3 },
  { value: 'NumRotBond', label: '可旋转键数', defaultWeight: 0.3 },
  { value: 'NumRings', label: '环数', defaultWeight: 0.3 },
  { value: 'NumAromaticRings', label: '芳香环数', defaultWeight: 0.3 },
]

export default function ProjectCreatePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const existingProjectId = searchParams.get('projectId')

  const [current, setCurrent] = useState(existingProjectId ? 1 : 0)
  const [projectName, setProjectName] = useState('')
  const [projectDesc, setProjectDesc] = useState('')
  const [projectId, setProjectId] = useState<string | null>(existingProjectId)
  const [availableTargets, setAvailableTargets] = useState<TargetData[]>([])
  const [selectedTargets, setSelectedTargets] = useState<TargetData[]>([])
  const [loading, setLoading] = useState(false)

  const [maxSteps, setMaxSteps] = useState(200)
  const [batchSize, setBatchSize] = useState(128)
  const [sigma, setSigma] = useState(128)
  const [learningRate, setLearningRate] = useState(0.0001)
  const [aggregation, setAggregation] = useState('geometric_mean')
  const [dockingBackend, setDockingBackend] = useState('vina')
  const [targetWeights, setTargetWeights] = useState<Record<string, number>>({})
  const [extraComponents, setExtraComponents] = useState<ScoringComponentSpec[]>([])

  useEffect(() => {
    if (existingProjectId) loadExistingProject()
  }, [existingProjectId])

  async function loadExistingProject() {
    if (!existingProjectId) return
    try {
      const p = await fetchProject(existingProjectId)
      setProjectName(p.name)
      setProjectDesc(p.description || '')
      setSelectedTargets(p.targets.map((pt: any) => ({ id: pt.target_id, name: pt.target_name } as TargetData)))
      loadTargets()
    } catch { message.error('项目加载失败') }
  }

  const loadTargets = async () => {
    try {
      const data = await fetchTargets(1, 100)
      setAvailableTargets(data)
    } catch { /**/ }
  }

  const goToStep1 = () => {
    if (!projectName.trim()) { message.warning('请输入项目名称'); return }
    loadTargets()
    setCurrent(1)
  }

  const goToStep2 = () => {
    if (selectedTargets.length < 1) { message.warning('至少选择 1 个靶点'); return }
    setCurrent(2)
  }

  const handleFinalSubmit = async () => {
    if (!projectName.trim()) { message.error('项目名称为空'); return }
    if (selectedTargets.length < 1) { message.warning('至少需要 1 个靶点'); return }
    setLoading(true)
    try {
      let pid = projectId
      // Create project if new
      if (!pid) {
        const project = await createProject({ name: projectName, description: projectDesc })
        pid = project.id
        // Link targets
        for (const t of selectedTargets) {
          await linkTarget(pid, { target_id: t.id, weight: 1.0 })
        }
      } else {
        // Ensure selected targets are linked (for existing project)
        for (const t of selectedTargets) {
          try {
            await linkTarget(pid, { target_id: t.id, weight: 1.0 })
          } catch {
            // Already linked, ignore
          }
        }
      }
      // Submit task
      const targetOverrides: Record<string, any> = {}
      selectedTargets.forEach((t) => {
        targetOverrides[t.id] = { weight: targetWeights[t.id] || 1.0 }
      })
      await submitTask({
        project_id: pid!,
        max_steps: maxSteps,
        batch_size: batchSize,
        sigma,
        learning_rate: learningRate,
        aggregation,
        device: 'cpu',
        docking_backend: dockingBackend,
        target_overrides: targetOverrides,
        extra_components: extraComponents,
      })
      message.success('任务已提交！')
      navigate(`/projects/${pid}`)
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '提交失败')
    } finally {
      setLoading(false)
    }
  }

  const toggleTarget = (target: TargetData) => {
    const found = selectedTargets.find((t) => t.id === target.id)
    if (found) {
      setSelectedTargets((prev) => prev.filter((t) => t.id !== target.id))
      setTargetWeights((prev) => { const { [target.id]: _, ...rest } = prev; return rest })
    } else {
      setSelectedTargets((prev) => [...prev, target])
      setTargetWeights((prev) => ({ ...prev, [target.id]: 1.0 }))
    }
  }

  const toggleComponent = (compType: string) => {
    const found = extraComponents.find((c) => c.type === compType)
    if (found) {
      setExtraComponents((prev) => prev.filter((c) => c.type !== compType))
    } else {
      const template = AVAILABLE_COMPONENTS.find((c) => c.value === compType)
      setExtraComponents((prev) => [...prev, {
        type: compType,
        name: template?.label || compType,
        weight: template?.defaultWeight || 1.0,
      }])
    }
  }

  const updateComponentWeight = (compType: string, weight: number) => {
    setExtraComponents((prev) =>
      prev.map((c) => (c.type === compType ? { ...c, weight } : c)),
    )
  }

  const stepItems = [
    { title: existingProjectId ? '已有项目' : '项目信息' },
    { title: '选择靶点' },
    { title: 'REINVENT 参数' },
    { title: '评分组件' },
    { title: '确认提交' },
  ]

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <Title level={3} style={{ color: '#fff', marginBottom: 24 }}>
        {existingProjectId ? '从已有项目新建任务' : '新建项目'}
      </Title>

      <Card style={{ marginBottom: 24 }}>
        <Steps current={current} items={stepItems} size="small" />
      </Card>

      {/* Step 0: Project Info (only for new projects) */}
      {current === 0 && !existingProjectId && (
        <Card title="项目基本信息">
          <Form layout="vertical">
            <Form.Item label="项目名称" required>
              <Input placeholder="如 EGFR 双靶点抑制剂优化" value={projectName}
                onChange={(e) => setProjectName(e.target.value)} />
            </Form.Item>
            <Form.Item label="项目描述">
              <Input.TextArea rows={3} placeholder="可选：描述项目目标和背景" value={projectDesc}
                onChange={(e) => setProjectDesc(e.target.value)} />
            </Form.Item>
            <Button type="primary" size="large" onClick={goToStep1}>下一步：选择靶点</Button>
          </Form>
        </Card>
      )}

      {/* For existing project, show info in step 0 */}
      {current === 0 && existingProjectId && setCurrent(1) as any}

      {/* Step 1: Select Targets */}
      {current === 1 && (
        <Card title="选择靶点蛋白" extra={<Button onClick={loadTargets}>刷新靶点库</Button>}>
          <div style={{ marginBottom: 16 }}>
            <Text type="secondary">已选靶点: {selectedTargets.length} 个</Text>
            <div style={{ marginTop: 8 }}>
              {selectedTargets.map((t) => (
                <Tag key={t.id} closable onClose={() => toggleTarget(t)} style={{ marginBottom: 4 }}>
                  {t.name} {('protein_name' in t) ? `(${(t as any).protein_name || ''})` : ''}
                </Tag>
              ))}
              {selectedTargets.length === 0 && <Text type="secondary">请点击下方靶点卡片选择</Text>}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {availableTargets.map((t) => {
              const isSelected = !!selectedTargets.find((s) => s.id === t.id)
              return (
                <Card key={t.id} size="small" hoverable
                  style={{ border: isSelected ? '2px solid #1677ff' : undefined, cursor: 'pointer' }}
                  onClick={() => toggleTarget(t)}
                >
                  <Text strong>{isSelected ? '✓ ' : ''}{t.name}</Text><br />
                  <Text type="secondary">{t.protein_name || '--'}</Text><br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    盒子: ({t.center_x}, {t.center_y}, {t.center_z}) | {t.size_x}×{t.size_y}×{t.size_z} Å
                  </Text>
                </Card>
              )
            })}
          </div>
          {availableTargets.length === 0 && (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <Text type="secondary">靶点库为空，请先在"靶点库"页面上传蛋白文件</Text>
            </div>
          )}
          <Divider />
          <Space>
            {!existingProjectId && <Button onClick={() => setCurrent(0)}>上一步</Button>}
            <Button type="primary" onClick={goToStep2}>下一步：REINVENT 参数</Button>
          </Space>
        </Card>
      )}

      {/* Step 2: REINVENT Parameters */}
      {current === 2 && (
        <Card title="REINVENT4 强化学习参数">
          <Form layout="vertical">
            <Form.Item label={`最大训练步数: ${maxSteps}`}>
              <Slider min={1} max={500} value={maxSteps} onChange={setMaxSteps}
                marks={{ 1: '1', 50: '50', 100: '100', 200: '200', 300: '300', 500: '500' }} />
            </Form.Item>
            <Form.Item label={`每批分子数 (batch_size): ${batchSize}`}>
              <Slider min={16} max={512} step={16} value={batchSize} onChange={setBatchSize}
                marks={{ 16: '16', 64: '64', 128: '128', 256: '256', 512: '512' }} />
            </Form.Item>
            <Form.Item label={`奖励函数温度 (sigma): ${sigma}`}>
              <Slider min={1} max={500} value={sigma} onChange={setSigma}
                marks={{ 1: '1', 128: '128', 256: '256', 500: '500' }} />
            </Form.Item>
            <Form.Item label="学习率">
              <Select value={String(learningRate)} onChange={(v) => setLearningRate(Number(v))}
                options={[
                  { value: '0.00001', label: '1e-5 (慢速)' },
                  { value: '0.0001', label: '1e-4 (标准)' },
                  { value: '0.001', label: '1e-3 (快速)' },
                ]} />
            </Form.Item>
            <Form.Item label="分数聚合方式">
              <Select value={aggregation} onChange={setAggregation}
                options={[
                  { value: 'geometric_mean', label: '几何平均 (推荐 — 各项都需达标)' },
                  { value: 'arithmetic_mean', label: '算术平均' },
                ]} />
            </Form.Item>
            <Form.Item label="分子对接后端">
              <Select value={dockingBackend} onChange={setDockingBackend}
                options={[
                  { value: 'vina', label: 'AutoDock Vina (CPU) — 无GPU时使用' },
                  { value: 'vina_gpu', label: 'Vina-GPU — 需要NVIDIA显卡' },
                ]} />
            </Form.Item>
            <Space>
              <Button onClick={() => setCurrent(1)}>上一步</Button>
              <Button type="primary" onClick={() => setCurrent(3)}>下一步：评分组件</Button>
            </Space>
          </Form>
        </Card>
      )}

      {/* Step 3: Scoring Components */}
      {current === 3 && (() => {
        const targetWeightSum = selectedTargets.reduce((s, t) => s + (targetWeights[t.id] || 1.0), 0)
        const extraWeightSum = extraComponents.reduce((s, c) => s + c.weight, 0)
        const totalWeight = targetWeightSum + extraWeightSum
        const isBalanced = Math.abs(totalWeight - 1.0) < 0.01

        return (
        <Card title="评分组件配置">
          <Text strong>对接打分组件 ({selectedTargets.length} 个靶点)</Text>
          <div style={{ marginTop: 8, marginBottom: 8 }}>
            {selectedTargets.map((t, i) => (
              <Card key={t.id} size="small" style={{ marginBottom: 8 }}
                styles={{ body: { padding: '10px 16px' } }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Space>
                    <Text strong>靶点 {i + 1}:</Text>
                    <Tag>{t.name}</Tag>
                    <Text type="secondary">DockStream 对接打分</Text>
                  </Space>
                  <Space>
                    <Text type="secondary" style={{ fontSize: 12 }}>权重:</Text>
                    <InputNumber
                      min={0.01} max={10} step={0.1}
                      value={targetWeights[t.id] || 1.0}
                      onChange={(v) => setTargetWeights((prev) => ({ ...prev, [t.id]: v || 0.1 }))}
                      style={{ width: 80 }}
                      size="small"
                    />
                  </Space>
                </div>
              </Card>
            ))}
          </div>

          <Divider />
          <Text strong>额外分子属性评分组件</Text>
          <div style={{ marginTop: 12 }}>
            {AVAILABLE_COMPONENTS.map((comp) => {
              const active = extraComponents.find((c) => c.type === comp.value)
              return (
                <Card key={comp.value} size="small" style={{ marginBottom: 8 }}
                  styles={{ body: { padding: '10px 16px' } }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Space>
                      <Checkbox
                        checked={!!active}
                        onChange={() => toggleComponent(comp.value)}
                      />
                      <Text>{comp.label}</Text>
                    </Space>
                    {active && (
                      <Space>
                        <Text type="secondary" style={{ fontSize: 12 }}>权重:</Text>
                        <InputNumber
                          min={0.01} max={10} step={0.1}
                          value={active.weight}
                          onChange={(v) => updateComponentWeight(comp.value, v || 0.1)}
                          style={{ width: 80 }}
                          size="small"
                        />
                      </Space>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>

          <Divider />
          <div style={{
            background: isBalanced ? '#0d2818' : '#281010',
            borderRadius: 8, padding: '10px 16px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <Text style={{ color: isBalanced ? '#52c41a' : '#ff4d4f' }}>
              总权重: {totalWeight.toFixed(2)} / 1.00
              {isBalanced ? ' ✓ 已平衡' : ' ⚠ 权重之和应为 1.0'}
            </Text>
            {!isBalanced && (
              <Button size="small" onClick={() => {
                const scale = 1.0 / totalWeight
                setTargetWeights((prev) => {
                  const next: Record<string, number> = {}
                  for (const [k, v] of Object.entries(prev)) { next[k] = +(v * scale).toFixed(2) }
                  return next
                })
                setExtraComponents((prev) =>
                  prev.map((c) => ({ ...c, weight: +(c.weight * scale).toFixed(2) })),
                )
              }}>自动归一化</Button>
            )}
          </div>
          <Divider />
          <Space>
            <Button onClick={() => setCurrent(2)}>上一步</Button>
            <Button type="primary" onClick={() => setCurrent(4)}>下一步：确认提交</Button>
          </Space>
        </Card>
      )})()}

      {/* Step 4: Confirm */}
      {current === 4 && (
        <Card title="确认提交">
          <div style={{ background: '#111', padding: 16, borderRadius: 8, marginBottom: 16 }}>
            <p><Text strong>项目: </Text><Text>{projectName}</Text></p>
            <p>
              <Text strong>靶点 ({selectedTargets.length}): </Text>
              {selectedTargets.map((t) => <Tag key={t.id}>{t.name}</Tag>)}
            </p>
            <p><Text strong>训练步数: </Text><Text>{maxSteps}</Text>
              <Text style={{ marginLeft: 24 }}><Text strong>批大小: </Text><Text>{batchSize}</Text></Text>
            </p>
            <p><Text strong>sigma: </Text><Text>{sigma}</Text>
              <Text style={{ marginLeft: 24 }}><Text strong>学习率: </Text><Text>{learningRate}</Text></Text>
              <Text style={{ marginLeft: 24 }}><Text strong>聚合: </Text><Text>{aggregation}</Text></Text>
            </p>
            <p><Text strong>对接后端: </Text><Text>{dockingBackend === 'vina_gpu' ? 'Vina-GPU (GPU加速)' : 'AutoDock Vina (CPU)'}</Text></p>
            <p>
              <Text strong>评分组件: </Text><br />
              {selectedTargets.map((t, i) => (
                <Tag key={t.id} color="blue">DockStream_{t.name} (w={targetWeights[t.id] || 1.0})</Tag>
              ))}
              {extraComponents.map((c) => (
                <Tag key={c.type} color="green">{c.name} (w={c.weight})</Tag>
              ))}
              <br /><Text type="secondary">总权重: {(selectedTargets.reduce((s, t) => s + (targetWeights[t.id] || 1.0), 0) + extraComponents.reduce((s, c) => s + c.weight, 0)).toFixed(2)}</Text>
            </p>
          </div>
          <Space>
            <Button onClick={() => setCurrent(3)}>上一步</Button>
            <Button type="primary" size="large" icon={<PlusOutlined />} onClick={handleFinalSubmit} loading={loading}>
              {existingProjectId ? '提交新任务' : '创建项目并提交任务'}
            </Button>
          </Space>
        </Card>
      )}
    </div>
  )
}
