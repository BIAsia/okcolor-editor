# Figma Plugin Domain Foundation

This note distills the runtime constraints that directly affect `okcolor-edit` implementation and test strategy.

## Official references

- Figma plugin quickstart and architecture: https://www.figma.com/plugin-docs/
- Plugin API reference (global `figma`, SceneNode, Paint): https://www.figma.com/plugin-docs/api/
- UI bridge (`figma.ui.postMessage` / `parent.postMessage`): https://www.figma.com/plugin-docs/how-plugins-run/
- Manifest constraints (`manifest.json` fields): https://www.figma.com/plugin-docs/manifest/

## Runtime constraints we must design around

- Plugin code (`main`) runs in Figma's sandboxed runtime, not a browser tab.
- UI code (`ui`) runs in an iframe and can only call plugin runtime through message passing.
- No Node.js APIs in plugin runtime.
- Selection and paint operations must tolerate heterogeneous nodes (non-paintable, missing fills, mixed values).
- Color operations should stay deterministic and pure in shared math modules so they can be tested outside Figma.

## Local test method (stable harness)

1. Unit-test pure math and paint transformation functions with Vitest.
2. Build plugin artifacts (`dist/code.js`, `dist/ui.html`).
3. Run a local smoke check that validates:
   - manifest points to the expected build outputs
   - declared output files exist
   - built `code.js` includes plugin entry usage (`figma.showUI` and `figma.ui.onmessage`)
4. Only then import into Figma desktop for manual interaction checks.

## Quality gate for feature work

Every feature completion in this repo should pass:

- `npm run test`
- `npm run build`
- `npm run smoke:plugin`

This keeps local iteration independent from flaky manual Figma checks and catches wiring regressions quickly.
