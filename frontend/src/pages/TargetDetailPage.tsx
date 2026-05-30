import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card, Typography, Button, Space, Form, InputNumber, Descriptions, Tag,
  Divider, message, Spin,
} from 'antd'
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons'
import { fetchTarget, updateTarget, type TargetData } from '../api/targets'
import Molecule3Dmol from '../components/molecule/Molecule3Dmol'

const { Title, Text } = Typography

export default function TargetDetailPage() {
  const { targetId } = useParams<{ targetId: string }>()
  const navigate = useNavigate()
  const [target, setTarget] = useState<TargetData | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  // Local state for live preview
  const [previewParams, setPreviewParams] = useState({
    center_x: 0,
    center_y: 0,
    center_z: 0,
    size_x: 25,
    size_y: 25,
    size_z: 25,
  })

  useEffect(() => {
    if (targetId) loadTarget()
  }, [targetId])

  async function loadTarget() {
    if (!targetId) return
    setLoading(true)
    try {
      const data = await fetchTarget(targetId)
      setTarget(data)
      // Initialize form and preview
      const params = {
        center_x: data.center_x,
        center_y: data.center_y,
        center_z: data.center_z,
        size_x: data.size_x,
        size_y: data.size_y,
        size_z: data.size_z,
      }
      form.setFieldsValue(params)
      setPreviewParams(params)
    } finally {
      setLoading(false)
    }
  }

  // Handle form value changes for live preview
  const handleValuesChange = useCallback((changedValues: any, allValues: any) => {
    setPreviewParams({
      center_x: allValues.center_x ?? previewParams.center_x,
      center_y: allValues.center_y ?? previewParams.center_y,
      center_z: allValues.center_z ?? previewParams.center_z,
      size_x: allValues.size_x ?? previewParams.size_x,
      size_y: allValues.size_y ?? previewParams.size_y,
      size_z: allValues.size_z ?? previewParams.size_z,
    })
  }, [previewParams])

  async function handleSave() {
    if (!targetId) return
    try {
      const values = await form.validateFields()
      setSaving(true)
      await updateTarget(targetId, {
        center_x: values.center_x,
        center_y: values.center_y,
        center_z: values.center_z,
        size_x: values.size_x,
        size_y: values.size_y,
        size_z: values.size_z,
        exhaustiveness: values.exhaustiveness,
      })
      message.success('参数已保存')
      loadTarget()
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(e?.response?.data?.detail || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !target) {
    return (
      <Card>
        <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />
      </Card>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/targets')}>返回</Button>
          <Title level={3} style={{ margin: 0, color: '#fff' }}>{target.name}</Title>
          {target.protein_name && <Tag>{target.protein_name}</Tag>}
        </Space>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24 }}>
        {/* Left: 3D Viewer */}
        <Card title="蛋白结构" styles={{ body: { padding: 0 } }}>
          <Molecule3Dmol
            pdbUrl={`http://127.0.0.1:8000/api/v1/files/pdb/${target.id}`}
            height={500}
            box={{
              center_x: target.center_x,
              center_y: target.center_y,
              center_z: target.center_z,
              size_x: target.size_x,
              size_y: target.size_y,
              size_z: target.size_z,
            }}
            showAxes={true}
          />
        </Card>

        {/* Right: Parameters */}
        <div>
          <Card title="基本信息" size="small" style={{ marginBottom: 16 }}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="文件">{target.pdbqt_filename}</Descriptions.Item>
              <Descriptions.Item label="文件大小">{((target.pdbqt_file_size ?? 0) / 1024).toFixed(1)} KB</Descriptions.Item>
              <Descriptions.Item label="穷举性">{target.exhaustiveness}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{new Date(target.created_at).toLocaleString()}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title="对接盒子参数" size="small">
            <Form
              form={form}
              layout="vertical"
              onValuesChange={handleValuesChange}
              size="small"
            >
              <Divider orientation="left" style={{ margin: '8px 0', fontSize: 12 }}>中心坐标 (Center)</Divider>
              <Space>
                <Form.Item name="center_x" label="X">
                  <InputNumber style={{ width: 90 }} step={0.5} />
                </Form.Item>
                <Form.Item name="center_y" label="Y">
                  <InputNumber style={{ width: 90 }} step={0.5} />
                </Form.Item>
                <Form.Item name="center_z" label="Z">
                  <InputNumber style={{ width: 90 }} step={0.5} />
                </Form.Item>
              </Space>

              <Divider orientation="left" style={{ margin: '8px 0', fontSize: 12 }}>盒子尺寸 (Size, Å)</Divider>
              <Space>
                <Form.Item name="size_x" label="X">
                  <InputNumber style={{ width: 90 }} min={1} step={1} />
                </Form.Item>
                <Form.Item name="size_y" label="Y">
                  <InputNumber style={{ width: 90 }} min={1} step={1} />
                </Form.Item>
                <Form.Item name="size_z" label="Z">
                  <InputNumber style={{ width: 90 }} min={1} step={1} />
                </Form.Item>
              </Space>

              <Divider orientation="left" style={{ margin: '8px 0', fontSize: 12 }}>对接参数</Divider>
              <Form.Item name="exhaustiveness" label="Exhaustiveness">
                <InputNumber style={{ width: '100%' }} min={1} max={128} />
              </Form.Item>

              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSave}
                loading={saving}
                block
              >
                保存参数
              </Button>
            </Form>
          </Card>
        </div>
      </div>
    </div>
  )
}
