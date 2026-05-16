import { HandSnapshot } from '../core/types';
import { INFERENCE } from '../core/constants';
import { logger } from '../utils/logging';
import { OneEuroFilter } from '../smoothing/OneEuroFilter';

export class HandTracker {
  private landmarker: any = null;
  private smoothing: OneEuroFilter;
  private initialized = false;
  private frameSkip = 0;

  constructor() {
    this.smoothing = new OneEuroFilter();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const { HandLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');

      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
      );

      this.landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: INFERENCE.MODEL_PATH,
          delegate: INFERENCE.DELEGATE,
        },
        runningMode: 'VIDEO',
        numHands: INFERENCE.MAX_HANDS,
        minHandDetectionConfidence: INFERENCE.MIN_HAND_CONFIDENCE,
        minTrackingConfidence: INFERENCE.MIN_HAND_CONFIDENCE,
      });

      this.initialized = true;
      logger.info('HandLandmarker initialized');
    } catch (err) {
      logger.error('Failed to initialize HandLandmarker', err);
      throw err;
    }
  }

  detect(video: HTMLVideoElement): HandSnapshot[] {
    if (!this.landmarker || !this.initialized) return [];

    this.frameSkip++;
    if (this.frameSkip % INFERENCE.EVERY_NTH_FRAME !== 0) {
      return [];
    }

    try {
      const result = this.landmarker.detectForVideo(video, performance.now());
      if (!result.landmarks || result.landmarks.length === 0) return [];

      const hands: HandSnapshot[] = [];
      const now = performance.now();

      for (let i = 0; i < result.landmarks.length; i++) {
        const rawLandmarks = result.landmarks[i];
        const raw = new Float32Array(rawLandmarks.length * 3);

        for (let j = 0; j < rawLandmarks.length; j++) {
          raw[j * 3] = rawLandmarks[j].x;
          raw[j * 3 + 1] = rawLandmarks[j].y;
          raw[j * 3 + 2] = rawLandmarks[j].z;
        }

        const handId = `hand_${i}`;
        const smoothed = this.smoothing.filterLandmarks(handId, raw, now);

        const handedness: 'Left' | 'Right' =
          result.handedness?.[i]?.[0]?.displayName === 'Left' ? 'Left' : 'Right';
        const confidence = result.handedness?.[i]?.[0]?.score ?? 1;

        hands.push({
          landmarks: smoothed,
          handedness,
          confidence,
          timestamp: now,
        });
      }

      return hands;
    } catch (err) {
      logger.error('Hand detection error', err);
      return [];
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  destroy(): void {
    if (this.landmarker) {
      try {
        this.landmarker.close?.();
      } catch {
        // ignore
      }
      this.landmarker = null;
    }
    this.smoothing.destroy();
    this.initialized = false;
  }
}
