import { useState, useEffect } from 'react'
import { Card, Spin, Typography, Row, Col } from 'antd'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { fetchTaskStatistics, type ScoreStatistics } from '../../api/results'

const { Text } = Typography

interface ScoreChartsProps {
  taskId: string
  style?: React.CSSProperties
}

export default function ScoreCharts({ taskId, style }: ScoreChartsProps) {
  const [stats, setStats] = useState<ScoreStatistics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadStatistics()
  }, [taskId])

  async function loadStatistics() {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchTaskStatistics(taskId)
      setStats(data)
    } catch (e: any) {
      setError(e?.message || '加载统计数据失败')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card style={style}>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin />
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card style={style}>
        <Text type="danger">{error}</Text>
      </Card>
    )
  }

  if (!stats || stats.total_molecules === 0) {
    return (
      <Card style={style}>
        <Text type="secondary">暂无数据</Text>
      </Card>
    )
  }

  return (
    <div style={style}>
      <Row gutter={[16, 16]}>
        {/* Learning Curve */}
        <Col span={24}>
          <Card title="学习曲线 (分数 vs 步骤)" size="small">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats.score_by_step}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="step" label={{ value: '步骤', position: 'bottom' }} />
                <YAxis domain={[0, 1]} label={{ value: '分数', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="max_score" name="最高分" stroke="#52c41a" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="avg_score" name="平均分" stroke="#1890ff" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="min_score" name="最低分" stroke="#ff4d4f" strokeWidth={1} dot={false} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* Score Distribution */}
        <Col span={12}>
          <Card title="分数分布" size="small">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stats.score_distribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" name="分子数" fill="#1890ff" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* Component Stats */}
        <Col span={12}>
          <Card title="组分分数统计" size="small">
            <div style={{ maxHeight: 250, overflowY: 'auto' }}>
              {Object.entries(stats.component_stats).map(([name, data]) => (
                <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <Text style={{ fontSize: 12 }}>{name}</Text>
                  <Text style={{ fontSize: 12, fontFamily: 'monospace' }}>
                    {data.min.toFixed(3)} ~ {data.max.toFixed(3)} (avg: {data.avg.toFixed(3)})
                  </Text>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
