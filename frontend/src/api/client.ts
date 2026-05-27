import axios from 'axios'

const SESSION_KEY = 'platform_session_token'

export function getSessionToken(): string {
  let token = localStorage.getItem(SESSION_KEY)
  if (!token) {
    token = crypto.randomUUID()
    localStorage.setItem(SESSION_KEY, token)
  }
  return token
}

const apiClient = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
})

apiClient.interceptors.request.use((config) => {
  config.headers['X-Session-Token'] = getSessionToken()
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(SESSION_KEY)
      window.location.reload()
    }
    return Promise.reject(error)
  },
)

export default apiClient
