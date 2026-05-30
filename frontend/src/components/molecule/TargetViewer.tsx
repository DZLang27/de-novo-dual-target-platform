import { useEffect, useRef, useState } from 'react'
import { Spin, Typography } from 'antd'

const { Text } = Typography

interface TargetViewerProps {
  targetId: string
  center_x: number
  center_y: number
  center_z: number
  size_x: number
  size_y: number
  size_z: number
  width?: number
  height?: number
}

export default function TargetViewer({
  targetId,
  center_x,
  center_y,
  center_z,
  size_x,
  size_y,
  size_z,
  width = 200,
  height = 150,
}: TargetViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<any>(null)
  const stageReady = useRef(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize NGL Stage
  useEffect(() => {
    let disposed = false
    import('ngl').then((ngl) => {
      if (disposed || !containerRef.current) return
      const stage = new ngl.Stage(containerRef.current, {
        backgroundColor: '#1a1a2e',
        quality: 'low',
      })
      stageRef.current = stage
      stageReady.current = true
    })
    return () => {
      disposed = true
      if (stageRef.current) {
        stageRef.current.dispose()
        stageRef.current = null
        stageReady.current = false
      }
    }
  }, [])

  // Load protein structure when targetId changes
  useEffect(() => {
    if (!stageReady.current || !targetId) return

    const stage = stageRef.current
    if (!stage) return

    setError(null)
    setLoading(true)
    stage.removeAllComponents()

    const proteinUrl = `/api/v1/files/pdb/${targetId}`

    stage.loadFile(proteinUrl, { ext: 'pdb' })
      .then((comp: any) => {
        // Add protein representation
        comp.addRepresentation('cartoon', { colorScheme: 'sstruc', opacity: 0.9 })
        comp.addRepresentation('ball+stick', { sele: 'hetero', multipleBond: 'symmetric', colorScheme: 'element' })

        // Create bounding box representation
        // We'll use a cylinder representation to approximate the box edges
        // For simplicity, just zoom to fit the protein

        comp.autoView()
        setLoading(false)
      })
      .catch((err: any) => {
        console.error('NGL load error:', err)
        setError('加载失败')
        setLoading(false)
      })
  }, [targetId])

  return (
    <div
      ref={containerRef}
      style={{
        width,
        height,
        position: 'relative',
        borderRadius: 4,
        overflow: 'hidden',
        background: '#1a1a2e',
      }}
    >
      {loading && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.5)',
          zIndex: 10,
        }}>
          <Spin size="small" />
        </div>
      )}
      {error && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
        }}>
          <Text style={{ fontSize: 11, color: '#ff6b6b' }}>{error}</Text>
        </div>
      )}
    </div>
  )
}
