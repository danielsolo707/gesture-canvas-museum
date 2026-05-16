import { GestureDetector, GestureResult } from '../types';
import { Handedness, LANDMARK_INDICES as L } from '../../core/types';
import { GESTURE } from '../../core/constants';

export class ColorSelectDetector implements GestureDetector {
  readonly name = 'color_select';

  detect(landmarks: Float32Array, handedness: Handedness): GestureResult | null {
    const indexTip = getLandmark(landmarks, L.INDEX_TIP);
    const indexPip = getLandmark(landmarks, L.INDEX_PIP);
    const indexMcp = getLandmark(landmarks, L.INDEX_MCP);

    const middleTip = getLandmark(landmarks, L.MIDDLE_TIP);
    const middlePip = getLandmark(landmarks, L.MIDDLE_PIP);
    const middleMcp = getLandmark(landmarks, L.MIDDLE_MCP);

    const ringTip = getLandmark(landmarks, L.RING_TIP);
    const ringPip = getLandmark(landmarks, L.RING_PIP);
    const ringMcp = getLandmark(landmarks, L.RING_MCP);

    const thumbTip = getLandmark(landmarks, L.THUMB_TIP);
    const pinkyTip = getLandmark(landmarks, L.PINKY_TIP);

    const indexExt = isExtended(indexTip, indexPip, indexMcp);
    const middleExt = isExtended(middleTip, middlePip, middleMcp);
    const ringExt = isExtended(ringTip, ringPip, ringMcp);

    if (!indexExt || !middleExt || !ringExt) return null;

    const thumbClosed = !isExtended(thumbTip, getLandmark(landmarks, L.THUMB_IP), getLandmark(landmarks, L.THUMB_MCP));
    const pinkyClosed = !isExtended(pinkyTip, getLandmark(landmarks, L.PINKY_PIP), getLandmark(landmarks, L.PINKY_MCP));

    if (!thumbClosed || !pinkyClosed) return null;

    return { type: 'color_select', hand: handedness, confidence: 0.8 };
  }

  reset(): void {}
}

function getLandmark(landmarks: Float32Array, index: number): [number, number, number] {
  const i = index * 3;
  return [landmarks[i], landmarks[i + 1], landmarks[i + 2]];
}

function isExtended(
  tip: [number, number, number],
  pip: [number, number, number],
  mcp: [number, number, number],
): boolean {
  const dx1 = tip[0] - mcp[0], dy1 = tip[1] - mcp[1];
  const dx2 = pip[0] - mcp[0], dy2 = pip[1] - mcp[1];
  const dTip = Math.sqrt(dx1 * dx1 + dy1 * dy1);
  const dPip = Math.sqrt(dx2 * dx2 + dy2 * dy2);
  return dTip > dPip + 0.08;
}
