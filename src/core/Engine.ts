import { EngineState, EngineMode, EngineStats, StrokePoint, Handedness, HandSnapshot, GestureType } from './types';
import { PERFORMANCE, GESTURE } from './constants';
import { EventBus, globalEventBus } from './EventBus';
import { WebcamManager } from '../tracking/WebcamManager';
import { HandTracker } from '../tracking/HandTracker';
import { GestureRecognizer } from '../gestures/GestureRecognizer';
import { StrokeEngine } from '../drawing/StrokeEngine';
import { ColorEngine } from '../features/colors/ColorEngine';
import { SceneManager } from '../rendering/SceneManager';
import { useStore } from '../store/useStore';
import { logger } from '../utils/logging';
import { getLandmark as getLm, distance3D } from '../gestures/detectors/utils';

export interface EngineConfig {
  canvas: HTMLCanvasElement;
  mode?: EngineMode;
}

export class Engine {
  private state: EngineState = 'uninitialized';
  private mode: EngineMode;
  private bus: EventBus;
  private webcam: WebcamManager;
  private tracker: HandTracker;
  private gesture: GestureRecognizer;
  private drawing: StrokeEngine;
  private scene: SceneManager;
  private config: EngineConfig;

  private rafId: number | null = null;
  private lastFrameTime = 0;
  private fpsValues: number[] = [];
  private lastFpsUpdate = 0;
  private running = false;

  private _stats: EngineStats = {
    fps: 0, inferenceMs: 0, gestureMs: 0, drawMs: 0, renderMs: 0,
    activeHands: 0, strokeCount: 0, mode: 'camera',
  };

  private activeDrawHands: Set<string> = new Set();
  private colorEngine: ColorEngine;
  private colorDwellIndex: number | null = null;
  private colorDwellStart = 0;
  private smoothHoverX = 0;
  private clearHoldStart = 0;
  private clearHoldActive = false;
  private clearCooldownUntil = 0;

  constructor(config: EngineConfig) {
    this.config = config;
    this.mode = config.mode ?? 'camera';
    this.bus = globalEventBus;
    this.webcam = new WebcamManager();
    this.tracker = new HandTracker();
    this.gesture = new GestureRecognizer();
    this.drawing = new StrokeEngine();
    this.colorEngine = new ColorEngine();
    this.scene = new SceneManager(config.canvas);
  }

  getStats(): Readonly<EngineStats> { return this._stats; }
  getStrokeEngine(): StrokeEngine { return this.drawing; }
  getSceneManager(): SceneManager { return this.scene; }

  async start(): Promise<void> {
    if (this.state !== 'uninitialized') return;
    this.setState('initializing');

    try {
      this.scene.initialize();
      this.drawing.initialize();
      this.gesture.initialize();

      if (this.mode === 'camera') {
        try {
          logger.info('Engine starting webcam');
          await this.webcam.start();
          this.onWebcamReady();
          useStore.getState().setMode('camera');
          useStore.getState().setWebcamReady(true);
          logger.info('Engine initializing tracker');
          await this.tracker.initialize();
          logger.info('Engine camera tracking ready');
        } catch (err) {
          logger.error('Engine camera/tracker failed; switching to fallback', err);
          this.mode = 'fallback';
          useStore.getState().setMode('fallback');
          useStore.getState().setWebcamReady(false);
          useStore.getState().setWebcamError(err instanceof Error ? err.message : String(err));
        }
      }

      this.setState('running');
      this.running = true;
      this.lastFrameTime = performance.now();
      this.loop(this.lastFrameTime);
    } catch (err) {
      this.setState('error');
      this.bus.emit('error', err as Error);
    }
  }

  pause(): void {
    this.running = false;
    if (this.rafId !== null) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    this.setState('paused');
  }

  resume(): void {
    if (this.state !== 'paused') return;
    this.running = true;
    this.lastFrameTime = performance.now();
    this.setState('running');
    this.loop(this.lastFrameTime);
  }

  async destroy(): Promise<void> {
    this.running = false;
    if (this.rafId !== null) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    this.webcam.stop();
    this.tracker.destroy();
    this.gesture.destroy();
    this.drawing.destroy();
    this.scene.destroy();
    this.bus.removeAll();
    this.setState('uninitialized');
  }

  private setState(s: EngineState): void {
    this.state = s;
    this.bus.emit('engine_state', s);
  }

  private onWebcamReady(): void {
    const video = this.webcam.getVideo();
    if (video) {
      this.scene.setVideoBackground(video);
    }
  }

  private lastStrokeUpdate = 0;

  private loop = (now: number): void => {
    if (!this.running) return;

    const delta = now - this.lastFrameTime;
    this.lastFrameTime = now;

    if (this.mode === 'camera') {
      this.processTracking(now).catch(() => {});
    }

    this.processDrawing(now);
    this.render(now);
    this.updateStats(now, delta);

    this.rafId = requestAnimationFrame(this.loop);
  };

  private async processTracking(now: number): Promise<void> {
    const t0 = performance.now();
    const video = this.webcam.getVideo();
    if (!video) return;

    let hands: HandSnapshot[] = [];
    try {
      hands = await this.tracker.detect(video);
    } catch (err) {
      logger.error('Engine tracking detect failed', err);
      hands = [];
    }
    this._stats.inferenceMs = performance.now() - t0;

    // Depth-of-field: only accept the hand closest to camera, reject background hands
    if (hands.length > 0) {
      hands = hands.filter((h) => computeHandScale(h.landmarks) >= 0.07);
      if (hands.length > 1) {
        hands.sort((a, b) => computeHandScale(b.landmarks) - computeHandScale(a.landmarks));
        hands = [hands[0]];
      }
    }

    this.bus.emit('hand_update', { hands });

    if (hands.length > 0) {
      const t2 = performance.now();
      const { events, handStates } = this.gesture.recognize(hands, now);
      this._stats.gestureMs = performance.now() - t2;

      for (const g of events) {
        this.bus.emit('gesture', g);
      }

      const visibleHandKeys = new Set<string>();
      const sortedHands = [...hands].sort((a, b) => getHandCenterX(a) - getHandCenterX(b));

      // Sync primary gesture to store for the gesture indicator
      let primaryGesture: GestureType | null = null;
      let primaryConfidence = 0;
      for (const hand of sortedHands) {
        const st = handStates.get(hand.handedness);
        if (st && st.type && st.confidence > primaryConfidence) {
          primaryGesture = st.type;
          primaryConfidence = st.confidence;
        }
      }
      if (primaryGesture) {
        useStore.getState().setGesture(primaryGesture as GestureType, sortedHands[0]?.handedness ?? 'Right', primaryConfidence);
      }

      for (let i = 0; i < sortedHands.length; i++) {
        const hand = sortedHands[i];
        const handKey = getHandKey(hand, i);
        visibleHandKeys.add(handKey);

        const point = getDrawingPoint(hand.landmarks);
        if (!point) continue;

        const handState = handStates.get(hand.handedness);
        const gestureType = handState?.type ?? null;

        const idxTip = getLandmark(hand.landmarks, 8);
        if (idxTip) {
          useStore.getState().setCursor(idxTip[0], idxTip[1]);
        }

        if (gestureType === 'eraser') {
          this.endActiveStroke(handKey);
          this.drawing.eraseStrokesAtPoint(point.x, point.y, useStore.getState().eraserSize * 0.005);
          continue;
        }

        if (gestureType === 'clear_canvas') {
          this.endActiveStroke(handKey);
          if (now < this.clearCooldownUntil) continue;
          if (!this.clearHoldActive) {
            this.clearHoldActive = true;
            this.clearHoldStart = now;
            useStore.getState().setClearProgress(0);
          }
          const elapsed = now - this.clearHoldStart;
          const progress = Math.min(elapsed / GESTURE.CLEAR_HOLD_MS, 1);
          useStore.getState().setClearProgress(progress);
          if (progress >= 1) {
            this.clearHoldActive = false;
            this.clearCooldownUntil = now + 2000;
            this.drawing.clearAll();
            useStore.getState().clearAllStrokes();
            useStore.getState().setClearProgress(0);
            this.bus.emit('clear_canvas', undefined);
          }
          continue;
        }
        if (this.clearHoldActive) {
          this.clearHoldActive = false;
          useStore.getState().setClearProgress(0);
        }

        if (gestureType === 'color_select') {
          this.endActiveStroke(handKey);
          useStore.getState().setColorPaletteActive(true);

          if (idxTip) {
            this.smoothHoverX += (idxTip[0] - this.smoothHoverX) * 0.25;
            const hoverIdx = Math.min(11, Math.max(0, Math.floor(this.smoothHoverX * 12)));
            useStore.getState().setColorHoverIndex(hoverIdx);

            if (hoverIdx !== this.colorDwellIndex) {
              this.colorDwellIndex = hoverIdx;
              this.colorDwellStart = now;
            } else if (now - this.colorDwellStart > 400) {
              this.colorEngine.selectColor(hoverIdx);
              this.colorDwellStart = now;
            }
          }
          continue;
        }
        useStore.getState().setColorPaletteActive(false);
        useStore.getState().setColorHoverIndex(null);
        this.colorDwellIndex = null;

        if (gestureType === 'drawing' || !gestureType) {
          const atTop = idxTip !== null && idxTip[1] < 0.10;
          if (!atTop) {
            if (!this.activeDrawHands.has(handKey)) {
              const state = useStore.getState();
              this.drawing.startStroke(handKey, point, state.color, state.strokeWidth, hand.handedness);
              this.activeDrawHands.add(handKey);
              useStore.getState().setIsDrawing(true);
            } else {
              this.drawing.extendStroke(handKey, point);
            }
            if (now - this.lastStrokeUpdate > 16) {
              const active = this.drawing.getActiveStroke(handKey);
              if (active) {
                this.bus.emit('stroke_update', active.toData());
              }
              this.lastStrokeUpdate = now;
            }
          } else {
            this.endActiveStroke(handKey);
          }
        } else {
          this.endActiveStroke(handKey);
        }
      }

      for (const handKey of [...this.activeDrawHands]) {
        if (!visibleHandKeys.has(handKey)) {
          this.endActiveStroke(handKey);
        }
      }
    } else {
      for (const h of this.activeDrawHands) {
        const data = this.drawing.endStroke(h);
        if (data) this.bus.emit('stroke_added', data);
      }
      this.activeDrawHands.clear();
      this.clearHoldActive = false;
      this.clearCooldownUntil = 0;
      useStore.getState().setClearProgress(0);
      useStore.getState().setGesture('idle', 'Left', 0);
      useStore.getState().setGesture('idle', 'Right', 0);
      useStore.getState().setIsDrawing(false);
      useStore.getState().setCursor(null, null);
      useStore.getState().setColorPaletteActive(false);
    }

    this._stats.activeHands = hands.length;
  }

  private processDrawing(now: number): void {
    const t0 = performance.now();
    this.drawing.update(now);
    this._stats.drawMs = performance.now() - t0;
  }

  private render(now: number): void {
    const t0 = performance.now();
    this.scene.render(now);
    this._stats.renderMs = performance.now() - t0;
  }

  private updateStats(now: number, delta: number): void {
    if (delta <= 0) return;
    const fps = delta > 0 ? 1000 / delta : 60;
    this.fpsValues.push(fps);
    if (this.fpsValues.length > PERFORMANCE.FPS_SAMPLE_WINDOW) {
      this.fpsValues.shift();
    }

    if (now - this.lastFpsUpdate > 1000) {
      const avg = this.fpsValues.reduce((a, b) => a + b, 0) / this.fpsValues.length;
      this._stats.fps = Math.round(avg);
      this._stats.strokeCount = this.drawing.getStrokeCount();
      this._stats.mode = this.mode;
      this.bus.emit('fps_update', this._stats.fps);
      this.lastFpsUpdate = now;
    }
  }

  private endActiveStroke(handKey: string): void {
    if (!this.activeDrawHands.has(handKey)) return;

    const data = this.drawing.endStroke(handKey);
    if (data) this.bus.emit('stroke_added', data);
    this.activeDrawHands.delete(handKey);
    useStore.getState().setIsDrawing(this.activeDrawHands.size > 0);
  }
}

function getLandmark(landmarks: Float32Array, index: number): [number, number, number] | null {
  const i = index * 3;
  if (i + 2 >= landmarks.length) return null;
  return [landmarks[i], landmarks[i + 1], landmarks[i + 2]];
}

function getDrawingPoint(landmarks: Float32Array): StrokePoint | null {
  const idxTip = getLandmark(landmarks, 8);
  if (!idxTip) return null;
  const aspect = window.innerWidth / window.innerHeight;
  return {
    x: (idxTip[0] - 0.5) * 2 * aspect,
    y: -(idxTip[1] - 0.5) * 2,
    z: 0,
  };
}

function getHandKey(hand: HandSnapshot, index: number): string {
  const wrist = getLandmark(hand.landmarks, 0);
  const screenSide = wrist && wrist[0] < 0.5 ? 'screen-left' : 'screen-right';
  return `${hand.handedness}:${screenSide}:${index}`;
}

function getHandCenterX(hand: HandSnapshot): number {
  let total = 0;
  let count = 0;
  for (let i = 0; i < hand.landmarks.length; i += 3) {
    total += hand.landmarks[i];
    count++;
  }
  return count > 0 ? total / count : 0.5;
}

function computeHandScale(landmarks: Float32Array): number {
  const wrist = getLm(landmarks, 0);
  const middleMcp = getLm(landmarks, 9);
  const d = distance3D(wrist[0], wrist[1], wrist[2], middleMcp[0], middleMcp[1], middleMcp[2]);
  return Math.max(d, 0.01);
}
