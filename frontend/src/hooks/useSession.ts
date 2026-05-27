import { useState, useCallback } from 'react'
import apiClient from '../api/client'

export function useSession() {
  const [label, setLabel] = useState<string | null>(
    localStorage.getItem('platform_session_label'),
  )

  const updateLabel = useCallback((newLabel: string) => {
    localStorage.setItem('platform_session_label', newLabel)
    setLabel(newLabel)
  }, [])

  return { label, updateLabel }
}
