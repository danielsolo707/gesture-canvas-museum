import { GestureDetector, GestureResult } from '../types';
import { Handedness, LANDMARK_INDICES as L } from '../../core/types';

export class ClearCanvasDetector implements GestureDetector {
  readonly name = 'clear_canvas';

  detect(landmarks: Float32Array, handedness: Handedness): GestureResult | null {
    const tips = [
      getLandmark(landmarks, L.THUMB_TIP),
      getLandmark(landmarks, L.INDEX_TIP),
      getLandmark(landmarks, L.MIDDLE_TIP),
      getLandmark(landmarks, L.RING_TIP),
      getLandmark(landmarks, L.PINKY_TIP),
    ];

    const mcp = [
      getLandmark(landmarks, L.THUMB_MCP),
      getLandmark(landmarks, L.INDEX_MCP),
      getLandmark(landmarks, L.MIDDLE_MCP),
      getLandmark(landmarks, L.RING_MCP),
      getLandmark(landmarks, L.PINKY_MCP),
    ];

    let extendedCount = 0;
    for (let i = 0; i < 5; i++) {
      const dTip = distance2D(tips[i][0], tips[i][1], mcp[i][0], mcp[i][1]);
      const threshold = i === 0 ? 0.12 : 0.1;
      if (dTip > threshold) extendedCount++;
    }

    if (extendedCount === 5) {
      return { type: 'clear_canvas', hand: handedness, confidence: 0.7 };
    }

    return null;
  }

  reset(): void {}
}

function getLandmark(landmarks: Float32Array, index: number): [number, number, number] {
  const i = index * 3;
  return [landmarks[i], landmarks[i + 1], landmarks[i + 2]];
}

function distance2D(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1, dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}
