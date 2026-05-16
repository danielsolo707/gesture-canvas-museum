import { GestureType } from '../core/types';
import { GESTURE } from '../core/constants';
import { FSMState, FSMTransition } from './types';

export class GestureFSM {
  private currentState: FSMState = 'idle';
  private transitions: FSMTransition[] = [];
  private lastTransitionTime = 0;

  constructor() {
    this.setupTransitions();
  }

  private setupTransitions(): void {
    this.transitions = [
      { from: 'idle', to: 'drawing', condition: () => true, cooldownMs: GESTURE.COOLDOWN_MS },
      { from: 'idle', to: 'eraser', condition: () => true, cooldownMs: GESTURE.COOLDOWN_MS },
      { from: 'idle', to: 'color_select', condition: () => true, cooldownMs: GESTURE.COOLDOWN_MS },
      { from: 'drawing', to: 'stop_drawing', condition: () => true, cooldownMs: GESTURE.COOLDOWN_MS },
      { from: 'drawing', to: 'eraser', condition: () => true, cooldownMs: GESTURE.COOLDOWN_MS },
      { from: 'drawing', to: 'idle', condition: () => true, cooldownMs: GESTURE.COOLDOWN_MS },
      { from: 'eraser', to: 'idle', condition: () => true, cooldownMs: GESTURE.COOLDOWN_MS },
      { from: 'eraser', to: 'stop_drawing', condition: () => true, cooldownMs: GESTURE.COOLDOWN_MS },
      { from: 'color_select', to: 'idle', condition: () => true, cooldownMs: GESTURE.COOLDOWN_MS },
      { from: 'stop_drawing', to: 'idle', condition: () => true, cooldownMs: GESTURE.COOLDOWN_MS },
      { from: 'clear_canvas', to: 'idle', condition: () => true, cooldownMs: 1000 },
      { from: 'dual_hand', to: 'idle', condition: () => true, cooldownMs: GESTURE.COOLDOWN_MS },
      { from: 'dual_hand', to: 'drawing', condition: () => true, cooldownMs: GESTURE.COOLDOWN_MS },
    ];
  }

  transition(to: GestureType, now: number): GestureType {
    if (to === this.currentState) return this.currentState;

    for (const t of this.transitions) {
      if (t.from === this.currentState && t.to === to) {
        if (now - this.lastTransitionTime < t.cooldownMs) {
          return this.currentState;
        }
        if (t.condition()) {
          this.currentState = to;
          this.lastTransitionTime = now;
          return to;
        }
      }
    }

    return this.currentState;
  }

  forceTransition(to: GestureType, now: number): void {
    this.currentState = to;
    this.lastTransitionTime = now;
  }

  getState(): FSMState {
    return this.currentState;
  }

  reset(): void {
    this.currentState = 'idle';
    this.lastTransitionTime = 0;
  }

  destroy(): void {
    this.reset();
  }
}
