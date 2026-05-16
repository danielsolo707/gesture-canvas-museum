import { WorkerMessage, WorkerResponse, WorkerHandData } from '../tracking/types';
import { INFERENCE } from '../core/constants';

let handLandmarker: any = null;
let offscreenCanvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;

  if (msg.type === 'init') {
    try {
      const { HandLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
      );

      handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: msg.modelPath,
          delegate: INFERENCE.DELEGATE,
        },
        runningMode: 'VIDEO',
        numHands: msg.maxHands,
        minHandDetectionConfidence: msg.minConfidence,
        minTrackingConfidence: msg.minConfidence,
      });

      self.postMessage({ type: 'ready' });
    } catch (err: unknown) {
      self.postMessage({
        type: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
    return;
  }

  if (msg.type === 'frame') {
    if (!handLandmarker) return;

    try {
      const bitmap = msg.bitmap;

      if (!offscreenCanvas || offscreenCanvas.width !== bitmap.width) {
        offscreenCanvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        ctx = offscreenCanvas.getContext('2d')!;
      }

      ctx!.clearRect(0, 0, bitmap.width, bitmap.height);
      ctx!.drawImage(bitmap, 0, 0);

      const result = handLandmarker.detectForVideo(offscreenCanvas, msg.timestamp);

      if (!result.landmarks || result.landmarks.length === 0) {
        self.postMessage({ type: 'landmarks', hands: [], timestamp: msg.timestamp } as WorkerResponse);
        return;
      }

      const hands: WorkerHandData[] = [];
      for (let i = 0; i < result.landmarks.length; i++) {
        const lm = result.landmarks[i];
        const arr = new Float32Array(lm.length * 3);
        for (let j = 0; j < lm.length; j++) {
          arr[j * 3] = lm[j].x;
          arr[j * 3 + 1] = lm[j].y;
          arr[j * 3 + 2] = lm[j].z;
        }

        hands.push({
          landmarks: arr,
          handedness: (result.handedness?.[i]?.[0]?.displayName === 'Left' ? 'Left' : 'Right') as 'Left' | 'Right',
          confidence: result.handedness?.[i]?.[0]?.score ?? 1,
        });
      }

      const response: WorkerResponse = {
        type: 'landmarks',
        hands,
        timestamp: msg.timestamp,
      };

      self.postMessage(response, { transfer: hands.map((h) => h.landmarks.buffer) } as any);
    } catch {
      self.postMessage({ type: 'landmarks', hands: [], timestamp: msg.timestamp } as WorkerResponse);
    }
  }
};
