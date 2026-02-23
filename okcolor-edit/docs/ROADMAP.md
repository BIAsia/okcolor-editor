# okcolor edit roadmap

## v0.1 (implemented tonight)

- Oklab <-> RGB conversion
- Oklab <-> Oklch conversion
- Oklch hue-safe gradient mixing
- Oklab/Oklch channel delta adjustments
- Curve-based adjustment in Oklab channels (L/a/b)
- Figma plugin shell and solid-fill apply flow
- Unit tests for math core
- Basic undo stack in UI state

## v0.2 (next)

- Multi-stop gradient editor in Oklch with editable stop colors and palette presets
- Preset curve packs (contrast, filmic, pastel recover) (implemented)
- Gamut warning and clipping strategy options (implemented)
- Batch apply to multi-selection

## v0.3

- Region masks by luminance/chroma range
- Histogram and waveform in Oklab channels
- Plug-in side panel polish and i18n (implemented: EN/zh-CN toggle + localized UI copy)

## done ahead

- Save/load adjustment recipes (plugin-local storage)
