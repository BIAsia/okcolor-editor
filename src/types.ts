import { EventHandler } from '@create-figma-plugin/utilities'

export interface ColorEntry {
  nodeId: string
  nodeName: string
  property: 'fill' | 'stroke' | 'effect'
  index: number
  gradientStopIndex: number  // -1 if not a gradient stop
  r: number
  g: number
  b: number
  a: number
  L: number
  C: number
  H: number
}

// Events from UI → Main
export interface AdjustHandler extends EventHandler {
  name: 'adjust'
  handler: (deltaL: number, deltaC: number, deltaH: number) => void
}

// Events from Main → UI
export interface ColorsFoundHandler extends EventHandler {
  name: 'colors-found'
  handler: (colors: ColorEntry[], frameId: string, frameName: string) => void
}

export interface NoSelectionHandler extends EventHandler {
  name: 'no-selection'
  handler: () => void
}
