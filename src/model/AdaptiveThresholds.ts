import { GestureType, Handedness } from '../core/types';

export interface AdaptiveConfig {
  historySize: number;
  baseConfidenceThreshold: number;
  speedAdaptationRate: number;
  stabilityAdaptationRate: number;
  confidenceFloor: number;
  confidenceCeiling: number;
  fastMotionThreshold: number;
  slowMotionThreshold: number;
}

const DEFAULT_ADAPTIVE_CONFIG: AdaptiveConfig = {
  historySize: 30,
  baseConfidenceThreshold: 0.45,
  speedAdaptationRate: 0.15,
  stabilityAdaptationRate: 0.20,
  confidenceFloor: 0.15,
  confidenceCeiling: 0.85,
  fastMotionThreshold: 0.08,
  slowMotionThreshold: 0.015,
};

interface HandAdaptiveState {
  motionHistory: number[];
  confidenceHistory: number[];
  currentSpeed: number;
  currentStability: number;
  thresholdCache: Map<string, number>;
  lastUpdate: number;
}

export class AdaptiveThresholds {
  private config: AdaptiveConfig;
  private states = new Map<Handedness, HandAdaptiveState>();

  constructor(config?: Partial<AdaptiveConfig>) {
    this.config = { ...DEFAULT_ADAPTIVE_CONFIG, ...config };
  }

  updateMotionSpeed(hand: Handedness, speed: number, now: number): void {
    const state = this.getOrCreateState(hand);
    state.motionHistory.push(speed);
    if (state.motionHistory.length > this.config.historySize) {
      state.motionHistory.shift();
    }

    state.currentSpeed = speed;
    state.lastUpdate = now;
    state.thresholdCache.clear();
  }

  updateTrackingStability(hand: Handedness, stability: number): void {
    const state = this.getOrCreateState(hand);
    state.currentStability = stability;
    state.thresholdCache.clear();
  }

  updateConfidence(hand: Handedness, confidence: number): void {
    const state = this.getOrCreateState(hand);
    state.confidenceHistory.push(confidence);
    if (state.confidenceHistory.length > this.config.historySize) {
      state.confidenceHistory.shift();
    }
  }

  getThreshold(hand: Handedness, gesture: GestureType, baseThreshold?: number): number {
    const state = this.getOrCreateState(hand);
    const key = `${gesture}`;

    const cached = state.thresholdCache.get(key);
    if (cached !== undefined) return cached;

    const base = baseThreshold ?? this.config.baseConfidenceThreshold;
    const speed = state.currentSpeed;
    const stability = state.currentStability;

    let threshold = base;

    const speedFactor = (speed - this.config.slowMotionThreshold) /
      (this.config.fastMotionThreshold - this.config.slowMotionThreshold);
    const clampedSpeedFactor = Math.max(-1, Math.min(1, speedFactor));

    threshold += clampedSpeedFactor * this.config.speedAdaptationRate;

    threshold -= stability * this.config.stabilityAdaptationRate;

    switch (gesture) {
      case 'drawing':
        threshold -= 0.05;
        break;
      case 'eraser':
        threshold += 0.10;
        break;
      case 'cursor':
        threshold += 0.02;
        break;
    }
    if (speed < this.config.slowMotionThreshold) {
      threshold -= 0.04;
    }

    const result = Math.max(this.config.confidenceFloor, Math.min(this.config.confidenceCeiling, threshold));
    state.thresholdCache.set(key, result);
    return result;
  }

  getActivationFrames(hand: Handedness, gesture: GestureType): number {
    const state = this.getOrCreateState(hand);
    const speed = state.currentSpeed;
    const stability = state.currentStability;
    let frames = 5;

    if (gesture === 'eraser') {
      frames += 3;
    }
    if (speed > this.config.fastMotionThreshold) {
      frames += 2;
    }
    if (stability < 0.4) {
      frames += 2;
    }

    return Math.min(frames, 15);
  }

  getAverageMotion(hand: Handedness): number {
    const state = this.states.get(hand);
    if (!state || state.motionHistory.length === 0) return 0;
    return state.motionHistory.reduce((a, b) => a + b, 0) / state.motionHistory.length;
  }

  getConfidenceVariance(hand: Handedness): number {
    const state = this.states.get(hand);
    if (!state || state.confidenceHistory.length < 2) return 0;
    const mean = state.confidenceHistory.reduce((a, b) => a + b, 0) / state.confidenceHistory.length;
    const variance = state.confidenceHistory.reduce((sum, v) => sum + (v - mean) ** 2, 0) / state.confidenceHistory.length;
    return variance;
  }

  isFastMotion(hand: Handedness): boolean {
    return this.getAverageMotion(hand) > this.config.fastMotionThreshold;
  }

  isStable(hand: Handedness): boolean {
    return this.getOrCreateState(hand).currentStability > 0.6;
  }

  private getOrCreateState(hand: Handedness): HandAdaptiveState {
    let state = this.states.get(hand);
    if (!state) {
      state = {
        motionHistory: [],
        confidenceHistory: [],
        currentSpeed: 0,
        currentStability: 1,
        thresholdCache: new Map(),
        lastUpdate: 0,
      };
      this.states.set(hand, state);
    }
    return state;
  }

  reset(hand?: Handedness): void {
    if (hand) {
      this.states.delete(hand);
    } else {
      this.states.clear();
    }
  }

  destroy(): void {
    this.reset();
  }
}
