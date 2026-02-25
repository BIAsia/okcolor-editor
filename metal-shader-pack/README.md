# MetalShaderPack

Day1 scaffold for `metal-shader-pack`.

## Included in this scaffold
- Swift Package target for iOS 17+/macOS 14+
- Locked `MSPShader` enum with 12 shader IDs
- First 6 `.metal` shader files with production-ready effect kernels
- `ShaderCatalog` mapping for Day1 first 6 shaders
- `MSPPreviewCatalog` with display names/subtitles for first-six demo cards
- Baseline tests for catalog and uniform defaults
- Demo folder shell for Xcode app scaffolding

## Local build commands (run on macOS with Xcode toolchain)

```bash
swift build
swift test
```
