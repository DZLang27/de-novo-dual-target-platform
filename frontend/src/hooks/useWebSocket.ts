import { useEffect, useRef, useState, useCallback } from 'react'
import { getSessionToken } from '../api/client'

export interface WSMessage {
  type: 'status' | 'score_update' | 'log' | 'error' | 'completed'
  [key: string]: any
}

export function useWebSocket(taskId: string | null) {
  const [messages, setMessages] = useState<WSMessage[]>([])
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!taskId) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const token = getSessionToken()
    const url = `${protocol}//127.0.0.1:8000/api/v1/ws/tasks/${taskId}?token=${token}`

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onerror = () => setConnected(false)

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data)
        setMessages((prev) => [...prev, msg])
      } catch {
        setMessages((prev) => [...prev, { type: 'log', line: event.data }])
      }
    }

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [taskId])

  const clearMessages = useCallback(() => setMessages([]), [])

  return { messages, connected, clearMessages }
}
