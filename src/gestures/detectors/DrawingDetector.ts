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

    const indexExt = s.index >= GESTURE.EXTENSION_SCORE_MIN;
    const middleNotExt = s.middle < GESTURE.EXTENSION_SCORE_MIN;
    const ringNotExt = s.ring < GESTURE.EXTENSION_SCORE_MIN;
    const pinkyNotExt = s.pinky < GESTURE.EXTENSION_SCORE_MIN;

    if (!indexExt || !middleNotExt || !ringNotExt || !pinkyNotExt) return null;

    const hexConfirmsDrawing = ha.ab > GESTURE.HEX_ASYMMETRY_DRAWING;
    const indexAngle = a.index;
    const confidence = Math.min((1 - indexAngle / 0.55) * 0.7 + (hexConfirmsDrawing ? 0.3 : 0), 1);

    return { type: 'drawing', hand: handedness, confidence: Math.max(0.4, confidence) };
  }

  reset(): void {}
}
