import { GestureDetector, GestureResult } from '../types';
import { Handedness } from '../../core/types';
import { GESTURE } from '../../core/constants';
import { HandShapeMetrics, distance3D, getLandmark } from './utils';

export class EraserDetector implements GestureDetector {
  readonly name = 'eraser';

  detect(landmarks: Float32Array, handedness: Handedness, shape?: HandShapeMetrics): GestureResult | null {
    if (!shape) return null;

    const s = shape.extensionScores;
    const ha = shape.hexAsymmetry;

    const indexExt = s.index >= GESTURE.EXTENSION_SCORE_MIN;
    const middleExt = s.middle >= GESTURE.EXTENSION_SCORE_MIN;
    const ringNotExt = s.ring < GESTURE.EXTENSION_SCORE_MIN;
    const pinkyNotExt = s.pinky < GESTURE.EXTENSION_SCORE_MIN;

    if (!indexExt || !middleExt || !ringNotExt || !pinkyNotExt) return null;

    const hexConfirmsEraser = ha.ab < GESTURE.HEX_ASYMMETRY_DRAWING;

    const indexTip = getLandmark(landmarks, 8);
    const middleTip = getLandmark(landmarks, 12);
    const fingerDistance = distance3D(
      indexTip[0], indexTip[1], indexTip[2],
      middleTip[0], middleTip[1], middleTip[2],
    );

    const confidence = hexConfirmsEraser ? 0.9 : 0.75;

    return {
      type: 'eraser',
      hand: handedness,
      confidence,
      data: { fingerDistance },
    };
  }

  reset(): void {}
}
