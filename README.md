# Gesture Canvas Museum

Museum-grade interactive gesture drawing system. Visitors draw in the air using hand gestures detected through a webcam.

## Features

- Air drawing with index-finger tracking
- **Depth-of-field filtering** — only the hand closest to the camera is tracked, background visitors are ignored
- Gesture persistence — brief tracking interruptions (up to 1.5s) don't break the active gesture
- Three.js ribbon rendering for colorful strokes
- Mouse fallback for testing without webcam tracking
- Local CPU-only MediaPipe hand tracking (Web Worker with main-thread fallback)
- Debug log panel and Playwright camera diagnostic

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
npm run diagnose:camera
```

`npm run diagnose:camera` opens Chrome, captures console/debug logs, writes `tmp-playwright-diagnose.json`, and saves `tmp-playwright-diagnose.png`.

## Controls

### Gesture Mode

| Gesture | Action |
| --- | --- |
| Index finger extended, others curled | Draw |
| Index + middle extended (peace sign) | Erase |
| Open palm (all 5 fingers extended) | Color select |
| Closed fist (all fingers curled) | Clear canvas (hold 2s) |

### Fallback Mode

| Input | Action |
| --- | --- |
| Left-click + drag | Draw |
| `C` | Cycle color |
| `X` | Clear canvas |
| `Ctrl+Z` | Undo |

## Depth-of-Field

The system tracks only the hand closest to the camera by measuring the wrist-to-middle-MCP distance in normalized landmark space. Hands below a minimum size threshold (0.07) are rejected entirely. This prevents visitors passing behind the active user from interfering.

When the tracked hand is briefly lost or uncertain, the last confirmed gesture is held for 1.5 seconds (per-hand latch) and the debouncer requires 5 consistent deactivation frames before releasing.

## Architecture

```text
src/
  core/       Engine, EventBus, Pipeline, types
  tracking/   WebcamManager, MediaPipe via Web Worker (fallback to main thread)
  gestures/   Gesture detectors, FSM, per-hand debouncer + gesture latch
  drawing/    StrokeEngine, Stroke, drawing buffer
  rendering/  Three.js scene, stroke renderer, hand overlay
  features/   Color engine, eraser, canvas history
  smoothing/  OneEuroFilter applied to all 63 landmark coordinates
  store/      Flat Zustand store
  hooks/      React hooks
  ui/         React components and styles
  workers/    tracking.worker.ts (MediaPipe HandLandmarker in worker thread)
  utils/      Math, logger, kiosk helpers
```

### Pipeline

```
Webcam → mirror canvas → MediaPipe HandLandmarker (worker) → raw landmarks
  → OneEuroFilter (minCutoff=0.4, beta=0.06, dCutoff=0.7)
  → depth-of-field filter (closest hand only)
  → HandShapeMetrics (finger angles, extension scores, hex asymmetry)
  → gesture detectors compete (highest confidence wins)
  → per-hand debouncer (5-frame activation/deactivation)
  → per-hand gesture latch (1.5s hold on brief loss)
  → EventBus → Engine processes (draw/erase/color/clear)
```

## Key Design Decisions

- Engine runs outside React in its own `requestAnimationFrame` loop.
- MediaPipe is loaded locally and runs CPU-only (Web Worker with main-thread fallback).
- OneEuroFilter smooths all 63 landmark coordinates per hand per frame.
- Per-hand gesture latch prevents flicker during brief tracking loss.
- All Three.js disposal is explicit.
- Zustand store stays flat.

## Dependencies

- `@mediapipe/tasks-vision`
- `three`
- `zustand`
- React 18 + TypeScript

## Commands

```bash
npm run dev             # development server
npm run build           # production build
npm run start:local     # local kiosk server at http://localhost:3000
npm run typecheck       # TypeScript check
npm run diagnose:camera # camera/debug diagnostic
```
