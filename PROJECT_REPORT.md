# Gesture Canvas Museum — Comprehensive Project Report

**Audit Date:** 2026-05-18  
**Auditor:** Senior Software Architect  
**Repository:** gesture-canvas-museum  
**Commit:** 7a5b003 (latest)

---

## 1. PROJECT OVERVIEW

### What This System Does

Gesture Canvas Museum is an interactive air-drawing installation designed for museum kiosks. Visitors stand in front of a webcam, extend their index finger, and draw strokes in the air — the system captures hand poses in real time via MediaPipe, classifies gestures (point, open palm, peace sign, fist), and renders colorful ribbon strokes on a Three.js canvas. The system supports five gestures: **draw** (index finger), **erase** (peace sign), **cursor/color-select** (open palm), **clear canvas** (fist held 2s), and **idle**.

### Target Environment

- **Physical:** Museum kiosk with a dedicated PC, webcam, and large display
- **OS:** Windows 10/11 or Linux (no macOS-specific code)
- **Network:** Fully offline-capable after one-time asset download
- **Audience:** Non-technical museum visitors — zero training expected
- **Uptime target:** Hours of continuous operation without restart

### Tech Stack Summary

| Layer | Technology | Version |
|-------|-----------|---------|
| Build | Vite | ^6.0.3 |
| UI | React | ^18.3.1 |
| Language | TypeScript | ~5.6.2 (strict mode) |
| 3D Rendering | Three.js | ^0.172.0 |
| State | Zustand | ^4.5.5 (flat store) |
| Hand Tracking | @mediapipe/tasks-vision | ^0.10.18 (CPU delegate) |
| ML Inference | Custom pure-TS Temporal CNN | In-house (no ONNX/TensorFlow) |
| Testing | Playwright | ^1.60.0 (diagnostic only) |

---

## 2. ARCHITECTURE MAP

### Full Pipeline

```
┌─────────────┐    ┌──────────────────┐    ┌────────────────────┐
│  Webcam      │───▶│  Web Worker      │───▶│  HandTracker       │
│  1280×720    │    │  MediaPipe CPU   │    │  (main thread)     │
└─────────────┘    └──────────────────┘    └────────┬───────────┘
                                                     │ Float32Array[]
                                                     ▼
                                             ┌──────────────────┐
                                             │  OneEuroFilter    │
                                             │  63 coords/hand   │
                                             └────────┬─────────┘
                                                      │
                                                      ▼
                                             ┌──────────────────┐
                                             │  Depth-of-Field   │
                                             │  Filter (closest  │
                                             │  hand only, min   │
                                             │  scale 0.07)      │
                                             └────────┬─────────┘
                                                      │
                                                      ▼
                                             ┌──────────────────┐
                                             │  FeatureExtractor │
                                             │  26 scalar feats  │
                                             └────────┬─────────┘
                                                      │
                                      ┌───────────────┼───────────────┐
                                      ▼                               ▼
                             ┌─────────────────┐            ┌──────────────────┐
                             │  TemporalCNN     │            │  Heuristic       │
                             │  (TCN/MLP)       │            │  Detectors       │
                             │  5-class probs   │            │  per gesture     │
                             └────────┬────────┘            └────────┬─────────┘
                                      │                              │
                                      ▼                              ▼
                             ┌─────────────────────────────────────────────┐
                             │  GestureRecognizer (blends CNN + heuristic)  │
                             └────────────────────┬────────────────────────┘
                                                  │
                                                  ▼
                             ┌─────────────────────────────────────────────┐
                             │  GestureStateMachine                         │
                             │  • Per-hand debounce (5-frame activate)      │
                             │  • Gesture latch (1.2s on brief loss)        │
                             │  • Confidence hysteresis                      │
                             └────────────────────┬────────────────────────┘
                                                  │
                                                  ▼
                             ┌─────────────────────────────────────────────┐
                             │  GestureActionMapper → EventBus              │
                             └────────────────────┬────────────────────────┘
                                                  │
                              ┌───────────────────┼───────────────────┐
                              ▼                   ▼                   ▼
                     ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
                     │  StrokeEngine│   │  ColorEngine  │   │  ClearEffect │
                     │  (draw/erase)│   │  (palette)    │   │  (particles) │
                     └──────┬───────┘   └──────────────┘   └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │  SceneManager│
                     │  Three.js    │
                     │  rAF render  │
                     └──────────────┘
```

### Module → Input/Output Summary

| Module | Input | Output |
|--------|-------|--------|
| WebcamManager | System camera | MediaStream → Video element |
| tracking.worker.ts | Video frame (ImageData) | Float32Array[63] landmarks per hand |
| HandTracker | Video element | HandSnapshot[] (via postMessage) |
| OneEuroFilter | Raw 63 landmarks | Smoothed 63 landmarks |
| DepthOfFieldFilter | Multiple hands | Single closest hand |
| FeatureExtractor | 63 landmarks | 26 scalar features |
| TemporalCNN | 20-frame buffer × 26 features | 5-class probability vector |
| HeuristicDetectors | Finger angles + openness | Per-gesture boolean + confidence |
| GestureRecognizer | CNN probs + heuristic results | Blended gesture + confidence |
| GestureStateMachine | Raw gesture classification | Stable gesture event (debounced) |
| GestureActionMapper | GestureEvent | Action (DRAW/ERASE/CURSOR/CLEAR/IDLE) |
| EventBus | Action | Notifies all subscribers |
| StrokeEngine | Action + 2D point | Stroke geometry (BufferGeometry) |
| SceneManager | Stroke geometries + hand data | Rendered Three.js frame |
| Zustand Store | Various state updates | React UI updates (debug panel) |

---

## 3. MODULE INVENTORY

### `src/core/` — Central Orchestration

| File | Purpose | Key Exports | Dependencies | Status |
|------|---------|-------------|--------------|--------|
| `Engine.ts` (562 lines) | Main game loop, owns all subsystems, processes tracking→gestures→drawing→render per frame | `Engine` class | All subsystems | **Core** |
| `EventBus.ts` (62 lines) | Typed pub/sub event bus with `on`/`once`/`emit`/`removeAll` | `EventBus`, `globalEventBus` | None | **Core** |
| `types.ts` (158 lines) | All shared type definitions (HandSnapshot, GestureType, StrokeData, EngineStats, etc.) | 20+ interfaces/types | None | **Core** |
| `constants.ts` (166 lines) | All configuration constants (WEBCAM, INFERENCE, GESTURE, TEMPORAL, SMOOTHING, etc.) | 15+ const objects | types.ts | **Core** |
| `GestureActionMapper.ts` (43 lines) | Maps GestureEvent → Action using ACTION_MAPPING table | `GestureActionMapper` | constants, types | **Core** |

### `src/tracking/` — Camera & Hand Detection

| File | Purpose | Key Exports | Dependencies | Status |
|------|---------|-------------|--------------|--------|
| `WebcamManager.ts` (~80 lines) | Manages getUserMedia, video element lifecycle | `WebcamManager` | constants | **Core** |
| `HandTracker.ts` (~180 lines) | Orchestrates Web Worker for MediaPipe, with main-thread fallback; manages hand caching | `HandTracker` | constants, types | **Core** |

### `src/workers/` — MediaPipe Worker

| File | Purpose | Key Exports | Dependencies | Status |
|------|---------|-------------|--------------|--------|
| `tracking.worker.ts` (~200 lines) | Web Worker running MediaPipe HandLandmarker, receives ImageData, returns landmarks | Worker message protocol | @mediapipe/tasks-vision | **Core** |

### `src/features/` — Feature Extraction & Classification

| File | Purpose | Key Exports | Dependencies | Status |
|------|---------|-------------|--------------|--------|
| `FeatureExtractor.ts` (~280 lines) | Computes 26 scalar features from 21 landmarks (angles, openness, distances, velocity, acceleration) | `FeatureExtractor` | types, constants | **Core** |
| `TemporalBuffer.ts` (~90 lines) | Ring buffer storing last 20 frames of 26-dim feature vectors | `TemporalBuffer` | types | **Core** |
| `types.ts` (39 lines) | FingerAngles, FingerOpenness, HandFeatures interfaces; FEATURE_COUNT=26 | Types + FEATURE_NAMES | None | **Core** |

### `src/model/` — ML Model Layer

| File | Purpose | Key Exports | Dependencies | Status |
|------|---------|-------------|--------------|--------|
| `TemporalCNN.ts` (228 lines) | Pure-TypeScript 1D CNN: Conv1D→Pool→ReLU→Conv1D→Pool→ReLU→FC→Softmax | `TemporalCNN` | types | **Core** |
| `GestureMLP.ts` (~200 lines) | Simple MLP classifier (20→12→5) with z-score normalization | `GestureMLP` | None | **Core** |
| `types.ts` (22 lines) | CNNWeights interface, GESTURE_CLASSES, ClassificationResult | Types | types | **Core** |

### `src/gestures/` — Gesture Recognition

| File | Purpose | Key Exports | Dependencies | Status |
|------|---------|-------------|--------------|--------|
| `GestureRecognizer.ts` (~300 lines) | Top-level recognizer: blends CNN + heuristic, runs state machine, produces events | `GestureRecognizer` | All gesture deps | **Core** |
| `detectors/DrawingDetector.ts` (~120 lines) | Heuristic: index extended, others curled | `DrawingDetector` | utils | **Core** |
| `detectors/EraserDetector.ts` (~100 lines) | Heuristic: index + middle extended | `EraserDetector` | utils | **Core** |
| `detectors/CursorDetector.ts` (~100 lines) | Heuristic: all 5 fingers extended | `CursorDetector` | utils | **Core** |
| `detectors/ClearCanvasDetector.ts` (~100 lines) | Heuristic: all fingers curled (fist) | `ClearCanvasDetector` | utils | **Core** |
| `detectors/utils.ts` (~150 lines) | getLandmark, distance3D, fingerAngle, extensionScore, hexAsymmetry | Utility functions | types | **Core** |

### `src/state-machine/` — Gesture State Machine

| File | Purpose | Key Exports | Dependencies | Status |
|------|---------|-------------|--------------|--------|
| `GestureStateMachine.ts` (215 lines) | Per-hand state tracking with hysteresis, cooldown, confidence blending, gesture latching | `GestureStateMachine` | types | **Core** |
| `types.ts` (37 lines) | TransitionRule, GestureStateEntry, GestureStateConfig, DEFAULT_STATE_CONFIG | Types | types | **Core** |

### `src/filtering/` — Signal Processing

| File | Purpose | Key Exports | Dependencies | Status |
|------|---------|-------------|--------------|--------|
| `OneEuroFilter.ts` (~100 lines) | Per-coordinate exponential smoothing filter | `OneEuroFilter` | constants | **Core** |
| `DepthOfFieldFilter.ts` (~80 lines) | Selects closest hand by wrist-to-MCP distance, rejects small hands | `DepthOfFieldFilter` | constants | **Core** |
| `OcclusionRecovery.ts` (~90 lines) | Extrapolates hand position during brief tracking loss using pose memory | `OcclusionRecovery` | constants, types | **Improved** |

### `src/smoothing/` — Position Smoothing

| File | Purpose | Key Exports | Dependencies | Status |
|------|---------|-------------|--------------|--------|
| `MotionPredictor.ts` (~60 lines) | Linear extrapolation for sub-frame prediction | `MotionPredictor` | constants | **Improved** |

### `src/drawing/` — Stroke Management

| File | Purpose | Key Exports | Dependencies | Status |
|------|---------|-------------|--------------|--------|
| `StrokeEngine.ts` (~250 lines) | Manages active strokes, history, undo, erase-at-point, clear-all | `StrokeEngine` | constants, types | **Core** |
| `Stroke.ts` (~180 lines) | Single stroke: points, Three.js BufferGeometry, addPoint, dispose | `Stroke` | types, constants | **Core** |

### `src/rendering/` — Three.js Rendering

| File | Purpose | Key Exports | Dependencies | Status |
|------|---------|-------------|--------------|--------|
| `SceneManager.ts` (~350 lines) | Three.js scene, camera, renderer; subscribes to EventBus; manages stroke meshes, hand overlay, cursor | `SceneManager` | Three.js, EventBus | **Core** |
| `HandOverlay.ts` (~120 lines) | Renders hand skeleton as Three.js lines + dots | `HandOverlay` | Three.js, types | **Core** |
| `ClearEffect.ts` (87 lines) | 200-particle explosion on canvas clear | `ClearEffect` | Three.js | **Core** |
| `shaders/` (empty) | Reserved for future GLSL shaders | — | — | **Planned** |

### `src/features/colors/` — Color System

| File | Purpose | Key Exports | Dependencies | Status |
|------|---------|-------------|--------------|--------|
| `ColorEngine.ts` (~80 lines) | 12-color palette, selectColor, getCurrentColor | `ColorEngine` | store | **Core** |

### `src/store/` — Zustand Store

| File | Purpose | Key Exports | Dependencies | Status |
|------|---------|-------------|--------------|--------|
| `useStore.ts` (~200 lines) | Single flat Zustand store: mode, gesture, cursor, strokes, debug, UI state | `useStore` | Zustand | **Core** |

### `src/ui/` — React UI

| File | Purpose | Key Exports | Dependencies | Status |
|------|---------|-------------|--------------|--------|
| `App.tsx` (~120 lines) | Root component: initializes Engine, renders canvas + overlay | `App` | Engine, hooks | **Core** |
| `DebugOverlay.tsx` (~150 lines) | Debug panel showing FPS, gesture state, CNN probabilities, features | `DebugOverlay` | store | **Core** |
| `HandStatusIndicator.tsx` (~60 lines) | Visual indicator for hand tracking status | `HandStatusIndicator` | store | **Core** |
| `ColorPalette.tsx` (~80 lines) | Bottom-of-screen color palette UI for cursor mode | `ColorPalette` | store | **Core** |
| `ClearProgressIndicator.tsx` (~40 lines) | Circular progress indicator during fist-hold clear | `ClearProgressIndicator` | store | **Core** |

### `src/hooks/` — React Hooks

| File | Purpose | Key Exports | Dependencies | Status |
|------|---------|-------------|--------------|--------|
| `useEngine.ts` (~50 lines) | Initializes and manages Engine lifecycle in React | `useEngine` | Engine | **Core** |
| `useFallbackInput.ts` (~100 lines) | Mouse/keyboard fallback for testing without camera | `useFallbackInput` | Engine, constants | **Core** |

### `src/utils/` — Utilities

| File | Purpose | Key Exports | Dependencies | Status |
|------|---------|-------------|--------------|--------|
| `logging.ts` (~60 lines) | Structured logger with level filtering, debug log buffer | `logger` | None | **Core** |
| `math.ts` (~40 lines) | clamp, lerp, smoothstep | Utility functions | None | **Core** |
| `kiosk.ts` (~30 lines) | Kiosk helpers (fullscreen request, etc.) | Kiosk utilities | None | **Improved** |

### `scripts/` — Training & Build Scripts

| File | Purpose | Key Exports | Dependencies | Status |
|------|---------|-------------|--------------|--------|
| `train_gesture_mlp.py` (628 lines) | Synthetic data generation + MLP/PyTorch training pipeline | MLP weights JSON | numpy, (optional) PyTorch | **New** |
| `weights_to_ts.py` (28 lines) | Converts MLP JSON weights → TypeScript module | pretrainedWeights.ts | Python | **New** |
| `copy-mediapipe.mjs` (59 lines) | Copies MediaPipe WASM files to public/ | WASM assets | fs | **Core** |
| `download-model.ps1` (18 lines) | Downloads hand_landmarker.task from Google storage | Model file | PowerShell | **Core** |
| `diagnose-playwright.mjs` (89 lines) | Camera/debug diagnostic via headless Chrome | JSON + PNG report | Playwright | **Improved** |

### `tests/` — Test Suite

| File | Purpose | Status |
|------|---------|--------|
| (empty) | No test files exist | 🔴 **Critical gap** |

---

## 4. ML PIPELINE DETAILS

### Feature Extraction: 26 Features

Extracted by `src/features/FeatureExtractor.ts` from the 21 MediaPipe hand landmarks (63 floats):

| # | Feature Name | Computation | Range |
|---|-------------|-------------|-------|
| 0-4 | `thumb_angle, index_angle, middle_angle, ring_angle, pinky_angle` | Angle between MCP→PIP→TIP vectors per finger | 0–π rad |
| 5-9 | `thumb_ext, index_ext, middle_ext, ring_ext, pinky_ext` | `1 - (angle / 0.55)`, clamped [0,1] | 0–1 |
| 10-12 | `hex_ab, hex_bc, hex_cd` | Normalized triangular areas between adjacent fingertips (AB=thumb-index, BC=index-middle, CD=middle-ring) | 0–~0.1 |
| 13-15 | `asym_ab, asym_bc, asym_cd` | `larger_hex / (smaller_hex + ε)` ratios between finger triangles | 0.5–10+ |
| 16 | `scale` | Wrist-to-middle-MCP Euclidean distance in normalized landmark space | 0.05–0.5 |
| 17 | `index_middle_dist` | Normalized distance between index and middle fingertips | 0–0.3 |
| 18 | `avg_ext` | Mean of 5 extension scores | 0–1 |
| 19 | `ext_range` | `max(extensions) - min(extensions)` | 0–1 |
| 20-22 | `velocity_x/y/z` | First derivative of index-tip position (landmarks[8]) | varies |
| 23-25 | `accel_x/y/z` | Second derivative of index-tip position | varies |

**Note:** Features 20-25 (velocity + acceleration) are temporal — computed from frame-to-frame deltas. The first few frames after tracking starts will have zero velocity/acceleration.

### MLP Model (scripts/train_gesture_mlp.py)

The training script (`scripts/train_gesture_mlp.py`) defines a **separate** model architecture from the runtime TemporalCNN:

**Architecture:** `20 inputs → 12 hidden (ReLU) → 5 outputs (Softmax)`

- **Input:** 20 features (NOT the full 26 — the training script uses a reduced feature set)
- **Parameter count:** 20×12 + 12 + 12×5 + 5 = **317 parameters**
- **Training data:** Synthetic only — procedural generators with Gaussian jitter, 4000 samples per class by default
- **Classes:** `['idle', 'drawing', 'color_select', 'clear_canvas', 'eraser']`
- **Export format:** JSON → converted to TypeScript via `weights_to_ts.py`

🔴 **Critical Mismatch:** The training script uses 20 features (N_FEATURES=20) but the runtime FeatureExtractor produces 26 features. The training features include `hex_ab, hex_bc, hex_cd, asym_ab, asym_bc, asym_cd` (lines 43-44) while the runtime features include `velocity_x/y/z, accel_x/y/z` instead. This means **the MLP weights trained by this script cannot be directly used with the runtime feature vector** without either retraining with 26 features or dropping velocity/acceleration features at inference time.

### TemporalCNN Model (src/model/TemporalCNN.ts)

A separate, more complex model exists in the runtime:

**Architecture:** 
```
Input: [20 frames × 26 features]
→ Conv1D(26→16, kernel=3, stride=1) + ReLU     → [20×16]
→ MaxPool1D(2)                                    → [10×16]
→ Conv1D(16→32, kernel=3, stride=1) + ReLU       → [10×32]
→ MaxPool1D(2)                                    → [5×32]
→ Flatten                                         → [160]
→ Dense(160→64) + ReLU                            → [64]
→ Dense(64→5) + Softmax                           → [5]
```

**Parameter count estimate:**
- Conv1: 26×16×3 + 16 = 1,264
- Conv2: 16×32×3 + 32 = 1,568
- FC1: 160×64 + 64 = 10,304
- FC2: 64×5 + 5 = 325
- **Total: ~13,461 parameters**

🔴 **No pre-trained weights exist for the TemporalCNN.** The `CNNWeights` interface is defined but no JSON/TS weight file ships with the project. The CNN is effectively non-functional unless weights are generated externally.

### Training Assumptions

- **Gesture set:** 5 classes (idle, drawing, eraser, cursor/color_select, clear_canvas)
- **Dataset:** Entirely synthetic — procedural generators in `train_gesture_mlp.py`
- **Hard samples:** 30% of each class uses harder distributions near decision boundaries
- **Confusion samples:** 15% transitional poses labeled as "idle"
- **Validation split:** 15%
- **Expected accuracy:** Likely >95% on synthetic validation (easy domain), but **unknown generalization to real MediaPipe landmarks**
- 🟡 **No real-world data collection pipeline exists.** The synthetic data generators are educated guesses about what the feature space looks like — there is no validation against actual hand poses.

### Inference Flow Latency Estimate

| Stage | Estimated Latency |
|-------|-------------------|
| MediaPipe CPU inference (21 landmarks) | 15–30ms |
| OneEuroFilter (63 coords × 2 hands) | <0.5ms |
| Feature extraction (26 features) | <0.5ms |
| Temporal buffer push | <0.1ms |
| MLP/TCN forward pass | <1ms |
| Heuristic detectors (4×) | <0.5ms |
| State machine + debounce | <0.1ms |
| **Total per-frame** | **~17–32ms** |

🟡 At 30fps target, per-frame budget is ~33ms. MediaPipe alone consumes 15-30ms, leaving minimal headroom. On slower museum hardware this could drop below 30fps.

---

## 5. KNOWN ISSUES & RISKS

### Runtime Crash Risks 🔴

1. **🔴 `Engine.ts:180` — Fire-and-forget async tracking:** `this.processTracking(now).catch(() => {})` swallows all errors silently. If `processTracking` throws during `this.gesture.recognize()`, the error is silently eaten and the pipeline appears to work but produces no output. No fallback behavior is triggered.

2. **🔴 `Engine.ts:557-561` — `computeHandScale` no null checks:** `getLm()` returns `[number, number, number]` but there's no null guard. If the landmark array is malformed or shorter than expected, `distance3D` will receive `undefined` values → `NaN` propagation → gesture pipeline breaks silently.

3. **🔴 `TemporalCNN.ts` — No weight initialization/fallback:** If CNN weights are missing or all-zero (which is the default state), the forward pass produces meaningless output. The `CNNWeights` interface expects 8 Float32Arrays but no default weights ship. If `TEMPORAL.ENABLE_CNN` is true and weights are empty, the CNN outputs garbage that could override correct heuristic results.

4. **🔴 `HandTracker.ts` — Worker initialization race condition:** If `detect()` is called before the worker finishes initializing (model loading is async), the worker will not have a HandLandmarker instance. The code likely guards against this, but the main-thread fallback path creates a NEW HandLandmarker on every call if the worker fails — this is extremely expensive (~500ms per creation).

5. **🔴 `FeatureExtractor.ts` — Frame-to-frame continuity:** Velocity/acceleration features depend on previous frame's landmark positions. On the first frame after hand detection resumes, velocity = 0 and acceleration = 0, creating a discontinuity that could confuse the temporal model.

### Architectural Weaknesses

6. **🟡 Duplicated gesture state tracking:** `Engine.ts` maintains `activeDrawHands`, `clearHoldActive`, `colorDwellIndex`, `lastGestureType` etc. — while `GestureStateMachine` maintains its own `GestureStateEntry` per hand. These two state systems can drift out of sync, especially during brief tracking loss.

7. **🟡 Global singleton EventBus:** `globalEventBus` is a module-level singleton. This makes unit testing extremely difficult (shared state between tests) and prevents multiple Engine instances.

8. **🟡 `SceneManager` hard dependency on `globalEventBus`:** SceneManager subscribes to events in its constructor/initialize. There's no way to inject a different EventBus, making it impossible to test SceneManager in isolation.

9. **🟡 No error boundaries in React:** `App.tsx` does not wrap the Engine initialization in an error boundary. If the Engine fails to initialize (e.g., WebGL not available), the entire React tree crashes with an unhandled exception.

10. **🟡 `ClearEffect.ts:55` — Hardcoded 16ms delta:** `this.elapsed += 16` assumes 60fps. On a 30fps display, the clear animation plays at half speed. On a 144hz display, it plays at 2.4x speed.

### Missing Error Handling

11. **🟡 `WebcamManager` — No device selection:** Uses default camera only. Museum PCs with multiple camera devices (or virtual cameras) have no way to select the correct device.

12. **🟡 `StrokeEngine` — No memory limits:** `DRAWING.MAX_POINTS_PER_STROKE` (5000) exists but there's no global stroke count or memory limit. A visitor who draws continuously for hours could accumulate unbounded geometry in memory.

13. **🟡 `Engine.ts:534` — `getDrawingPoint` uses `window.innerWidth/Height`:** This is a side effect inside a pure function. In a multi-monitor museum setup where the display is a different resolution than the window, the aspect ratio calculation will be wrong, causing drawing distortion.

14. **🟡 `SceneManager` — No WebGL context loss handling:** Three.js canvases can lose context (GPU driver reset, power management). No `webglcontextlost`/`webglcontextrestored` event handling exists.

15. **🟢 `EventBus.emit` — `data` parameter is optional:** `emit<K>(event: K, data?: EventMap[K])` — but some event types are `void` (e.g., `clear_canvas`). When data is undefined and the handler expects a value, TypeScript's type system allows this but the handler receives `undefined`.

### Performance Bottlenecks

16. **🟡 MediaPipe CPU-only:** The constant `DELEGATE: 'CPU'` forces CPU inference. On museum hardware with a discrete GPU, using `GPU` delegate could halve inference time. However, the AGENTS.md specifies CPU, likely for compatibility.

17. **🟡 OneEuroFilter runs on main thread:** Filtering 63 coordinates per hand per frame is cheap (<0.5ms), but it runs on the main thread alongside rendering. On slow machines, this contributes to frame drops.

18. **🟡 `SceneManager` may create new geometries every frame:** If `stroke_update` events fire every 16ms (line 443 of Engine.ts) and each update rebuilds the BufferGeometry, this creates significant GC pressure. The `Stroke.ts` class needs explicit `dispose()` calls.

19. **🟡 Zustand store updates per-frame:** Multiple `useStore.getState().setX()` calls per frame (gesture, cursor, drawing state, debug info) — while Zustand is fast, these trigger React re-renders in subscribed components every frame. The `PERFORMANCE.STORE_SYNC_INTERVAL_MS` (66ms) throttle may not be consistently applied.

### Chicken-and-Egg Problems

20. **🟡 Calibration before classification:** The system has `CalibrationData` types and `calibration_start`/`calibration_done` events (Engine.ts:81-86), but **no calibration flow is implemented in the startup sequence**. The FeatureExtractor's `scale` feature varies wildly between users (a child's hand vs. an adult's), but without calibration, the classification thresholds are fixed and will misclassify for extreme hand sizes.

21. **🟡 Synthetic data vs. real data:** The MLP was trained on synthetic data that approximates what MediaPipe outputs. There's no validation that the synthetic feature distributions match real MediaPipe landmarks. Until real data is collected and the model is retrained, classification accuracy on real users is unknown.

---

## 6. MISSING PIECES

### Testing 🔴

- **No unit tests exist.** The `tests/` directory is empty.
- No integration tests for the tracking pipeline
- No end-to-end tests (Playwright is used only for diagnostics, not assertions)
- No test runner configured (no Jest, Vitest, etc. in package.json)
- 🟢 **No CI/CD pipeline** (no GitHub Actions, no automated typecheck/build on push)

### Model Training Pipeline 🟡

- No real data collection tool (no "record landmarks to file" mode)
- No model evaluation/benchmarking script
- No A/B testing framework for comparing heuristic vs. CNN accuracy
- No model versioning (no way to ship updated weights without code changes)
- 🟡 The TemporalCNN has no training script — only the MLP does

### Logging & Monitoring 🟡

- `logger` exists but writes only to in-memory buffer + console
- No persistent logging (file-based or remote)
- No crash reporting / telemetry
- No performance metrics collection (FPS history, latency percentiles)
- No alerting for sustained low FPS or tracking failure

### Deployment & Hardware 🟡

- No Docker container for reproducible deployment
- No startup health check (verify webcam, model files, WebGL)
- No auto-restart on crash (no PM2/systemd/Windows Service config)
- No kiosk-mode browser configuration (disable context menus, keyboard shortcuts)
- No screen resolution / display scaling detection
- No hardware requirements documentation (minimum CPU, GPU, RAM, webcam resolution)

### Accessibility 🟢

- No alternative input for visitors who cannot use hand gestures
- No audio feedback for gesture confirmation
- No visual tutorial / onboarding for first-time visitors
- No language localization (all UI text in English)
- No consideration for visitors with motor impairments

### Missing Functional Features 🟢

- No save/export artwork functionality
- No stroke thickness control (gesture-based or otherwise)
- No undo gesture (Ctrl+Z exists in fallback only, no gesture equivalent)
- No multi-user collaborative drawing
- No timeout / screensaver mode when no hands detected

---

## 7. TECHNICAL DEBT

| Item | Location | Severity | Description |
|------|----------|----------|-------------|
| Feature mismatch between training and inference | `train_gesture_mlp.py:35` vs `FeatureExtractor.ts` | **High** | Training uses 20 features, runtime uses 26. Cannot use trained weights directly. |
| No CNN weights shipped | `src/model/TemporalCNN.ts` | **High** | TemporalCNN defined but no pre-trained weights exist. CNN is effectively dead code. |
| Dual gesture state tracking | `Engine.ts` + `GestureStateMachine.ts` | **High** | Two independent systems track gesture state; easy to get out of sync. |
| Global singleton EventBus | `src/core/EventBus.ts:62` | **Medium** | Makes testing hard, prevents multiple instances. |
| `forward()` method in MLP has wrong implementation | `train_gesture_mlp.py:369-374` | **Medium** | The `forward()` method computes `logits = X @ self.w2.T + self.b2` (skipping hidden layer) instead of `h @ self.w2.T`. The `predict()` method does it correctly. `forward()` is never called in training, but it's dead code with a bug. |
| Synthetic data only | `scripts/train_gesture_mlp.py` | **Medium** | No validation against real MediaPipe output. Entire classification accuracy is theoretical. |
| Hardcoded frame time in ClearEffect | `src/rendering/ClearEffect.ts:55` | **Low** | `this.elapsed += 16` instead of computing delta from actual timestamps. |
| `noUnusedLocals: false` in tsconfig | `tsconfig.json:16` | **Low** | Dead code not caught by TypeScript. Several unused imports/variables likely exist. |
| Empty shaders directory | `src/rendering/shaders/` | **Low** | Placeholder directory never used. |
| `NEW_GESTURE_MAP` unused | `src/model/types.ts` (referenced) | **Low** | Dead code from refactoring. |
| `tmp-playwright-diagnose.*` in repo root | Root directory | **Low** | Generated diagnostic files committed to repo. Should be in .gitignore. |
| No path alias usage consistency | Various imports | **Low** | Some files use `@/` aliases, others use relative `../` paths inconsistently. |
| `import.meta.env.BASE_URL` in constants | `src/core/constants.ts:15` | **Low** | Model path depends on Vite's base URL at build time. Could break in non-standard deployment. |

---

## 8. RECOMMENDED NEXT STEPS

### Critical (Must fix before museum deployment)

| # | Task | Effort | Description |
|---|------|--------|-------------|
| 1 | **Fix feature dimension mismatch** | Medium (days) | Retrain MLP with 26 features (matching FeatureExtractor) or retrain TemporalCNN with a real training script. Ensure runtime model weights are compatible with runtime features. |
| 2 | **Ship working model weights** | Medium (days) | Generate and ship either MLP or TCN weights that match the runtime feature pipeline. Without this, CNN classification is non-functional. |
| 3 | **Add null safety to landmark processing** | Small (hours) | Guard all `getLandmark()` calls, add null checks in `computeHandScale()`, `getDrawingPoint()`, and the feature extractor. Prevent NaN propagation. |
| 4 | **Add startup health checks** | Small (hours) | On boot, verify: (1) webcam accessible, (2) model file exists, (3) WebGL context created, (4) worker initializes. Show clear error messages for each failure. |
| 5 | **Add WebGL context loss handling** | Small (hours) | Listen for `webglcontextlost`/`webglcontextrestored` on the canvas. On loss, pause rendering. On restore, reinitialize Three.js renderer. |

### High Priority

| # | Task | Effort | Description |
|---|------|--------|-------------|
| 6 | **Implement calibration flow** | Medium (days) | On first hand detection, run a 2-second calibration: ask user to show open palm, measure hand scale, store calibration data. Use to normalize feature extraction thresholds. |
| 7 | **Set up testing framework** | Medium (days) | Add Vitest for unit tests. Write tests for: FeatureExtractor, OneEuroFilter, GestureStateMachine, TemporalCNN forward pass, StrokeEngine. Target ≥70% coverage on core modules. |
| 8 | **Add memory management for strokes** | Small (hours) | Implement max total stroke count or memory budget. Auto-dispose oldest strokes when limit is reached. Add explicit `dispose()` calls in StrokeEngine. |
| 9 | **Refactor to injectable EventBus** | Medium (days) | Accept EventBus as constructor parameter in Engine, SceneManager, and all consumers. Keep `globalEventBus` as default but allow override for testing. |
| 10 | **Add React error boundary** | Small (hours) | Wrap App in an error boundary that catches initialization failures and shows a friendly error screen with recovery instructions. |

### Medium Priority

| # | Task | Effort | Description |
|---|------|--------|-------------|
| 11 | **Collect real landmark data** | Large (weeks) | Build a "data collection mode" that records FeatureExtractor output to JSON. Have 10+ people perform each gesture for 30 seconds. Use this to retrain the model with real data. |
| 12 | **Add persistent logging** | Medium (days) | Write logs to localStorage or IndexedDB with rotation. Add a "download logs" button in debug overlay. This is critical for diagnosing issues during museum operation. |
| 13 | **Implement device selection** | Small (hours) | Add camera device enumeration and selection in the UI or via URL parameter for museum PCs with multiple cameras. |
| 14 | **Add auto-restart on crash** | Small (hours) | Wrap Engine in try/catch at the top level. On unrecoverable error, reload the page after a timeout. Consider PM2 or systemd for process-level restart. |
| 15 | **Kiosk mode hardening** | Small (hours) | Disable right-click context menu, prevent Ctrl+W, disable browser keyboard shortcuts. Set fullscreen on startup. Add idle timeout → screensaver. |
| 16 | **GPU delegate option** | Small (hours) | Make MediaPipe delegate configurable (CPU vs GPU). Auto-detect if GPU delegate is available. Could significantly reduce inference latency on capable hardware. |

### Low Priority

| # | Task | Effort | Description |
|---|------|--------|-------------|
| 17 | **Fix ClearEffect delta time** | Small (hours) | Replace hardcoded `+= 16` with actual delta from timestamps. |
| 18 | **Add visitor onboarding** | Medium (days) | First-time tutorial showing hand gestures with animated examples. Auto-dismiss after 10 seconds or on first detected gesture. |
| 19 | **Add undo gesture** | Small (hours) | Map a 3-finger gesture or specific motion to undo last stroke. |
| 20 | **Artwork export** | Medium (days) | Add "save your art" feature — render canvas to image, optionally with QR code to download. |
| 21 | **Clean up dead code** | Small (hours) | Remove unused `forward()` method in train_gesture_mlp.py, unused `NEW_GESTURE_MAP`, empty shaders directory, tmp diagnostic files. |
| 22 | **Standardize import paths** | Small (hours) | Use `@/` path aliases consistently. Configure ESLint to enforce this. |
| 23 | **Add CI pipeline** | Medium (days) | GitHub Actions: typecheck → build → (future: test). Block merge on failure. |

---

## 9. OPEN QUESTIONS

### Hardware & Environment

1. **What is the target museum hardware spec?** CPU model, RAM, GPU, webcam model/position/resolution. This determines whether GPU MediaPipe delegate is viable, whether 60fps is achievable, and what inference latency budget we have.

2. **What is the webcam mounting position and angle?** Hand tracking accuracy degrades significantly at angles >30° from frontal. If the camera is above/below eye level, the landmark extraction may need compensation.

3. **How large is the display?** This affects cursor easing, stroke width, and the color palette hover zone dimensions. Current values are tuned for a standard monitor.

### User Experience

4. **Should there be a calibration step on startup?** A 5-second "show your hand" calibration would normalize for hand size and improve classification accuracy. But it adds friction for museum visitors who expect instant interaction.

5. **What happens when no one is interacting?** Should the canvas auto-clear after N seconds of idle? Should there be a screensaver or attract mode? Should it show pre-drawn content?

6. **Should visitors be able to save their artwork?** If yes, what's the mechanism? (QR code, email, NFC card, print?)

### Model & Accuracy

7. **What is the acceptable misclassification rate?** In a museum, misclassifying "draw" as "erase" is very frustrating. Should we prioritize precision over recall for destructive gestures (erase, clear)?

8. **Are we willing to collect real training data?** This is the single biggest factor in classification accuracy. Even 30 minutes of recorded MediaPipe landmarks from 5-10 people would be transformative.

9. **Should the CNN be TemporalCNN (temporal) or MLP (frame-by-frame)?** The TemporalCNN uses 20 frames of history and is more accurate in theory, but has no training script and no weights. The MLP is simpler, has a training pipeline, but doesn't use temporal context.

### Operational

10. **Who maintains this installation?** The museum staff need a way to restart the system, diagnose issues, and update software. Is there a remote management interface?

11. **What's the expected uptime?** Should the app self-heal? Auto-restart browser on crash? Watchdog timer?

12. **Is there a content management need?** Should museum staff be able to change colors, stroke styles, or gesture mappings without code changes?

---

*End of Report*