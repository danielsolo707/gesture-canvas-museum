import { EngineState, EngineMode, EngineStats } from './types';
import { PERFORMANCE, STORE_SYNC_INTERVAL_MS } from './constants';
import { EventBus, globalEventBus } from './EventBus';
import { Pipeline } from './Pipeline';
import { WebcamManager } from '../tracking/WebcamManager';
import { HandTracker } from '../tracking/HandTracker';
import { GestureRecognizer } from '../gestures/GestureRecognizer';
import { StrokeEngine } from '../drawing/StrokeEngine';
import { SceneManager } from '../rendering/SceneManager';

export interface EngineConfig {
  canvas: HTMLCanvasElement;
  mode?: EngineMode;
}

export class Engine {
  private state: EngineState = 'uninitialized';
  private mode: EngineMode;
  private bus: EventBus;
  private pipeline: Pipeline;
  private webcam: WebcamManager;
  private tracker: HandTracker;
  private gesture: GestureRecognizer;
  private drawing: StrokeEngine;
  private scene: SceneManager;
  private config: EngineConfig;

  private rafId: number | null = null;
  private lastFrameTime = 0;
  private frameCount = 0;
  private fpsValues: number[] = [];
  private lastFpsUpdate = 0;
  private running = false;

  private _stats: EngineStats = {
    fps: 0, inferenceMs: 0, gestureMs: 0, drawMs: 0, renderMs: 0,
    activeHands: 0, strokeCount: 0, mode: 'camera',
  };

  constructor(config: EngineConfig) {
    this.config = config;
    this.mode = config.mode ?? 'camera';
    this.bus = globalEventBus;
    this.pipeline = new Pipeline();
    this.webcam = new WebcamManager();
    this.tracker = new HandTracker();
    this.gesture = new GestureRecognizer();
    this.drawing = new StrokeEngine();
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
      this.pipeline.setStrokeEngine(this.drawing);
      this.pipeline.on('stroke', (s) => this.bus.emit('stroke_added', s));

      if (this.mode === 'camera') {
        try {
          await this.webcam.start();
          await this.tracker.initialize();
        } catch {
          this.mode = 'fallback';
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

  private loop = (now: number): void => {
    if (!this.running) return;

    const delta = now - this.lastFrameTime;
    this.lastFrameTime = now;
    this.frameCount++;

    if (this.frameCount % 2 === 0 && this.mode === 'camera') {
      this.processTracking(now);
    }

    this.processDrawing(now);
    this.render(now);
    this.updateStats(now, delta);

    this.rafId = requestAnimationFrame(this.loop);
  };

  private processTracking(now: number): void {
    const t0 = performance.now();
    const video = this.webcam.getVideo();
    if (!video) return;

    const hands = this.tracker.detect(video);
    this._stats.inferenceMs = performance.now() - t0;

    if (hands.length > 0) {
      this.bus.emit('hand_update', { hands });
      const t2 = performance.now();
      const gestures = this.gesture.recognize(hands, now);
      this._stats.gestureMs = performance.now() - t2;
      for (const g of gestures) {
        this.bus.emit('gesture', g);
        if (g.type === 'clear_canvas' && g.confidence >= 1) {
          this.drawing.clearAll();
        }
      }
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
}
