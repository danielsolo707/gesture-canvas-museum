# Gesture Canvas Museum

Museum-grade interactive gesture drawing system. Visitors draw in the air using hand gestures detected through a webcam.

## Features

- Air drawing with index-finger tracking
- Simultaneous two-hand detection
- Gesture controls for draw, eraser, color cycle, stop, clear, and dual-hand mode
- Three.js ribbon rendering for colorful strokes
- Mouse fallback for testing without webcam tracking
- Local CPU-only MediaPipe hand tracking
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
| Index finger extended | Draw |
| Index + middle extended | Erase |
| Index + middle + ring extended | Cycle color |
| Closed fist | Stop drawing |
| Open palm held | Clear canvas |
| Two drawing hands | Dual-hand drawing |

### Fallback Mode

| Input | Action |
| --- | --- |
| Left-click + drag | Draw |
| `C` | Cycle color |
| `X` | Clear canvas |
| `Ctrl+Z` | Undo |

## Architecture

```text
src/
  core/       Engine, EventBus, Pipeline, types
  tracking/   WebcamManager, direct local MediaPipe HandTracker
  gestures/   Gesture detectors, FSM, debouncer
  drawing/    StrokeEngine, Stroke, drawing buffer
  rendering/  Three.js scene, stroke renderer, hand overlay
  features/   Color engine, eraser, canvas history
  store/      Flat Zustand store
  hooks/      React hooks
  ui/         React components and styles
  utils/      Math, logger, kiosk helpers
```

## Key Design Decisions

- Engine runs outside React in its own `requestAnimationFrame` loop.
- MediaPipe is loaded locally and runs CPU-only.
- No worker is used.
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
