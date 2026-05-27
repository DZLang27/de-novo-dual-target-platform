import { useEffect, useState } from 'react'
import {
  Card, Table, Button, Modal, Form, Input, InputNumber, Upload, Space,
  Typography, message,
} from 'antd'
import { PlusOutlined, UploadOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { UploadFile } from 'antd/es/upload'
import { fetchTargets, createTarget, deleteTarget, updateTarget, type TargetData } from '../api/targets'

const { Title } = Typography

export default function TargetManagerPage() {
  const [targets, setTargets] = useState<TargetData[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editingTarget, setEditingTarget] = useState<TargetData | null>(null)
  const [form] = Form.useForm()
  const [fileList, setFileList] = useState<UploadFile[]>([])

  useEffect(() => { loadTargets() }, [])

  async function loadTargets() {
    setLoading(true)
    try {
      const data = await fetchTargets()
      setTargets(data)
    } finally { setLoading(false) }
  }

  function openCreateModal() {
    setEditMode(false)
    setEditingTarget(null)
    form.resetFields()
    form.setFieldsValue({ exhaustiveness: 16 })
    setFileList([])
    setModalOpen(true)
  }

  function openEditModal(target: TargetData) {
    setEditMode(true)
    setEditingTarget(target)
    setFileList([])
    setModalOpen(true)
    setTimeout(() => {
      form.setFieldsValue({
        name: target.name,
        protein_name: target.protein_name || undefined,
        center_x: target.center_x,
        center_y: target.center_y,
        center_z: target.center_z,
        size_x: target.size_x,
        size_y: target.size_y,
        size_z: target.size_z,
        exhaustiveness: target.exhaustiveness,
      })
    }, 50)
  }

  async function handleSubmit() {
    try {
      const values = await form.validateFields()
      console.log('Form values:', JSON.stringify(values))

      if (editMode && editingTarget) {
        const body: Record<string, any> = {
          name: values.name,
          protein_name: values.protein_name || null,
          center_x: Number(values.center_x),
          center_y: Number(values.center_y),
          center_z: Number(values.center_z),
          size_x: Number(values.size_x),
          size_y: Number(values.size_y),
          size_z: Number(values.size_z),
          exhaustiveness: Number(values.exhaustiveness),
        }
        console.log('PATCH body:', JSON.stringify(body))
        await updateTarget(editingTarget.id, body)
        message.success('靶点已更新')
      } else {
        const formData = new FormData()
        formData.append('name', String(values.name))
        if (values.protein_name) formData.append('protein_name', String(values.protein_name))
        formData.append('center_x', String(values.center_x))
        formData.append('center_y', String(values.center_y))
        formData.append('center_z', String(values.center_z))
        formData.append('size_x', String(values.size_x))
        formData.append('size_y', String(values.size_y))
        formData.append('size_z', String(values.size_z))
        formData.append('exhaustiveness', String(values.exhaustiveness))
        if (fileList[0]?.originFileObj) {
          formData.append('file', fileList[0].originFileObj as Blob)
        }
        await createTarget(formData)
        message.success('靶点上传成功')
      }
      setModalOpen(false)
      form.resetFields()
      setFileList([])
      loadTargets()
    } catch (e: any) {
      if (e?.errorFields) return // validation error, don't show
      message.error(e?.response?.data?.detail || '操作失败')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteTarget(id)
      message.success('删除成功')
      loadTargets()
    } catch { message.error('删除失败') }
  }

  const columns: ColumnsType<TargetData> = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '蛋白', dataIndex: 'protein_name', key: 'protein_name', render: (v: string | undefined) => v || '--' },
    {
      title: '盒子中心', key: 'center',
      render: (_: any, r: TargetData) => r.center_x != null ? `(${r.center_x}, ${r.center_y}, ${r.center_z})` : '--',
    },
    {
      title: '盒子尺寸', key: 'size',
      render: (_: any, r: TargetData) => r.size_x != null ? `${r.size_x} × ${r.size_y} × ${r.size_z} Å` : '--',
    },
    { title: '穷举性', dataIndex: 'exhaustiveness', key: 'exhaustiveness' },
    {
      title: '操作', key: 'actions', width: 160,
      render: (_: any, r: TargetData) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEditModal(r)}>编辑</Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r.id)}>删除</Button>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0, color: '#fff' }}>靶点库</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>上传靶点</Button>
      </div>

      <Card>
        <Table columns={columns} dataSource={targets} rowKey="id" loading={loading} pagination={{ pageSize: 20 }} />
      </Card>

      <Modal
        title={editMode ? '编辑靶点' : '上传靶点蛋白'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => { setModalOpen(false); form.resetFields(); setFileList([]) }}
        okText={editMode ? '保存' : '上传'}
        cancelText="取消"
        width={600}
      >
        <Form form={form} layout="vertical" initialValues={{ exhaustiveness: 16 }}>
          <Form.Item name="name" label="靶点名称" rules={[{ required: true }]}>
            <Input placeholder="如 EGFR 野生型" />
          </Form.Item>
          <Form.Item name="protein_name" label="蛋白名称">
            <Input placeholder="PDB ID 或基因名" />
          </Form.Item>
          {!editMode && (
            <Form.Item label="PDBQT 文件" required={!editMode}>
              <Upload
                accept=".pdbqt,.pdb"
                maxCount={1}
                fileList={fileList}
                beforeUpload={(file) => {
                  setFileList([{ uid: '-1', name: file.name, originFileObj: file as any }])
                  return false
                }}
                onRemove={() => setFileList([])}
              >
                <Button icon={<UploadOutlined />}>选择文件</Button>
              </Upload>
            </Form.Item>
          )}
          <Typography.Text strong>结合位点参数</Typography.Text>
          <Space wrap style={{ marginTop: 8 }}>
            <Form.Item name="center_x" label="Center X" rules={[{ required: true }]}>
              <InputNumber style={{ width: 90 }} />
            </Form.Item>
            <Form.Item name="center_y" label="Center Y" rules={[{ required: true }]}>
              <InputNumber style={{ width: 90 }} />
            </Form.Item>
            <Form.Item name="center_z" label="Center Z" rules={[{ required: true }]}>
              <InputNumber style={{ width: 90 }} />
            </Form.Item>
          </Space>
          <Space wrap>
            <Form.Item name="size_x" label="Size X (Å)" rules={[{ required: true, type: 'number', min: 0 }]}>
              <InputNumber min={0} style={{ width: 90 }} />
            </Form.Item>
            <Form.Item name="size_y" label="Size Y (Å)" rules={[{ required: true, type: 'number', min: 0 }]}>
              <InputNumber min={0} style={{ width: 90 }} />
            </Form.Item>
            <Form.Item name="size_z" label="Size Z (Å)" rules={[{ required: true, type: 'number', min: 0 }]}>
              <InputNumber min={0} style={{ width: 90 }} />
            </Form.Item>
          </Space>
          <Form.Item name="exhaustiveness" label="Exhaustiveness" rules={[{ required: true }]}>
            <InputNumber min={1} max={128} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
