import { StrokeData, StrokePoint } from './types';
import { StrokeEngine } from '../drawing/StrokeEngine';

type PipelineHandler = (data: StrokeData) => void;

export class Pipeline {
  private strokeEngine: StrokeEngine | null = null;
  private handlers: Set<PipelineHandler> = new Set();

  setStrokeEngine(engine: StrokeEngine): void {
    this.strokeEngine = engine;
  }

  on(event: 'stroke', handler: PipelineHandler): void {
    this.handlers.add(handler);
  }

  off(event: 'stroke', handler: PipelineHandler): void {
    this.handlers.delete(handler);
  }

  commitStroke(points: StrokePoint[], color: string, width: number, hand: 'Left' | 'Right'): void {
    if (!this.strokeEngine) return;
    const stroke = this.strokeEngine.addStroke(points, color, width, hand);
    for (const h of this.handlers) {
      h(stroke);
    }
  }

  destroy(): void {
    this.handlers.clear();
    this.strokeEngine = null;
  }
}
