import { INFERENCE } from '../core/constants';

let landmarker: any = null;
let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let initialized = false;
let initPromise: Promise<void> | null = null;

async function initLandmarker(): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const { HandLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
    const wasmBase = new URL(`${import.meta.env.BASE_URL}tasks-vision/wasm/`, self.location.origin).href;
    const vision = await FilesetResolver.forVisionTasks(wasmBase, false);

    landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: INFERENCE.MODEL_PATH,
        delegate: INFERENCE.DELEGATE,
      },
      runningMode: 'VIDEO',
      numHands: INFERENCE.MAX_HANDS,
      minHandDetectionConfidence: INFERENCE.MIN_HAND_DETECTION_CONFIDENCE,
      minTrackingConfidence: INFERENCE.MIN_HAND_TRACKING_CONFIDENCE,
    });

    initialized = true;
  })();

  return initPromise;
}

function ensureCanvas(width: number, height: number): void {
  if (!canvas || canvas.width !== width || canvas.height !== height) {
    canvas = new OffscreenCanvas(width, height);
    ctx = canvas.getContext('2d', { alpha: false });
  }
}

self.onmessage = async (e: MessageEvent) => {
  const { type } = e.data;

  if (type === 'init') {
    try {
      await initLandmarker();
      self.postMessage({ type: 'ready' });
    } catch (err) {
      self.postMessage({ type: 'error', error: String(err) });
    }
    return;
  }

  if (type !== 'detect' || !initialized) return;

  const { bitmap, timestamp, width, height } = e.data;

  try {
    ensureCanvas(width, height);
    ctx!.clearRect(0, 0, width, height);
    ctx!.drawImage(bitmap, 0, 0);
    bitmap.close();

    const result = landmarker.detectForVideo(canvas as any, timestamp);

    const landmarks = result.landmarks?.map((lm: Array<{ x: number; y: number; z: number }>) =>
      lm.map((p) => ({ x: p.x, y: p.y, z: p.z }))
    ) ?? [];

    const handedness = result.handedness?.map((h: Array<{ displayName?: string; score?: number }>) => ({
      displayName: h[0]?.displayName,
      score: h[0]?.score,
    })) ?? [];

    self.postMessage({ type: 'result', landmarks, handedness, timestamp });
  } catch (err) {
    self.postMessage({ type: 'error', error: String(err) });
  }
};
