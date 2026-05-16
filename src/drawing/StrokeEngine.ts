import { StrokePoint, StrokeData, Handedness } from '../core/types';
import { DRAWING } from '../core/constants';
import { Stroke } from './Stroke';
import { DrawingBuffer, hexToRgb, BufferGeometryData } from './DrawingBuffer';
import { randomId } from '../utils/math';
import { globalEventBus } from '../core/EventBus';

export class StrokeEngine {
  private strokes: Map<string, Stroke> = new Map();
  private completedStrokes: StrokeData[] = [];
  private undoStack: StrokeData[] = [];
  private activeHands: Map<Handedness, Stroke | null> = new Map();
  private buffer: DrawingBuffer;
  private _strokeCount = 0;

  constructor() {
    this.buffer = new DrawingBuffer();
    this.activeHands.set('Left', null);
    this.activeHands.set('Right', null);
  }

  initialize(): void {
    this.buffer.clear();
  }

  startStroke(hand: Handedness, point: StrokePoint, color: string, width: number): Stroke {
    const stroke = new Stroke(hand, color, width);
    stroke.addPoint(point);
    this.strokes.set(stroke.id, stroke);
    this.activeHands.set(hand, stroke);
    return stroke;
  }

  extendStroke(hand: Handedness, point: StrokePoint): Stroke | null {
    const active = this.activeHands.get(hand);
    if (!active) return null;

    const last = active.points[active.points.length - 1];
    const dx = point.x - last.x;
    const dy = point.y - last.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < DRAWING.MIN_POINT_DISTANCE) return active;

    active.addPoint(point);
    return active;
  }

  endStroke(hand: Handedness): StrokeData | null {
    const active = this.activeHands.get(hand);
    if (!active) return null;

    this.activeHands.set(hand, null);

    if (active.points.length < 2) {
      this.strokes.delete(active.id);
      return null;
    }

    const data = active.toData();
    this.completedStrokes.push(data);
    this._strokeCount++;
    this.strokes.delete(active.id);

    if (this.undoStack.length >= DRAWING.UNDO_DEPTH) {
      this.undoStack.shift();
    }

    return data;
  }

  cancelStroke(hand: Handedness): void {
    const active = this.activeHands.get(hand);
    if (active) {
      this.strokes.delete(active.id);
      this.activeHands.set(hand, null);
    }
  }

  addStroke(points: StrokePoint[], color: string, width: number, hand: Handedness): StrokeData {
    const stroke = new Stroke(hand, color, width);
    stroke.points = points;
    const data = stroke.toData();
    this.completedStrokes.push(data);
    this._strokeCount++;
    return data;
  }

  removeStroke(strokeId: string): void {
    const idx = this.completedStrokes.findIndex((s) => s.id === strokeId);
    if (idx !== -1) {
      this.completedStrokes.splice(idx, 1);
      globalEventBus.emit('stroke_erased', { strokeId });
    }
  }

  eraseStrokesAtPoint(x: number, y: number, radius: number): string[] {
    const erased: string[] = [];
    this.completedStrokes = this.completedStrokes.filter((s) => {
      for (const p of s.points) {
        const dx = p.x - x;
        const dy = p.y - y;
        if (dx * dx + dy * dy < radius * radius) {
          erased.push(s.id);
          return false;
        }
      }
      return true;
    });
    for (const id of erased) {
      globalEventBus.emit('stroke_erased', { strokeId: id });
    }
    return erased;
  }

  undo(): StrokeData | null {
    const data = this.completedStrokes.pop();
    if (data) {
      this.undoStack.push(data);
      this._strokeCount--;
      globalEventBus.emit('undo');
    }
    return data ?? null;
  }

  redo(): StrokeData | null {
    const data = this.undoStack.pop();
    if (data) {
      this.completedStrokes.push(data);
      this._strokeCount++;
    }
    return data ?? null;
  }

  clearAll(): void {
    this.completedStrokes.length = 0;
    this.undoStack.length = 0;
    this.strokes.clear();
    this.activeHands.set('Left', null);
    this.activeHands.set('Right', null);
    this._strokeCount = 0;
    this.buffer.clear();
    globalEventBus.emit('clear_canvas');
  }

  getActiveStroke(hand: Handedness): Stroke | null {
    return this.activeHands.get(hand) ?? null;
  }

  getCompletedStrokes(): readonly StrokeData[] {
    return this.completedStrokes;
  }

  getStrokeCount(): number {
    return this._strokeCount;
  }

  rebuildBuffer(): BufferGeometryData | null {
    this.buffer.clear();
    for (const stroke of this.completedStrokes) {
      this.bufferStroke(stroke);
    }
    return this.buffer.getData();
  }

  private bufferStroke(stroke: StrokeData): void {
    if (stroke.points.length < 2) return;
    const color = hexToRgb(stroke.color);
    const baseWidth = stroke.width * 0.005;
    for (let i = 1; i < stroke.points.length; i++) {
      this.buffer.appendRibbonSegment(
        stroke.points[i - 1], stroke.points[i], baseWidth, baseWidth, color,
      );
    }
  }

  update(_now: number): void {}

  destroy(): void {
    this.strokes.clear();
    this.completedStrokes.length = 0;
    this.undoStack.length = 0;
    this.activeHands.clear();
    this.buffer.destroy();
  }
}
