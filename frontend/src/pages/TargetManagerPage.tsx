import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card, Table, Button, Modal, Form, Input, InputNumber, Upload, Space,
  Typography, message, Steps, Checkbox, InputNumber as AntdInputNumber, Tabs,
} from 'antd'
import { PlusOutlined, UploadOutlined, DeleteOutlined, EditOutlined, ToolOutlined, DownloadOutlined, EyeOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { UploadFile } from 'antd/es/upload'
import { fetchTargets, createTarget, deleteTarget, updateTarget, prepareProtein, prepareFromPDB, type TargetData } from '../api/targets'

const { Title } = Typography

export default function TargetManagerPage() {
  const navigate = useNavigate()
  const [targets, setTargets] = useState<TargetData[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editingTarget, setEditingTarget] = useState<TargetData | null>(null)
  const [form] = Form.useForm()
  const [fileList, setFileList] = useState<UploadFile[]>([])
  
  // Protein preparation state
  const [prepModalOpen, setPrepModalOpen] = useState(false)
  const [prepFileList, setPrepFileList] = useState<UploadFile[]>([])
  const [prepLoading, setPrepLoading] = useState(false)
  const [prepResult, setPrepResult] = useState<any>(null)
  const [prepForm] = Form.useForm()
  const [pdbForm] = Form.useForm()
  const [pdbLoading, setPdbLoading] = useState(false)

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

  async function handlePrepareProtein() {
    try {
      const values = await prepForm.validateFields()
      if (!prepFileList[0]?.originFileObj) {
        message.error('请上传 PDB 文件')
        return
      }
      
      setPrepLoading(true)
      const formData = new FormData()
      formData.append('file', prepFileList[0].originFileObj as Blob)
      formData.append('remove_heterogens', String(values.remove_heterogens ?? true))
      formData.append('fix_missing_heavy_atoms', String(values.fix_missing_heavy_atoms ?? true))
      formData.append('fix_missing_hydrogens', String(values.fix_missing_hydrogens ?? true))
      formData.append('pH', String(values.pH ?? 7.4))
      
      const result = await prepareProtein(formData)
      setPrepResult(result)
      
      if (result.success) {
        message.success('蛋白准备完成')
      } else {
        message.error(result.error || '蛋白准备失败')
      }
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(e?.response?.data?.detail || '蛋白准备失败')
    } finally {
      setPrepLoading(false)
    }
  }

  function openPrepModal() {
    setPrepModalOpen(true)
    setPrepFileList([])
    setPrepResult(null)
    prepForm.resetFields()
    pdbForm.resetFields()
    prepForm.setFieldsValue({
      remove_heterogens: true,
      fix_missing_heavy_atoms: true,
      fix_missing_hydrogens: true,
      pH: 7.4,
    })
    pdbForm.setFieldsValue({
      pdb_id: '',
      target_name: '',
      remove_heterogens: true,
      fix_missing_heavy_atoms: true,
      fix_missing_hydrogens: true,
      standardize: true,
      pH: 7.4,
    })
  }

  async function handlePrepareFromPDB() {
    try {
      const values = await pdbForm.validateFields()
      if (!values.pdb_id || values.pdb_id.trim().length !== 4) {
        message.error('请输入有效的 4 位 PDB ID')
        return
      }

      setPdbLoading(true)
      setPrepResult(null)

      try {
        const target = await prepareFromPDB({
          pdb_id: values.pdb_id.trim(),
          name: values.target_name || undefined,
          remove_heterogens: values.remove_heterogens ?? true,
          fix_missing_heavy_atoms: values.fix_missing_heavy_atoms ?? true,
          fix_missing_hydrogens: values.fix_missing_hydrogens ?? true,
          standardize: values.standardize ?? true,
          pH: values.pH ?? 7.4,
        })

        // Target created successfully, show success and refresh list
        message.success(`靶点 "${target.name}" 已添加到靶点库`)
        setPrepResult({
          success: true,
          target_name: target.name,
          center: `(${target.center_x}, ${target.center_y}, ${target.center_z})`,
          size: `${target.size_x} × ${target.size_y} × ${target.size_z} Å`,
        })
        loadTargets()
      } catch (e: any) {
        const errorMsg = e?.response?.data?.detail || '蛋白准备失败'
        message.error(errorMsg)
        setPrepResult({
          success: false,
          error: errorMsg,
        })
      }
    } catch (e: any) {
      if (e?.errorFields) return
    } finally {
      setPdbLoading(false)
    }
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
      title: '操作', key: 'actions', width: 200,
      render: (_: any, r: TargetData) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/targets/${r.id}`)}>查看</Button>
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
        <Space>
          <Button icon={<ToolOutlined />} onClick={openPrepModal}>蛋白准备工具</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>上传靶点</Button>
        </Space>
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

      {/* Protein Preparation Modal */}
      <Modal
        title="蛋白准备工具"
        open={prepModalOpen}
        onOk={() => {}}
        onCancel={() => { setPrepModalOpen(false); prepForm.resetFields(); pdbForm.resetFields(); setPrepFileList([]); setPrepResult(null) }}
        footer={null}
        width={650}
      >
        <Tabs
          items={[
            {
              key: 'pdb_id',
              label: <span><DownloadOutlined /> 通过 PDB ID 下载</span>,
              children: (
                <Form form={pdbForm} layout="vertical" onFinish={handlePrepareFromPDB}>
                  <Form.Item
                    name="pdb_id"
                    label="PDB ID"
                    rules={[{ required: true, message: '请输入 PDB ID' }]}
                  >
                    <Input
                      placeholder="如 1M17, 3N76, 7BQY"
                      maxLength={4}
                      style={{ textTransform: 'uppercase' }}
                    />
                  </Form.Item>

                  <Form.Item
                    name="target_name"
                    label="靶点名称（可选）"
                  >
                    <Input placeholder="留空则使用 PDB ID 作为名称" />
                  </Form.Item>

                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    从 RCSB PDB 数据库自动下载蛋白结构，使用 DockStream 进行预处理，直接添加到靶点库
                  </Typography.Text>

                  <div style={{ marginTop: 16 }}>
                    <Typography.Text strong>修复选项</Typography.Text>
                    <div style={{ marginTop: 8 }}>
                      <Form.Item name="remove_heterogens" valuePropName="checked" noStyle>
                        <Checkbox>移除杂原子</Checkbox>
                      </Form.Item>
                      <br />
                      <Form.Item name="fix_missing_heavy_atoms" valuePropName="checked" noStyle>
                        <Checkbox>补全缺失重原子</Checkbox>
                      </Form.Item>
                      <br />
                      <Form.Item name="fix_missing_hydrogens" valuePropName="checked" noStyle>
                        <Checkbox>添加缺失氢原子</Checkbox>
                      </Form.Item>
                      <Form.Item name="pH" label="质子化 pH" style={{ marginTop: 8 }}>
                        <AntdInputNumber min={0} max={14} step={0.1} style={{ width: 120 }} />
                      </Form.Item>
                    </div>
                  </div>

                  <Button type="primary" htmlType="submit" loading={pdbLoading} block>
                    下载并准备蛋白
                  </Button>
                </Form>
              ),
            },
            {
              key: 'upload',
              label: <span><UploadOutlined /> 上传 PDB 文件</span>,
              children: (
                <Form form={prepForm} layout="vertical">
                  <Form.Item label="选择 PDB 文件" required>
                    <Upload
                      accept=".pdb"
                      maxCount={1}
                      fileList={prepFileList}
                      beforeUpload={(file) => {
                        setPrepFileList([{ uid: '-1', name: file.name, originFileObj: file as any }])
                        return false
                      }}
                      onRemove={() => setPrepFileList([])}
                    >
                      <Button icon={<UploadOutlined />}>选择 PDB 文件</Button>
                    </Upload>
                  </Form.Item>

                  <Typography.Text strong>修复选项</Typography.Text>
                  <div style={{ marginTop: 8 }}>
                    <Form.Item name="remove_heterogens" valuePropName="checked">
                      <Checkbox>移除杂原子（保留水分子）</Checkbox>
                    </Form.Item>
                    <Form.Item name="fix_missing_heavy_atoms" valuePropName="checked">
                      <Checkbox>补全缺失重原子</Checkbox>
                    </Form.Item>
                    <Form.Item name="fix_missing_hydrogens" valuePropName="checked">
                      <Checkbox>添加缺失氢原子</Checkbox>
                    </Form.Item>
                    <Form.Item name="pH" label="质子化 pH">
                      <AntdInputNumber min={0} max={14} step={0.1} style={{ width: 120 }} />
                    </Form.Item>
                  </div>

                  <Button type="primary" onClick={handlePrepareProtein} loading={prepLoading} block>
                    开始准备
                  </Button>
                </Form>
              ),
            },
          ]}
        />
        
        {prepResult && (
          <div style={{ marginTop: 16, padding: 12, background: '#f5f5f5', borderRadius: 6 }}>
            <Typography.Text strong>准备结果</Typography.Text>
            <div style={{ marginTop: 8 }}>
              {prepResult.success ? (
                <>
                  <div style={{ color: '#52c41a' }}>✓ 已成功添加到靶点库</div>
                  <div>靶点名称: {prepResult.target_name}</div>
                  <div>盒子中心: {prepResult.center}</div>
                  <div>盒子尺寸: {prepResult.size}</div>
                </>
              ) : (
                <div style={{ color: '#ff4d4f' }}>✗ {prepResult.error}</div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
