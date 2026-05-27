import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Typography } from 'antd'
import {
  DashboardOutlined,
  PlusOutlined,
  ExperimentOutlined,
  DatabaseOutlined,
} from '@ant-design/icons'

const { Header, Sider, Content } = Layout
const { Text } = Typography

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '项目列表' },
  { key: '/projects/new', icon: <PlusOutlined />, label: '新建项目' },
  { key: '/targets', icon: <DatabaseOutlined />, label: '靶点库' },
]

export default function AppShell() {
  const navigate = useNavigate()
  const location = useLocation()

  const selectedKey = menuItems
    .filter((item) => item.key !== '/')
    .find((item) => location.pathname.startsWith(item.key))?.key || '/'

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={240} style={{ background: '#001529' }}>
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}>
          <Text strong style={{ color: '#fff', fontSize: 15, whiteSpace: 'normal' }}>
            De novo 双靶点抑制剂设计平台
          </Text>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ marginTop: 8 }}
        />
      </Sider>
      <Layout>
        <Header style={{
          background: '#141414',
          padding: '0 24px',
          borderBottom: '1px solid #303030',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
        }}>
          <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>
            AI驱动的分子设计平台 v1.0
          </Text>
        </Header>
        <Content style={{
          padding: 24,
          background: '#000',
          overflow: 'auto',
        }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
