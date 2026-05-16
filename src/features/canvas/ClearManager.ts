import { GESTURE } from '../../core/constants';
import { globalEventBus } from '../../core/EventBus';

export class ClearManager {
  private holdStartTime: number | null = null;
  private onClear: (() => void) | null = null;
  private onProgress: ((progress: number) => void) | null = null;
  private _active = false;

  get active(): boolean {
    return this._active;
  }

  startHold(onClear: () => void, onProgress?: (progress: number) => void): void {
    this.holdStartTime = performance.now();
    this._active = true;
    this.onClear = onClear;
    this.onProgress = onProgress ?? null;
  }

  update(now: number): number {
    if (!this._active || this.holdStartTime === null) return 0;

    const elapsed = now - this.holdStartTime;
    const progress = Math.min(elapsed / GESTURE.CLEAR_HOLD_MS, 1);

    this.onProgress?.(progress);

    if (progress >= 1) {
      this.onClear?.();
      globalEventBus.emit('clear_canvas');
      this.reset();
      return 1;
    }

    return progress;
  }

  reset(): void {
    this.holdStartTime = null;
    this._active = false;
    this.onClear = null;
    this.onProgress = null;
  }
}
