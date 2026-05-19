import { INFERENCE } from '../core/constants';

const LANDMARKS_PER_HAND = 21;
const FLOATS_PER_LANDMARK = 3;
const FLOATS_PER_HAND = LANDMARKS_PER_HAND * FLOATS_PER_LANDMARK;

let landmarker: any = null;
let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let initialized = false;
let initPromise: Promise<void> | null = null;

const landmarkPool: Float32Array[] = [];
const POOL_SIZE = 4;
function acquireFloatArray(len: number): Float32Array {
  for (let i = 0; i < landmarkPool.length; i++) {
    if (landmarkPool[i] && landmarkPool[i].length === len) {
      const buf = landmarkPool[i];
      landmarkPool[i] = null as any;
      return buf;
    }
  }
  return new Float32Array(len);
}
function releaseFloatArray(arr: Float32Array): void {
  if (landmarkPool.length < POOL_SIZE) {
    landmarkPool.push(arr);
  }
}

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
      minTrackingConfidence: INFERENCE.MIN_TRACKING_CONFIDENCE,
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

function packLandmarksToBinary(
  landmarks: Array<Array<{ x: number; y: number; z: number }>>,
  handedness: Array<Array<{ displayName?: string; score?: number }>>,
  timestamp: number,
): ArrayBuffer {
  const numHands = Math.min(landmarks.length, INFERENCE.MAX_HANDS);
  const headerSize = 4;
  const landmarkBytes = numHands * FLOATS_PER_HAND * 4;

  const buf = new ArrayBuffer(headerSize + landmarkBytes);
  const view = new DataView(buf);
  view.setUint32(0, numHands, true);

  const floatView = new Float32Array(buf, headerSize, numHands * FLOATS_PER_HAND);

  for (let h = 0; h < numHands; h++) {
    const base = h * FLOATS_PER_HAND;
    const lm = landmarks[h];
    for (let i = 0; i < LANDMARKS_PER_HAND && i < lm.length; i++) {
      floatView[base + i * 3] = lm[i].x;
      floatView[base + i * 3 + 1] = lm[i].y;
      floatView[base + i * 3 + 2] = lm[i].z;
    }
  }

  return buf;
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

  if (type === 'ping') {
    self.postMessage({ type: 'pong' });
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

    const landmarks = result.landmarks ?? [];
    const handedness = result.handedness ?? [];

    const buf = packLandmarksToBinary(
      landmarks,
      handedness.map((h: any) => [{ displayName: h[0]?.displayName, score: h[0]?.score }]),
      timestamp,
    );

    const numHands = Math.min(landmarks.length, INFERENCE.MAX_HANDS);
    const handednessInfo: Array<{ displayName?: string; score?: number }> = [];
    for (let h = 0; h < numHands; h++) {
      handednessInfo.push({
        displayName: handedness[h]?.[0]?.displayName,
        score: handedness[h]?.[0]?.score,
      });
    }

    self.postMessage(
      { type: 'result', buf, handedness: handednessInfo, timestamp },
      [buf],
    );
  } catch (err) {
    self.postMessage({ type: 'error', error: String(err) });
  }
};
