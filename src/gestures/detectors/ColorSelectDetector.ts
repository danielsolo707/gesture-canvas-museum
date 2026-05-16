import { GestureDetector, GestureResult } from '../types';
import { Handedness } from '../../core/types';
import { HandShapeMetrics } from './utils';

export class ColorSelectDetector implements GestureDetector {
  readonly name = 'color_select';

  detect(_landmarks: Float32Array, handedness: Handedness, shape?: HandShapeMetrics): GestureResult | null {
    if (!shape) return null;

    const s = shape.extensionScores;

    const allExtended =
      s.index >= 0.25 &&
      s.middle >= 0.25 &&
      s.ring >= 0.25 &&
      s.pinky >= 0.25 &&
      s.thumb >= 0.25;

    if (!allExtended) return null;

    return { type: 'color_select', hand: handedness, confidence: 0.8 };
  }

  reset(): void {}
}
