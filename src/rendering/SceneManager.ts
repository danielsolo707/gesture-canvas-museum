import * as THREE from 'three';
import { RENDER, Z_LAYERS } from '../core/constants';
import { globalEventBus } from '../core/EventBus';
import { HandSnapshot, StrokeData, GestureEvent } from '../core/types';
import { StrokeRenderer } from './StrokeRenderer';
import { HandOverlay } from './HandOverlay';
import { GestureIndicator3D } from './GestureIndicator3D';
import { ClearEffect } from './ClearEffect';
import { logger } from '../utils/logging';

export class SceneManager {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.OrthographicCamera | null = null;
  private strokeRenderer: StrokeRenderer | null = null;
  private handOverlay: HandOverlay | null = null;
  private gestureIndicator: GestureIndicator3D | null = null;
  private clearEffect: ClearEffect | null = null;
  private initialized = false;
  private resizeObserver: ResizeObserver | null = null;
  private cleanupFns: (() => void)[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  initialize(): void {
    if (this.initialized) return;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(RENDER.BG_COLOR, 1);

    this.scene = new THREE.Scene();

    const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
    const frustumSize = 2;
    this.camera = new THREE.OrthographicCamera(
      -frustumSize * aspect,
      frustumSize * aspect,
      frustumSize,
      -frustumSize,
      -10,
      10,
    );
    this.camera.position.z = 5;

    this.strokeRenderer = new StrokeRenderer(this.scene);
    this.handOverlay = new HandOverlay(this.scene);
    this.gestureIndicator = new GestureIndicator3D(this.scene);
    this.clearEffect = new ClearEffect(this.scene);

    this.wireEvents();

    this.handleResize();
    this.setupResizeObserver();

    this.initialized = true;
    logger.info('SceneManager initialized');
  }

  private wireEvents(): void {
    this.cleanupFns.push(
      globalEventBus.on('hand_update', ({ hands }: { hands: HandSnapshot[] }) => {
        this.handOverlay?.setHands(hands);
      }),
    );

    this.cleanupFns.push(
      globalEventBus.on('stroke_added', (stroke: StrokeData) => {
        this.strokeRenderer?.addStroke(stroke);
      }),
    );

    this.cleanupFns.push(
      globalEventBus.on('stroke_erased', ({ strokeId }: { strokeId: string }) => {
        this.strokeRenderer?.removeStroke(strokeId);
      }),
    );

    this.cleanupFns.push(
      globalEventBus.on('gesture', (event: GestureEvent) => {
        this.gestureIndicator?.setGesture(
          event.type,
          (event.data as { progress?: number })?.progress ?? 0,
        );
        if (event.type === 'clear_canvas' && event.confidence >= 1) {
          this.clearEffect?.trigger();
          this.strokeRenderer?.clear();
        }
      }),
    );
  }

  getScene(): THREE.Scene | null {
    return this.scene;
  }

  getCamera(): THREE.OrthographicCamera | null {
    return this.camera;
  }

  getStrokeRenderer(): StrokeRenderer | null {
    return this.strokeRenderer;
  }

  getHandOverlay(): HandOverlay | null {
    return this.handOverlay;
  }

  getGestureIndicator(): GestureIndicator3D | null {
    return this.gestureIndicator;
  }

  getClearEffect(): ClearEffect | null {
    return this.clearEffect;
  }

  render(now: number): void {
    if (!this.renderer || !this.scene || !this.camera) return;

    this.strokeRenderer?.update(now);
    this.handOverlay?.update(now);
    this.gestureIndicator?.update(now);
    this.clearEffect?.update(now);

    this.renderer.render(this.scene, this.camera);
  }

  private handleResize(): void {
    if (!this.renderer || !this.camera) return;

    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;

    this.renderer.setSize(width, height, false);

    const aspect = width / height;
    const frustumSize = 2;
    this.camera.left = -frustumSize * aspect;
    this.camera.right = frustumSize * aspect;
    this.camera.top = frustumSize;
    this.camera.bottom = -frustumSize;
    this.camera.updateProjectionMatrix();
  }

  private setupResizeObserver(): void {
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.canvas);
  }

  destroy(): void {
    this.cleanupFns.forEach((fn) => fn());
    this.cleanupFns.length = 0;

    this.resizeObserver?.disconnect();
    this.strokeRenderer?.destroy();
    this.handOverlay?.destroy();
    this.gestureIndicator?.destroy();
    this.clearEffect?.destroy();

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }

    this.scene = null;
    this.camera = null;
    this.initialized = false;
  }
}
