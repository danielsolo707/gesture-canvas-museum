import { GestureDetector, GestureResult } from '../types';
import { Handedness, LANDMARK_INDICES as L } from '../../core/types';

export class EraserDetector implements GestureDetector {
  readonly name = 'eraser';

  detect(landmarks: Float32Array, handedness: Handedness): GestureResult | null {
    const indexTip = getLandmark(landmarks, L.INDEX_TIP);
    const indexPip = getLandmark(landmarks, L.INDEX_PIP);
    const indexMcp = getLandmark(landmarks, L.INDEX_MCP);

    const middleTip = getLandmark(landmarks, L.MIDDLE_TIP);
    const middlePip = getLandmark(landmarks, L.MIDDLE_PIP);
    const middleMcp = getLandmark(landmarks, L.MIDDLE_MCP);

    const thumbTip = getLandmark(landmarks, L.THUMB_TIP);
    const ringTip = getLandmark(landmarks, L.RING_TIP);
    const pinkyTip = getLandmark(landmarks, L.PINKY_TIP);

    const indexExt = isExtended(indexTip, indexPip, indexMcp);
    const middleExt = isExtended(middleTip, middlePip, middleMcp);

    if (!indexExt || !middleExt) return null;

    const thumbClosed = !isExtended(thumbTip, getLandmark(landmarks, L.THUMB_IP), getLandmark(landmarks, L.THUMB_MCP));
    const ringClosed = !isExtended(ringTip, getLandmark(landmarks, L.RING_PIP), getLandmark(landmarks, L.RING_MCP));
    const pinkyClosed = !isExtended(pinkyTip, getLandmark(landmarks, L.PINKY_PIP), getLandmark(landmarks, L.PINKY_MCP));

    if (!thumbClosed || !ringClosed || !pinkyClosed) return null;

    const dx = indexTip[0] - middleTip[0];
    const dy = indexTip[1] - middleTip[1];
    const fingerDistance = Math.sqrt(dx * dx + dy * dy);

    return {
      type: 'eraser',
      hand: handedness,
      confidence: 0.85,
      data: { fingerDistance },
    };
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
  const dTip = Math.sqrt((tip[0] - mcp[0]) ** 2 + (tip[1] - mcp[1]) ** 2);
  const dPip = Math.sqrt((pip[0] - mcp[0]) ** 2 + (pip[1] - mcp[1]) ** 2);
  return dTip > dPip + 0.08;
}
