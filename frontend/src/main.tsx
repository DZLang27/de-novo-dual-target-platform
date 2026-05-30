import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider, theme, App as AntApp } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { BrowserRouter } from 'react-router-dom'
import App from './App'

const platformTheme = {
  token: {
    colorPrimary: '#4c6ef5',
    borderRadius: 8,
  },
  algorithm: theme.defaultAlgorithm,
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider theme={platformTheme} locale={zhCN}>
      <AntApp>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>,
)
