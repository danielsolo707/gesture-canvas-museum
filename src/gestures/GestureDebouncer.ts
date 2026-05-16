import { GESTURE } from '../core/constants';
import { GestureType } from '../core/types';

interface HysteresisState {
  active: boolean;
  activeType: GestureType | null;
  activateCount: number;
  deactivateCount: number;
  pendingType: GestureType | null;
}

export class GestureDebouncer {
  private states = new Map<string, HysteresisState>();
  private activateFrames: number;
  private deactivateFrames: number;
  private cooldownMs: number;
  private lastTriggered = new Map<string, number>();

  constructor(
    activateFrames = GESTURE.ACTIVATE_FRAMES,
    deactivateFrames = GESTURE.DEACTIVATE_FRAMES,
    cooldownMs = GESTURE.COOLDOWN_MS,
  ) {
    this.activateFrames = activateFrames;
    this.deactivateFrames = deactivateFrames;
    this.cooldownMs = cooldownMs;
  }

  update(hand: string, detectedType: GestureType | null, now: number): {
    activeGesture: GestureType | null;
    changed: boolean;
  } {
    let state = this.states.get(hand);
    if (!state) {
      state = { active: false, activeType: null, activateCount: 0, deactivateCount: 0, pendingType: null };
      this.states.set(hand, state);
    }

    const wasActive = state.active;
    const wasType = state.activeType;

    if (state.active) {
      if (detectedType !== null && detectedType === state.activeType) {
        state.deactivateCount = 0;
      } else {
        state.deactivateCount++;
        if (state.deactivateCount >= this.deactivateFrames) {
          state.active = false;
          state.activeType = null;
          state.deactivateCount = 0;
          state.activateCount = 0;
          state.pendingType = null;
        }
      }
    } else {
      if (detectedType !== null) {
        if (state.pendingType === detectedType) {
          state.activateCount++;
          if (state.activateCount >= this.activateFrames) {
            state.active = true;
            state.activeType = detectedType;
            state.activateCount = 0;
            state.deactivateCount = 0;
            state.pendingType = null;
          }
        } else {
          state.pendingType = detectedType;
          state.activateCount = 1;
          state.deactivateCount = 0;
        }
      } else {
        state.activateCount = 0;
        state.pendingType = null;
      }
    }

    const changed = state.active !== wasActive || state.activeType !== wasType;

    return {
      activeGesture: state.activeType,
      changed,
    };
  }

  isActive(hand: string): boolean {
    return this.states.get(hand)?.active ?? false;
  }

  getActiveGesture(hand: string): GestureType | null {
    return this.states.get(hand)?.activeType ?? null;
  }

  shouldTriggerEvent(hand: string, gestureType: GestureType, now: number): boolean {
    const key = `${hand}:${gestureType}`;
    const last = this.lastTriggered.get(key) ?? 0;
    if (now - last < this.cooldownMs) return false;
    this.lastTriggered.set(key, now);
    return true;
  }

  reset(hand?: string): void {
    if (hand) {
      this.states.delete(hand);
      for (const key of this.lastTriggered.keys()) {
        if (key.startsWith(`${hand}:`)) this.lastTriggered.delete(key);
      }
    } else {
      this.states.clear();
      this.lastTriggered.clear();
    }
  }

  destroy(): void {
    this.reset();
  }
}
