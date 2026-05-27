import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card, Table, Button, Space, Typography, Row, Col, Statistic,
  Modal, Form, Input, Popconfirm, message,
} from 'antd'
import {
  PlusOutlined, ExperimentOutlined, CheckCircleOutlined,
  ClockCircleOutlined, EditOutlined, DeleteOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { fetchProjects, updateProject, deleteProject, type ProjectData } from '../api/projects'
import { fetchQueueStatus, type QueueStatus } from '../api/tasks'

const { Title } = Typography

export default function DashboardPage() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<ProjectData[]>([])
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<ProjectData | null>(null)
  const [form] = Form.useForm()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [pList, qs] = await Promise.all([fetchProjects(), fetchQueueStatus()])
      setProjects(pList)
      setQueueStatus(qs)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  function openEditModal(project: ProjectData) {
    setEditingProject(project)
    form.setFieldsValue({ name: project.name, description: project.description })
    setEditModalOpen(true)
  }

  async function handleEdit() {
    if (!editingProject) return
    try {
      const values = await form.validateFields()
      await updateProject(editingProject.id, values)
      message.success('项目已更新')
      setEditModalOpen(false)
      loadData()
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '更新失败')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteProject(id)
      message.success('项目已删除')
      loadData()
    } catch (e: any) {
      message.error('删除失败')
    }
  }

  const columns: ColumnsType<ProjectData> = [
    {
      title: '项目名称', dataIndex: 'name', key: 'name',
      render: (text: string, record: ProjectData) => (
        <a onClick={() => navigate(`/projects/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: '靶点数', key: 'targets',
      render: (_: any, r: ProjectData) => r.targets?.length || 0,
    },
    {
      title: '任务数', dataIndex: 'task_count', key: 'task_count',
    },
    {
      title: '创建时间', dataIndex: 'created_at', key: 'created_at',
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作', key: 'actions', width: 250,
      render: (_: any, r: ProjectData) => (
        <Space>
          <Button size="small" onClick={() => navigate(`/projects/${r.id}`)}>详情</Button>
          <Button size="small" type="primary" onClick={() => navigate(`/projects/${r.id}`)}>新建任务</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEditModal(r)} />
          <Popconfirm title="确定删除此项目？" onConfirm={() => handleDelete(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0, color: '#fff' }}>项目列表</Title>
        <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => navigate('/projects/new')}>
          新建项目
        </Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card><Statistic title="总项目数" value={projects.length} prefix={<ExperimentOutlined />} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="GPU 状态" value={queueStatus?.gpu_available ? '空闲' : '占用中'} prefix={queueStatus?.gpu_available ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <ClockCircleOutlined style={{ color: '#faad14' }} />} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="排队任务" value={queueStatus?.queue_length || 0} prefix={<ClockCircleOutlined />} /></Card>
        </Col>
        <Col span={6}>
          <Card><Button type="link" onClick={loadData}>刷新数据</Button></Card>
        </Col>
      </Row>

      <Card>
        <Table
          columns={columns}
          dataSource={projects}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
        />
      </Card>

      <Modal
        title="编辑项目"
        open={editModalOpen}
        onOk={handleEdit}
        onCancel={() => setEditModalOpen(false)}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="项目名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="项目描述">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
