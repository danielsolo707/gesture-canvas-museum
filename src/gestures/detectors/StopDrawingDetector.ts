import { GestureDetector, GestureResult } from '../types';
import { Handedness, LANDMARK_INDICES as L } from '../../core/types';
import { GESTURE } from '../../core/constants';

export class StopDrawingDetector implements GestureDetector {
  readonly name = 'stop_drawing';

  detect(landmarks: Float32Array, handedness: Handedness): GestureResult | null {
    const wrist = getLandmark(landmarks, L.WRIST);
    const tips = [
      getLandmark(landmarks, L.THUMB_TIP),
      getLandmark(landmarks, L.INDEX_TIP),
      getLandmark(landmarks, L.MIDDLE_TIP),
      getLandmark(landmarks, L.RING_TIP),
      getLandmark(landmarks, L.PINKY_TIP),
    ];

    let maxDist = 0;
    for (const tip of tips) {
      const d = distance3D(tip[0], tip[1], tip[2], wrist[0], wrist[1], wrist[2]);
      if (d > maxDist) maxDist = d;
    }

    if (maxDist < GESTURE.FIST_THRESHOLD) {
      return { type: 'stop_drawing', hand: handedness, confidence: 0.9 };
    }

    return null;
  }

  reset(): void {}
}

function getLandmark(landmarks: Float32Array, index: number): [number, number, number] {
  const i = index * 3;
  return [landmarks[i], landmarks[i + 1], landmarks[i + 2]];
}

function distance3D(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number): number {
  const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
