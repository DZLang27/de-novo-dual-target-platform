import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card, Table, Button, Space, Tag, Typography, Descriptions, Divider,
  Typography as AntTypography,
} from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { fetchProject, type ProjectData } from '../api/projects'
import { fetchTasks, type TaskData } from '../api/tasks'

const { Title, Text } = AntTypography

const statusColors: Record<string, string> = {
  pending: 'default', queued: 'processing', running: 'processing',
  completed: 'success', failed: 'error', cancelled: 'warning',
}

const statusLabels: Record<string, string> = {
  pending: '待提交', queued: '排队中', running: '运行中',
  completed: '已完成', failed: '失败', cancelled: '已取消',
}

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<ProjectData | null>(null)
  const [tasks, setTasks] = useState<TaskData[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (projectId) loadData()
  }, [projectId])

  async function loadData() {
    if (!projectId) return
    setLoading(true)
    try {
      const [p, t] = await Promise.all([fetchProject(projectId), fetchTasks(projectId)])
      setProject(p)
      setTasks(t)
    } finally { setLoading(false) }
  }

  const columns: ColumnsType<TaskData> = [
    {
      title: '任务', key: 'task_number', width: 80,
      render: (_: any, r: TaskData) => (
        <a onClick={() => navigate(`/tasks/${r.id}`)}>{r.task_number ? `#${r.task_number}` : '--'}</a>
      ),
    },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: (v: string) => <Tag color={statusColors[v] || 'default'}>{statusLabels[v] || v}</Tag>,
    },
    {
      title: '模式', dataIndex: 'mode', key: 'mode', width: 100,
    },
    {
      title: '进度', key: 'progress',
      render: (_: any, r: TaskData) => `${r.current_step}/${r.max_steps} (${r.progress_pct}%)`,
    },
    {
      title: '最佳分数', dataIndex: 'best_score', key: 'best_score',
      render: (v?: number) => v != null ? v.toFixed(4) : '--',
    },
    {
      title: '分子数', dataIndex: 'total_molecules', key: 'total_molecules',
    },
    {
      title: '创建时间', dataIndex: 'created_at', key: 'created_at',
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作', key: 'actions',
      render: (_: any, r: TaskData) => (
        <Button size="small" onClick={() => navigate(`/tasks/${r.id}`)}>查看</Button>
      ),
    },
  ]

  if (!project) return <Card loading={loading} />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <Title level={3} style={{ color: '#fff', margin: 0 }}>{project.name}</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate(`/projects/new?projectId=${projectId}`)}>新建任务</Button>
      </div>

      <Card style={{ marginBottom: 24 }}>
        <Descriptions column={2} size="small">
          <Descriptions.Item label="项目名称">{project.name}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{new Date(project.created_at).toLocaleString('zh-CN')}</Descriptions.Item>
          <Descriptions.Item label="描述">{project.description || '--'}</Descriptions.Item>
          <Descriptions.Item label="靶点数量">{project.targets?.length || 0}</Descriptions.Item>
        </Descriptions>
        {project.targets && project.targets.length > 0 && (
          <>
            <Divider />
            <Text strong>关联靶点:</Text>
            {project.targets.map((pt) => (
              <Card key={pt.id} size="small" style={{ marginTop: 8 }}>
                <Text strong>{pt.target_name}</Text>
                {pt.center_x != null && <Text type="secondary"> | 盒子: ({pt.center_x}, {pt.center_y}, {pt.center_z})</Text>}
              </Card>
            ))}
          </>
        )}
      </Card>

      <Card title="任务历史">
        <Table
          columns={columns}
          dataSource={tasks}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
        />
      </Card>
    </div>
  )
}
