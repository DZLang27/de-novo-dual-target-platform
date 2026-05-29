import { useEffect, useRef, useState } from 'react'
import { Spin, Typography, Radio, Space } from 'antd'

const { Text } = Typography

interface Molecule3DmolProps {
  pdbUrl: string
  sdfUrl?: string
  height?: number
  box?: { center_x: number; center_y: number; center_z: number; size_x: number; size_y: number; size_z: number }
  showAxes?: boolean
}

type ProteinStyle = 'cartoon' | 'surface' | 'ball+stick'

export default function Molecule3Dmol({ pdbUrl, sdfUrl, height = 500, box, showAxes = false }: Molecule3DmolProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [proteinStyle, setProteinStyle] = useState<ProteinStyle>('cartoon')
  const currentStyleRef = useRef<ProteinStyle>('cartoon')
  const scriptLoadedRef = useRef(false)

  // Initialize 3Dmol viewer
  useEffect(() => {
    if (!containerRef.current) return
    if (scriptLoadedRef.current && viewerRef.current) return

    const loadScript = () => {
      if (!containerRef.current) return
      const viewer = window.$3Dmol.createViewer(containerRef.current, {
        backgroundColor: '#1a1a2e',
        antialias: true,
      })
      viewerRef.current = viewer
      scriptLoadedRef.current = true
    }

    if (window.$3Dmol) {
      loadScript()
    } else {
      const script = document.createElement('script')
      script.src = 'https://3Dmol.org/build/3Dmol-min.js'
      script.async = true
      script.onload = loadScript
      document.head.appendChild(script)
    }
  }, [])

  // Load protein and ligand
  useEffect(() => {
    if (!viewerRef.current || !pdbUrl) return
    if (!window.$3Dmol) {
      // Wait for script to load
      const checkInterval = setInterval(() => {
        if (window.$3Dmol && viewerRef.current) {
          clearInterval(checkInterval)
          loadData()
        }
      }, 100)
      setTimeout(() => clearInterval(checkInterval), 10000)
      return
    }
    loadData()

    function loadData() {
      const viewer = viewerRef.current
      if (!viewer) return

      setLoading(true)
      setError(null)
      viewer.clear()

      fetch(pdbUrl)
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          return res.text()
        })
        .then(pdbData => {
          viewer.addModel(pdbData, 'pdb')

          if (sdfUrl) {
            return fetch(sdfUrl).then(res => {
              if (!res.ok) return null
              return res.text()
            }).then(sdfData => {
              if (sdfData && sdfData.trim()) {
                viewer.addModel(sdfData, 'sdf')
              }
            })
          }
        })
        .then(() => {
          applyStyle(viewer, currentStyleRef.current, window.$3Dmol)
          
          // Draw box if provided
          if (box) {
            drawBox(viewer, box)
          }
          
          // Draw axes if requested
          if (showAxes && box) {
            drawAxes(viewer, box)
          }
          
          // Zoom to ligand (hetflag=true) if it exists, otherwise zoom to all
          const model = viewer.getModel()
          const hasLigand = model.selectedAtoms({ hetflag: true }).length > 0
          if (hasLigand) {
            viewer.zoomTo({ hetflag: true })
          } else {
            viewer.zoomTo()
          }
          viewer.render()
          setLoading(false)
        })
        .catch(err => {
          console.error('3Dmol error:', err)
          setError(`加载失败: ${err.message}`)
          setLoading(false)
        })
    }
  }, [pdbUrl, sdfUrl])

  function applyStyle(viewer: any, style: ProteinStyle, $3Dmol: any) {
    viewer.setStyle({}, {})
    viewer.removeAllSurfaces()

    if (style === 'cartoon') {
      viewer.setStyle({ hetflag: false }, { cartoon: { color: 'spectrum' } })
      viewer.setStyle({ hetflag: true }, { stick: { colorscheme: 'Jmol', radius: 0.15 } })
    } else if (style === 'surface') {
      viewer.setStyle({ hetflag: false }, {})
      viewer.addSurface($3Dmol.SurfaceType.VDW, {
        opacity: 0.85,
        color: 'spectrum',
      }, { hetflag: false })
      viewer.setStyle({ hetflag: true }, { stick: { colorscheme: 'Jmol', radius: 0.15 } })
    } else if (style === 'ball+stick') {
      viewer.setStyle({}, { stick: { colorscheme: 'Jmol', radius: 0.15 }, sphere: { colorscheme: 'Jmol', scale: 0.3 } })
    }
    viewer.render()
  }

  function handleStyleChange(style: ProteinStyle) {
    if (style === currentStyleRef.current) return
    setProteinStyle(style)
    currentStyleRef.current = style
    if (viewerRef.current && window.$3Dmol) {
      applyStyle(viewerRef.current, style, window.$3Dmol)
    }
  }

  // Draw docking box
  function drawBox(viewer: any, box: { center_x: number; center_y: number; center_z: number; size_x: number; size_y: number; size_z: number }) {
    const hx = box.size_x / 2
    const hy = box.size_y / 2
    const hz = box.size_z / 2
    const cx = box.center_x
    const cy = box.center_y
    const cz = box.center_z

    // 8 corners of the box
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

    // 12 edges of the box
    const edges = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7],
    ]

    // Draw each edge as a line
    for (const [i, j] of edges) {
      viewer.addCylinder({
        start: { x: corners[i][0], y: corners[i][1], z: corners[i][2] },
        end: { x: corners[j][0], y: corners[j][1], z: corners[j][2] },
        radius: 0.1,
        color: '#00ff88',
        fromCap: 2,
        toCap: 2,
      })
    }
  }

  // Draw coordinate axes
  function drawAxes(viewer: any, box: { center_x: number; center_y: number; center_z: number; size_x: number; size_y: number; size_z: number }) {
    const axisLength = Math.min(box.size_x, box.size_y, box.size_z) * 0.4
    const ox = box.center_x - box.size_x / 2
    const oy = box.center_y - box.size_y / 2
    const oz = box.center_z - box.size_z / 2

    // X axis (red)
    viewer.addCylinder({
      start: { x: ox, y: oy, z: oz },
      end: { x: ox + axisLength, y: oy, z: oz },
      radius: 0.15,
      color: '#ff4444',
      fromCap: 2,
      toCap: 2,
    })

    // Y axis (green)
    viewer.addCylinder({
      start: { x: ox, y: oy, z: oz },
      end: { x: ox, y: oy + axisLength, z: oz },
      radius: 0.15,
      color: '#44ff44',
      fromCap: 2,
      toCap: 2,
    })

    // Z axis (blue)
    viewer.addCylinder({
      start: { x: ox, y: oy, z: oz },
      end: { x: ox, y: oy, z: oz + axisLength },
      radius: 0.15,
      color: '#4444ff',
      fromCap: 2,
      toCap: 2,
    })
  }

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <Space>
          <Text type="secondary">蛋白样式:</Text>
          <Radio.Group size="small" value={proteinStyle} onChange={(e) => handleStyleChange(e.target.value)}>
            <Radio.Button value="cartoon">Cartoon</Radio.Button>
            <Radio.Button value="surface">Surface</Radio.Button>
            <Radio.Button value="ball+stick">Ball+Stick</Radio.Button>
          </Radio.Group>
        </Space>
      </div>
      <div style={{ position: 'relative', height }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
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
    </div>
  )
}
