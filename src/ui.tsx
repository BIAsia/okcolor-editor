import '!figma-plugin-ds/dist/figma-plugin-ds.css'
import '!./slider.css'
import { render } from '@create-figma-plugin/ui'
import { emit, on } from '@create-figma-plugin/utilities'
import { h } from 'preact'
import { useState, useEffect, useCallback, useRef } from 'preact/hooks'
import type { ColorEntry, AdjustHandler, ColorsFoundHandler, NoSelectionHandler } from './types'

function Plugin() {
  const [colors, setColors] = useState<ColorEntry[]>([])
  const [frameName, setFrameName] = useState<string>('')
  const [hasSelection, setHasSelection] = useState(false)

  const [deltaL, setDeltaL] = useState(0)
  const [deltaC, setDeltaC] = useState(0)
  const [deltaH, setDeltaH] = useState(0)

  // Anti-writeback: track whether we are the source of changes
  const isAdjusting = useRef(false)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    on<ColorsFoundHandler>('colors-found', (foundColors, _frameId, name) => {
      if (isAdjusting.current) return
      setColors(foundColors)
      setFrameName(name)
      setHasSelection(true)
      setDeltaL(0)
      setDeltaC(0)
      setDeltaH(0)
    })

    on<NoSelectionHandler>('no-selection', () => {
      if (isAdjusting.current) return
      setColors([])
      setFrameName('')
      setHasSelection(false)
      setDeltaL(0)
      setDeltaC(0)
      setDeltaH(0)
    })
  }, [])

  // Debounced emit to main thread
  const emitAdjust = useCallback(
    (l: number, c: number, hue: number) => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
      debounceTimer.current = setTimeout(() => {
        isAdjusting.current = true
        emit<AdjustHandler>('adjust', l, c, hue)
        // Release the guard after a short delay to allow selection event to pass
        setTimeout(() => {
          isAdjusting.current = false
        }, 100)
      }, 30)
    },
    []
  )

  const handleLChange = useCallback(
    (e: h.JSX.TargetedEvent<HTMLInputElement>) => {
      const v = parseFloat(e.currentTarget.value)
      setDeltaL(v)
      emitAdjust(v, deltaC, deltaH)
    },
    [deltaC, deltaH, emitAdjust]
  )

  const handleCChange = useCallback(
    (e: h.JSX.TargetedEvent<HTMLInputElement>) => {
      const v = parseFloat(e.currentTarget.value)
      setDeltaC(v)
      emitAdjust(deltaL, v, deltaH)
    },
    [deltaL, deltaH, emitAdjust]
  )

  const handleHChange = useCallback(
    (e: h.JSX.TargetedEvent<HTMLInputElement>) => {
      const v = parseFloat(e.currentTarget.value)
      setDeltaH(v)
      emitAdjust(deltaL, deltaC, v)
    },
    [deltaL, deltaC, emitAdjust]
  )

  const handleReset = useCallback(() => {
    setDeltaL(0)
    setDeltaC(0)
    setDeltaH(0)
    emitAdjust(0, 0, 0)
  }, [emitAdjust])

  const uniqueNodeCount = new Set(colors.map((c) => c.nodeId)).size

  if (!hasSelection) {
    return (
      <div style={{ padding: '8px' }}>
        <div class="onboarding-tip">
          <div class="icon icon--styles"></div>
          <div class="onboarding-tip__msg">Select a Frame to begin editing colors.</div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Frame name as section title */}
      <div class="section-title">{frameName}</div>

      {/* Color count summary */}
      <div class="type" style={{ padding: '0 8px 8px', color: 'var(--black3)' }}>
        {colors.length} color{colors.length !== 1 ? 's' : ''} across{' '}
        {uniqueNodeCount} node{uniqueNodeCount !== 1 ? 's' : ''}
      </div>

      {/* Lightness (L) slider */}
      <div class="section-title">Lightness (L)</div>
      <div style={{ padding: '4px 8px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '6px' }}>
          <span class="type" style={{ color: 'var(--black3)' }}>
            {deltaL > 0 ? '+' : ''}{deltaL.toFixed(3)}
          </span>
        </div>
        <input
          class="slider"
          type="range"
          min="-0.5"
          max="0.5"
          step="0.001"
          value={deltaL}
          onInput={handleLChange}
        />
      </div>

      {/* Chroma (C) slider */}
      <div class="section-title">Chroma (C)</div>
      <div style={{ padding: '4px 8px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '6px' }}>
          <span class="type" style={{ color: 'var(--black3)' }}>
            {deltaC > 0 ? '+' : ''}{deltaC.toFixed(3)}
          </span>
        </div>
        <input
          class="slider"
          type="range"
          min="-0.2"
          max="0.2"
          step="0.001"
          value={deltaC}
          onInput={handleCChange}
        />
      </div>

      {/* Hue (H) slider */}
      <div class="section-title">Hue (H)</div>
      <div style={{ padding: '4px 8px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '6px' }}>
          <span class="type" style={{ color: 'var(--black3)' }}>
            {deltaH > 0 ? '+' : ''}{deltaH.toFixed(1)}{'\u00B0'}
          </span>
        </div>
        <input
          class="slider"
          type="range"
          min="-180"
          max="180"
          step="1"
          value={deltaH}
          onInput={handleHChange}
        />
      </div>

      {/* Reset button */}
      <div style={{ padding: '8px' }}>
        <button
          class="button button--secondary"
          style={{ width: '100%' }}
          onClick={handleReset}
        >
          Reset
        </button>
      </div>
    </div>
  )
}

export default render(Plugin)
