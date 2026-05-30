/// <reference types="vite/client" />

interface Window {
  NGL: {
    Stage: new (element: HTMLElement, params?: Record<string, unknown>) => {
      loadFile: (url: string, params?: Record<string, unknown>) => Promise<any>
      setSpin: (axis: number[], speed: number) => void
      autoView: () => void
      removeAllComponents: () => void
      centerView: () => void
      viewerControls: { spin: (axis: number[]) => void }
    }
  }
  $3Dmol: {
    createViewer: (element: HTMLElement, config?: Record<string, unknown>) => $3DmolViewer
  }
}

interface $3DmolViewer {
  removeAllModels: () => void
  addModel: (data: string, format: string) => void
  setStyle: (sel?: Record<string, unknown>, style?: Record<string, unknown>) => void
  addSurface: (type: string, style?: Record<string, unknown>, sel?: Record<string, unknown>) => void
  zoomTo: (sel?: Record<string, unknown>) => void
  render: () => void
  clear: () => void
  setBackgroundColor: (color: string) => void
  addBox: (spec: Record<string, unknown>) => void
  addAxes: (spec: Record<string, unknown>) => void
  resize: () => void
  removeAllSurfaces: () => void
  zoom: (factor: number) => void
}
