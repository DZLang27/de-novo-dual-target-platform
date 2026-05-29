import { useEffect, useRef, useState, useCallback } from 'react'
import { Spin, Typography } from 'antd'

const { Text } = Typography

interface TargetViewer3DProps {
  targetId: string
  center_x: number
  center_y: number
  center_z: number
  size_x: number
  size_y: number
  size_z: number
  height?: number
}

export default function TargetViewer3D({
  targetId,
  center_x,
  center_y,
  center_z,
  size_x,
  size_y,
  size_z,
  height = 500,
}: TargetViewer3DProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<any>(null)
  const nglRef = useRef<any>(null)
  const proteinCompRef = useRef<any>(null)
  const boxCompRef = useRef<any>(null)
  const [nglReady, setNglReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize NGL Stage once
  useEffect(() => {
    let disposed = false
    import('ngl').then((ngl) => {
      if (disposed || !containerRef.current) return
      nglRef.current = ngl
      const stage = new ngl.Stage(containerRef.current, {
        backgroundColor: '#1a1a2e',
      })
      stageRef.current = stage
      setNglReady(true)
      window.addEventListener('resize', () => stage.handleResize())
    })
    return () => {
      disposed = true
      if (stageRef.current) {
        stageRef.current.dispose()
        stageRef.current = null
        setNglReady(false)
      }
    }
  }, [])

  // Load protein structure when both NGL is ready and targetId changes
  useEffect(() => {
    if (!nglReady || !targetId) return

    const stage = stageRef.current
    if (!stage) return

    setError(null)
    setLoading(true)
    stage.removeAllComponents()
    proteinCompRef.current = null
    boxCompRef.current = null

    const baseUrl = 'http://127.0.0.1:8000'
    const proteinUrl = `${baseUrl}/api/v1/files/pdb/${targetId}`

    fetch(proteinUrl)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.text()
      })
      .then(text => {
        const blob = new Blob([text], { type: 'chemical/x-pdb' })
        return stage.loadFile(blob, { ext: 'pdb' })
      })
      .then((comp: any) => {
        proteinCompRef.current = comp
        comp.addRepresentation('cartoon', { colorScheme: 'sstruc', opacity: 0.9 })
        comp.addRepresentation('ball+stick', { sele: 'hetero and not water', multipleBond: 'symmetric', colorScheme: 'element' })
        comp.autoView()
        setLoading(false)
        drawBox(stage, center_x, center_y, center_z, size_x, size_y, size_z)
      })
      .catch((err: any) => {
        console.error('NGL load error:', err)
        setError(`加载失败: ${err.message}`)
        setLoading(false)
      })
  }, [nglReady, targetId])

  // Update box when parameters change
  useEffect(() => {
    if (!nglReady) return
    const stage = stageRef.current
    if (!stage || !proteinCompRef.current) return

    drawBox(stage, center_x, center_y, center_z, size_x, size_y, size_z)
  }, [nglReady, center_x, center_y, center_z, size_x, size_y, size_z])

  // Draw box representation using NGL from ref
  const drawBox = useCallback((stage: any, cx: number, cy: number, cz: number, sx: number, sy: number, sz: number) => {
    if (boxCompRef.current) {
      stage.removeComponent(boxCompRef.current)
      boxCompRef.current = null
    }

    const ngl = nglRef.current
    if (!ngl) return

    try {
      const shape = new ngl.Shape('box')
      const hx = sx / 2
      const hy = sy / 2
      const hz = sz / 2

      // Draw box edges (green)
      const corners = [
        [cx - hx, cy - hy, cz - hz],
        [cx + hx, cy - hy, cz - hz],
        [cx + hx, cy + hy, cz - hz],
        [cx - hx, cy + hy, cz - hz],
        [cx - hx, cy - hy, cz + hz],
        [cx + hx, cy - hy, cz + hz],
        [cx + hx, cy + hy, cz + hz],
        [cx - hx, cy + hy, cz + hz],
      ]

      const edges = [
        [0, 1], [1, 2], [2, 3], [3, 0],
        [4, 5], [5, 6], [6, 7], [7, 4],
        [0, 4], [1, 5], [2, 6], [3, 7],
      ]

      for (const [i, j] of edges) {
        shape.addCylinder(corners[i], corners[j], [0, 1, 0.5], 0.15)
      }

      // Draw coordinate axes at box corner (front-left-bottom)
      const axisLength = Math.min(hx, hy, hz) * 0.6
      const ox = cx - hx  // origin at corner
      const oy = cy - hy
      const oz = cz - hz
      shape.addCylinder([ox, oy, oz], [ox + axisLength, oy, oz], [1, 0, 0], 0.2)  // X axis (red)
      shape.addCylinder([ox, oy, oz], [ox, oy + axisLength, oz], [0, 1, 0], 0.2)  // Y axis (green)
      shape.addCylinder([ox, oy, oz], [ox, oy, oz + axisLength], [0, 0, 1], 0.2)  // Z axis (blue)

      const boxComp = stage.addComponentFromObject(shape)
      boxComp.addRepresentation('buffer')
      boxCompRef.current = boxComp
    } catch (e) {
      console.warn('Failed to draw box:', e)
    }
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
      />
      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: 10, left: 10,
        display: 'flex', gap: 8, fontSize: 11, fontFamily: 'monospace',
        background: 'rgba(0,0,0,0.5)', padding: '4px 8px', borderRadius: 4,
      }}>
        <span style={{ color: '#ff4444' }}>●X</span>
        <span style={{ color: '#44ff44' }}>●Y</span>
        <span style={{ color: '#4444ff' }}>●Z</span>
        <span style={{ color: '#00ff88', marginLeft: 8 }}>□Box</span>
      </div>
      {loading && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)', zIndex: 10,
        }}>
          <Spin>加载 3D 结构中...</Spin>
        </div>
      )}
      {error && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.7)', zIndex: 10,
        }}>
          <Text type="danger" style={{ padding: 16 }}>{error}</Text>
        </div>
      )}
    </div>
  )
}
