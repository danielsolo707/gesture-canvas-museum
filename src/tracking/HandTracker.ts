import { HandSnapshot } from '../core/types';
import { INFERENCE, SMOOTHING } from '../core/constants';
import { OneEuroFilter } from '../smoothing/OneEuroFilter';
import { logger } from '../utils/logging';

type HandLandmarkerInstance = {
  detectForVideo: (source: HTMLCanvasElement, timestamp: number) => {
    landmarks?: Array<Array<{ x: number; y: number; z: number }>>;
    handedness?: Array<Array<{ displayName?: string; score?: number }>>;
  };
  close?: () => void;
};

function getLocalWasmBaseUrl(): string {
  return new URL('/tasks-vision/wasm/', window.location.origin).href;
}

export class HandTracker {
  private landmarker: HandLandmarkerInstance | null = null;
  private initialized = false;
  private initializing: Promise<void> | null = null;
  private lastDetect = 0;
  private lastHands: HandSnapshot[] = [];
  private lastHandsAt = 0;
  private prevHands: HandSnapshot[] = [];
  private prevHandsAt = 0;
  private mirrorCanvas: HTMLCanvasElement | null = null;
  private mirrorCtx: CanvasRenderingContext2D | null = null;
  private filter: OneEuroFilter;

  private worker: Worker | null = null;
  private workerReady = false;
  private workerBusy = false;
  private useWorker = true;
  private pendingWorkerResolve: ((hands: HandSnapshot[]) => void) | null = null;

  constructor() {
    this.filter = new OneEuroFilter({
      minCutoff: SMOOTHING.MIN_CUTOFF,
      beta: SMOOTHING.BETA,
      dCutoff: SMOOTHING.D_CUTOFF,
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initializing) return this.initializing;

    logger.info('HandTracker initializing');

    this.initializing = (async () => {
      try {
        await this.initWorker();
      } catch {
        logger.warn('Worker init failed, falling back to main-thread MediaPipe');
        this.useWorker = false;
      }

      if (!this.useWorker) {
        await this.createLandmarker();
      }

      this.initialized = true;
    })();

    return this.initializing;
  }

  private async initWorker(): Promise<void> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(
        new URL('../workers/tracking.worker.ts', import.meta.url),
        { type: 'module' },
      );

      const timeout = setTimeout(() => {
        worker.terminate();
        reject(new Error('Worker init timeout'));
      }, 8000);

      worker.onmessage = (e: MessageEvent) => {
        if (e.data.type === 'ready') {
          clearTimeout(timeout);
          this.worker = worker;
          this.workerReady = true;
          worker.onmessage = this.onWorkerMessage;
          logger.info('Tracking worker ready');
          resolve();
        } else if (e.data.type === 'error') {
          clearTimeout(timeout);
          worker.terminate();
          reject(new Error(e.data.error));
        }
      };

      worker.onerror = (err) => {
        clearTimeout(timeout);
        worker.terminate();
        reject(err);
      };

      worker.postMessage({ type: 'init' });
    });
  }

  private onWorkerMessage = (e: MessageEvent): void => {
    if (e.data.type === 'error') {
      this.workerBusy = false;
      const errorMessage = typeof e.data.error === 'string' ? e.data.error : 'Tracking worker error';
      logger.error('Tracking worker error', errorMessage);
      if (this.pendingWorkerResolve) {
        this.pendingWorkerResolve([]);
        this.pendingWorkerResolve = null;
      }
      void this.fallbackToMainThread(errorMessage);
      return;
    }

    if (e.data.type !== 'result' || !this.pendingWorkerResolve) return;

    const hands = this.processRawResult(e.data.landmarks, e.data.handedness, e.data.timestamp);
    this.workerBusy = false;

    this.prevHands = this.lastHands;
    this.prevHandsAt = this.lastHandsAt;
    this.lastHands = hands;
    this.lastHandsAt = e.data.timestamp;

    if (hands.length > 0) {
      logger.info('HandTracker detected hands', {
        hands: hands.map((h: HandSnapshot) => ({ handedness: h.handedness, confidence: h.confidence })),
      });
    }

    this.pendingWorkerResolve(hands);
    this.pendingWorkerResolve = null;
  };

  async detect(video: HTMLVideoElement): Promise<HandSnapshot[]> {
    if (!this.initialized) return [];

    const now = performance.now();

    if (this.useWorker && this.workerReady) {
      return this.detectWithWorker(video, now);
    }

    return this.detectMainThread(video, now);
  }

  private async detectWithWorker(video: HTMLVideoElement, now: number): Promise<HandSnapshot[]> {
    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) return [];

    if (this.workerBusy || now - this.lastDetect < INFERENCE.MIN_INTERVAL_MS) {
      return this.getExtrapolatedHands(now);
    }

    this.workerBusy = true;
    this.lastDetect = now;

    try {
      const source = this.getMirroredVideoFrame(video);
      const bitmap = await createImageBitmap(source);

      return new Promise((resolve) => {
        this.pendingWorkerResolve = resolve;
        this.worker!.postMessage(
          {
            type: 'detect',
            bitmap,
            timestamp: now,
            width: source.width,
            height: source.height,
          },
          [bitmap],
        );
      });
    } catch (err) {
      this.workerBusy = false;
      logger.error('Worker detection send failed', err);
      return this.getExtrapolatedHands(now);
    }
  }

  private async detectMainThread(video: HTMLVideoElement, now: number): Promise<HandSnapshot[]> {
    if (!this.landmarker) return [];
    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) return [];

    if (now - this.lastDetect < INFERENCE.MIN_INTERVAL_MS) {
      return this.getExtrapolatedHands(now);
    }
    this.lastDetect = now;

    try {
      const source = this.getMirroredVideoFrame(video);
      const result = this.landmarker.detectForVideo(source, now);
      const hands = this.processRawResult(
        result.landmarks?.map((lm) => lm.map((p) => ({ x: p.x, y: p.y, z: p.z }))) ?? [],
        result.handedness?.map((h) => ({ displayName: h[0]?.displayName, score: h[0]?.score })) ?? [],
        now,
      );

      this.prevHands = this.lastHands;
      this.prevHandsAt = this.lastHandsAt;
      this.lastHands = hands;
      this.lastHandsAt = now;

      if (hands.length > 0) {
        logger.info('HandTracker detected hands', {
          hands: hands.map((h) => ({ handedness: h.handedness, confidence: h.confidence })),
        });
      }

      return hands;
    } catch (err) {
      logger.error('HandTracker detection failed', err);
      return [];
    }
  }

  private getExtrapolatedHands(now: number): HandSnapshot[] {
    if (this.lastHands.length === 0) return [];
    if (this.prevHands.length === 0) return this.lastHands;
    if (now - this.lastHandsAt > INFERENCE.CACHED_HAND_MAX_AGE_MS * 2) return [];

    const dt = this.lastHandsAt - this.prevHandsAt;
    if (dt <= 0) return this.lastHands;

    const elapsed = now - this.lastHandsAt;
    const t = Math.min(elapsed / dt, 2.0);

    return this.lastHands.map((hand, i) => {
      const prev = this.prevHands[i];
      if (!prev || prev.handedness !== hand.handedness) return hand;

      const result = new Float32Array(hand.landmarks.length);
      for (let j = 0; j < hand.landmarks.length; j++) {
        result[j] = hand.landmarks[j] + (hand.landmarks[j] - prev.landmarks[j]) * t;
      }

      return {
        ...hand,
        landmarks: result,
        confidence: Math.max(0, hand.confidence - t * 0.03),
      };
    });
  }

  private processRawResult(
    rawLandmarks: Array<Array<{ x: number; y: number; z: number }>>,
    rawHandedness: Array<{ displayName?: string; score?: number }>,
    timestamp: number,
  ): HandSnapshot[] {
    if (!rawLandmarks || rawLandmarks.length === 0) return [];

    const prevCenters = this.lastHands.map((hand) => this.getLandmarkCenter(hand.landmarks));
    const usedPrev = new Set<number>();

    return rawLandmarks.map((landmarks, i) => {
      const raw = new Float32Array(landmarks.length * 3);
      for (let j = 0; j < landmarks.length; j++) {
        raw[j * 3] = landmarks[j].x;
        raw[j * 3 + 1] = landmarks[j].y;
        raw[j * 3 + 2] = landmarks[j].z;
      }

      // Match to previous hands by center to keep filtering/handedness stable during fast motion.
      const rawCenter = this.getLandmarkCenter(raw);
      let matchedPrev = -1;
      let bestDist = Number.POSITIVE_INFINITY;
      for (let j = 0; j < prevCenters.length; j++) {
        if (usedPrev.has(j)) continue;
        const dx = rawCenter.x - prevCenters[j].x;
        const dy = rawCenter.y - prevCenters[j].y;
        const dist = Math.hypot(dx, dy);
        if (dist < bestDist) {
          bestDist = dist;
          matchedPrev = j;
        }
      }

      if (matchedPrev >= 0 && bestDist <= INFERENCE.HAND_MATCH_DISTANCE) {
        usedPrev.add(matchedPrev);
      } else {
        matchedPrev = -1;
      }

      const detected = rawHandedness[i]?.displayName;
      const detectedHandedness = detected === 'Left' ? 'Right' : (detected === 'Right' ? 'Left' : 'Right');
      const handedness = matchedPrev >= 0 ? this.lastHands[matchedPrev].handedness : detectedHandedness;
      const handId = matchedPrev >= 0 ? `track:${matchedPrev}` : `track:${i}`;

      const filtered = this.filter.filterLandmarks(handId, raw, timestamp);

      return {
        landmarks: filtered,
        handedness,
        confidence: rawHandedness[i]?.score ?? 1,
        timestamp,
      };
    });
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  destroy(): void {
    try {
      this.landmarker?.close?.();
    } catch {
      // Ignore MediaPipe close errors during teardown.
    }
    this.landmarker = null;

    if (this.worker) {
      this.worker.onmessage = null;
      this.worker.terminate();
      this.worker = null;
    }
    this.workerReady = false;

    this.initialized = false;
    this.initializing = null;
    this.lastHands = [];
    this.prevHands = [];
    this.lastHandsAt = 0;
    this.prevHandsAt = 0;
    this.mirrorCanvas = null;
    this.mirrorCtx = null;
    this.filter.destroy();
  }

  private async createLandmarker(): Promise<void> {
    try {
      const { HandLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
      logger.info('MediaPipe tasks-vision module imported locally');

      const vision = await FilesetResolver.forVisionTasks(getLocalWasmBaseUrl(), false);
      logger.info('MediaPipe local WASM fileset resolved');

      this.landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: INFERENCE.MODEL_PATH,
          delegate: INFERENCE.DELEGATE,
        },
        runningMode: 'VIDEO',
        numHands: INFERENCE.MAX_HANDS,
        minHandDetectionConfidence: INFERENCE.MIN_HAND_DETECTION_CONFIDENCE,
        minTrackingConfidence: INFERENCE.MIN_HAND_TRACKING_CONFIDENCE,
      }) as HandLandmarkerInstance;

      this.initialized = true;
      logger.info('HandLandmarker initialized locally');
    } catch (err) {
      logger.error('Failed to initialize local HandLandmarker', err);
      throw err;
    }
  }

  private async fallbackToMainThread(reason: string): Promise<void> {
    if (!this.useWorker) return;

    logger.warn('Disabling tracking worker', { reason });
    this.useWorker = false;
    this.workerReady = false;
    this.workerBusy = false;

    if (this.worker) {
      this.worker.onmessage = null;
      this.worker.terminate();
      this.worker = null;
    }

    if (!this.landmarker) {
      try {
        await this.createLandmarker();
      } catch (err) {
        logger.error('Fallback landmarker init failed', err);
      }
    }
  }

  private getMirroredVideoFrame(video: HTMLVideoElement): HTMLCanvasElement {
    const width = video.videoWidth;
    const height = video.videoHeight;

    if (!this.mirrorCanvas) {
      this.mirrorCanvas = document.createElement('canvas');
      this.mirrorCtx = this.mirrorCanvas.getContext('2d', { alpha: false });
    }

    if (!this.mirrorCtx || !this.mirrorCanvas) {
      throw new Error('Could not create tracking canvas');
    }

    if (this.mirrorCanvas.width !== width || this.mirrorCanvas.height !== height) {
      this.mirrorCanvas.width = width;
      this.mirrorCanvas.height = height;
    }

    this.mirrorCtx.clearRect(0, 0, width, height);
    this.mirrorCtx.save();
    this.mirrorCtx.scale(-1, 1);
    this.mirrorCtx.drawImage(video, -width, 0, width, height);
    this.mirrorCtx.restore();

    return this.mirrorCanvas;
  }

  private getLandmarkCenter(landmarks: Float32Array): { x: number; y: number } {
    let totalX = 0;
    let totalY = 0;
    let count = 0;
    for (let i = 0; i < landmarks.length; i += 3) {
      totalX += landmarks[i];
      totalY += landmarks[i + 1];
      count++;
    }
    const denom = count === 0 ? 1 : count;
    return { x: totalX / denom, y: totalY / denom };
  }
}
