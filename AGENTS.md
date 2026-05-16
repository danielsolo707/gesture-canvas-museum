# Gesture Canvas Museum — Agent Guide

## Project Stack
- Vite + React 18 + TypeScript
- Three.js (react-three-fiber not used in hot path)
- Zustand 4 (flat store pattern)
- MediaPipe @mediapipe/tasks-vision (CPU delegate)

## Architecture Rules
- Engine runs its own rAF loop — NEVER inside React render cycle
- Zustand store is flat (no nested slices) — use `useStore(s => s.property)` directly
- Gesture detectors produce events via EventBus — SceneManager wires them to renderers
- All Three.js disposal must be explicit (geometry.dispose(), material.dispose())
- Web Worker for MediaPipe lives in src/workers/tracking.worker.ts

## Key Files
- `src/core/Engine.ts` — main loop, owns all subsystems
- `src/core/EventBus.ts` — typed event bus for decoupled communication
- `src/store/useStore.ts` — single flat Zustand store with all state/actions
- `src/rendering/SceneManager.ts` — Three.js scene, wires event bus → renderers

## Testing
```bash
npm run dev      # http://localhost:3000
npm run build    # Production build → dist/
npm run typecheck  # tsc --noEmit
```

## Model File
MediaPipe hand_landmarker.task must be at `public/models/hand_landmarker.task`
Download: `powershell -File scripts/download-model.ps1`

## Commands (Fallback Mode)
- Left mouse: Draw
- C: Cycle color (requires ColorEngine)
- X: Clear canvas
- Ctrl+Z: Undo
