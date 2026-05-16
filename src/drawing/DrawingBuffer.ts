import { StrokePoint } from '../core/types';
import { DRAWING } from '../core/constants';

export interface BufferGeometryData {
  positions: Float32Array;
  colors: Float32Array;
  indices: Uint32Array | Uint16Array;
}

export class DrawingBuffer {
  private positions: Float32Array;
  private colors: Float32Array;
  private indices: Uint32Array;
  private vertexCount = 0;
  private indexCount = 0;
  private capacity: number;

  constructor(maxPoints = 100000) {
    this.capacity = maxPoints * 2;
    this.positions = new Float32Array(this.capacity * 3);
    this.colors = new Float32Array(this.capacity * 3);
    this.indices = new Uint32Array(this.capacity * 6);
  }

  appendRibbonSegment(
    p1: StrokePoint,
    p2: StrokePoint,
    width1: number,
    width2: number,
    color: [number, number, number],
  ): void {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.0001) return;

    const nx = -dy / len;
    const ny = dx / len;

    const idx = this.vertexCount;

    this.positions[idx * 3] = p1.x + nx * width1;
    this.positions[idx * 3 + 1] = p1.y + ny * width1;
    this.positions[idx * 3 + 2] = p1.z ?? 0;

    this.positions[(idx + 1) * 3] = p1.x - nx * width1;
    this.positions[(idx + 1) * 3 + 1] = p1.y - ny * width1;
    this.positions[(idx + 1) * 3 + 2] = p1.z ?? 0;

    this.positions[(idx + 2) * 3] = p2.x + nx * width2;
    this.positions[(idx + 2) * 3 + 1] = p2.y + ny * width2;
    this.positions[(idx + 2) * 3 + 2] = p2.z ?? 0;

    this.positions[(idx + 3) * 3] = p2.x - nx * width2;
    this.positions[(idx + 3) * 3 + 1] = p2.y - ny * width2;
    this.positions[(idx + 3) * 3 + 2] = p2.z ?? 0;

    for (let i = 0; i < 4; i++) {
      this.colors[(idx + i) * 3] = color[0];
      this.colors[(idx + i) * 3 + 1] = color[1];
      this.colors[(idx + i) * 3 + 2] = color[2];
    }

    this.indices[this.indexCount] = idx;
    this.indices[this.indexCount + 1] = idx + 1;
    this.indices[this.indexCount + 2] = idx + 2;
    this.indices[this.indexCount + 3] = idx + 1;
    this.indices[this.indexCount + 4] = idx + 3;
    this.indices[this.indexCount + 5] = idx + 2;

    this.vertexCount += 4;
    this.indexCount += 6;
  }

  getData(): BufferGeometryData | null {
    if (this.vertexCount === 0) return null;

    return {
      positions: this.positions.slice(0, this.vertexCount * 3),
      colors: this.colors.slice(0, this.vertexCount * 3),
      indices: this.indices.slice(0, this.indexCount),
    };
  }

  clear(): void {
    this.vertexCount = 0;
    this.indexCount = 0;
  }

  getVertexCount(): number {
    return this.vertexCount;
  }

  destroy(): void {
    this.clear();
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b];
}

export { hexToRgb };
