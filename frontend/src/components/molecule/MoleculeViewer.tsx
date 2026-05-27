import { useEffect, useRef, useState } from 'react'
import { Spin, Typography } from 'antd'

const { Text } = Typography

interface Props {
  taskId: string
  stepNumber: number
  smiles: string
  targetIds: string[]
  activeTargetIndex: number
}

export default function MoleculeViewer({
  taskId, stepNumber, smiles, targetIds, activeTargetIndex,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<any>(null)
  const stageReady = useRef(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load NGL once
  useEffect(() => {
    let disposed = false
    import('ngl').then((ngl) => {
      if (disposed || !containerRef.current) return
      const stage = new ngl.Stage(containerRef.current, { backgroundColor: '#1a1a2e' })
      stageRef.current = stage
      stageReady.current = true
      window.addEventListener('resize', () => stage.handleResize())
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

  // Load molecule data (re-runs when target or molecule changes)
  useEffect(() => {
    if (!stageReady.current || targetIds.length === 0) return

    const targetId = targetIds[activeTargetIndex] || targetIds[0]
    if (!targetId) return

    setError(null)
    setLoading(true)

    const baseUrl = 'http://127.0.0.1:8000'
    const proteinUrl = `${baseUrl}/api/v1/files/pdb/${targetId}`
    const targetSuffix = targetIds.length > 1 ? `&target=t${activeTargetIndex}` : ''
    const ligandUrl = `${baseUrl}/api/v1/files/sdf/${taskId}?step=${stepNumber}&smiles=${encodeURIComponent(smiles)}${targetSuffix}`

    const stage = stageRef.current
    stage.removeAllComponents()

    Promise.all([
      stage.loadFile(proteinUrl, { ext: 'pdb' }),
      stage.loadFile(ligandUrl, { ext: 'sdf' }),
    ])
      .then(([proteinComp, ligandComp]: any[]) => {
        proteinComp.addRepresentation('cartoon', { colorScheme: 'sstruc', opacity: 0.9 })
        proteinComp.addRepresentation('surface', { sele: 'not protein', opacity: 0.15 })
        ligandComp.addRepresentation('licorice', { multipleBond: 'symmetric', colorScheme: 'element' })
        ligandComp.autoView(800)
        setLoading(false)
      })
      .catch((err: any) => {
        console.error('NGL error:', err)
        setError(`加载失败: ${err?.message || err}`)
        setLoading(false)
      })
  }, [taskId, stepNumber, smiles, activeTargetIndex])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%', height: 500, position: 'relative',
        borderRadius: 8, overflow: 'hidden', background: '#1a1a2e',
      }}
    >
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
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10,
          background: 'rgba(0,0,0,0.7)',
        }}>
          <Text type="danger" style={{ textAlign: 'center', padding: 16 }}>{error}</Text>
        </div>
      )}
    </div>
  )
}
