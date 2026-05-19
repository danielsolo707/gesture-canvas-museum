import { StrokePoint, StrokeData, Handedness } from '../core/types';
import { DRAWING } from '../core/constants';
import { Stroke } from './Stroke';
import { DrawingBuffer, hexToRgb, BufferGeometryData } from './DrawingBuffer';
import { randomId } from '../utils/math';
import { globalEventBus } from '../core/EventBus';

const SPATIAL_CELL_SIZE = 0.03;

function cellKey(x: number, y: number): string {
  return `${Math.floor(x / SPATIAL_CELL_SIZE)}:${Math.floor(y / SPATIAL_CELL_SIZE)}`;
}

class EraserIndex {
  private grid = new Map<string, Set<string>>();

  insert(strokeId: string, points: StrokePoint[]): void {
    if (points.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const keys = new Set<string>();
    for (let cx = Math.floor(minX / SPATIAL_CELL_SIZE); cx <= Math.floor(maxX / SPATIAL_CELL_SIZE); cx++) {
      for (let cy = Math.floor(minY / SPATIAL_CELL_SIZE); cy <= Math.floor(maxY / SPATIAL_CELL_SIZE); cy++) {
        keys.add(`${cx}:${cy}`);
      }
    }
    for (const key of keys) {
      let cell = this.grid.get(key);
      if (!cell) { cell = new Set(); this.grid.set(key, cell); }
      cell.add(strokeId);
    }
  }

  query(x: number, y: number, radius: number): Set<string> {
    const result = new Set<string>();
    const r = Math.max(radius, SPATIAL_CELL_SIZE * 0.5);
    for (let cx = Math.floor((x - r) / SPATIAL_CELL_SIZE); cx <= Math.floor((x + r) / SPATIAL_CELL_SIZE); cx++) {
      for (let cy = Math.floor((y - r) / SPATIAL_CELL_SIZE); cy <= Math.floor((y + r) / SPATIAL_CELL_SIZE); cy++) {
        const cell = this.grid.get(`${cx}:${cy}`);
        if (cell) for (const id of cell) result.add(id);
      }
    }
    return result;
  }

  remove(strokeId: string): void {
    for (const cell of this.grid.values()) cell.delete(strokeId);
  }

  clear(): void {
    this.grid.clear();
  }
}

export class StrokeEngine {
  private strokes: Map<string, Stroke> = new Map();
  private completedStrokes: StrokeData[] = [];
  private undoStack: StrokeData[] = [];
  private activeHands: Map<string, Stroke> = new Map();
  private buffer: DrawingBuffer;
  private eraserIndex = new EraserIndex();
  private _strokeCount = 0;

  constructor() {
    this.buffer = new DrawingBuffer();
  }

  initialize(): void {
    this.buffer.clear();
  }

  startStroke(
    handKey: string,
    point: StrokePoint,
    color: string,
    width: number,
    handedness: Handedness = handKey === 'Left' ? 'Left' : 'Right',
  ): Stroke {
    const stroke = new Stroke(handedness, color, width);
    stroke.addPoint(point);
    this.strokes.set(stroke.id, stroke);
    this.activeHands.set(handKey, stroke);
    return stroke;
  }

  extendStroke(handKey: string, point: StrokePoint): Stroke | null {
    const active = this.activeHands.get(handKey);
    if (!active) return null;

    const last = active.points[active.points.length - 1];
    const dx = point.x - last.x;
    const dy = point.y - last.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < DRAWING.MIN_POINT_DISTANCE) return active;

    active.addPoint(point);
    return active;
  }

  endStroke(handKey: string): StrokeData | null {
    const active = this.activeHands.get(handKey);
    if (!active) return null;

    this.activeHands.delete(handKey);

    if (active.points.length < 2) {
      this.strokes.delete(active.id);
      return null;
    }

    const data = active.toData();
    this.completedStrokes.push(data);
    this.eraserIndex.insert(data.id, data.points);
    this._strokeCount++;
    this.strokes.delete(active.id);

    if (this.undoStack.length >= DRAWING.UNDO_DEPTH) {
      this.undoStack.shift();
    }

    return data;
  }

  migrateStrokeKey(oldKey: string, newKey: string): void {
    const stroke = this.activeHands.get(oldKey);
    if (stroke) {
      this.activeHands.set(newKey, stroke);
      this.activeHands.delete(oldKey);
    }
  }

  cancelStroke(handKey: string): void {
    const active = this.activeHands.get(handKey);
    if (active) {
      this.strokes.delete(active.id);
      this.activeHands.delete(handKey);
    }
  }

  addStroke(points: StrokePoint[], color: string, width: number, hand: Handedness): StrokeData {
    const stroke = new Stroke(hand, color, width);
    stroke.points = points;
    const data = stroke.toData();
    this.completedStrokes.push(data);
    this.eraserIndex.insert(data.id, data.points);
    this._strokeCount++;
    return data;
  }

  removeStroke(strokeId: string): void {
    const idx = this.completedStrokes.findIndex((s) => s.id === strokeId);
    if (idx !== -1) {
      this.completedStrokes.splice(idx, 1);
      this.eraserIndex.remove(strokeId);
      globalEventBus.emit('stroke_erased', { strokeId });
    }
  }

  eraseStrokesAtPoint(x: number, y: number, radius: number): string[] {
    const candidates = this.eraserIndex.query(x, y, radius);
    if (candidates.size === 0) return [];

    const erased: string[] = [];
    const candidateSet = new Set(candidates);

    this.completedStrokes = this.completedStrokes.filter((s) => {
      if (!candidateSet.has(s.id)) return true;

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
      this.eraserIndex.remove(id);
      globalEventBus.emit('stroke_erased', { strokeId: id });
    }

    return erased;
  }

  undo(): StrokeData | null {
    const data = this.completedStrokes.pop();
    if (data) {
      this.undoStack.push(data);
      this.eraserIndex.remove(data.id);
      this._strokeCount--;
      globalEventBus.emit('stroke_erased', { strokeId: data.id });
      globalEventBus.emit('undo');
    }
    return data ?? null;
  }

  redo(): StrokeData | null {
    const data = this.undoStack.pop();
    if (data) {
      this.completedStrokes.push(data);
      this.eraserIndex.insert(data.id, data.points);
      this._strokeCount++;
      globalEventBus.emit('stroke_added', data);
    }
    return data ?? null;
  }

  clearAll(): void {
    this.completedStrokes.length = 0;
    this.undoStack.length = 0;
    this.strokes.clear();
    this.activeHands.clear();
    this.eraserIndex.clear();
    this._strokeCount = 0;
    this.buffer.clear();
    globalEventBus.emit('clear_canvas');
  }

  getActiveStroke(handKey: string): Stroke | null {
    return this.activeHands.get(handKey) ?? null;
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
    this.eraserIndex.clear();
    this.buffer.destroy();
  }
}
