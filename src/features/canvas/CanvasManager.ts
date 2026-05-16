import { StrokeEngine } from '../../drawing/StrokeEngine';
import { StrokeRenderer } from '../../rendering/StrokeRenderer';
import { globalEventBus } from '../../core/EventBus';
import { logger } from '../../utils/logging';

export class CanvasManager {
  private strokeEngine: StrokeEngine;
  private strokeRenderer: StrokeRenderer | null = null;

  constructor(strokeEngine: StrokeEngine, strokeRenderer?: StrokeRenderer) {
    this.strokeEngine = strokeEngine;
    this.strokeRenderer = strokeRenderer ?? null;
  }

  setStrokeRenderer(renderer: StrokeRenderer): void {
    this.strokeRenderer = renderer;
  }

  clear(): void {
    this.strokeEngine.clearAll();
    this.strokeRenderer?.clear();
    logger.info('Canvas cleared');
  }

  undo(): void {
    const undone = this.strokeEngine.undo();
    if (undone) {
      this.strokeRenderer?.removeStroke(undone.id);
    }
  }

  redo(): void {
    const redone = this.strokeEngine.redo();
    if (redone) {
      this.strokeRenderer?.addStroke(redone);
    }
  }

  getStrokeCount(): number {
    return this.strokeEngine.getStrokeCount();
  }

  destroy(): void {
    this.clear();
  }
}
