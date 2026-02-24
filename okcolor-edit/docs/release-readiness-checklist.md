# Release Readiness Checklist

Use this checklist before creating a release candidate for `okcolor-edit`.

## 1) Automated gate

Run:

```bash
npm run release:check
```

Expected output ends with:

- `[release] readiness gate passed...`

This gate enforces:

- collaboration branch preflight
- unit tests
- plugin build
- plugin smoke wiring check

## 2) Manual Figma verification (desktop app)

- Import plugin from `manifest.json`
- With a mixed selection (SOLID + GRADIENT capable layers):
  - adjust Oklab/Oklch sliders and preview updates
  - apply solid edits and verify all editable fills update
  - apply gradient edits and verify existing gradient is replaced, not duplicated
  - verify blend/opacity and gradient direction are preserved
  - verify region mask and histogram/waveform rendering behave as expected
- Save a recipe, reload plugin, and apply the saved recipe again

## 3) RC handoff

- Tag commit with `rc-*` after automated + manual pass
- Note any known limitations in release notes
