import { NUM_LANDMARKS } from '../core/types';
import { EDGE } from '../core/constants';
import { getLandmark } from '../utils/math';

export interface EdgeProximity {
  left: number;
  right: number;
  top: number;
  bottom: number;
  overall: number;
  dampingFactor: number;
}

export class EdgeProximityDetector {
  private readonly dampingMargin: number;
  private readonly highDampingThreshold: number;
  private readonly fullDampingFactor: number;

  constructor(
    dampingMargin = EDGE.DAMPING_ZONE,
    highDampingThreshold = EDGE.HIGH_DAMPING_THRESHOLD,
    fullDampingFactor = EDGE.FULL_DAMPING,
  ) {
    this.dampingMargin = dampingMargin;
    this.highDampingThreshold = highDampingThreshold;
    this.fullDampingFactor = fullDampingFactor;
  }

  compute(landmarks: Float32Array | null): EdgeProximity {
    if (!landmarks || landmarks.length < NUM_LANDMARKS * 3) {
      return { left: 0, right: 0, top: 0, bottom: 0, overall: 0, dampingFactor: 1 };
    }

    let minX = 1, maxX = 0, minY = 1, maxY = 0;
    let validCount = 0;

    for (let i = 0; i < NUM_LANDMARKS; i++) {
      const lm = getLandmark(landmarks, i);
      if (!lm) continue;
      const [x, y] = lm;
      if (Math.abs(x) < 0.001 && Math.abs(y) < 0.001) continue;
      if (x < 0 || x > 1 || y < 0 || y > 1) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      validCount++;
    }

    if (validCount < 3) {
      return { left: 0, right: 0, top: 0, bottom: 0, overall: 0, dampingFactor: 1 };
    }

    const left = Math.max(0, 1 - minX / this.dampingMargin);
    const right = Math.max(0, 1 - (1 - maxX) / this.dampingMargin);
    const top = Math.max(0, 1 - minY / this.dampingMargin);
    const bottom = Math.max(0, 1 - (1 - maxY) / this.dampingMargin);

    const overall = Math.max(left, right, top, bottom);

    const dampingFactor = overall >= this.highDampingThreshold
      ? this.fullDampingFactor + (1 - this.fullDampingFactor) * (1 - (overall - this.highDampingThreshold) / (1 - this.highDampingThreshold))
      : 1 - (overall / this.highDampingThreshold) * (1 - 0.7);

    const clamped = Math.max(this.fullDampingFactor, Math.min(1, dampingFactor));

    return {
      left: Math.min(1, left),
      right: Math.min(1, right),
      top: Math.min(1, top),
      bottom: Math.min(1, bottom),
      overall: Math.min(1, overall),
      dampingFactor: Math.round(clamped * 100) / 100,
    };
  }

  getNearestEdge(prox: EdgeProximity): 'left' | 'right' | 'top' | 'bottom' | 'none' {
    const max = Math.max(prox.left, prox.right, prox.top, prox.bottom);
    if (max < 0.1) return 'none';
    if (max === prox.left) return 'left';
    if (max === prox.right) return 'right';
    if (max === prox.top) return 'top';
    return 'bottom';
  }
}
