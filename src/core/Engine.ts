import { EngineState, EngineMode, EngineStats, StrokePoint, HandSnapshot, GestureType, GestureDebugInfo, CursorState, Action, HandIntegrity, EdgeProximityInfo, GestureFreezeState } from './types';
import { PERFORMANCE, GESTURE, INTERACTION, RENDER, FREEZE } from './constants';
import { EventBus, globalEventBus } from './EventBus';
import { GestureActionMapper } from './GestureActionMapper';
import { WebcamManager } from '../tracking/WebcamManager';
import { HandTracker } from '../tracking/HandTracker';
import { GestureRecognizer } from '../gestures/GestureRecognizer';
import { StrokeEngine } from '../drawing/StrokeEngine';
import { ColorEngine } from '../features/colors/ColorEngine';
import { SceneManager } from '../rendering/SceneManager';
import { PredictiveCursor } from '../utils/PredictiveCursor';
import { EdgeProximityDetector } from '../tracking/EdgeProximityDetector';
import { GestureFreezeController } from '../tracking/GestureFreezeController';
import { SafeInteractionZoneMapper } from '../tracking/SafeInteractionZoneMapper';
import { ViewportCalibration } from '../tracking/ViewportCalibration';
import { useStore } from '../store/useStore';
import { logger } from '../utils/logging';
import { getLandmark as getLm, distance3D } from '../utils/math';

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
  private frameCount = 0;
  private trackingInterval = 0;
  private lastTrackingTime = 0;
  private trackingInProgress = false;

  private _stats: EngineStats = {
    fps: 0, inferenceMs: 0, gestureMs: 0, drawMs: 0, renderMs: 0,
    activeHands: 0, strokeCount: 0, mode: 'camera',
    motionSpeed: 0, pipelineLatencyMs: 0,
    trackingStability: 0, intentConfidence: 0,
  };

  private activeDrawHands = new Set<string>();
  private actionMapper: GestureActionMapper;
  private colorEngine: ColorEngine;
  private colorDwellIndex: number | null = null;
  private paletteHoverActive = false;
  private lastStrokeUpdate = 0;

  private cursorState: CursorState = {
    x: 0.5, y: 0.5, targetX: 0.5, targetY: 0.5,
    easedX: 0.5, easedY: 0.5, visible: false,
    isDrawing: false, isErasing: false, isCursor: false,
    size: 12, opacity: 0,
  };

  private attractTimer = 0;
  private idleFadeTimer = 0;

  private edgeDetector: EdgeProximityDetector;
  private freezeController: GestureFreezeController;
  private safeZoneMapper: SafeInteractionZoneMapper;
  private predictiveCursor: PredictiveCursor;
  private viewportCalibration: ViewportCalibration;

  private lastIntegrity: HandIntegrity | null = null;
  private lastEdgeProx: EdgeProximityInfo | null = null;
  private lastFreezeState: GestureFreezeState | null = null;
  private cursorFadeTimer = 0;
  private freezePredictedPos: { x: number; y: number } | null = null;

  constructor(config: EngineConfig) {
    this.config = config;
    this.mode = config.mode ?? 'camera';
    this.bus = globalEventBus;
    this.actionMapper = new GestureActionMapper();
    this.webcam = new WebcamManager();
    this.tracker = new HandTracker();
    this.gesture = new GestureRecognizer();
    this.drawing = new StrokeEngine();
    this.colorEngine = new ColorEngine();
    this.scene = new SceneManager(config.canvas);
    this.edgeDetector = new EdgeProximityDetector();
    this.freezeController = new GestureFreezeController();
    this.safeZoneMapper = new SafeInteractionZoneMapper();
    this.predictiveCursor = new PredictiveCursor();
    this.viewportCalibration = new ViewportCalibration();
  }

  getStats(): Readonly<EngineStats> { return this._stats; }
  getStrokeEngine(): StrokeEngine { return this.drawing; }
  getSceneManager(): SceneManager { return this.scene; }
  getGestureRecognizer(): GestureRecognizer { return this.gesture; }
  getActionMapper(): GestureActionMapper { return this.actionMapper; }

  async start(): Promise<void> {
    if (this.state !== 'uninitialized') return;
    this.setState('initializing');

    try {
      this.scene.initialize();
      this.drawing.initialize();
      this.gesture.initialize();

      if (this.mode === 'camera') {
        try {
          await this.webcam.start();
          this.onWebcamReady();
          useStore.getState().setMode('camera');
          useStore.getState().setWebcamReady(true);
          await this.tracker.initialize();
        } catch (err) {
          logger.error('Camera/tracker failed; using fallback', err);
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
    this.freezeController.reset();
    this.setState('uninitialized');
  }

  private setState(s: EngineState): void {
    this.state = s;
    this.bus.emit('engine_state', s);
  }

  private onWebcamReady(): void {
    const video = this.webcam.getVideo();
    if (!video) return;
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    this.tracker.prepareMirrorCanvas(w, h);
    const mirrorCanvas = this.tracker.getMirrorCanvas();
    if (mirrorCanvas) this.scene.setVideoBackground(mirrorCanvas);
  }

  private loop = (now: number): void => {
    if (!this.running) return;

    const delta = now - this.lastFrameTime;
    this.lastFrameTime = now;
    this.frameCount++;

    if (this.mode === 'camera' && !this.trackingInProgress) {
      this.processTracking(now).catch(() => {});
    }

    this.processDrawing(now);
    this.processIdleTimers(now, delta);
    this.freezeAdvanceBlend();
    this.render(now);
    this.updateStats(now, delta);

    this.rafId = requestAnimationFrame(this.loop);
  };

  private freezeAdvanceBlend(): void {
    this.freezeController.advanceUnfreezeBlend();
  }

  private async processTracking(now: number): Promise<void> {
    this.trackingInProgress = true;
    try {
      const t0 = performance.now();
      const video = this.webcam.getVideo();
      if (!video) return;

      this.trackingInterval = now - this.lastTrackingTime;
      this.lastTrackingTime = now;

      let hands: HandSnapshot[] = [];
      try {
        hands = await this.tracker.detect(video);
      } catch (err) {
        logger.error('Tracking detect failed', err);
        hands = [];
      }
      this.scene.markVideoNeedsUpdate();
      this._stats.inferenceMs = performance.now() - t0;

      if (hands.length > 0) {
        hands = hands.filter((h) => computeHandScale(h.landmarks) >= 0.03);
        if (hands.length > 1) {
          hands.sort((a, b) => computeHandScale(b.landmarks) - computeHandScale(a.landmarks));
          hands = [hands[0]];
        }
      }

      const integrity: HandIntegrity | null = hands.length > 0
        ? this.tracker.getIntegrity(hands[0])
        : null;
      this.lastIntegrity = integrity;

      const edgeProx: EdgeProximityInfo | null = hands.length > 0
        ? this.edgeDetector.compute(hands[0].landmarks)
        : null;
      this.lastEdgeProx = edgeProx;

      this.attractTimer = 0;
      this.idleFadeTimer = 0;
      this.viewportCalibration.sample(hands);
      this.bus.emit('hand_update', { hands });

      if (hands.length > 0) {
        const pipelineStart = performance.now();

        // Step 1: Run gesture recognition FIRST to get actual gesture/confidence
        const t2 = performance.now();
        const initialResult = this.gesture.recognize(hands, now, integrity, edgeProx, null);
        this._stats.gestureMs = performance.now() - t2;

        // Step 2: Extract primary gesture from result
        const sortedHands = [...hands].sort((a, b) => getHandCenterX(a) - getHandCenterX(b));
        let primaryGesture: GestureType | null = null;
        let primaryConfidence = 0;
        for (const hand of sortedHands) {
          const st = initialResult.handStates.get(hand.handedness);
          if (st && st.type && st.confidence > primaryConfidence) {
            primaryGesture = st.type;
            primaryConfidence = st.confidence;
          }
        }

        // Step 3: Pass actual gesture + confidence to freeze controller (FIX: was 'idle'/0)
        // Confidence floor: when integrity >= 0.6 (hand well-tracked), ensure
        // freeze can always clear by providing at least 0.5 confidence
        const freezeConfidence = (integrity?.score ?? 0) >= 0.6
          ? Math.max(primaryConfidence, 0.5)
          : primaryConfidence;
        const freezeState = this.freezeController.update(
          primaryGesture ?? 'idle', freezeConfidence,
          integrity ?? this.zeroIntegrity(),
          edgeProx ?? this.zeroEdgeProx(), now,
        );

        // Step 4: If frozen, re-run gesture recognition with freeze state for override
        const result = freezeState.frozen
          ? this.gesture.recognize(hands, now, integrity, edgeProx, freezeState)
          : initialResult;

        for (const g of result.events) {
          this.bus.emit('gesture', g);
          const action = this.actionMapper.translate(g);
          if (action.type !== 'IDLE') {
            this.bus.emit('action', action);
          }
        }

        if (result.pipelineDebug) {
          this._stats.motionSpeed = result.pipelineDebug.motionSpeed;
          this._stats.trackingStability = result.pipelineDebug.trackingStability;
          this._stats.intentConfidence = result.pipelineDebug.intentScore;
        }

        this.lastFreezeState = freezeState;

        const effectiveGesture = freezeState.frozen ? freezeState.lastStableGesture : (primaryGesture ?? 'idle');
        const effectiveConfidence = freezeState.frozen ? freezeState.lastStableConfidence : primaryConfidence;

        if (primaryGesture) {
          useStore.getState().setGesture(effectiveGesture, sortedHands[0]?.handedness ?? 'Right', effectiveConfidence);
        }

        if (result.pipelineDebug) {
          const debugInfo: GestureDebugInfo = {
            activeGesture: effectiveGesture,
            gestureConfidence: effectiveConfidence,
            motionSpeed: result.pipelineDebug.motionSpeed,
            stableCount: 0,
            trackingStability: result.pipelineDebug.trackingStability,
            intentScore: result.pipelineDebug.intentScore,
            dynamicThreshold: result.pipelineDebug.dynamicThreshold,
            handIntegrity: integrity?.score ?? 0,
            edgeProximity: edgeProx?.overall ?? 0,
            gestureFrozen: freezeState.frozen,
            freezeActive: freezeState.frozen,
            predictionActive: freezeState.frozen && freezeState.lastStableGesture !== 'idle',
            safeZoneActive: (edgeProx?.overall ?? 0) > 0.3,
            smoothedConfidence: result.pipelineDebug.smoothedConfidence,
            freezeReason: freezeState.freezeReason,
            completenessScore: integrity?.score ?? 0,
            topEdge: edgeProx?.top ?? 0,
            bottomEdge: edgeProx?.bottom ?? 0,
            leftEdge: edgeProx?.left ?? 0,
            rightEdge: edgeProx?.right ?? 0,
          };
          useStore.getState().setGestureDebug(debugInfo);
        }

        useStore.getState().setIntegrityDebug(
          integrity?.score ?? 0,
          edgeProx?.overall ?? 0,
          freezeState.frozen,
          freezeState.frozen,
          freezeState.frozen && freezeState.lastStableGesture !== 'idle',
          (edgeProx?.overall ?? 0) > 0.3,
          hands.length === 0,
          freezeState.freezeReason,
          result.pipelineDebug?.smoothedConfidence,
        );

        for (let i = 0; i < sortedHands.length; i++) {
          const hand = sortedHands[i];
          let handKey = getHandKey(hand, i);
          const point = getDrawingPoint(hand.landmarks, this.config.canvas);
          if (!point) continue;

          // During freeze recovery, the hand may return with different handedness,
          // which changes handKey. Migrate the existing stroke to the new key so
          // the original stroke continues instead of creating a phantom new one.
          if (freezeState.frozen && !this.activeDrawHands.has(handKey) && this.activeDrawHands.size > 0) {
            const oldKey = this.activeDrawHands.values().next().value;
            if (oldKey !== undefined) {
              this.activeDrawHands.delete(oldKey);
              this.activeDrawHands.add(handKey);
              this.drawing.migrateStrokeKey(oldKey, handKey);
            }
          }

          const handState = result.handStates.get(hand.handedness);
          const gestureType = freezeState.frozen ? freezeState.lastStableGesture : (handState?.type ?? null);

          const idxTip = getLandmark(hand.landmarks, 8);
          this.updateCursor(idxTip, gestureType, now, handState?.confidence ?? 0, integrity, edgeProx);

          if (gestureType === 'eraser') {
            this.endActiveStroke(handKey);
            this.drawing.eraseStrokesAtPoint(point.x, point.y, 0.05);
            useStore.getState().setIsErasing(true);
            continue;
          }
          useStore.getState().setIsErasing(false);

          if (gestureType === 'cursor') {
            this.endActiveStroke(handKey);
            this.handleCursorMode(hand, idxTip, now);
            continue;
          }
          this.deactivatePalette();

          if (gestureType === 'drawing') {
            this.handleDrawingMode(hand, handKey, point, idxTip, now, freezeState);
          } else {
            if (!freezeState.frozen) {
              this.endActiveStroke(handKey);
            }
          }
        }

        if (!freezeState.frozen) {
          for (const handKey of [...this.activeDrawHands]) {
            if (!hands.find((_, i) => getHandKey(hands[i], i) === handKey)) {
              this.endActiveStroke(handKey);
            }
          }
        }

        this._stats.pipelineLatencyMs = performance.now() - pipelineStart;
      } else {
        const lastGesture = this.activeDrawHands.size > 0 ? 'drawing' : 'idle';
        const freezeState = this.freezeController.update(
          lastGesture, this.cursorState.opacity,
          integrity ?? this.zeroIntegrity(), edgeProx ?? this.zeroEdgeProx(), now,
        );
        this.lastFreezeState = freezeState;

        if (freezeState.frozen && this.activeDrawHands.size > 0) {
          const pred = this.predictiveCursor.getCurrent();
          if (pred) {
            const decay = Math.max(0.5, 1 - (freezeState.freezeDurationMs / 400) * 0.5);
            const decayed = this.predictiveCursor.getDecayedPosition(decay);
            const safe = this.safeZoneMapper.map(decayed.x, decayed.y);
            const freezePoint: StrokePoint = {
              x: (safe.stabilizedX - 0.5) * 2 * (this.config.canvas.clientWidth / this.config.canvas.clientHeight),
              y: -(safe.stabilizedY - 0.5) * 2,
              z: 0,
            };
            for (const handKey of this.activeDrawHands) {
              this.drawing.extendStroke(handKey, freezePoint);
            }
            this.cursorState.easedX = decayed.x;
            this.cursorState.easedY = decayed.y;
          }

          this.cursorState.isDrawing = true;
          this.cursorState.opacity = Math.max(0.15, this.cursorState.opacity - 0.02);
          useStore.getState().setCursor(this.cursorState.easedX, this.cursorState.easedY, this.cursorState);

          this._stats.activeHands = 0;
          this._stats.pipelineLatencyMs = 0;
          return;
        }

        for (const h of this.activeDrawHands) {
          const data = this.drawing.endStroke(h);
          if (data) this.bus.emit('stroke_added', data);
        }
        this.activeDrawHands.clear();
        this.useStore().setGesture('idle', 'Left', 0);
        this.useStore().setGesture('idle', 'Right', 0);
        this.useStore().setIsDrawing(false);

        if (this.cursorState.opacity > 0.01) {
          this.cursorState.opacity = Math.max(0, this.cursorState.opacity - 0.04);
          useStore.getState().setCursor(this.cursorState.easedX, this.cursorState.easedY, this.cursorState);
        } else {
          useStore.getState().setCursor(null, null);
          this.cursorState.visible = false;
        }
        this.useStore().setColorPaletteActive(false);
        this.deactivatePalette();
      }

      this._stats.activeHands = hands.length;
    } finally {
      this.trackingInProgress = false;
    }
  }

  private useStore() { return useStore.getState(); }

  private zeroIntegrity(): HandIntegrity {
    return {
      score: 0, wristVisible: false, palmIntact: false,
      individualFingers: { thumb: false, index: false, middle: false, ring: false, pinky: false },
      requiredGroups: { drawing: false, cursor: false, eraser: false },
      edgeFlags: { anyEdge: false, leftEdge: false, rightEdge: false, topEdge: false, bottomEdge: false },
      missingLandmarkCount: 21,
    };
  }

  private zeroEdgeProx(): EdgeProximityInfo {
    return {
      left: 0, right: 0, top: 0, bottom: 0, overall: 0,
      dampingFactor: 1, gestureSensitivity: 1, cursorDamping: 1,
      perEdgeConfidence: { left: 1, right: 1, top: 1, bottom: 1 },
    };
  }

  private processIdleTimers(now: number, _delta: number): void {
    if (this.mode === 'camera') {
      this.attractTimer += _delta;
      this.idleFadeTimer += _delta;
    }
  }

  private updateCursor(
    idxTip: [number, number, number] | null,
    gestureType: GestureType | null,
    now: number,
    confidence: number,
    integrity: HandIntegrity | null,
    edgeProx: EdgeProximityInfo | null,
  ): void {
    if (idxTip && integrity && integrity.score >= 0.3) {
      const safe = this.safeZoneMapper.map(idxTip[0], idxTip[1]);
      this.cursorState.targetX = safe.stabilizedX;
      this.cursorState.targetY = safe.stabilizedY;

      const dx = this.cursorState.targetX - this.cursorState.easedX;
      const dy = this.cursorState.targetY - this.cursorState.easedY;
      const easeFactor = edgeProx && edgeProx.dampingFactor < 0.7
        ? INTERACTION.CURSOR_EASING_FACTOR * (1 + (1 - (edgeProx?.dampingFactor ?? 1)) * 0.5)
        : INTERACTION.CURSOR_EASING_FACTOR;

      this.cursorState.easedX += dx * easeFactor;
      this.cursorState.easedY += dy * easeFactor;
      this.cursorState.easedY = Math.max(this.cursorState.easedY, INTERACTION.UI_TOP_MARGIN);

      this.cursorState.x = this.cursorState.easedX;
      this.cursorState.y = this.cursorState.easedY;
      this.cursorState.visible = true;
      this.cursorFadeTimer = 0;

      this.predictiveCursor.update(this.cursorState.easedX, this.cursorState.easedY, now);

      this.cursorState.isDrawing = gestureType === 'drawing';
      this.cursorState.isErasing = gestureType === 'eraser';
      this.cursorState.isCursor = gestureType === 'cursor';

      if (gestureType === 'drawing') {
        this.cursorState.size = 6;
        this.cursorState.opacity = INTERACTION.DRAW_MODE_OPACITY;
      } else if (gestureType === 'eraser') {
        this.cursorState.size = 20;
        this.cursorState.opacity = INTERACTION.ERASE_MODE_OPACITY;
      } else if (gestureType === 'cursor') {
        this.cursorState.size = 12;
        this.cursorState.opacity = INTERACTION.CURSOR_MODE_OPACITY;
      } else {
        this.cursorState.size = 8;
        this.cursorState.opacity = 0.4 * (edgeProx?.dampingFactor ?? 1);
      }

      useStore.getState().setCursor(this.cursorState.easedX, this.cursorState.easedY, this.cursorState);
      useStore.getState().setCursorMode(gestureType === 'cursor');
    } else {
      this.cursorFadeTimer++;

      // Use predictive cursor during tracking loss
      if (this.lastFreezeState?.frozen) {
        const pred = this.predictiveCursor.getCurrent();
        if (pred) {
          const decay = Math.max(0.3, 1 - (this.lastFreezeState.freezeDurationMs / 400) * 0.7);
          const decayed = this.predictiveCursor.getDecayedPosition(decay);
          this.cursorState.easedX = decayed.x;
          this.cursorState.easedY = decayed.y;
          this.cursorState.targetX = decayed.x;
          this.cursorState.targetY = decayed.y;
          this.cursorState.x = decayed.x;
          this.cursorState.y = decayed.y;
          this.cursorState.visible = true;
          this.cursorState.opacity = Math.max(0.2, this.cursorState.opacity - 0.02);
          useStore.getState().setCursor(this.cursorState.easedX, this.cursorState.easedY, this.cursorState);
          return;
        }
      }

      if (this.cursorState.visible && this.cursorFadeTimer < 20) {
        this.cursorState.opacity = Math.max(0.1, this.cursorState.opacity - 0.03);
        this.freezePredictedPos = this.freezePredictedPos ?? {
          x: this.cursorState.easedX,
          y: this.cursorState.easedY,
        };
        this.cursorState.easedX += (this.freezePredictedPos.x - this.cursorState.easedX) * 0.1;
        this.cursorState.easedY += (this.freezePredictedPos.y - this.cursorState.easedY) * 0.1;
        useStore.getState().setCursor(this.cursorState.easedX, this.cursorState.easedY, this.cursorState);
      } else {
        this.cursorState.visible = false;
        useStore.getState().setCursor(null, null);
        this.freezePredictedPos = null;
      }
    }
  }

  private handleCursorMode(hand: HandSnapshot, idxTip: [number, number, number] | null, now: number): void {
    if (!idxTip) return;

    const isInPaletteZone = idxTip[0] < INTERACTION.PALETTE_ZONE_X;
    const store = useStore.getState();

    if (isInPaletteZone) {
      if (!this.paletteHoverActive) {
        this.paletteHoverActive = true;
      }

      store.setColorPaletteActive(true);

      const normalizedY = Math.max(0, Math.min(1,
        (this.cursorState.easedY - INTERACTION.PALETTE_Y_MIN)
        / (INTERACTION.PALETTE_Y_MAX - INTERACTION.PALETTE_Y_MIN)
      ));
      const hoverIdx = Math.min(11, Math.max(0, Math.round(normalizedY * 11)));
      store.setColorHoverIndex(hoverIdx);

      if (hoverIdx !== this.colorDwellIndex) {
        this.colorDwellIndex = hoverIdx;
        this.colorEngine.selectColor(hoverIdx);
      }
    } else if (idxTip[0] >= INTERACTION.PALETTE_DEACTIVATE_X) {
      this.deactivatePalette();
    }
  }

  private handleDrawingMode(
    hand: HandSnapshot,
    handKey: string,
    point: StrokePoint,
    idxTip: [number, number, number] | null,
    now: number,
    freezeState?: GestureFreezeState,
  ): void {
    const isFrozen = freezeState?.frozen ?? false;
    const atTop = !isFrozen && idxTip !== null && idxTip[1] < INTERACTION.DRAW_STOP_ZONE_Y;

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
    }
    // else atTop: skip frame — don't end stroke, so it resumes cleanly when finger returns
  }

  private deactivatePalette(): void {
    if (this.paletteHoverActive) {
      this.paletteHoverActive = false;
    }
    useStore.getState().setColorPaletteActive(false);
    useStore.getState().setColorHoverIndex(null);
    this.colorDwellIndex = null;
  }

  private processDrawing(now: number): void {
    this.drawing.update(now);
  }

  private render(now: number): void {
    this.scene.render(now);
  }

  private updateStats(now: number, delta: number): void {
    if (delta <= 0) return;
    const fps = 1000 / delta;
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

function getDrawingPoint(landmarks: Float32Array, canvas: HTMLCanvasElement): StrokePoint | null {
  const idxTip = getLandmark(landmarks, 8);
  if (!idxTip) return null;
  const aspect = canvas.clientWidth / canvas.clientHeight;
  return {
    x: (idxTip[0] - 0.5) * 2 * aspect,
    y: -(idxTip[1] - 0.5) * 2,
    z: 0,
  };
}

function getHandKey(hand: HandSnapshot, index: number): string {
  return `${hand.handedness}:${index}`;
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
  const dx = wrist[0] - middleMcp[0];
  const dy = wrist[1] - middleMcp[1];
  return Math.max(Math.sqrt(dx * dx + dy * dy), 0.01);
}
