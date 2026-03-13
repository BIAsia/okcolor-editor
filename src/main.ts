import { on, showUI, emit } from '@create-figma-plugin/utilities'
import { srgbToOklch, oklchToSrgb } from './oklch'
import type { ColorEntry, AdjustHandler, ColorsFoundHandler, NoSelectionHandler } from './types'

// Anti-writeback: ignore selection changes triggered by our own paint operations
let isPainting = false

// Baseline colors captured at the moment of selection (before any adjustments)
let baselineColors: ColorEntry[] = []
let currentFrameId: string | null = null

function collectColors(frame: FrameNode): ColorEntry[] {
  const entries: ColorEntry[] = []

  function visit(node: SceneNode) {
    // Process fills
    if ('fills' in node && Array.isArray(node.fills)) {
      const fills = node.fills as ReadonlyArray<Paint>
      for (let i = 0; i < fills.length; i++) {
        const paint = fills[i]
        if (paint.type === 'SOLID') {
          const lch = srgbToOklch(paint.color.r, paint.color.g, paint.color.b)
          entries.push({
            nodeId: node.id,
            nodeName: node.name,
            property: 'fill',
            index: i,
            gradientStopIndex: -1,
            r: paint.color.r,
            g: paint.color.g,
            b: paint.color.b,
            a: paint.opacity !== undefined ? paint.opacity : 1,
            ...lch,
          })
        } else if (
          paint.type === 'GRADIENT_LINEAR' ||
          paint.type === 'GRADIENT_RADIAL' ||
          paint.type === 'GRADIENT_ANGULAR' ||
          paint.type === 'GRADIENT_DIAMOND'
        ) {
          for (let si = 0; si < paint.gradientStops.length; si++) {
            const stop = paint.gradientStops[si]
            const lch = srgbToOklch(stop.color.r, stop.color.g, stop.color.b)
            entries.push({
              nodeId: node.id,
              nodeName: node.name,
              property: 'fill',
              index: i,
              gradientStopIndex: si,
              r: stop.color.r,
              g: stop.color.g,
              b: stop.color.b,
              a: stop.color.a,
              ...lch,
            })
          }
        }
      }
    }

    // Process strokes
    if ('strokes' in node && Array.isArray(node.strokes)) {
      const strokes = node.strokes as ReadonlyArray<Paint>
      for (let i = 0; i < strokes.length; i++) {
        const paint = strokes[i]
        if (paint.type === 'SOLID') {
          const lch = srgbToOklch(paint.color.r, paint.color.g, paint.color.b)
          entries.push({
            nodeId: node.id,
            nodeName: node.name,
            property: 'stroke',
            index: i,
            gradientStopIndex: -1,
            r: paint.color.r,
            g: paint.color.g,
            b: paint.color.b,
            a: paint.opacity !== undefined ? paint.opacity : 1,
            ...lch,
          })
        } else if (
          paint.type === 'GRADIENT_LINEAR' ||
          paint.type === 'GRADIENT_RADIAL' ||
          paint.type === 'GRADIENT_ANGULAR' ||
          paint.type === 'GRADIENT_DIAMOND'
        ) {
          for (let si = 0; si < paint.gradientStops.length; si++) {
            const stop = paint.gradientStops[si]
            const lch = srgbToOklch(stop.color.r, stop.color.g, stop.color.b)
            entries.push({
              nodeId: node.id,
              nodeName: node.name,
              property: 'stroke',
              index: i,
              gradientStopIndex: si,
              r: stop.color.r,
              g: stop.color.g,
              b: stop.color.b,
              a: stop.color.a,
              ...lch,
            })
          }
        }
      }
    }

    // Process effects (shadows, glows)
    if ('effects' in node && Array.isArray(node.effects)) {
      const effects = node.effects as ReadonlyArray<Effect>
      for (let i = 0; i < effects.length; i++) {
        const effect = effects[i]
        if (
          (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') &&
          'color' in effect
        ) {
          const c = effect.color
          const lch = srgbToOklch(c.r, c.g, c.b)
          entries.push({
            nodeId: node.id,
            nodeName: node.name,
            property: 'effect',
            index: i,
            gradientStopIndex: -1,
            r: c.r,
            g: c.g,
            b: c.b,
            a: c.a,
            ...lch,
          })
        }
      }
    }

    // Recurse into children
    if ('children' in node) {
      for (const child of (node as ChildrenMixin).children) {
        visit(child as SceneNode)
      }
    }
  }

  visit(frame)
  return entries
}

function applyAdjustment(deltaL: number, deltaC: number, deltaH: number) {
  if (baselineColors.length === 0 || !currentFrameId) return

  isPainting = true

  for (const entry of baselineColors) {
    const node = figma.getNodeById(entry.nodeId) as SceneNode | null
    if (!node) continue

    // Compute adjusted OKLCH from baseline
    const newL = Math.max(0, Math.min(1, entry.L + deltaL))
    const newC = Math.max(0, entry.C + deltaC)
    const newH = ((entry.H + deltaH) % 360 + 360) % 360
    const [r, g, b] = oklchToSrgb({ L: newL, C: newC, H: newH })

    if (entry.property === 'fill' && 'fills' in node) {
      const fills = [...(node.fills as ReadonlyArray<Paint>)]
      const paint = fills[entry.index]
      if (entry.gradientStopIndex === -1 && paint.type === 'SOLID') {
        fills[entry.index] = { ...paint, color: { r, g, b } }
      } else if (
        entry.gradientStopIndex >= 0 &&
        'gradientStops' in paint
      ) {
        const stops = [...paint.gradientStops]
        const oldStop = stops[entry.gradientStopIndex]
        stops[entry.gradientStopIndex] = {
          ...oldStop,
          color: { r, g, b, a: oldStop.color.a },
        }
        fills[entry.index] = { ...paint, gradientStops: stops } as Paint
      }
      ;(node as GeometryMixin).fills = fills
    } else if (entry.property === 'stroke' && 'strokes' in node) {
      const strokes = [...(node.strokes as ReadonlyArray<Paint>)]
      const paint = strokes[entry.index]
      if (entry.gradientStopIndex === -1 && paint.type === 'SOLID') {
        strokes[entry.index] = { ...paint, color: { r, g, b } }
      } else if (
        entry.gradientStopIndex >= 0 &&
        'gradientStops' in paint
      ) {
        const stops = [...paint.gradientStops]
        const oldStop = stops[entry.gradientStopIndex]
        stops[entry.gradientStopIndex] = {
          ...oldStop,
          color: { r, g, b, a: oldStop.color.a },
        }
        strokes[entry.index] = { ...paint, gradientStops: stops } as Paint
      }
      ;(node as GeometryMixin).strokes = strokes
    } else if (entry.property === 'effect' && 'effects' in node) {
      const effects = [...(node.effects as ReadonlyArray<Effect>)]
      const effect = effects[entry.index]
      if (
        (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') &&
        'color' in effect
      ) {
        effects[entry.index] = {
          ...effect,
          color: { r, g, b, a: effect.color.a },
        }
      }
      ;(node as BlendMixin).effects = effects
    }
  }

  isPainting = false
}

function handleSelectionChange() {
  if (isPainting) return

  const selection = figma.currentPage.selection
  if (selection.length !== 1 || selection[0].type !== 'FRAME') {
    currentFrameId = null
    baselineColors = []
    emit<NoSelectionHandler>('no-selection')
    return
  }

  const frame = selection[0] as FrameNode
  currentFrameId = frame.id
  baselineColors = collectColors(frame)

  emit<ColorsFoundHandler>('colors-found', baselineColors, frame.id, frame.name)
}

export default function () {
  showUI({ width: 320, height: 480 })

  on<AdjustHandler>('adjust', (deltaL, deltaC, deltaH) => {
    applyAdjustment(deltaL, deltaC, deltaH)
  })

  figma.on('selectionchange', handleSelectionChange)

  // Initial scan
  handleSelectionChange()
}
