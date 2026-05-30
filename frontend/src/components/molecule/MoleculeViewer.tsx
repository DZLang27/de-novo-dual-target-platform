import { useEffect, useRef, useState } from 'react'
import { Spin, Typography, Switch, Space, Radio } from 'antd'

const { Text } = Typography

interface Props {
  taskId: string
  stepNumber: number
  smiles: string
  targetIds: string[]
  activeTargetIndex: number
}

type ProteinStyle = 'cartoon' | 'surface' | 'ball+stick'

export default function MoleculeViewer({
  taskId, stepNumber, smiles, targetIds, activeTargetIndex,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<any>(null)
  const stageReady = useRef(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [proteinStyle, setProteinStyle] = useState<ProteinStyle>('cartoon')
  const proteinCompRef = useRef<any>(null)
  const representationsRef = useRef<Map<ProteinStyle, any>>(new Map())

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

  // Load molecule data when ready and dependencies change
  useEffect(() => {
    // If NGL not ready yet, skip (will be triggered again when it loads)
    if (!stageReady.current) return
    if (targetIds.length === 0) return

    const targetId = targetIds[activeTargetIndex] || targetIds[0]
    if (!targetId) return

    setError(null)
    setLoading(true)
    representationsRef.current.clear()

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
        proteinCompRef.current = proteinComp
        
        // Create all representations but only show the selected one
        const cartoon = proteinComp.addRepresentation('cartoon', { colorScheme: 'sstruc', opacity: 0.9, visible: proteinStyle === 'cartoon' })
        
        // Create AV surface (high quality molecular surface - PyMOL-like)
        const surfaceAv = proteinComp.addRepresentation('surface', { 
          colorScheme: 'sstruc', 
          opacity: 0.95, 
          visible: proteinStyle === 'surface',
          surfaceType: 'av',
          probeRadius: 1.4,
          smoothSheet: true,
          scaleFactor: 1.0,
          side: 'front',
          useWorker: false,
        })
        
        const ballstick = proteinComp.addRepresentation('ball+stick', { 
          sele: 'not water and not hydrogen', 
          multipleBond: 'symmetric', 
          colorScheme: 'element',
          visible: proteinStyle === 'ball+stick',
        })
        
        representationsRef.current.set('cartoon', cartoon)
        representationsRef.current.set('surface', surfaceAv)
        representationsRef.current.set('ball+stick', ballstick)
        
        ligandComp.addRepresentation('licorice', { multipleBond: 'symmetric', colorScheme: 'element' })
        ligandComp.autoView(800)
        setLoading(false)
      })
      .catch((err: any) => {
        console.error('NGL error:', err)
        setError(`加载失败: ${err.message}`)
        setLoading(false)
      })
  }, [taskId, stepNumber, smiles, activeTargetIndex, targetIds])

  // Handle protein style change
  function handleStyleChange(style: ProteinStyle) {
    console.log('Changing to style:', style, 'Available reps:', Array.from(representationsRef.current.keys()))
    setProteinStyle(style)
    representationsRef.current.forEach((rep, key) => {
      console.log('Setting visibility:', key, key === style)
      rep.setVisibility(key === style)
      // Force rebuild surface when showing it
      if (key === 'surface' && key === style) {
        const params = rep.getParameters()
        console.log('Surface params:', params)
        rep.build(params)
      }
    })
  }

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <Space>
          <Text type="secondary">蛋白样式:</Text>
          <Radio.Group 
            size="small" 
            value={proteinStyle} 
            onChange={(e) => handleStyleChange(e.target.value)}
          >
            <Radio.Button value="cartoon">Cartoon</Radio.Button>
            <Radio.Button value="surface">Surface</Radio.Button>
            <Radio.Button value="ball+stick">Ball+Stick</Radio.Button>
          </Radio.Group>
        </Space>
      </div>
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
    </div>
  )
}
