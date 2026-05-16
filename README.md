# Gesture Canvas / بوم حرکتی

> **Museum-grade interactive gesture drawing system**  
> Visitors draw in the air using hand gestures detected through a webcam.
>
> **سیستم تعاملی نقاشی با حرکات دست در سطح موزه**  
> بازدیدکنندگان با حرکات دست در هوا نقاشی می‌کنند.

---

## ✨ Features / قابلیت‌ها

- **Air Drawing** — Draw with your index finger using real-time hand tracking
- **Both Hands** — Supports simultaneous two-hand drawing
- **6 Gesture Controls:**
  - 👆 **Draw** — index finger extended
  - ✌️ **Eraser** — two fingers, size controlled by finger spread
  - 🤟 **Color Select** — three fingers extended
  - ✊ **Stop** — closed fist
  - 🖐️ **Clear Canvas** — open palm held 1.5 seconds
  - 🤲 **Dual Hand** — both hands drawing simultaneously
- **Gesture Indicators** — visual feedback for active gesture
- **3D Ribbon Rendering** — smooth colorful strokes via Three.js
- **Mouse/Touch Fallback** — works without a webcam
- **Kiosk Mode** — fullscreen, context-menu prevention, crash recovery

**Tech Stack:** Vite · React 18 · TypeScript · Three.js · Zustand · MediaPipe Hand Landmarker

---

## 🚀 Quick Start / شروع سریع

```bash
# Clone / download the project
cd gesture-canvas-museum

# Install dependencies
npm install

# Download the MediaPipe hand tracking model (~7.8 MB)
powershell -File scripts/download-model.ps1

# Start development server
npm run dev
# → http://localhost:3000
```

### Production Build / ساخت نهایی

```bash
npm run build      # → dist/
npm run preview    # preview production build
```

---

## 🎮 Controls / کنترل‌ها

### Gesture Mode (webcam required)

| Gesture | Action | Fingers |
|---------|--------|---------|
| Draw | Start drawing | Index extended, others closed |
| Stop Drawing | Pause stroke | Closed fist |
| Eraser | Erase strokes | Index + middle extended |
| Color Select | Cycle color | Index + middle + ring extended |
| Clear Canvas | Clear all (hold 1.5s) | Open palm, all 5 fingers |
| Dual Hand | Both hands draw | Both hands in draw gesture |

### Fallback Mode (mouse/keyboard — no webcam needed)

| Input | Action |
|-------|--------|
| Left-click + drag | Draw |
| `C` | Cycle color |
| `X` | Clear canvas |
| `Ctrl` + `Z` | Undo |

---

## 🏗️ Architecture / معماری

```
src/
├── core/          Engine, EventBus, Pipeline, types
├── tracking/      WebcamManager, HandTracker (MediaPipe)
├── workers/       Web Worker for MediaPipe inference
├── gestures/      6 gesture detectors + FSM + debouncer
├── drawing/       StrokeEngine, Stroke, drawing buffer
├── rendering/     Three.js scene, stroke renderer, hand overlay
├── smoothing/     OneEuroFilter (jitter reduction)
├── features/      Color engine, eraser, canvas history
├── store/         Zustand store (flat, single source of truth)
├── hooks/         React hooks (engine, gesture, drawing)
├── ui/            React components, styles, app shell
└── utils/         Math, object pool, logger, kiosk helpers
```

### Key Design Decisions

- **Engine runs outside React** — its own `requestAnimationFrame` loop, never inside the React render cycle
- **EventBus decouples layers** — gesture detectors → SceneManager → renderers via typed events
- **Flat Zustand store** — no nested slices, direct property access with `useStore(s => s.property)`
- **OneEuroFilter** — adaptive low-pass filter for jitter reduction (low smoothing when still, responsive when moving)
- **Ribbon mesh rendering** — quad strips with vertex colors, lightweight geometry updates
- **Web Worker** — MediaPipe inference runs off the main thread via `tracking.worker.ts`

---

## ⚙️ Performance Targets / اهداف عملکردی

| Metric | Target | Notes |
|--------|--------|-------|
| Frame rate | 30–60 fps | CPU-only inference every 2nd frame |
| Memory | <200 MB stable | Object pooling, ring buffers, explicit disposal |
| Startup | <3 seconds | Async model load with fallback mode |
| Runtime stability | 8+ hours | Auto-recovery watchdog, error boundaries |

Optimized for: **8GB RAM, no GPU, CPU-only** (museum kiosk hardware).

---

## 📦 Dependencies

- `three` + `@react-three/fiber` + `@react-three/drei` — 3D rendering
- `zustand` — state management
- `@mediapipe/tasks-vision` — hand landmark detection
- React 18 + TypeScript 5 — UI framework

---

## 🧹 Commands

```bash
npm run dev         # development server
npm run build       # production build
npm run typecheck   # TypeScript type checking
npm run preview     # preview production build
```

---

## 📝 License

MIT — use freely for museum installations, educational purposes, or any project.

---

> Built for [موزه / Museum] — May 2026
