# OKLCH Editor v0.2 Task Plan

## Scope
Focus on editor usability and production-safe apply workflow for Figma plugin.

## Current status
- v0.1 shipped in repo (`main`): core color conversion + channel edits + curve adjustment + basic apply flow.
- v0.2 started (`feat/oklch-editor-v0.2-plan`): detailed task breakdown and execution sequence.

## Milestones

### M1 - Multi-stop gradient editor (OKLCH)
- Status: Todo
- Deliverables:
  - Add 2-8 stops support in UI model
  - Per-stop OKLCH inputs + reorder/delete
  - Interpolate in OKLCH with hue strategy selector
  - Preview strip updates in real time
- Acceptance:
  - Can generate smooth 3+ stop gradients without obvious hue jumps

### M2 - Preset curves
- Status: Todo
- Deliverables:
  - Add preset packs: contrast, filmic, pastel recover
  - One-click apply to L/a/b curves
  - Reset to custom/manual mode
- Acceptance:
  - Preset click updates curve and output instantly

### M3 - Gamut warning and clipping strategy
- Status: Todo
- Deliverables:
  - Detect out-of-gamut pixels/colors in conversion path
  - Strategy switch: hard clip / chroma compress / preserve lightness
  - Warning badge in UI when clipping occurs
- Acceptance:
  - Users can switch strategy and see deterministic output changes

### M4 - Batch apply for multi-selection
- Status: Todo
- Deliverables:
  - Apply same transform to all selected nodes with compatible fills
  - Skip unsupported nodes with count report
- Acceptance:
  - 20 selected layers process with clear success/skip summary

### M5 - Basic undo stack (UI state)
- Status: Todo
- Deliverables:
  - Keep last N (default 20) editor states
  - Undo/redo controls and shortcuts
- Acceptance:
  - Parameter edits can be reverted/restored without desync

## Planned execution order
1. M1 -> 2. M4 -> 3. M3 -> 4. M2 -> 5. M5

## ETA expectation
- v0.2 alpha (M1 + M4): 2-3 focused sessions
- v0.2 beta (M1-M4): 4-6 focused sessions
- v0.2 complete (M1-M5): 6-8 focused sessions
