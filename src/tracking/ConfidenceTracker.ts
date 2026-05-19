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
