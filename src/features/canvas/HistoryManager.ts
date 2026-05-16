import { StrokeData } from '../../core/types';
import { DRAWING } from '../../core/constants';

export class HistoryManager {
  private undoStack: StrokeData[][] = [];
  private redoStack: StrokeData[][] = [];
  private maxDepth: number;

  constructor(maxDepth = DRAWING.UNDO_DEPTH) {
    this.maxDepth = maxDepth;
  }

  pushSnapshot(strokes: StrokeData[]): void {
    this.undoStack.push([...strokes]);
    this.redoStack.length = 0;

    if (this.undoStack.length > this.maxDepth) {
      this.undoStack.shift();
    }
  }

  undo(strokes: StrokeData[]): StrokeData[] | null {
    if (this.undoStack.length === 0) return null;
    this.redoStack.push([...strokes]);
    return [...this.undoStack.pop()!];
  }

  redo(strokes: StrokeData[]): StrokeData[] | null {
    if (this.redoStack.length === 0) return null;
    this.undoStack.push([...strokes]);
    return [...this.redoStack.pop()!];
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }

  destroy(): void {
    this.clear();
  }
}
