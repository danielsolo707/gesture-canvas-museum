import { StrokePoint } from '../../core/types';
import { DRAWING } from '../../core/constants';
import { StrokeEngine } from '../../drawing/StrokeEngine';

export interface EraserResult {
  centerX: number;
  centerY: number;
  radius: number;
  erasedStrokeIds: string[];
}

export class EraserEngine {
  private strokeEngine: StrokeEngine;

  constructor(strokeEngine: StrokeEngine) {
    this.strokeEngine = strokeEngine;
  }

  erase(indexFinger: StrokePoint, middleFinger: StrokePoint, handedness: string): EraserResult {
    const dx = indexFinger.x - middleFinger.x;
    const dy = indexFinger.y - middleFinger.y;
    const fingerDist = Math.sqrt(dx * dx + dy * dy);

    const minR = DRAWING.ERASER_MIN_WIDTH;
    const maxR = DRAWING.ERASER_MAX_WIDTH;
    const radius = minR + fingerDist * (maxR - minR) * 10;
    const clampedRadius = Math.min(Math.max(radius, minR), maxR);

    const centerX = (indexFinger.x + middleFinger.x) / 2;
    const centerY = (indexFinger.y + middleFinger.y) / 2;

    const erasedIds = this.strokeEngine.eraseStrokesAtPoint(centerX, centerY, clampedRadius);

    return { centerX, centerY, radius: clampedRadius, erasedStrokeIds: erasedIds };
  }

  destroy(): void {}
}
