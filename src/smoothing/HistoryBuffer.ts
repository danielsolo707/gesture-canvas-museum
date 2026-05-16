import { SMOOTHING } from '../core/constants';

export class HistoryBuffer {
  private buffers = new Map<string, Float32Array[]>();
  private maxSize: number;

  constructor(maxSize = SMOOTHING.HISTORY_SIZE) {
    this.maxSize = maxSize;
  }

  push(handId: string, landmarks: Float32Array): void {
    let buffer = this.buffers.get(handId);
    if (!buffer) {
      buffer = [];
      this.buffers.set(handId, buffer);
    }
    const copy = new Float32Array(landmarks);
    buffer.push(copy);
    if (buffer.length > this.maxSize) {
      buffer.shift();
    }
  }

  getAverage(handId: string): Float32Array | null {
    const buffer = this.buffers.get(handId);
    if (!buffer || buffer.length === 0) return null;

    const size = buffer[0].length;
    const avg = new Float32Array(size);

    for (let i = 0; i < size; i++) {
      let sum = 0;
      for (let j = 0; j < buffer.length; j++) {
        sum += buffer[j][i];
      }
      avg[i] = sum / buffer.length;
    }
    return avg;
  }

  getLatest(handId: string): Float32Array | null {
    const buffer = this.buffers.get(handId);
    if (!buffer || buffer.length === 0) return null;
    return buffer[buffer.length - 1];
  }

  clear(handId?: string): void {
    if (handId) {
      this.buffers.delete(handId);
    } else {
      this.buffers.clear();
    }
  }

  destroy(): void {
    this.buffers.clear();
  }
}
