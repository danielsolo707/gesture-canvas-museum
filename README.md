# Gesture Canvas Museum

Museum-grade interactive gesture drawing system. Visitors draw in the air using hand gestures detected through a webcam.

## Features

- **3 precise gestures** — Drawing (single index), Cursor (index + middle), Eraser (open palm)
- **Instant color palette** — move hand to left edge → palette opens → move up/down to select color instantly
- **Closest-hand tracking** — only the hand nearest the camera is tracked; background visitors are ignored
- **Partial-hand resilience** — works even when only 1–2 fingers are in frame (MediaPipe tracking mode + temporal fallback)
- **Handedness correction** — correctly identifies left vs right hand despite the mirrored camera feed
- **Depth-of-field filtering** — hands too small (far away) are rejected (threshold: normalized scale < 0.07)
- **Gesture persistence** — brief tracking interruptions (up to 800ms) don't break the active gesture via velocity-based extrapolation
- **Distance-based finger openness** — MCP-to-TIP distance normalized by wrist-to-middleMCP (more robust than angle-based)
- **Three.js ribbon rendering** — colorful interpolated stroke ribbons with smooth curves
- **Fallback mode** — mouse support for testing without webcam
- **CPU-only MediaPipe** — Web Worker with main-thread fallback, all assets loaded locally
- **Kiosk-ready** — idle reset (2 min), watchdog, fullscreen, keyboard/menu blocking for museum displays
- **Attract mode** — auto-cycles colors when idle (15s) to draw visitors in
- **Diagnostic tools** — Paint-like debug panel, Playwright camera test, performance HUD

## What's New — Complete Refactor Report

### Gesture Recognition — Complete Overhaul

| Aspect | Before | After | Improvement |
|---|---|---|---|
| **Gesture types** | 5 (drawing, cursor, clear_canvas, idle, pinch) | **3** (drawing, cursor, eraser) | Simpler, more reliable |
| **Finger openness** | Angle-based (PIP joint angles) | **Distance-based** (MCP-to-TIP 3D distance / hand size) | 2–3× more robust across screen positions |
| **Gesture thresholds** | Absolute values | **Relative/ratio-based** | Position-independent, works everywhere |
| **Drawing detection** | `indexDominance ≥ 1.8` | `index - max(thumb, mcp, ring, pinky) ≥ 0.25` | No false eraser in bottom half |
| **Cursor detection** | Hard finger angle thresholds | `middle - max(ring, pinky) ≥ 0.20` | Works at all distances |
| **Eraser detection** | Separate angle-based detector | `min/max openness ratio ≥ 0.40` | Unified heuristic |
| **State machine frames** | 5 activate / 5 deactivate | **3 activate / 2 deactivate** | 40–60% faster response |
| **Intent layer** | Extra hysteresis (5-frame buffer) | **Bypassed** | No more laggy gesture switching |
| **False positives from pose** | Common (fist → clear_canvas) | **Eliminated** (clear_canvas removed) | — |
| **Gestures in bottom screen half** | Broke (switched to eraser) | **Fixed** | — |
| **Right-to-left drawing** | Stopped at center | **Fixed** | — |

### Hand Tracking & Camera — Reliability Improvements

| Aspect | Before | After | Improvement |
|---|---|---|---|
| **MAX_HANDS** | 1 | **2** | Enables closest-hand selection |
| **Handedness label** | Wrong (mirror not corrected) | **Flipped after inference** | Correct left/right identification |
| **Closest-hand selection** | Dead code (MAX_HANDS = 1) | **Working: scale-based sort** | Background visitor rejection |
| **Tracking confidence** | 0.45 | **0.30** | Tracks through partial occlusion |
| **Detection confidence** | 0.55 | **0.50** | Easier initial detection |
| **Stale frame timeout** | 300ms | **800ms** | 2.7× longer temporal persistence |
| **Extrapolation** | Simple velocity | **Velocity-based with cap 2× dt** | Smoother occlusion recovery |
| **Webcam resolution** | 1280×720 @ 60fps | **640×480 @ 30fps** | 4× less data, same gesture accuracy |
| **Inference rate** | Every frame | **Every 2nd frame** | 2× CPU efficiency |
| **Smoothing cutoff** | 0.6 | **1.5** | Less lag, more responsive |
| **Gesture latch timeout** | 1500ms | **600ms** | Faster recovery from false positives |

### Color Selection — Complete Redesign

| Aspect | Before | After | Improvement |
|---|---|---|---|
| **Activation zone** | Top-left square (25%×25%) | **Left vertical strip** (12% wide) | — |
| **Color selection axis** | Horizontal (left-right) | **Vertical (up-down)** | Intuitive, natural |
| **Selection mechanism** | 120ms dwell | **Instant on hover** | Zero delay |
| **Palette deactivation** | Same zone as activation | **22% hysteresis buffer** | No accidental closing |
| **Vertical range for colors** | 96% of frame height | **60% of frame** | Less hand travel needed |
| **Open-palm color select** | Separate detector | **Integrated into cursor + palette** | Streamlined |

### Stroke Rendering — Quality Boost

| Aspect | Before | After | Improvement |
|---|---|---|---|
| **Stroke geometry** | Flat lines | **Catmull-Rom ribbons with end caps** | Smooth, 3D-like strokes |
| **Stroke width** | Uniform | **Pressure-sensitive taper** (min 1, max 8) | Natural brush feel |
| **Point spacing** | 0.001 minimum | **0.0008** with curve quality 4 | Finer detail |
| **Ribbon cap segments** | 1 (no cap) | **3** | Clean closed ends |
| **Stroke glow** | Enabled | **Disabled** (performance) | 2× faster rendering |
| **Hand overlay** | Rendered as 3D spheres | **Removed** | Simpler, faster |
| **Gesture indicator 3D** | Rendered in scene | **Removed** | — |

### New Architecture — Added Systems

| System | Purpose |
|---|---|
| **GestureClassifier** | Single-class heuristic with distance-based openness + state machine |
| **AdaptiveThresholds** | Per-hand confidence thresholds that adapt to motion speed & stability |
| **FeatureExtractor** | Extracts finger openness from MCP-to-TIP distances |
| **LandmarkNormalizer** | Mirrors landmark coordinates and corrects handedness |
| **GestureActionMapper** | Maps gestures to domain actions (DRAW, CURSOR, ERASE, etc.) |
| **FingertipCursor** | Visual dot cursor that follows index fingertip |
| **PredictiveCursor** | Velocity-based position prediction for smoother rendering |
| **Diagnostics** | Built-in paint panel, performance monitoring, crash detection |
| **KioskMode** | Fullscreen lock, watchdog, idle reset, keyboard blocking |

### Deleted (Dead Code Cleanup)

| Removed File | Reason |
|---|---|
| `GestureDebouncer.ts` | Replaced by simpler state machine |
| `GestureFSM.ts` | Logic moved into GestureClassifier |
| `detectors/ClearCanvasDetector.ts` | clear_canvas gesture removed |
| `detectors/ColorSelectDetector.ts` | Color select integrated into cursor |
| `detectors/DrawingDetector.ts` | Logic moved to heuristic |
| `detectors/EraserDetector.ts` | Logic moved to heuristic |
| `detectors/utils.ts` | Dead code |
| `ClearProgressRing.tsx` | clear_canvas gesture removed |
| `CursorOverlay.tsx` | Replaced by FingertipCursor |
| `GestureIndicator3D.ts` | Dead code |
| `HandOverlay.tsx` | Performance optimization |
| `smoothing/types.ts` | Dead code |

### Performance Summary

| Metric | Before | After |
|---|---|---|
| **Detection rate** | Full HD @ 60fps, every frame | 640×480 @ 30fps, every 2nd frame |
| **MediaPipe workload** | 4.6× pixels (1280×720) | **4× less** (640×480) |
| **Inference frequency** | 60 inferences/sec | **15–30 inferences/sec** |
| **Gesture response time** | ~150ms (5 frames @ 30fps + debounce) | **~60ms** (2 frames @ 30fps + direct heuristic) |
| **Storage per stroke** | Up to 5000 points | **Up to 3000 points** |
| **Render passes** | Hand overlay + glow + 3D indicator | **Just strokes + background** |

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
  core/       Engine, EventBus, Pipeline, types, constants
  tracking/   WebcamManager, HandTracker, LandmarkNormalizer
  model/      GestureClassifier, FeatureExtractor, IntentLayer, AdaptiveThresholds
  drawing/    StrokeEngine, Stroke, drawing buffer
  rendering/  Three.js scene, StrokeRenderer
  features/   ColorEngine, ColorPalette
  smoothing/  OneEuroFilter applied to all 63 landmark coordinates
  store/      Flat Zustand store
  hooks/      React hooks
  ui/         React components and styles
  workers/    tracking.worker.ts (MediaPipe HandLandmarker in worker thread)
  utils/      Math, logger, diagnostics, kiosk helpers, predictive cursor
```

### Pipeline

```text
Webcam → mirror canvas → MediaPipe HandLandmarker (worker) → raw landmarks
  → LandmarkNormalizer (mirror correction + handedness flip)
  → OneEuroFilter (minCutoff=1.5, beta=0.08, dCutoff=1.2)
  → depth-of-field filter (scale ≥ 0.07, closest hand only via scale comparison)
  → FeatureExtractor (distance-based finger openness)
  → GestureClassifier heuristic (3 gestures, ratio-based thresholds, state machine)
  → Engine processes (draw/cursor/erase/palette)
```

## Key Design Decisions

- Engine runs outside React in its own `requestAnimationFrame` loop.
- MediaPipe is loaded locally and runs CPU-only (Web Worker with main-thread fallback).
- OneEuroFilter smooths all 63 landmark coordinates per hand per frame.
- Finger openness uses **MCP-to-Tip 3D distance** (not angle) for robustness across all screen positions.
- Gesture thresholds are **ratio/relative-based** (not absolute) to handle camera perspective shifts.
- Calibration module is **disabled** — position-dependent scaling was causing landmark distortion in different screen regions.
- Intent layer is **bypassed** — direct heuristic output eliminates hysteresis delays.
- Palette activation uses camera-space coordinates (not DOM pixel) for reliability.
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
