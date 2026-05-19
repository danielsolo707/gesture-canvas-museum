import { SMOOTHING } from '../core/constants';

export interface FilterConfig {
  minCutoff: number;
  beta: number;
  dCutoff: number;
}

interface FilterState {
  prevValue: number;
  prevDerivative: number;
  prevTimestamp: number;
  initialized: boolean;
}

export class OneEuroFilter {
  private states = new Map<string, Map<string, FilterState>>();
  private config: FilterConfig;

  constructor(config?: Partial<FilterConfig>) {
    this.config = {
      minCutoff: config?.minCutoff ?? SMOOTHING.MIN_CUTOFF,
      beta: config?.beta ?? SMOOTHING.BETA,
      dCutoff: config?.dCutoff ?? SMOOTHING.D_CUTOFF,
    };
  }

  private getState(handId: string, landmarkIndex: number, axis: 'x' | 'y' | 'z'): FilterState {
    let handStates = this.states.get(handId);
    if (!handStates) {
      handStates = new Map();
      this.states.set(handId, handStates);
    }
    const key = `${landmarkIndex}:${axis}`;
    let state = handStates.get(key);
    if (!state) {
      state = { prevValue: 0, prevDerivative: 0, prevTimestamp: 0, initialized: false };
      handStates.set(key, state);
    }
    return state;
  }

  private smoothingFactor(cutoff: number, delta: number): number {
    const r = 2 * Math.PI * cutoff * (delta / 1000);
    return r / (r + 1);
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
      ? Math.max(timestamp - state.prevTimestamp, 0.001)
      : 16.67;

    const speed = this.estimateSpeed(state, delta);
    const adaptiveBeta = this.config.beta * (1 + speed * 0.3);
    const cutoff = this.config.minCutoff + adaptiveBeta * Math.abs(state.prevDerivative);
    const alpha = this.smoothingFactor(cutoff, delta);
    const smoothed = state.prevValue + alpha * (value - state.prevValue);

    const derivative = (smoothed - state.prevValue) / delta;
    const dAlpha = this.smoothingFactor(this.config.dCutoff, delta);
    const smoothedDerivative = state.prevDerivative + dAlpha * (derivative - state.prevDerivative);

    state.prevValue = smoothed;
    state.prevDerivative = smoothedDerivative;
    state.prevTimestamp = timestamp;
    state.initialized = true;

    return smoothed;
  }

  private estimateSpeed(state: FilterState, _delta: number): number {
    return Math.abs(state.prevDerivative);
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
