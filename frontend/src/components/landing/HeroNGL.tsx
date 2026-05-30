import { useEffect, useRef } from 'react'

export default function HeroNGL({ pdbId = '6LUD' }: { pdbId?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const loadedRef = useRef(false)

  useEffect(() => {
    if (loadedRef.current) return
    const container = containerRef.current
    if (!container) return

    const loadNGL = () => {
      if (!container || !window.NGL) return
      loadedRef.current = true

      const stage = new window.NGL.Stage(container, {
        backgroundColor: '#0a0e1a',
        impostor: true,
        antialias: true,
      })

      stage.loadFile(`https://files.rcsb.org/download/${pdbId}.pdb`, {
        defaultRepresentation: true,
      }).then((comp: any) => {
        comp.autoView()
      })

      stage.setSpin([0, 1, 0], 0.003)
    }

    if (window.NGL) {
      loadNGL()
    } else {
      const script = document.createElement('script')
      script.src = 'https://unpkg.com/ngl@2.4.0/dist/ngl.js'
      script.async = true
      script.onload = loadNGL
      document.head.appendChild(script)
    }
  }, [pdbId])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        minHeight: 420,
        background: '#0a0e1a',
        borderRadius: 0,
      }}
      onWheel={(e) => e.stopPropagation()}
    />
  )
}
