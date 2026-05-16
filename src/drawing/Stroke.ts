import { StrokePoint, StrokeData, Handedness } from '../core/types';
import { randomId } from '../utils/math';

export class Stroke {
  readonly id: string;
  readonly hand: Handedness;
  readonly createdAt: number;
  points: StrokePoint[];
  color: string;
  width: number;
  isEraser: boolean;
  eraserSize: number;
  private _dirty = true;

  constructor(hand: Handedness, color: string, width: number) {
    this.id = randomId();
    this.hand = hand;
    this.createdAt = performance.now();
    this.points = [];
    this.color = color;
    this.width = width;
    this.isEraser = false;
    this.eraserSize = 0;
  }

  addPoint(point: StrokePoint): void {
    this.points.push(point);
    this._dirty = true;
  }

  get dirty(): boolean {
    return this._dirty;
  }

  markClean(): void {
    this._dirty = false;
  }

  toData(): StrokeData {
    return {
      id: this.id,
      points: [...this.points],
      color: this.color,
      width: this.width,
      hand: this.hand,
      createdAt: this.createdAt,
    };
  }

  static fromData(data: StrokeData): Stroke {
    const stroke = new Stroke(data.hand, data.color, data.width);
    stroke.points = [...data.points];
    return stroke;
  }
}
