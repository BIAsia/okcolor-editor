# Stable local testing for Figma plugin

This is the recommended local workflow for reliable plugin testing.

## Why this setup

- Figma plugin development requires the desktop app to load local manifest files.
- Keeping a continuous build process avoids stale `dist/` artifacts.
- Hot reload shortens iteration loops while preserving the same imported plugin.
- Console + optional Developer VM gives better debugging without changing release behavior.

## Setup once

1. Open Figma desktop app.
2. Plugins -> Development -> Import plugin from manifest.
3. Pick this repo's `manifest.json`.

## Daily loop

1. Run watcher in terminal:

```bash
npm run build:watch
```

2. In Figma enable:
   - Plugins -> Development -> Hot reload plugin
3. Edit code and test repeatedly by re-running the plugin.
4. For debugging:
   - Plugins -> Development -> Open Console
   - Optional: Plugins -> Development -> Use Developer VM

## Final verification rule

- Before concluding a fix, run one pass with **Developer VM disabled** to verify behavior in the normal sandbox.

## Compatibility guardrail

- Plugin backend bundle target is pinned to `es2017` in `build.mjs` to avoid sandbox parser failures like `Unexpected token ...`.

## References

- Figma plugin quickstart: https://developers.figma.com/docs/plugins/plugin-quickstart-guide/
- Figma debugging docs: https://developers.figma.com/docs/plugins/debugging/
- Figma runtime model: https://developers.figma.com/docs/plugins/how-plugins-run/
