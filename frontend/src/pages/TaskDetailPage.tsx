import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card, Table, Button, Tag, Typography, Progress, Space, Divider,
  message, Tooltip,
} from 'antd'
import {
  ReloadOutlined, DownloadOutlined, StopOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { fetchTask, cancelTask, type TaskData } from '../api/tasks'
import { fetchMolecules, downloadCsv, type MoleculeData } from '../api/results'
import { useWebSocket } from '../hooks/useWebSocket'

const { Title, Text } = Typography

const statusColors: Record<string, string> = {
  pending: 'default', queued: 'processing', running: 'processing',
  completed: 'success', failed: 'error', cancelled: 'warning',
}
const statusLabels: Record<string, string> = {
  pending: '待提交', queued: '排队中', running: '运行中',
  completed: '已完成', failed: '失败', cancelled: '已取消',
}

export default function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const [task, setTask] = useState<TaskData | null>(null)
  const [molecules, setMolecules] = useState<MoleculeData[]>([])
  const [totalMols, setTotalMols] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)

  const { messages, connected } = useWebSocket(
    task?.status === 'running' || task?.status === 'queued' ? taskId! : null,
  )

  useEffect(() => {
    if (taskId) loadTask()
  }, [taskId])

  useEffect(() => {
    if (taskId) loadMolecules()
  }, [taskId, page])

  useEffect(() => {
    const lastMsg = messages[messages.length - 1]
    if (!lastMsg) return
    if (lastMsg.type === 'completed' || lastMsg.type === 'error') {
      loadTask()
    }
    if (lastMsg.type === 'status' && lastMsg.current_step != null) {
      setTask((prev) => prev ? { ...prev, current_step: lastMsg.current_step, progress_pct: lastMsg.progress_pct } : prev)
    }
  }, [messages])

  async function loadTask() {
    if (!taskId) return
    try {
      const t = await fetchTask(taskId)
      setTask(t)
    } catch { /**/ }
  }

  async function loadMolecules() {
    if (!taskId) return
    setLoading(true)
    try {
      const data = await fetchMolecules(taskId, { page, page_size: 50 })
      setMolecules(data.items)
      setTotalMols(data.total)
    } finally { setLoading(false) }
  }

  async function handleCancel() {
    if (!taskId) return
    try {
      await cancelTask(taskId)
      message.success('任务已取消')
      loadTask()
    } catch { message.error('取消失败') }
  }

  async function handleExport() {
    if (!taskId) return
    try {
      const blob = await downloadCsv(taskId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `task_${taskId}_results.csv`; a.click()
      URL.revokeObjectURL(url)
    } catch { message.error('导出失败') }
  }

  // Build dynamic columns from component_scores keys
  const componentScoreKeys: string[] = []
  if (molecules.length > 0 && molecules[0].component_scores) {
    Object.keys(molecules[0].component_scores).forEach((k) => {
      if (!componentScoreKeys.includes(k)) componentScoreKeys.push(k)
    })
  }

  const columns: ColumnsType<MoleculeData> = [
    {
      title: 'SMILES', dataIndex: 'smiles', key: 'smiles', width: 280, fixed: 'left',
      render: (v: string) => (
        <Tooltip title={v}>
          <Text code style={{ fontSize: 12, wordBreak: 'break-all' }}>{v.length > 60 ? v.slice(0, 60) + '...' : v}</Text>
        </Tooltip>
      ),
    },
    {
      title: '总分', dataIndex: 'total_score', key: 'total_score', width: 90, fixed: 'left',
      sorter: (a: any, b: any) => a.total_score - b.total_score,
      render: (v: number) => v.toFixed(4),
    },
    ...componentScoreKeys.map((key) => ({
      title: key,
      dataIndex: ['component_scores', key] as any,
      key: `comp_${key}`,
      width: 110,
      render: (_: any, r: MoleculeData) => {
        const val = r.component_scores?.[key]
        return val != null ? (typeof val === 'number' ? val.toFixed(4) : String(val)) : '--'
      },
    })),
    {
      title: '步骤', dataIndex: 'step_number', key: 'step', width: 65,
    },
    {
      title: '操作', key: 'actions', width: 70, fixed: 'right',
      render: (_: any, r: MoleculeData) => (
        <Button size="small" onClick={() => navigate(`/molecules/${r.id}`)}>查看</Button>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <Title level={3} style={{ color: '#fff', margin: 0 }}>
          {task?.task_number ? `任务 #${task.task_number}` : '任务'}
          {task && <Tag color={statusColors[task.status]} style={{ marginLeft: 12 }}>{statusLabels[task.status]}</Tag>}
        </Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => { loadTask(); loadMolecules() }}>刷新</Button>
          {task?.status === 'completed' && <Button icon={<DownloadOutlined />} onClick={handleExport}>导出 CSV</Button>}
          {(task?.status === 'running' || task?.status === 'queued') && (
            <Button danger icon={<StopOutlined />} onClick={handleCancel}>取消任务</Button>
          )}
        </Space>
      </div>

      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 48, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <Text type="secondary">进度</Text><br />
            {task && <Progress percent={task.progress_pct} format={() => `${task.current_step}/${task.max_steps}`} style={{ width: 200 }} />}
          </div>
          <div>
            <Text type="secondary">最佳分数</Text><br />
            <Text strong style={{ fontSize: 24 }}>{task?.best_score != null ? task.best_score.toFixed(4) : '--'}</Text>
          </div>
          <div>
            <Text type="secondary">生成分子数</Text><br />
            <Text strong style={{ fontSize: 24 }}>{task?.total_molecules || 0}</Text>
          </div>
          <div>
            <Text type="secondary">WebSocket</Text><br />
            <Tag color={connected ? 'green' : 'red'}>{connected ? '已连接' : '未连接'}</Tag>
          </div>
        </div>
        {messages.filter((m) => m.type === 'error').map((m, i) => (
          <Tag color="red" key={i} style={{ marginTop: 8 }}>{m.message}</Tag>
        ))}
      </Card>

      <Card title={`分子列表 (${totalMols})`}>
        <Table
          columns={columns}
          dataSource={molecules}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={{
            current: page,
            pageSize: 50,
            total: totalMols,
            onChange: setPage,
            showTotal: (t) => `共 ${t} 个分子`,
          }}
        />
      </Card>
    </div>
  )
}
