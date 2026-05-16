import { GestureDetector, GestureResult } from '../types';
import { Handedness } from '../../core/types';
import { LANDMARK_INDICES as L } from '../../core/types';
import { GESTURE } from '../../core/constants';

export class DrawingDetector implements GestureDetector {
  readonly name = 'drawing';

  detect(landmarks: Float32Array, handedness: Handedness): GestureResult | null {
    const indexTip = getLandmark(landmarks, L.INDEX_TIP);
    const indexPip = getLandmark(landmarks, L.INDEX_PIP);
    const indexMcp = getLandmark(landmarks, L.INDEX_MCP);

    const thumbTip = getLandmark(landmarks, L.THUMB_TIP);
    const middleTip = getLandmark(landmarks, L.MIDDLE_TIP);
    const ringTip = getLandmark(landmarks, L.RING_TIP);
    const pinkyTip = getLandmark(landmarks, L.PINKY_TIP);

    const indexExtended = isFingerExtended(indexTip, indexPip, indexMcp);
    if (!indexExtended) return null;

    const thumbClosed = !isFingerExtended(thumbTip, getLandmark(landmarks, L.THUMB_IP), getLandmark(landmarks, L.THUMB_MCP));
    const middleClosed = !isFingerExtended(middleTip, getLandmark(landmarks, L.MIDDLE_PIP), getLandmark(landmarks, L.MIDDLE_MCP));
    const ringClosed = !isFingerExtended(ringTip, getLandmark(landmarks, L.RING_PIP), getLandmark(landmarks, L.RING_MCP));
    const pinkyClosed = !isFingerExtended(pinkyTip, getLandmark(landmarks, L.PINKY_PIP), getLandmark(landmarks, L.PINKY_MCP));

    if (!thumbClosed || !middleClosed || !ringClosed || !pinkyClosed) return null;

    const wrist = getLandmark(landmarks, L.WRIST);
    const dist = distance2D(indexTip[0], indexTip[1], wrist[0], wrist[1]);

    const confidence = Math.min(dist / 0.5, 1);

    return { type: 'drawing', hand: handedness, confidence };
  }

  reset(): void {}
}

function getLandmark(landmarks: Float32Array, index: number): [number, number, number] {
  const i = index * 3;
  return [landmarks[i], landmarks[i + 1], landmarks[i + 2]];
}

function isFingerExtended(
  tip: [number, number, number],
  pip: [number, number, number],
  mcp: [number, number, number],
): boolean {
  return distance2D(tip[0], tip[1], mcp[0], mcp[1]) > distance2D(pip[0], pip[1], mcp[0], mcp[1]) + GESTURE.FINGER_EXTENSION_THRESHOLD;
}

function distance2D(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}
