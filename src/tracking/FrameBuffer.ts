import { LANDMARKS_FLOAT_SIZE } from '../core/types';

export class FrameBuffer {
  private buffers: Float32Array[] = [];
  private timestamps: number[] = [];
  private maxSize: number;

  constructor(maxSize = 5) {
    this.maxSize = maxSize;
  }

  push(landmarks: Float32Array, timestamp: number): void {
    const copy = new Float32Array(landmarks);
    this.buffers.push(copy);
    this.timestamps.push(timestamp);

    if (this.buffers.length > this.maxSize) {
      this.buffers.shift();
      this.timestamps.shift();
    }
  }

  getLatest(): { landmarks: Float32Array; timestamp: number } | null {
    if (this.buffers.length === 0) return null;
    return {
      landmarks: this.buffers[this.buffers.length - 1],
      timestamp: this.timestamps[this.timestamps.length - 1],
    };
  }

  getAverage(): Float32Array | null {
    if (this.buffers.length === 0) return null;

    const avg = new Float32Array(LANDMARKS_FLOAT_SIZE);
    for (let i = 0; i < avg.length; i++) {
      let sum = 0;
      for (let j = 0; j < this.buffers.length; j++) {
        sum += this.buffers[j][i];
      }
      avg[i] = sum / this.buffers.length;
    }
    return avg;
  }

  clear(): void {
    this.buffers.length = 0;
    this.timestamps.length = 0;
  }

  destroy(): void {
    this.clear();
  }
}
