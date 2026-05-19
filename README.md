# Gesture Canvas Museum

Museum-grade interactive gesture drawing system. Visitors draw in the air using hand gestures detected through a webcam.

## Features

- **3 precise gestures** — Drawing (single index), Cursor (index + middle), Eraser (open palm)
- **Edge-aware tracking** — stable near viewport edges; gesture sensitivity decreases and transitions become more conservative near boundaries
- **Partial-hand recovery** — when fingers exit the frame, the system preserves the previous stable gesture instead of switching erratically
- **Gesture freeze logic** — brief tracking interruptions keep the last stable gesture active (up to 400ms), preventing accidental mode switches
- **Confidence gating** — smoothed/decayed confidence values gate all gesture transitions; jittery tracking never triggers aggressive changes
- **Predictive cursor** — velocity-based extrapolation during temporary tracking loss prevents snapping and maintains continuity
- **Safe interaction zone** — sigmoid-based coordinate compression maps the full viewport into a stabilized inner zone, reducing edge instability
- **Instant color palette** — move hand to left edge → palette opens → move up/down to select color instantly
- **Closest-hand tracking** — only the hand nearest the camera is tracked; background visitors are ignored
- **Handedness correction** — correctly identifies left vs right hand despite the mirrored camera feed
- **Depth-of-field filtering** — hands too small (far away) are rejected (threshold: normalized scale < 0.07)
- **Gesture persistence** — tracking interruptions up to 800ms don't break the active gesture via velocity-based extrapolation with drift damping
- **Distance-based finger openness** — MCP-to-TIP distance normalized by wrist-to-middleMCP (more robust than angle-based)
- **Three.js ribbon rendering** — colorful interpolated stroke ribbons with smooth curves
- **Fallback mode** — mouse support for testing without webcam
- **CPU-only MediaPipe** — Web Worker with main-thread fallback, all assets loaded locally
- **Kiosk-ready** — idle reset (2 min), watchdog, fullscreen, keyboard/menu blocking for museum displays
- **Attract mode** — auto-cycles colors when idle (15s) to draw visitors in
- **Diagnostic tools** — realtime pipeline debug panel showing confidence, edge proximity, freeze state, hand completeness, and extrapolation activity

## Gesture Reference

| Gesture | Fingers | Action |
|---|---|---|
| **Drawing** | Index only extended, all others curled | Draw on canvas |
| **Cursor** | Index + middle extended, ring + pinky curled | Navigate, activate palette |
| **Eraser** | Open palm, all 5 fingers extended | Erase strokes under cursor |

### Color Palette

1. Move hand to the **far left edge** of the camera frame (cursor mode).
2. The vertical palette opens.
3. Move hand **up or down** to select a color — selection is instant.
4. Move hand away from the left edge to close the palette.

> **Tip:** The palette activation zone is the leftmost 12% of the frame. Colors span 10%–70% of the vertical axis. A 10% buffer zone prevents accidental deactivation.

## Offline Museum Run

After the prerequisites are downloaded once, the app can run with the internet off.

Required local files:
- `node_modules/`
- `public/models/hand_landmarker.task`
- `public/tasks-vision/wasm/*`

One-time setup while online:
```bash
npm install
powershell -File scripts/download-model.ps1
npm run copy-mediapipe
```

Run offline:
```bash
npm run build
npm run start:local
# http://localhost:3000
```

No CDN is used at runtime. MediaPipe loads from the local `@mediapipe/tasks-vision` package, local WASM files copied into `public/tasks-vision/wasm`, and the local hand model in `public/models`.

## Development

```bash
npm run dev
# http://localhost:3000
```

## Verification

```bash
npm run typecheck
npm run build
npm run test        # Unit tests (vitest)
npm run diagnose:camera
```

`npm run diagnose:camera` opens Chrome, captures console/debug logs, writes `tmp-playwright-diagnose.json`, and saves `tmp-playwright-diagnose.png`.

## Architecture

```text
src/
  core/       Engine, EventBus, GestureActionMapper, types, constants
  tracking/   WebcamManager, HandTracker, LandmarkNormalizer,
              HandIntegrityValidator, EdgeProximityDetector,
              GestureFreezeController, SafeInteractionZoneMapper,
              ConfidenceTracker, ViewportCalibration
  model/      GestureClassifier, OcclusionRecovery, AdaptiveThresholds
  features/   FeatureExtractor, ColorEngine, ColorPalette
  drawing/    StrokeEngine, Stroke, drawing buffer
  rendering/  Three.js scene, StrokeRenderer, ClearEffect
  smoothing/  OneEuroFilter applied to all 63 landmark coordinates
  store/      Flat Zustand store
  hooks/      React hooks (useEngine, usePerformance, useFallbackInput)
  ui/         React components, FingertipCursor, debug panels, styles
  utils/      PredictiveCursor, Diagnostics, KioskMode, math, logging
  workers/    tracking.worker.ts (MediaPipe HandLandmarker in worker thread)
```

### Pipeline

```text
Webcam → mirror canvas → MediaPipe HandLandmarker (worker) → raw landmarks
  → LandmarkNormalizer (mirror correction + handedness flip)
  → OneEuroFilter (minCutoff=1.5, beta=0.08, dCutoff=1.2)
  → depth-of-field filter (scale ≥ 0.07, closest hand only)
  → HandIntegrityValidator (palm integrity, wrist visibility, per-gesture scoring)
  → EdgeProximityDetector (per-edge confidence weights, damping factors)
  → OcclusionRecovery (velocity-based extrapolation with drift damping)
  → ConfidenceTracker (smoothed confidence with adaptive decay)
  → FeatureExtractor (distance-based finger openness)
  → GestureClassifier heuristic (3 gestures, edge-aware ratio thresholds, state machine)
  → GestureFreezeController (locks gesture during low integrity / edge proximity)
  → SafeInteractionZoneMapper (sigmoid compression into stabilized bounds)
  → Engine processes (draw/cursor/erase/palette)
```

### Edge-Aware Tracking Flow

```text
Low tracking quality → System becomes MORE conservative:

  1. Edge proximity detected?        → Boost gesture thresholds, require more frames
  2. Confidence drops?               → Gate gesture transitions, persist current state
  3. Hand becomes incomplete?         → Freeze last stable gesture, enable prediction
  4. Tracking returns?               → Blend extrapolated → real over 5 frames
  5. Cursor needs stabilization?     → Sigmoid safe-zone mapping + velocity prediction
```

## Key Design Decisions

- Engine runs outside React in its own `requestAnimationFrame` loop.
- MediaPipe is loaded locally and runs CPU-only (Web Worker with main-thread fallback).
- OneEuroFilter smooths all 63 landmark coordinates per hand per frame.
- Finger openness uses **MCP-to-Tip 3D distance** (not angle) for robustness across all screen positions.
- Gesture thresholds are **ratio/relative-based** (not absolute) to handle camera perspective shifts.
- Near edges, all thresholds increase (require stronger finger extension) and the state machine requires more activation frames.
- When tracking quality decreases, the system becomes **more conservative** — incomplete data preserves the previous stable state rather than triggering new gestures.
- Eraser near edges requires extra confidence (eliminates false erases from partial hands).
- All Three.js disposal is explicit.
- Zustand store stays flat.

## Dependencies

- `@mediapipe/tasks-vision`
- `three`
- `zustand`
- React 18 + TypeScript
- `vitest` + `happy-dom` (testing)

## Commands

```bash
npm run dev             # Development server
npm run build           # Production build
npm run start:local     # Local kiosk server at http://localhost:3000
npm run typecheck       # TypeScript check
npm run test            # Run unit tests
npm run test:watch      # Watch mode for tests
npm run diagnose:camera # Camera/debug diagnostic
```
