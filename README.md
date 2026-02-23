# okcolor edit

A Figma plugin prototype that brings illustration-style color editing to Oklab/Oklch channels.

## Features (current)

- Oklab/Oklch conversion
- Oklch gradient interpolation (shortest hue path) with preview ramp
- Oklab channel shifts (L/a/b)
- Oklch channel shifts (L/C/H)
- Curve operation for L/a/b channels in Oklab space (L midpoint control in UI)
- Gamut policy handling: clip, compress, warn+clip
- Apply edited color to selected solid fill layer

## Local development

```bash
npm install
npm run test
npm run build
```

Load plugin in Figma (Development):

1. Open Figma desktop app.
2. Plugins -> Development -> Import plugin from manifest.
3. Select this file: `manifest.json`.
4. Run `okcolor edit`.

## Current limits

- UI currently edits selected SOLID fill only
- Gradient editing logic is in core but not exposed with a full visual editor yet
- Curve is implemented in core and prepared for UI binding
