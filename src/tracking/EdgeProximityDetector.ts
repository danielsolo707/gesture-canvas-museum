import { NUM_LANDMARKS, EdgeProximityInfo } from '../core/types';
import { EDGE } from '../core/constants';
import { getLandmark } from '../utils/math';

export class EdgeProximityDetector {
  private readonly dampingMargin: number;
  private readonly bottomExtraMargin: number;
  private readonly highDampingThreshold: number;
  private readonly fullDampingFactor: number;
  private readonly gestureWeight: number;
  private readonly cursorWeight: number;
  private readonly bottomConfidencePenalty: number;
  private readonly confidenceFloor: number;

  constructor(config?: {
    dampingMargin?: number;
    bottomExtraMargin?: number;
    highDampingThreshold?: number;
    fullDampingFactor?: number;
    gestureWeight?: number;
    cursorWeight?: number;
    bottomConfidencePenalty?: number;
    confidenceFloor?: number;
  }) {
    this.dampingMargin = config?.dampingMargin ?? EDGE.DAMPING_ZONE;
    this.bottomExtraMargin = config?.bottomExtraMargin ?? EDGE.BOTTOM_EXTRA_MARGIN;
    this.highDampingThreshold = config?.highDampingThreshold ?? EDGE.HIGH_DAMPING_THRESHOLD;
    this.fullDampingFactor = config?.fullDampingFactor ?? EDGE.FULL_DAMPING;
    this.gestureWeight = config?.gestureWeight ?? EDGE.GESTURE_SENSITIVITY_WEIGHT;
    this.cursorWeight = config?.cursorWeight ?? EDGE.CURSOR_DAMPING_WEIGHT;
    this.bottomConfidencePenalty = config?.bottomConfidencePenalty ?? EDGE.BOTTOM_CONFIDENCE_PENALTY;
    this.confidenceFloor = config?.confidenceFloor ?? EDGE.EDGE_CONFIDENCE_FLOOR;
  }

  compute(landmarks: Float32Array | null): EdgeProximityInfo {
    if (!landmarks || landmarks.length < NUM_LANDMARKS * 3) {
      return this.zeroProximity();
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

    if (validCount < 3) return this.zeroProximity();

    const bottomMargin = this.dampingMargin + this.bottomExtraMargin;

    const left = Math.max(0, 1 - minX / this.dampingMargin);
    const right = Math.max(0, 1 - (1 - maxX) / this.dampingMargin);
    const top = Math.max(0, 1 - minY / this.dampingMargin);
    const bottom = Math.max(0, 1 - (1 - maxY) / bottomMargin);

    const overall = Math.max(left, right, top, bottom);

    const dampingFactor = overall >= this.highDampingThreshold
      ? this.fullDampingFactor + (1 - this.fullDampingFactor) * (1 - (overall - this.highDampingThreshold) / (1 - this.highDampingThreshold))
      : 1 - (overall / this.highDampingThreshold) * (1 - 0.7);

    const clamped = Math.max(this.fullDampingFactor, Math.min(1, dampingFactor));

    const gestureSensitivity = this.gestureWeight + (1 - this.gestureWeight) * clamped;
    const cursorDamping = this.cursorWeight + (1 - this.cursorWeight) * clamped;

    const perEdgeConfidence = {
      left: Math.max(this.confidenceFloor, 1 - left * 0.6),
      right: Math.max(this.confidenceFloor, 1 - right * 0.6),
      top: Math.max(this.confidenceFloor, 1 - top * 0.6),
      bottom: Math.max(this.confidenceFloor, 1 - bottom * (0.6 + this.bottomConfidencePenalty)),
    };

    return {
      left: Math.min(1, left),
      right: Math.min(1, right),
      top: Math.min(1, top),
      bottom: Math.min(1, bottom),
      overall: Math.min(1, overall),
      dampingFactor: Math.round(clamped * 100) / 100,
      gestureSensitivity: Math.round(gestureSensitivity * 100) / 100,
      cursorDamping: Math.round(cursorDamping * 100) / 100,
      perEdgeConfidence,
    };
  }

  getNearestEdge(prox: EdgeProximityInfo): 'left' | 'right' | 'top' | 'bottom' | 'none' {
    const max = Math.max(prox.left, prox.right, prox.top, prox.bottom);
    if (max < 0.1) return 'none';
    if (max === prox.left) return 'left';
    if (max === prox.right) return 'right';
    if (max === prox.top) return 'top';
    return 'bottom';
  }

  private zeroProximity(): EdgeProximityInfo {
    return {
      left: 0, right: 0, top: 0, bottom: 0, overall: 0,
      dampingFactor: 1, gestureSensitivity: 1, cursorDamping: 1,
      perEdgeConfidence: { left: 1, right: 1, top: 1, bottom: 1 },
    };
  }
}
