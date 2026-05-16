import { GestureDetector, GestureResult } from '../types';
import { Handedness } from '../../core/types';
import { GESTURE } from '../../core/constants';
import { HandShapeMetrics } from './utils';

export class ClearCanvasDetector implements GestureDetector {
  readonly name = 'clear_canvas';

  detect(_landmarks: Float32Array, handedness: Handedness, shape?: HandShapeMetrics): GestureResult | null {
    if (!shape) return null;

    const a = shape.fingerAngles;
    const ha = shape.hexAreas;

    const allCurled =
      a.index > GESTURE.FINGER_ANGLE_CURLED_MIN &&
      a.middle > GESTURE.FINGER_ANGLE_CURLED_MIN &&
      a.ring > GESTURE.FINGER_ANGLE_CURLED_MIN &&
      a.pinky > GESTURE.FINGER_ANGLE_CURLED_MIN;

    if (!allCurled) return null;

    const compactPalm = ha.ab < 0.03 && ha.bc < 0.03;

    return { type: 'clear_canvas', hand: handedness, confidence: compactPalm ? 0.9 : 0.75 };
  }

  reset(): void {}
}
