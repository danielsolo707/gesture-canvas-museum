export class FPSCounter {
  private frames: number[] = [];
  private windowSize: number;

  constructor(windowSize = 60) {
    this.windowSize = windowSize;
  }

  update(timestamp: number): void {
    this.frames.push(timestamp);
    const cutoff = timestamp - 1000;
    while (this.frames.length > 0 && this.frames[0] < cutoff) {
      this.frames.shift();
    }
    if (this.frames.length > this.windowSize) {
      this.frames.splice(0, this.frames.length - this.windowSize);
    }
  }

  get fps(): number {
    if (this.frames.length < 2) return 0;
    const elapsed = this.frames[this.frames.length - 1] - this.frames[0];
    if (elapsed <= 0) return 0;
    return ((this.frames.length - 1) / elapsed) * 1000;
  }

  reset(): void {
    this.frames.length = 0;
  }
}

export function nowMs(): number {
  return performance.now();
}
