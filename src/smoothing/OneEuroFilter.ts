import { FilterConfig, OneEuroFilterState } from './types';
import { SMOOTHING } from '../core/constants';

export class OneEuroFilter {
  private states = new Map<string, Map<string, OneEuroFilterState>>();
  private config: FilterConfig;

  constructor(config?: Partial<FilterConfig>) {
    this.config = {
      minCutoff: config?.minCutoff ?? SMOOTHING.MIN_CUTOFF,
      beta: config?.beta ?? SMOOTHING.BETA,
      dCutoff: config?.dCutoff ?? SMOOTHING.D_CUTOFF,
    };
  }

  private getState(handId: string, landmarkIndex: number, axis: 'x' | 'y' | 'z'): OneEuroFilterState {
    let handStates = this.states.get(handId);
    if (!handStates) {
      handStates = new Map();
      this.states.set(handId, handStates);
    }
    const key = `${landmarkIndex}:${axis}`;
    let state = handStates.get(key);
    if (!state) {
      state = {
        prevValue: 0,
        prevDerivative: 0,
        prevTimestamp: 0,
        initialized: false,
      };
      handStates.set(key, state);
    }
    return state;
  }

  private smoothingFactor(cutoff: number, delta: number): number {
    const r = 2 * Math.PI * cutoff * delta;
    return r / (r + 1);
  }

  private exponentialSmoothing(value: number, prevValue: number, factor: number): number {
    return prevValue + factor * (value - prevValue);
  }

  filter(
    handId: string,
    landmarkIndex: number,
    axis: 'x' | 'y' | 'z',
    value: number,
    timestamp: number,
  ): number {
    const state = this.getState(handId, landmarkIndex, axis);
    const delta = state.initialized
      ? Math.max(timestamp - state.prevTimestamp, 0.0001)
      : 1 / 60;

    const cutoff = this.config.minCutoff + this.config.beta * Math.abs(state.prevDerivative);
    const alpha = this.smoothingFactor(cutoff, delta);
    const smoothed = this.exponentialSmoothing(value, state.prevValue, alpha);

    const derivative = (smoothed - state.prevValue) / delta;
    const dAlpha = this.smoothingFactor(this.config.dCutoff, delta);
    const smoothedDerivative = this.exponentialSmoothing(derivative, state.prevDerivative, dAlpha);

    state.prevValue = smoothed;
    state.prevDerivative = smoothedDerivative;
    state.prevTimestamp = timestamp;
    state.initialized = true;

    return smoothed;
  }

  filterLandmarks(
    handId: string,
    landmarks: Float32Array,
    timestamp: number,
  ): Float32Array {
    const result = new Float32Array(landmarks.length);
    for (let i = 0; i < landmarks.length; i += 3) {
      result[i] = this.filter(handId, i / 3, 'x', landmarks[i], timestamp);
      result[i + 1] = this.filter(handId, i / 3, 'y', landmarks[i + 1], timestamp);
      result[i + 2] = this.filter(handId, i / 3, 'z', landmarks[i + 2], timestamp);
    }
    return result;
  }

  reset(handId?: string): void {
    if (handId) {
      this.states.delete(handId);
    } else {
      this.states.clear();
    }
  }

  destroy(): void {
    this.states.clear();
  }
}
