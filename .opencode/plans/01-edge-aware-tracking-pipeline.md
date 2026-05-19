# Edge-Aware Tracking Pipeline — Full Implementation Plan

**Status:** Approved — Ready to execute
**Total:** 15 file modifications, 2 new files

---

## Phase 1: Foundation (types + constants)

### 1.1 `src/core/types.ts` — Add types

**After `FramebufferMetrics`, add:**

```typescript
export interface ConfidenceState {
  raw: number;
  smoothed: number;
  decayRate: number;
  lastUpdate: number;
  history: number[];
}

export interface CalibrationData {
  bottomEdgeOffset: number;
  perspectiveSkewX: number;
  perspectiveSkewY: number;
  cameraTilt: number;
  viewportAspectCorrection: number;
}

export interface DebugOverlayState {
  showConfidence: boolean;
  showEdgeZones: boolean;
  showSafeZone: boolean;
  showIntegrity: boolean;
  showCalibration: boolean;
  showFreezeState: boolean;
  showPrediction: boolean;
}

export const DEFAULT_CALIBRATION: CalibrationData = {
  bottomEdgeOffset: 0,
  perspectiveSkewX: 0,
  perspectiveSkewY: 0,
  cameraTilt: 0,
  viewportAspectCorrection: 1,
};
```

### 1.2 `src/core/constants.ts` — Add constant groups

**After `INTEGRITY` block, add:**

```typescript
export const CONFIDENCE = {
  SMOOTHING_ALPHA: 0.35,
  DECAY_RATE_PER_MS: 0.0003,
  GATE_THRESHOLD: 0.30,
  HIGH_CONFIDENCE: 0.70,
  HISTORY_SIZE: 10,
  FAST_DECAY_THRESHOLD: 0.03,
  FAST_DECAY_RATE: 0.0006,
} as const;

export const EDGE = {
  SAFE_MARGIN: 0.05,
  DAMPING_ZONE: 0.15,
  BOTTOM_EXTRA_MARGIN: 0.08,
  HIGH_DAMPING_THRESHOLD: 0.7,
  FULL_DAMPING: 0.2,
  GESTURE_SENSITIVITY_WEIGHT: 0.6,
  CURSOR_DAMPING_WEIGHT: 0.4,
  BOTTOM_CONFIDENCE_PENALTY: 0.15,
  EDGE_CONFIDENCE_FLOOR: 0.25,
} as const;

export const EXTRAPOLATION = {
  MAX_BLEND_FRAMES: 5,
  VELOCITY_DAMPING: 0.85,
  DRIFT_CAP: 0.03,
  RECOVERY_BLEND_ALPHA: 0.35,
  MAX_PREDICTION_SPEED: 0.008,
} as const;

export const CALIBRATION = {
  AUTO_CALIBRATION_FRAMES: 30,
  CALIBRATION_SAMPLE_INTERVAL_MS: 100,
  BOTTOM_EDGE_SAMPLES: 10,
  PERSPECTIVE_SAMPLE_REGIONS: 4,
  DEBUG_OVERLAY_OPACITY: 0.3,
} as const;
```

**Update the existing `EDGE` and `SAFE_ZONE` blocks to match the above** (replace existing with the consolidated `EDGE` above).

---

## Phase 2: New Tracking Subsystems

### 2.1 Create `src/tracking/ConfidenceTracker.ts`

```typescript
import { Handedness, ConfidenceState } from '../core/types';
import { CONFIDENCE } from '../core/constants';

export class ConfidenceTracker {
  private states = new Map<Handedness, ConfidenceState>();

  update(hand: Handedness, rawConfidence: number, now: number): number {
    let state = this.states.get(hand);
    if (!state) {
      state = {
        raw: rawConfidence,
        smoothed: rawConfidence,
        decayRate: CONFIDENCE.DECAY_RATE_PER_MS,
        lastUpdate: now,
        history: [rawConfidence],
      };
      this.states.set(hand, state);
      return rawConfidence;
    }

    const dt = Math.max(now - state.lastUpdate, 0);
    const decay = Math.max(0, 1 - state.decayRate * dt);

    // Detect jitter: if confidence fluctuates wildly, increase decay
    const prevAvg = state.history.reduce((a, b) => a + b, 0) / state.history.length;
    const jitter = Math.abs(rawConfidence - prevAvg);
    const adaptiveRate = jitter > CONFIDENCE.FAST_DECAY_THRESHOLD
      ? CONFIDENCE.FAST_DECAY_RATE
      : CONFIDENCE.DECAY_RATE_PER_MS;

    state.raw = rawConfidence;
    state.smoothed = state.smoothed * decay
      + CONFIDENCE.SMOOTHING_ALPHA * (rawConfidence * decay - state.smoothed * decay)
      + rawConfidence * (1 - decay);
    state.smoothed = Math.max(0, Math.min(1, state.smoothed));
    state.decayRate = adaptiveRate;
    state.lastUpdate = now;

    state.history.push(rawConfidence);
    if (state.history.length > CONFIDENCE.HISTORY_SIZE) {
      state.history.shift();
    }

    return state.smoothed;
  }

  getSmoothed(hand: Handedness): number {
    return this.states.get(hand)?.smoothed ?? 0;
  }

  getDecayedAt(hand: Handedness, elapsedMs: number): number {
    const state = this.states.get(hand);
    if (!state) return 0;
    const decay = Math.max(0, 1 - state.decayRate * elapsedMs);
    return state.smoothed * decay;
  }

  getHistory(hand: Handedness): number[] {
    return this.states.get(hand)?.history ?? [];
  }

  getStability(hand: Handedness): number {
    const hist = this.states.get(hand)?.history;
    if (!hist || hist.length < 3) return 0;
    let variance = 0;
    const mean = hist.reduce((a, b) => a + b, 0) / hist.length;
    for (const v of hist) variance += (v - mean) ** 2;
    variance /= hist.length;
    return Math.max(0, 1 - Math.min(variance * 5, 1));
  }

  reset(hand?: Handedness): void {
    if (hand) this.states.delete(hand);
    else this.states.clear();
  }
}
```

### 2.2 Create `src/tracking/ViewportCalibration.ts`

```typescript
import { CalibrationData, DEFAULT_CALIBRATION, HandSnapshot } from '../core/types';
import { CALIBRATION } from '../core/constants';
import { getLandmark } from '../utils/math';

export class ViewportCalibration {
  private data: CalibrationData;
  private bottomSamples: number[][] = [];
  private calibrationCount = 0;
  private calibrated = false;
  private autoCalibrating = false;

  constructor(initial?: Partial<CalibrationData>) {
    this.data = { ...DEFAULT_CALIBRATION, ...initial };
  }

  isCalibrated(): boolean {
    return this.calibrated;
  }

  getData(): CalibrationData {
    return { ...this.data };
  }

  sample(hands: HandSnapshot[]): void {
    if (this.calibrated) return;
    this.autoCalibrating = true;

    for (const hand of hands) {
      const wrist = getLandmark(hand.landmarks, 0);
      if (!wrist) continue;
      if (wrist[1] > 0.85) {
        this.bottomSamples.push([wrist[0], wrist[1]]);
      }
    }

    this.calibrationCount++;
    if (
      this.calibrationCount >= CALIBRATION.AUTO_CALIBRATION_FRAMES
      && this.bottomSamples.length >= CALIBRATION.BOTTOM_EDGE_SAMPLES
    ) {
      this.computeCalibration();
    }
  }

  private computeCalibration(): void {
    if (this.bottomSamples.length === 0) return;

    // Average bottom Y position to determine offset
    const avgY = this.bottomSamples.reduce((s, p) => s + p[1], 0)
      / this.bottomSamples.length;
    const offset = Math.max(0, avgY - 0.85);
    this.data.bottomEdgeOffset = offset;

    // Perspective skew: check if hand at bottom-left vs bottom-right differs in Y
    const leftSamples = this.bottomSamples.filter((p) => p[0] < 0.4);
    const rightSamples = this.bottomSamples.filter((p) => p[0] > 0.6);
    if (leftSamples.length > 2 && rightSamples.length > 2) {
      const leftAvgY = leftSamples.reduce((s, p) => s + p[1], 0) / leftSamples.length;
      const rightAvgY = rightSamples.reduce((s, p) => s + p[1], 0) / rightSamples.length;
      this.data.perspectiveSkewY = (rightAvgY - leftAvgY) * 0.5;
    }

    this.calibrated = true;
    this.autoCalibrating = false;
  }

  apply(rawX: number, rawY: number): { x: number; y: number } {
    if (!this.calibrated) return { x: rawX, y: rawY };

    // Bottom edge offset: push Y up slightly so bottom of frame maps better
    let y = rawY - this.data.bottomEdgeOffset * 0.3;

    // Perspective correction
    const skewFactor = (rawX - 0.5) * this.data.perspectiveSkewY;
    y += skewFactor;

    return {
      x: rawX + this.data.perspectiveSkewX * (rawY - 0.5),
      y: Math.max(0, Math.min(1, y)),
    };
  }

  getDebugOverlay(): { boundaryPoints: Array<{ x: number; y: number }> } | null {
    if (!this.calibrated) return null;
    return {
      boundaryPoints: [
        { x: 0, y: 1 - this.data.bottomEdgeOffset },
        { x: 1, y: 1 - this.data.bottomEdgeOffset - this.data.perspectiveSkewY },
      ],
    };
  }

  reset(): void {
    this.data = { ...DEFAULT_CALIBRATION };
    this.bottomSamples = [];
    this.calibrationCount = 0;
    this.calibrated = false;
    this.autoCalibrating = false;
  }
}
```

---

## Phase 3: Enhance Existing Tracking Subsystems

### 3.1 `src/tracking/EdgeProximityDetector.ts` — Replace entire file

```typescript
import { NUM_LANDMARKS } from '../core/types';
import { EDGE } from '../core/constants';
import { getLandmark } from '../utils/math';

export interface EdgeProximity {
  left: number;
  right: number;
  top: number;
  bottom: number;
  overall: number;
  dampingFactor: number;
  gestureSensitivity: number;
  cursorDamping: number;
  perEdgeConfidence: { left: number; right: number; top: number; bottom: number };
}

export class EdgeProximityDetector {
  private readonly dampingMargin: number;
  private readonly bottomExtraMargin: number;
  private readonly highDampingThreshold: number;
  private readonly fullDampingFactor: number;
  private readonly gestureWeight: number;
  private readonly cursorWeight: number;
  private readonly bottomConfidencePenalty: number;
  private readonly confidenceFloor: number;

  constructor(config?: {
    dampingMargin?: number;
    bottomExtraMargin?: number;
    highDampingThreshold?: number;
    fullDampingFactor?: number;
    gestureWeight?: number;
    cursorWeight?: number;
    bottomConfidencePenalty?: number;
    confidenceFloor?: number;
  }) {
    this.dampingMargin = config?.dampingMargin ?? EDGE.DAMPING_ZONE;
    this.bottomExtraMargin = config?.bottomExtraMargin ?? EDGE.BOTTOM_EXTRA_MARGIN;
    this.highDampingThreshold = config?.highDampingThreshold ?? EDGE.HIGH_DAMPING_THRESHOLD;
    this.fullDampingFactor = config?.fullDampingFactor ?? EDGE.FULL_DAMPING;
    this.gestureWeight = config?.gestureWeight ?? EDGE.GESTURE_SENSITIVITY_WEIGHT;
    this.cursorWeight = config?.cursorWeight ?? EDGE.CURSOR_DAMPING_WEIGHT;
    this.bottomConfidencePenalty = config?.bottomConfidencePenalty ?? EDGE.BOTTOM_CONFIDENCE_PENALTY;
    this.confidenceFloor = config?.confidenceFloor ?? EDGE.EDGE_CONFIDENCE_FLOOR;
  }

  compute(landmarks: Float32Array | null): EdgeProximity {
    if (!landmarks || landmarks.length < NUM_LANDMARKS * 3) {
      return this.zeroResult();
    }

    let minX = 1, maxX = 0, minY = 1, maxY = 0;
    let validCount = 0;

    for (let i = 0; i < NUM_LANDMARKS; i++) {
      const lm = getLandmark(landmarks, i);
      if (!lm) continue;
      const [x, y] = lm;
      if (Math.abs(x) < 0.001 && Math.abs(y) < 0.001) continue;
      if (x < 0 || x > 1 || y < 0 || y > 1) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      validCount++;
    }

    if (validCount < 3) return this.zeroResult();

    const bottomMargin = this.dampingMargin + this.bottomExtraMargin;

    const left = Math.max(0, 1 - minX / this.dampingMargin);
    const right = Math.max(0, 1 - (1 - maxX) / this.dampingMargin);
    const top = Math.max(0, 1 - minY / this.dampingMargin);
    const bottom = Math.max(0, 1 - (1 - maxY) / bottomMargin);

    const overall = Math.max(left, right, top, bottom);

    const dampingFactor = overall >= this.highDampingThreshold
      ? this.fullDampingFactor + (1 - this.fullDampingFactor) * (1 - (overall - this.highDampingThreshold) / (1 - this.highDampingThreshold))
      : 1 - (overall / this.highDampingThreshold) * (1 - 0.7);

    const clamped = Math.max(this.fullDampingFactor, Math.min(1, dampingFactor));

    // Gesture sensitivity is less affected by edge than cursor damping
    const gestureSensitivity = this.gestureWeight + (1 - this.gestureWeight) * clamped;
    const cursorDamping = this.cursorWeight + (1 - this.cursorWeight) * clamped;

    // Per-edge confidence weights
    const perEdgeConfidence = {
      left: Math.max(this.confidenceFloor, 1 - left * 0.6),
      right: Math.max(this.confidenceFloor, 1 - right * 0.6),
      top: Math.max(this.confidenceFloor, 1 - top * 0.6),
      bottom: Math.max(this.confidenceFloor, 1 - bottom * (0.6 + this.bottomConfidencePenalty)),
    };

    return {
      left: Math.min(1, left),
      right: Math.min(1, right),
      top: Math.min(1, top),
      bottom: Math.min(1, bottom),
      overall: Math.min(1, overall),
      dampingFactor: Math.round(clamped * 100) / 100,
      gestureSensitivity: Math.round(gestureSensitivity * 100) / 100,
      cursorDamping: Math.round(cursorDamping * 100) / 100,
      perEdgeConfidence,
    };
  }

  getNearestEdge(prox: EdgeProximity): 'left' | 'right' | 'top' | 'bottom' | 'none' {
    const max = Math.max(prox.left, prox.right, prox.top, prox.bottom);
    if (max < 0.1) return 'none';
    if (max === prox.left) return 'left';
    if (max === prox.right) return 'right';
    if (max === prox.top) return 'top';
    return 'bottom';
  }

  private zeroResult(): EdgeProximity {
    return {
      left: 0, right: 0, top: 0, bottom: 0, overall: 0,
      dampingFactor: 1, gestureSensitivity: 1, cursorDamping: 1,
      perEdgeConfidence: { left: 1, right: 1, top: 1, bottom: 1 },
    };
  }
}
```

### 3.2 `src/tracking/HandIntegrityValidator.ts` — Add methods

**After existing methods, add:**

```typescript
  getGestureSpecificScore(gesture: 'drawing' | 'cursor' | 'eraser', integrity: IntegrityResult): number {
    const group = integrity.requiredGroups[gesture];
    if (!group) return 0;

    let base = integrity.score;

    switch (gesture) {
      case 'drawing':
        // Drawing only needs index + wrist
        base = (integrity.wristVisible ? 0.4 : 0)
          + (integrity.individualFingers.index ? 0.4 : 0)
          + (integrity.palmIntact ? 0.2 : 0);
        break;
      case 'cursor':
        // Cursor needs index + middle + wrist
        base = (integrity.wristVisible ? 0.3 : 0)
          + (integrity.individualFingers.index ? 0.25 : 0)
          + (integrity.individualFingers.middle ? 0.25 : 0)
          + (integrity.palmIntact ? 0.2 : 0);
        break;
      case 'eraser':
        // Eraser needs ALL fingers + wrist
        base = (integrity.wristVisible ? 0.1 : 0)
          + (integrity.individualFingers.thumb ? 0.18 : 0)
          + (integrity.individualFingers.index ? 0.18 : 0)
          + (integrity.individualFingers.middle ? 0.18 : 0)
          + (integrity.individualFingers.ring ? 0.18 : 0)
          + (integrity.individualFingers.pinky ? 0.18 : 0);
        break;
    }

    return Math.max(0, Math.min(1, base));
  }

  completenessByRegion(landmarks: Float32Array): {
    topHalf: number; bottomHalf: number; leftHalf: number; rightHalf: number;
  } {
    let topCount = 0, bottomCount = 0, leftCount = 0, rightCount = 0;
    let topValid = 0, bottomValid = 0, leftValid = 0, rightValid = 0;

    for (let i = 0; i < NUM_LANDMARKS; i++) {
      const lm = getLandmark(landmarks, i);
      if (!lm) continue;
      const [x, y] = lm;
      const valid = !(Math.abs(x) < this.landmarkThreshold && Math.abs(y) < this.landmarkThreshold);
      if (y < 0.5) { topCount++; if (valid) topValid++; }
      else { bottomCount++; if (valid) bottomValid++; }
      if (x < 0.5) { leftCount++; if (valid) leftValid++; }
      else { rightCount++; if (valid) rightValid++; }
    }

    return {
      topHalf: topCount > 0 ? topValid / topCount : 0,
      bottomHalf: bottomCount > 0 ? bottomValid / bottomCount : 0,
      leftHalf: leftCount > 0 ? leftValid / leftCount : 0,
      rightHalf: rightCount > 0 ? rightValid / rightCount : 0,
    };
  }
```

### 3.3 `src/tracking/GestureFreezeController.ts` — Add blend + reason tracking

**In `FreezeState`, add `freezeReason: string` and `unfreezeReason: string` (already exists).**

**In `update()` method, change the freeze threshold logic:**

```typescript
  update(
    gesture: GestureType,
    confidence: number,
    integrity: IntegrityResult,
    edgeProx: EdgeProximity,
    now: number,
  ): FreezeState {
    const lowIntegrity = integrity.score < this.freezeIntegrityThreshold;
    const nearEdge = edgeProx.overall > this.freezeEdgeThreshold;
    const lowConfidence = confidence < 0.3;
    const shouldFreeze = lowIntegrity || nearEdge || lowConfidence;

    if (this.state.frozen) {
      const elapsed = now - this.state.freezeStartTime;

      if (elapsed > this.maxFreezeMs) {
        this.forceUnfreeze('max_duration');
        this.consecutiveStable = 0;
        return this.state;
      }

      const canUnfreeze = integrity.score >= this.unfreezeIntegrity
        && edgeProx.overall <= this.unfreezeEdge
        && confidence >= 0.35;

      if (canUnfreeze) {
        this.consecutiveStable++;
        if (this.consecutiveStable >= this.unfreezeConsecutive) {
          this.unfreezeBlendCounter = this.transitionBlendFrames;
          this.state.frozen = false;
          this.state.unfreezeReason = 'tracking_recovered';
          this.state.blendProgress = 0;
        }
      } else {
        this.consecutiveStable = 0;
      }

      if (this.state.frozen) {
        this.state.freezeDurationMs = elapsed;
      }

      return this.state;
    }

    if (gesture !== 'idle' && shouldFreeze) {
      this.state.frozen = true;
      this.state.lastStableGesture = gesture;
      this.state.lastStableConfidence = confidence;
      this.state.freezeStartTime = now;
      this.state.freezeDurationMs = 0;
      this.state.freezeCount++;
      this.state.blendProgress = 0;
      this.state.unfreezeReason = '';

      if (lowIntegrity) this.state.freezeReason = 'low_integrity';
      else if (nearEdge) this.state.freezeReason = 'edge_proximity';
      else if (lowConfidence) this.state.freezeReason = 'low_confidence';
      else this.state.freezeReason = 'unknown';

      this.consecutiveStable = 0;
    }

    return this.state;
  }

  getFreezeReason(): string {
    return this.state.freezeReason;
  }
```

### 3.4 `src/tracking/SafeInteractionZoneMapper.ts` — Replace with sigmoid-based

```typescript
import { SAFE_ZONE } from '../core/constants';

export interface SafeZoneResult {
  stabilizedX: number;
  stabilizedY: number;
  rawX: number;
  rawY: number;
  dampingApplied: boolean;
  isInSafeZone: boolean;
  edgeFalloff: { x: number; y: number };
}

export class SafeInteractionZoneMapper {
  private readonly innerXMin: number;
  private readonly innerXMax: number;
  private readonly innerYMin: number;
  private readonly innerYMax: number;
  private readonly compressionStrength: number;
  private readonly bottomCompression: number;
  private readonly sigmoidSteepness: number;

  constructor(config?: {
    innerXMin?: number;
    innerXMax?: number;
    innerYMin?: number;
    innerYMax?: number;
    compressionStrength?: number;
    bottomCompression?: number;
    sigmoidSteepness?: number;
  }) {
    this.innerXMin = config?.innerXMin ?? SAFE_ZONE.INNER_X_MIN;
    this.innerXMax = config?.innerXMax ?? SAFE_ZONE.INNER_X_MAX;
    this.innerYMin = config?.innerYMin ?? SAFE_ZONE.INNER_Y_MIN;
    this.innerYMax = config?.innerYMax ?? SAFE_ZONE.INNER_Y_MAX;
    this.compressionStrength = config?.compressionStrength ?? SAFE_ZONE.COMPRESSION_STRENGTH;
    this.bottomCompression = config?.bottomCompression ?? SAFE_ZONE.BOTTOM_COMPRESSION;
    this.sigmoidSteepness = config?.sigmoidSteepness ?? 4;
  }

  map(rawX: number, rawY: number): SafeZoneResult {
    const isInSafeZone = rawX >= this.innerXMin && rawX <= this.innerXMax
      && rawY >= this.innerYMin && rawY <= this.innerYMax;

    const stabilizedX = this.sigmoidCompress(rawX, this.innerXMin, this.innerXMax, this.compressionStrength);
    const stabilizedY = this.sigmoidCompress(rawY, this.innerYMin, this.innerYMax, this.bottomCompression);

    const edgeFalloff = {
      x: this.computeEdgeFalloff(rawX, this.innerXMin, this.innerXMax),
      y: this.computeEdgeFalloff(rawY, this.innerYMin, this.innerYMax),
    };

    const dampingApplied = stabilizedX !== rawX || stabilizedY !== rawY;

    return {
      stabilizedX, stabilizedY, rawX, rawY,
      dampingApplied, isInSafeZone, edgeFalloff,
    };
  }

  private sigmoidCompress(value: number, innerMin: number, innerMax: number, strength: number): number {
    const innerWidth = innerMax - innerMin;

    if (value >= innerMin && value <= innerMax) {
      return value;
    }

    // Outside safe zone: apply smooth sigmoid compression
    if (value < innerMin) {
      const t = (innerMin - value) / innerMin;
      const compression = this.smoothstep(t) * strength;
      return innerMin - t * innerMin * compression;
    }

    // value > innerMax
    const outerRight = 1 - innerMax;
    const t = (value - innerMax) / outerRight;
    const compression = this.smoothstep(t) * strength;
    return innerMax + t * outerRight * (1 - compression);
  }

  private smoothstep(t: number): number {
    t = Math.max(0, Math.min(1, t));
    return t * t * (3 - 2 * t);
  }

  private computeEdgeFalloff(value: number, innerMin: number, innerMax: number): number {
    if (value < innerMin) {
      return 1 - Math.max(0, Math.min(1, (innerMin - value) / innerMin));
    }
    if (value > innerMax) {
      return 1 - Math.max(0, Math.min(1, (value - innerMax) / (1 - innerMax)));
    }
    return 1;
  }
}
```

### 3.5 `src/model/OcclusionRecovery.ts` — Add recovery blending + velocity damping

**After `extrapolatePose`, add:**

```typescript
  blendWithRecovery(
    hand: Handedness,
    rawLandmarks: Float32Array,
    rawConfidence: number,
    now: number,
  ): Float32Array {
    const memory = this.poseMemory.get(hand);
    if (!memory || memory.length === 0 || rawConfidence >= 0.5) {
      return rawLandmarks;
    }

    const lastStable = memory[memory.length - 1];
    const elapsed = now - lastStable.timestamp;
    const blendAlpha = Math.max(0, Math.min(1, elapsed / this.maxExtrapolationMs));

    // Blend: more extrapolation = more weight on raw
    const result = new Float32Array(LANDMARKS_FLOAT_SIZE);
    for (let i = 0; i < LANDMARKS_FLOAT_SIZE; i++) {
      result[i] = rawLandmarks[i] * blendAlpha + lastStable.landmarks[i] * (1 - blendAlpha);
    }

    return result;
  }

  private readonly velocityDamping = 0.85;
  private readonly driftCap = 0.03;

  // Override/extend the extrapolatePose method to add velocity damping:
  // In the extrapolatePose method, after line:
  //   extrapolated[i] = lastFrame.landmarks[i] + velocity[i] * t;
  // Add velocity damping:
  //   extrapolated[i] = lastFrame.landmarks[i] + Math.min(velocity[i] * t, this.driftCap);
  // And multiply each velocity element by velocityDamping after use.
```

**Replace `extrapolatePose` method:**

```typescript
  private extrapolatePose(hand: Handedness, lastFrame: PoseFrame, elapsed: number, now: number): PoseFrame {
    const extrapolated = new Float32Array(LANDMARKS_FLOAT_SIZE);
    const t = Math.min(elapsed / 1000, 0.3);

    let velocity: Float32Array;
    if (lastFrame.velocity && lastFrame.velocity.length === LANDMARKS_FLOAT_SIZE) {
      velocity = lastFrame.velocity;
    } else {
      velocity = new Float32Array(LANDMARKS_FLOAT_SIZE);
    }

    // Apply velocity damping to prevent drift
    const dampedVelocity = new Float32Array(LANDMARKS_FLOAT_SIZE);
    for (let i = 0; i < LANDMARKS_FLOAT_SIZE; i++) {
      dampedVelocity[i] = velocity[i] * this.velocityDamping;
    }

    for (let i = 0; i < LANDMARKS_FLOAT_SIZE; i++) {
      const displacement = dampedVelocity[i] * t;
      extrapolated[i] = lastFrame.landmarks[i] + Math.max(-this.driftCap, Math.min(this.driftCap, displacement));
    }

    return {
      landmarks: extrapolated,
      timestamp: now,
      confidence: lastFrame.confidence * 0.8,
      velocity: dampedVelocity,
    };
  }
```

### 3.6 `src/utils/PredictiveCursor.ts` — Add decay + confidence

**Add `predictionConfidence` property and decay logic:**

```typescript
  private predictionConfidence = 0;

  // In update():
  // After computing predictions, also set:
  //   this.predictionConfidence = Math.min(1, speed / (speed + 0.01));

  // Add new method:
  getPredictionConfidence(): number {
    return this.predictionConfidence;
  }

  getDecayedPosition(decayFactor: number): { x: number; y: number } {
    const current = this.getCurrent();
    if (!current) return { x: 0.5, y: 0.5 };
    // Decay toward screen center when tracking is lost
    const centerX = 0.5, centerY = 0.5;
    return {
      x: current.x + (centerX - current.x) * (1 - decayFactor),
      y: current.y + (centerY - current.y) * (1 - decayFactor),
    };
  }

  reset(): void {
    this.history = [];
    this.smoothedX = 0;
    this.smoothedY = 0;
    this.velocityX = 0;
    this.velocityY = 0;
    this.predictionConfidence = 0; // ADD THIS LINE
  }
```

---

## Phase 4: GestureClassifier Rewrite

### 4.1 `src/model/GestureClassifier.ts` — Major changes

**Replace the `process()` method:**
- Integrate `ConfidenceTracker`
- Fix conflict between `heuristicDetect` and `edgeAwareHeuristicDetect`
- Pass actual gesture to freeze controller

```typescript
// Add imports:
import { ConfidenceTracker } from '../tracking/ConfidenceTracker';

// Add to constructor:
private confidenceTracker: ConfidenceTracker;

constructor() {
  // ... existing code ...
  this.confidenceTracker = new ConfidenceTracker();
}

initialize(): void {
  // ... existing code ...
  this.confidenceTracker.reset(); // ADD
}

// Replace process() method with confidence-gated version:

  process(
    hands: HandSnapshot[],
    now: number,
    integrity?: HandIntegrity | null,
    edgeProx?: EdgeProximityInfo | null,
    freezeState?: GestureFreezeState | null,
  ): GesturePipelineResult {
    const events: GestureEvent[] = [];
    const handStates = new Map<Handedness, { ... }>();
    // ... existing debug vars ...

    for (const hand of hands) {
      const rawLandmarks = hand.landmarks;

      // Step 1: Occlusion recovery
      const occlusionResult = this.occlusionRecovery.recover(
        hand.handedness, rawLandmarks, hand.confidence, now,
      );

      if (!occlusionResult.recovered) {
        this.occlusionRecovery.recordPose(
          hand.handedness, occlusionResult.landmarks, occlusionResult.confidence, now,
        );
      }

      // Step 2: Normalize landmarks
      const norm = this.normalizer.normalize(
        occlusionResult.landmarks, hand.handedness, occlusionResult.confidence, now,
      );

      // Step 3: Extract features
      const features = this.featureExtractor.extract(norm, now);
      debugFeatures = features;
      const speed = features.speed;
      debugMotionSpeed = speed;

      // Step 4: Update adaptive systems
      this.adaptiveThresholds.updateMotionSpeed(hand.handedness, speed, now);
      const stability = this.occlusionRecovery.getTrackingStability(hand.handedness);
      this.adaptiveThresholds.updateTrackingStability(hand.handedness, stability);
      debugTrackingStability = stability;

      // Step 5: Confidence gating
      const smoothedConfidence = this.confidenceTracker.update(
        hand.handedness, hand.confidence, now,
      );
      const edgeDamping = edgeProx?.dampingFactor ?? 1;
      const integrityScore = integrity?.score ?? 1;
      const gestureSpecificScore = integrity
        ? this.getBestGestureScore(integrity, hand.handedness, features)
        : 1;

      // Step 6: Gate — if confidence is too low, preserve previous state
      const effectiveConfidence = smoothedConfidence * (0.3 + 0.7 * gestureSpecificScore);
      const confidenceGate = effectiveConfidence >= CONFIDENCE.GATE_THRESHOLD;

      let heuristicGesture: GestureType | null = null;
      let heuristicConfidence = 0;

      if (confidenceGate) {
        heuristicGesture = this.edgeAwareHeuristicDetect(
          features, speed, integrity, edgeProx, freezeState,
        );
        if (heuristicGesture) {
          const rawConf = this.computeConfidence(heuristicGesture, features, speed);
          heuristicConfidence = rawConf * (0.5 + 0.5 * edgeDamping) * (0.5 + 0.5 * smoothedConfidence);
        }
      }

      // Step 7: Apply freeze override
      const gestureOverride = freezeState?.frozen ? freezeState.lastStableGesture : null;
      const selectedGesture = gestureOverride ?? heuristicGesture ?? 'idle';
      const selectedConfidence = gestureOverride
        ? Math.max(freezeState!.blendProgress * 0.5, heuristicConfidence * 0.3)
        : heuristicConfidence;

      // Step 8: Dynamic threshold
      const dynamicThreshold = this.adaptiveThresholds.getThreshold(
        hand.handedness, selectedGesture,
      );
      debugDynamicThreshold = dynamicThreshold;
      this.adaptiveThresholds.updateConfidence(hand.handedness, selectedConfidence);
      debugIntentScore = selectedConfidence;

      // Step 9: State machine
      const sm = this.getOrCreateState(hand.handedness);
      const gestureChanged = sm.current !== selectedGesture;

      const edgePenalty = edgeDamping < 0.6 ? 2 : 0;
      const integrityPenalty = integrityScore < 0.6 ? 3 : 0;
      const confidencePenalty = smoothedConfidence < 0.5 ? 1 : 0;
      const extraFrames = edgePenalty + integrityPenalty + confidencePenalty;

      this.updateStateMachine(sm, selectedGesture, selectedConfidence, now, extraFrames);

      // Step 10: Cooldown with edge-aware extension
      const cooldownKey = `${hand.handedness}:${selectedGesture}`;
      const lastFired = this.gestureCooldowns.get(cooldownKey) ?? 0;
      let shouldEmitEvent = false;

      if (sm.current === selectedGesture && sm.current !== sm.lastChange) {
        sm.lastChange = sm.current;
      }
      if (selectedGesture !== 'idle' && gestureChanged && !freezeState?.frozen) {
        const effectiveCooldown = GESTURE.COOLDOWN_MS
          + (edgeDamping < 0.6 ? 100 : 0)
          + (integrityScore < 0.6 ? 150 : 0)
          + (smoothedConfidence < 0.5 ? 80 : 0);
        if (now - lastFired >= effectiveCooldown) {
          shouldEmitEvent = true;
          this.gestureCooldowns.set(cooldownKey, now);
        }
      }

      // Step 11: Gesture persistence — if drawing and partial, keep drawing
      const finalGesture = freezeState?.frozen
        ? freezeState.lastStableGesture
        : (confidenceGate ? sm.current : (sm.current !== 'idle' ? sm.current : 'idle'));
      const finalConfidence = freezeState?.frozen
        ? Math.max(freezeState.blendProgress * 0.5, selectedConfidence * 0.3)
        : selectedConfidence;

      handStates.set(hand.handedness, {
        gesture: finalGesture,
        confidence: finalConfidence,
        stableCount: sm.stableCount,
        intentScore: debugIntentScore,
      });

      if (shouldEmitEvent && finalGesture !== 'idle') {
        events.push({
          type: finalGesture,
          hand: hand.handedness,
          confidence: finalConfidence,
          timestamp: now,
          data: { dynamicThreshold, trackingStability: stability, smoothedConfidence },
        });
      }
    }

    // ... return ...
  }

  // Add new helper:
  private getBestGestureScore(
    integrity: HandIntegrity,
    hand: Handedness,
    _features: HandFeatures,
  ): number {
    // Use the HandIntegrityValidator's gesture-specific score logic
    // This checks which gesture is most viable given current hand visibility
    const fingerCount = Object.values(integrity.individualFingers).filter(Boolean).length;
    if (fingerCount >= 4 && integrity.wristVisible) return 1;
    if (fingerCount >= 2 && integrity.wristVisible) return 0.8;
    if (fingerCount >= 1) return 0.5;
    return 0.2;
  }
```

**Fix `edgeAwareHeuristicDetect` to use `perEdgeConfidence`:**

```typescript
  edgeAwareHeuristicDetect(
    features: HandFeatures,
    motionSpeed: number,
    integrity: HandIntegrity | null | undefined,
    edgeProx: EdgeProximityInfo | null | undefined,
    freezeState: GestureFreezeState | null | undefined,
  ): GestureType | null {
    if (freezeState?.frozen) return null;

    const o = features.fingerOpenness;
    const edgeDamping = edgeProx?.dampingFactor ?? 1;
    const integrityScore = integrity?.score ?? 1;

    // Use per-edge confidence if available (lower = more conservative)
    const minEdgeConf = edgeProx
      ? Math.min(
          edgeProx.perEdgeConfidence?.left ?? 1,
          edgeProx.perEdgeConfidence?.right ?? 1,
          edgeProx.perEdgeConfidence?.top ?? 1,
          edgeProx.perEdgeConfidence?.bottom ?? 1,
        )
      : 1;

    // Combined damping: edge proximity + per-edge confidence
    const effectiveDamping = edgeDamping * minEdgeConf;

    // More conservative thresholds near edges
    const edgePremium = 1 - effectiveDamping;

    const drawingOpennessThreshold = 0.35 + edgePremium * 0.15;
    const drawingDominanceThreshold = 0.25 + edgePremium * 0.10;
    const cursorOpennessThreshold = 0.30 + edgePremium * 0.12;
    const cursorDominanceThreshold = 0.20 + edgePremium * 0.08;
    const eraserMinOpenness = 0.35 + edgePremium * 0.15;
    const eraserRatioThreshold = 0.40 + edgePremium * 0.12;

    if (integrityScore < 0.3) return null;

    // Drawing check
    if (o.index >= drawingOpennessThreshold) {
      const othersMax = Math.max(o.thumb, o.middle, o.ring, o.pinky);
      if (o.index - othersMax >= drawingDominanceThreshold) {
        if (!integrity || integrity.requiredGroups.drawing) return 'drawing';
      }
    }

    // Cursor check
    if (o.index >= cursorOpennessThreshold && o.middle >= cursorOpennessThreshold) {
      const curledMax = Math.max(o.ring, o.pinky);
      if (o.middle - curledMax >= cursorDominanceThreshold) {
        if (!integrity || integrity.requiredGroups.cursor) return 'cursor';
      }
    }

    // Eraser check — requires HIGH confidence near edges
    const minOpen = Math.min(o.thumb, o.index, o.middle, o.ring, o.pinky);
    const maxOpen = Math.max(o.thumb, o.index, o.middle, o.ring, o.pinky);
    if (minOpen >= eraserMinOpenness && maxOpen > 0 && (minOpen / maxOpen) >= eraserRatioThreshold) {
      // Near edges: require extra confidence for eraser (dangerous mode)
      if (edgePremium > 0.3 && integrityScore < 0.7) return null;
      if (!integrity || integrity.requiredGroups.eraser) return 'eraser';
    }

    return null;
  }
```

---

## Phase 5: Engine.ts — Critical Integration Fix

### 5.1 `src/core/Engine.ts` — The BIG fix

**The critical bug is on this line in `processTracking()`:**

```typescript
// BUG: Always passes 'idle' and 0 confidence → freeze NEVER triggers
const freezeState = this.freezeController.update(
  'idle', 0, integrity ?? this.zeroIntegrity(), edgeProx ?? this.zeroEdgeProx(), now,
);
```

**Fix: Pass actual gesture and confidence:**

```typescript
// FIX: First call gesture recognizer, THEN pass result to freeze controller
if (hands.length > 0) {
  // ... existing integrity/edge computation ...

  // Run gesture recognition FIRST
  const t2 = performance.now();
  const result = this.gesture.recognize(hands, now, integrity, edgeProx, null); // null = no freeze yet
  this._stats.gestureMs = performance.now() - t2;

  // Get primary gesture from result
  let primaryGesture: GestureType = 'idle';
  let primaryConfidence = 0;
  let primaryHandedness: Handedness = 'Right';
  for (const [hand, state] of result.handStates) {
    if (state.confidence > primaryConfidence) {
      primaryGesture = state.gesture;
      primaryConfidence = state.confidence;
      primaryHandedness = hand;
    }
  }

  // NOW pass actual gesture + confidence to freeze controller
  const freezeState = this.freezeController.update(
    primaryGesture, primaryConfidence,
    integrity ?? this.zeroIntegrity(),
    edgeProx ?? this.zeroEdgeProx(), now,
  );

  // Re-run gesture with freeze state if frozen
  const finalResult = freezeState.frozen
    ? this.gesture.recognize(hands, now, integrity, edgeProx, freezeState)
    : result;

  // ... rest of processing with finalResult ...
}
```

**Also fix cursor handling during freeze:**

```typescript
  // In updateCursor(), after safe zone mapping, add:
  
  // During freeze, use predictive cursor with decay
  if (this.lastFreezeState?.frozen && !idxTip) {
    const predicted = this.predictiveCursor.getCurrent();
    if (predicted) {
      const decay = Math.max(0.5, 1 - (this.lastFreezeState.freezeDurationMs / FREEZE.MAX_FREEZE_MS) * 0.5);
      const decayed = this.predictiveCursor.getDecayedPosition(decay);
      this.cursorState.targetX = decayed.x;
      this.cursorState.targetY = decayed.y;
    }
  }
```

**Add `ConfidenceTracker` import and instance:**

```typescript
import { ConfidenceTracker } from '../tracking/ConfidenceTracker';

// Add to constructor:
private confidenceTracker: ConfidenceTracker;

constructor(config: EngineConfig) {
  // ... existing ...
  this.confidenceTracker = new ConfidenceTracker();
}
```

---

## Phase 6: Debug Visualization

### 6.1 `src/ui/components/HandDebugOverlay.tsx` — Add zones

**After existing hand skeleton rendering, add:**

```tsx
// Add safe zone and edge proximity visualization when debug is on
const showDebug = useStore((s) => s.showDebug);
const gestureDebug = useStore((s) => s.gestureDebug);

// Inside SVG, after hands.map():
{showDebug && gestureDebug && (
  <>
    {/* Safe zone boundary */}
    <rect
      x={0.15} y={0.15}
      width={0.70} height={0.70}
      fill="none"
      stroke="rgba(0,255,100,0.3)"
      strokeWidth={0.005}
      strokeDasharray="0.01 0.01"
      vectorEffect="non-scaling-stroke"
    />
    {/* Edge proximity zones */}
    <rect x={0} y={0} width={0.15} height={1}
      fill={`rgba(255,100,0,${gestureDebug.edgeProximity * 0.15})`} />
    <rect x={0.85} y={0} width={0.15} height={1}
      fill={`rgba(255,100,0,${gestureDebug.edgeProximity * 0.15})`} />
    <rect x={0} y={0} width={1} height={0.15}
      fill={`rgba(255,100,0,${gestureDebug.edgeProximity * 0.15})`} />
    <rect x={0} y={0.85} width={1} height={0.15}
      fill={`rgba(255,100,0,${gestureDebug.edgeProximity * 0.2})`} />
  </>
)}
```

### 6.2 `src/ui/components/debug/TemporalDebugPanel.tsx` — Enhanced sections

```tsx
// Add after existing freeze display:
{gestureDebug && (
  <>
    {/* Freeze details */}
    {gestureDebug.gestureFrozen && (
      <div style={{ color: '#ffd43b' }}>
        FREEZE: {gestureDebug.freezeActive ? 'active' : 'inactive'}
      </div>
    )}
    
    {/* Per-edge proximity if available */}
    {gestureDebug.edgeProximity > 0.1 && (
      <div style={{ color: '#888', fontSize: 10 }}>
        Edge: {(gestureDebug.edgeProximity * 100).toFixed(0)}%
      </div>
    )}

    {/* Hand completeness */}
    <div style={{ color: '#888' }}>
      Hand: {(gestureDebug.handIntegrity * 100).toFixed(0)}% complete
    </div>

    {/* Prediction status */}
    {gestureDebug.predictionActive && (
      <div style={{ color: '#0ff' }}>PREDICTING</div>
    )}
  </>
)}
```

---

## Phase 7: Store Alignment

### 7.1 `src/store/useStore.ts` — Add new fields

**After existing fields:**

```typescript
  // New debug fields
  trackingConfidence: number;
  freezeReason: string;
  completenessScore: number;
  calibrationActive: boolean;

  // New setters
  setTrackingConfidence: (confidence: number) => void;
  setFreezeReason: (reason: string) => void;
  setCompletenessScore: (score: number) => void;
  setCalibrationActive: (active: boolean) => void;
```

**Initial values:**

```typescript
  trackingConfidence: 0,
  freezeReason: '',
  completenessScore: 0,
  calibrationActive: false,
```

**Setters:**

```typescript
  setTrackingConfidence: (trackingConfidence) => set({ trackingConfidence }),
  setFreezeReason: (freezeReason) => set({ freezeReason }),
  setCompletenessScore: (completenessScore) => set({ completenessScore }),
  setCalibrationActive: (calibrationActive) => set({ calibrationActive }),
```

**In `setGestureDebug`, ensure debug info includes new fields (update the type if needed).**

---

## Phase 8: Final Verification

### 8.1 Type check

```bash
npm run typecheck
```

### 8.2 Update `ENGINEERING_AUDIT.md`

Add a new section documenting the edge-aware tracking pipeline:

```markdown
## 13. EDGE-AWARE TRACKING PIPELINE (2026-05-19)

### Added Systems

| Component | Lines | Purpose |
|---|---|---|
| `ConfidenceTracker.ts` | ~80 | Smoothed confidence gating with adaptive decay |
| `ViewportCalibration.ts` | ~120 | Auto-calibration for bottom edge / perspective |
| EdgeProximityDetector (enhanced) | +20 | Per-edge confidence weights, gesture sensitivity |
| HandIntegrityValidator (enhanced) | +40 | Gesture-specific scoring, region completeness |
| GestureFreezeController (fixed) | +10 | Now receives actual gesture (not 'idle') |
| SafeInteractionZoneMapper (enhanced) | +30 | Sigmoid falloff, smooth edge mapping |
| OcclusionRecovery (enhanced) | +20 | Recovery blending, velocity damping |
| PredictiveCursor (enhanced) | +15 | Prediction confidence, center decay |
| GestureClassifier (rewritten) | +80 | Confidence gating, edge-aware thresholds |

### Key Fixes
1. **Critical Bug:** GestureFreezeController received `'idle'` + `0` confidence → freeze never activated
2. **Integration:** Gesture recognition now runs BEFORE freeze decision
3. **Philosophy:** Low tracking confidence → more conservative, not more reactive
```

---

## Execution Order

| Step | File | Action |
|------|------|--------|
| 1 | `src/core/types.ts` | Add types |
| 2 | `src/core/constants.ts` | Add constants |
| 3 | `src/tracking/ConfidenceTracker.ts` | CREATE |
| 4 | `src/tracking/ViewportCalibration.ts` | CREATE |
| 5 | `src/tracking/EdgeProximityDetector.ts` | REPLACE |
| 6 | `src/tracking/HandIntegrityValidator.ts` | ADD methods |
| 7 | `src/tracking/GestureFreezeController.ts` | MODIFY |
| 8 | `src/tracking/SafeInteractionZoneMapper.ts` | REPLACE |
| 9 | `src/model/OcclusionRecovery.ts` | MODIFY |
| 10 | `src/utils/PredictiveCursor.ts` | ADD methods |
| 11 | `src/model/GestureClassifier.ts` | REWRITE process() |
| 12 | `src/core/Engine.ts` | FIX freeze integration |
| 13 | `src/ui/components/HandDebugOverlay.tsx` | ENHANCE |
| 14 | `src/ui/components/debug/TemporalDebugPanel.tsx` | ENHANCE |
| 15 | `src/store/useStore.ts` | ADD fields |
| 16 | `npm run typecheck` | VERIFY |
| 17 | `ENGINEERING_AUDIT.md` | UPDATE |
