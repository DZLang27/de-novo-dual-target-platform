import { useState, useEffect } from 'react'
import { Card, Table, Typography, Button, Space, Select, message } from 'antd'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { fetchTaskComparison, type TaskComparisonItem } from '../api/results'
import { fetchTasks, type TaskData } from '../api/tasks'

const { Title, Text } = Typography

export default function TaskComparePage() {
  const [allTasks, setAllTasks] = useState<TaskData[]>([])
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([])
  const [comparisonData, setComparisonData] = useState<TaskComparisonItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadAllTasks()
  }, [])

  async function loadAllTasks() {
    try {
      const data = await fetchTasks({ page_size: 100, status: 'completed' })
      setAllTasks(data.items || [])
    } catch (e: any) {
      message.error('加载任务列表失败')
    }
  }

  async function loadComparison() {
    if (selectedTaskIds.length < 2) {
      message.warning('请至少选择 2 个任务进行对比')
      return
    }

    setLoading(true)
    try {
      const data = await fetchTaskComparison(selectedTaskIds)
      setComparisonData(data.tasks)
    } catch (e: any) {
      message.error('加载对比数据失败')
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    {
      title: '任务 #',
      dataIndex: 'task_number',
      key: 'task_number',
      render: (v: number) => `#${v}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
    },
    {
      title: '生成分子数',
      dataIndex: 'total_molecules',
      key: 'total_molecules',
    },
    {
      title: '最高分',
      dataIndex: 'best_score',
      key: 'best_score',
      render: (v: number | null) => v != null ? v.toFixed(4) : '--',
    },
    {
      title: '平均分',
      dataIndex: 'avg_score',
      key: 'avg_score',
      render: (v: number | null) => v != null ? v.toFixed(4) : '--',
    },
    {
      title: '总步数',
      dataIndex: 'max_steps',
      key: 'max_steps',
    },
  ]

  const chartData = comparisonData.map(task => ({
    name: `#${task.task_number}`,
    最高分: task.best_score || 0,
    平均分: task.avg_score || 0,
  }))

  return (
    <div>
      <Title level={3} style={{ color: '#fff', marginBottom: 24 }}>任务对比</Title>

      <Card style={{ marginBottom: 24 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>选择要对比的任务（至少 2 个）：</Text>
          <Select
            mode="multiple"
            placeholder="选择已完成的任务"
            style={{ width: '100%' }}
            value={selectedTaskIds}
            onChange={setSelectedTaskIds}
            options={allTasks.map(task => ({
              value: task.id,
              label: `任务 #${task.task_number} (${task.total_molecules || 0} 分子)`,
            }))}
          />
          <Button type="primary" onClick={loadComparison} loading={loading}>
            开始对比
          </Button>
        </Space>
      </Card>

      {comparisonData.length > 0 && (
        <>
          <Card title="对比表格" style={{ marginBottom: 24 }}>
            <Table
              columns={columns}
              dataSource={comparisonData}
              rowKey="task_id"
              pagination={false}
              size="small"
            />
          </Card>

          <Card title="分数对比图">
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 1]} />
                <Tooltip />
                <Legend />
                <Bar dataKey="最高分" fill="#52c41a" />
                <Bar dataKey="平均分" fill="#1890ff" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </>
      )}
    </div>
  )
}
