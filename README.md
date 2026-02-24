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

## Stable local testing workflow (Figma plugin)

1. Open Figma desktop app and import `manifest.json` once:
   - Plugins -> Development -> Import plugin from manifest.
2. Keep a watch build running while you test:

```bash
npm run build:watch
```

3. Turn on hot reload for faster iterations:
   - Plugins -> Development -> Hot reload plugin.
4. Debug via console when needed:
   - Plugins -> Development -> Open Console.
5. For deep debugger use, temporarily enable:
   - Plugins -> Development -> Use Developer VM.
   - Final verification should still be done with Developer VM off.

Compatibility note: plugin backend output is compiled to `es2017` to avoid sandbox syntax parse errors (for example, `Unexpected token ...`).

Detailed guide: `docs/local-testing.md`.

## Current limits

- UI currently edits selected SOLID fill only
- Gradient editing logic is in core but not exposed with a full visual editor yet
- Curve is implemented in core and prepared for UI binding
