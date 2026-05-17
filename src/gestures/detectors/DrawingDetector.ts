import { GestureDetector, GestureResult } from '../types';
import { Handedness } from '../../core/types';
import { GESTURE } from '../../core/constants';
import { HandShapeMetrics } from './utils';

export class DrawingDetector implements GestureDetector {
  readonly name = 'drawing';

  detect(_landmarks: Float32Array, handedness: Handedness, shape?: HandShapeMetrics): GestureResult | null {
    if (!shape) return null;

    const s = shape.extensionScores;
    const a = shape.fingerAngles;
    const ha = shape.hexAsymmetry;

    const indexExt = s.index >= GESTURE.DRAWING_INDEX_SCORE_MIN;
    const thumbNotExt = s.thumb <= GESTURE.DRAWING_THUMB_CURLED_MAX;
    const middleCurled = s.middle <= GESTURE.DRAWING_CURLED_SCORE_MAX;
    const ringCurled = s.ring <= GESTURE.DRAWING_CURLED_SCORE_MAX;
    const pinkyCurled = s.pinky <= GESTURE.DRAWING_CURLED_SCORE_MAX;

    if (!indexExt || !thumbNotExt || !middleCurled || !ringCurled || !pinkyCurled) return null;

    const hexConfirmsDrawing = ha.ab > GESTURE.HEX_ASYMMETRY_DRAWING;
    const indexScore = Math.max(0, 1 - a.index / 0.55);
    const thumbIsClearlyCurled = s.thumb <= 0.15;
    const bonus = (hexConfirmsDrawing ? 0.3 : 0.05) + (thumbIsClearlyCurled ? 0.1 : 0);
    const confidence = Math.min(indexScore * 0.7 + bonus, 1);

    return { type: 'drawing', hand: handedness, confidence: Math.max(0.5, confidence) };
  }

  reset(): void {}
}
