# okcolor edit

A Figma plugin prototype that brings illustration-style color editing to Oklab/Oklch channels.

## Features (current)

- Oklab/Oklch conversion
- Oklch multi-stop gradient interpolation (shortest hue path) with preview ramp
- Oklab channel shifts (L/a/b)
- Oklch channel shifts (L/C/H)
- Region mask by luminance/chroma range with feather control
- Curve operation for L/a/b channels in Oklab space (L midpoint control in UI)
- Gamut policy handling: clip, compress, warn+clip
- Apply edited color to all selected layers with editable fills (adds/replaces SOLID fill)
- Apply multi-stop Oklch gradient (3 to 5 stops from the editor) to selected layers with editable fills (adds/replaces gradient)
- Save/load named adjustment recipes in plugin-local storage

## Local development

```bash
npm install
npm run preflight:collab
npm run test
npm run build
```

Workflow source of truth: `docs/github-collab.md`.

Load plugin in Figma (Development):

1. Open Figma desktop app.
2. Plugins -> Development -> Import plugin from manifest.
3. Select this file: `manifest.json`.
4. Run `okcolor edit`.

## Current limits

- UI edits all currently selected layers that expose editable fills
- Gradient preview now supports editable middle stop position, custom stop colors, and palette presets
- Curve controls support L/a/b channels (L includes preset packs; a/b use custom midpoint curves)
