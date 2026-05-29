import { useState, useEffect, memo } from 'react'
import { Spin } from 'antd'

interface Molecule2DProps {
  smiles: string
  width?: number
  height?: number
  className?: string
  style?: React.CSSProperties
}

// Cache for SVG data to avoid repeated API calls
const svgCache = new Map<string, string>()

function Molecule2DInner({ smiles, width = 200, height = 150, className, style }: Molecule2DProps) {
  const [svgData, setSvgData] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!smiles) return

    const cacheKey = `${smiles}_${width}_${height}`
    
    // Check cache first
    const cached = svgCache.get(cacheKey)
    if (cached) {
      setSvgData(cached)
      return
    }

    setLoading(true)
    setError(false)

    const params = new URLSearchParams({
      smiles,
      width: String(width),
      height: String(height),
      format: 'svg',
    })

    fetch(`/api/v1/files/2d-image?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch')
        return res.text()
      })
      .then((svg) => {
        svgCache.set(cacheKey, svg)
        setSvgData(svg)
      })
      .catch(() => {
        setError(true)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [smiles, width, height])

  if (loading) {
    return (
      <div
        style={{
          width,
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#fafafa',
          borderRadius: 4,
          ...style,
        }}
        className={className}
      >
        <Spin size="small" />
      </div>
    )
  }

  if (error || !svgData) {
    return (
      <div
        style={{
          width,
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#fafafa',
          borderRadius: 4,
          color: '#999',
          fontSize: 12,
          ...style,
        }}
        className={className}
      >
        {error ? '加载失败' : '--'}
      </div>
    )
  }

  return (
    <div
      style={{
        width,
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fafafa',
        borderRadius: 4,
        overflow: 'hidden',
        ...style,
      }}
      className={className}
      dangerouslySetInnerHTML={{ __html: svgData }}
    />
  )
}

const Molecule2D = memo(Molecule2DInner)
export default Molecule2D
