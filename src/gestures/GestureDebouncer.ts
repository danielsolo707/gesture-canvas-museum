import { GESTURE } from '../core/constants';
import { GestureType } from '../core/types';

export class GestureDebouncer {
  private countMap = new Map<string, number>();
  private lastTriggered = new Map<string, number>();
  private requiredFrames: number;
  private cooldownMs: number;

  constructor(requiredFrames = GESTURE.DEBOUNCE_FRAMES, cooldownMs = GESTURE.COOLDOWN_MS) {
    this.requiredFrames = requiredFrames;
    this.cooldownMs = cooldownMs;
  }

  shouldTrigger(
    gesture: GestureType,
    hand: string,
    detected: boolean,
    now: number,
  ): boolean {
    const key = `${hand}:${gesture}`;
    const last = this.lastTriggered.get(key) ?? 0;

    if (now - last < this.cooldownMs) {
      return false;
    }

    if (detected) {
      const count = (this.countMap.get(key) ?? 0) + 1;
      this.countMap.set(key, count);

      if (count >= this.requiredFrames) {
        this.countMap.set(key, 0);
        this.lastTriggered.set(key, now);
        return true;
      }
    } else {
      this.countMap.set(key, 0);
    }

    return false;
  }

  reset(hand?: string): void {
    if (hand) {
      for (const key of this.countMap.keys()) {
        if (key.startsWith(`${hand}:`)) {
          this.countMap.set(key, 0);
          this.lastTriggered.delete(key);
        }
      }
    } else {
      this.countMap.clear();
      this.lastTriggered.clear();
    }
  }

  destroy(): void {
    this.reset();
  }
}
