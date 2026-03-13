import {
  render,
  Container,
  Text,
  VerticalSpace,
  Bold,
  Muted,
  RangeSlider,
  Button,
} from '@create-figma-plugin/ui'
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

  return (
    <Container space="medium">
      <VerticalSpace space="large" />

      {!hasSelection ? (
        <div>
          <Text>
            <Muted>Select a Frame to begin editing colors.</Muted>
          </Text>
        </div>
      ) : (
        <div>
          <Text>
            <Bold>{frameName}</Bold>
          </Text>
          <VerticalSpace space="extraSmall" />
          <Text>
            <Muted>
              {colors.length} color{colors.length !== 1 ? 's' : ''} across{' '}
              {uniqueNodeCount} node{uniqueNodeCount !== 1 ? 's' : ''}
            </Muted>
          </Text>

          <VerticalSpace space="large" />

          {/* Lightness slider */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <Text><Bold>Lightness (L)</Bold></Text>
              <Text><Muted>{deltaL > 0 ? '+' : ''}{deltaL.toFixed(3)}</Muted></Text>
            </div>
            <RangeSlider
              maximum={0.5}
              minimum={-0.5}
              onInput={handleLChange}
              value={String(deltaL)}
              increment={0.001}
            />
          </div>

          {/* Chroma slider */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <Text><Bold>Chroma (C)</Bold></Text>
              <Text><Muted>{deltaC > 0 ? '+' : ''}{deltaC.toFixed(3)}</Muted></Text>
            </div>
            <RangeSlider
              maximum={0.2}
              minimum={-0.2}
              onInput={handleCChange}
              value={String(deltaC)}
              increment={0.001}
            />
          </div>

          {/* Hue slider */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <Text><Bold>Hue (H)</Bold></Text>
              <Text><Muted>{deltaH > 0 ? '+' : ''}{deltaH.toFixed(1)}{'\u00B0'}</Muted></Text>
            </div>
            <RangeSlider
              maximum={180}
              minimum={-180}
              onInput={handleHChange}
              value={String(deltaH)}
              increment={1}
            />
          </div>

          <VerticalSpace space="small" />
          <Button fullWidth onClick={handleReset} secondary>
            Reset
          </Button>
        </div>
      )}

      <VerticalSpace space="large" />
    </Container>
  )
}

export default render(Plugin)
