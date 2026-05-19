import * as THREE from 'three';
import { RENDER } from '../core/constants';
import { globalEventBus } from '../core/EventBus';
import { StrokeData, GestureEvent } from '../core/types';
import { StrokeRenderer } from './StrokeRenderer';
import { ClearEffect } from './ClearEffect';
import { logger } from '../utils/logging';

export class SceneManager {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.OrthographicCamera | null = null;
  private strokeRenderer: StrokeRenderer | null = null;
  private clearEffect: ClearEffect | null = null;
  private videoBg: THREE.Mesh | null = null;
  private videoTexture: THREE.Texture | null = null;
  private initialized = false;
  private resizeObserver: ResizeObserver | null = null;
  private cleanupFns: (() => void)[] = [];
  private videoNeedsUpdate = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  initialize(): void {
    if (this.initialized) return;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    });

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setClearColor(RENDER.BG_COLOR, 1);

    this.scene = new THREE.Scene();

    const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
    const frustumSize = 1;
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
    this.clearEffect = new ClearEffect(this.scene);

    this.wireEvents();

    this.handleResize();
    this.setupResizeObserver();

    this.initialized = true;
    logger.info('SceneManager initialized');
  }

  setVideoBackground(mirroredCanvas: HTMLCanvasElement): void {
    if (!this.scene) return;

    if (this.videoTexture) {
      this.videoTexture.dispose();
    }
    if (this.videoBg) {
      this.scene.remove(this.videoBg);
      (this.videoBg.geometry as THREE.BufferGeometry)?.dispose();
      (this.videoBg.material as THREE.Material)?.dispose();
    }

    this.videoTexture = new THREE.CanvasTexture(mirroredCanvas);
    this.videoTexture.colorSpace = THREE.SRGBColorSpace;

    const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
    const geo = new THREE.PlaneGeometry(aspect * 2, 2);
    const mat = new THREE.MeshBasicMaterial({
      map: this.videoTexture,
      transparent: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.videoBg = new THREE.Mesh(geo, mat);
    this.videoBg.renderOrder = -1;
    this.videoBg.position.z = -1;
    this.scene.add(this.videoBg);
    this.videoNeedsUpdate = true;
  }

  private wireEvents(): void {
    this.cleanupFns.push(
      globalEventBus.on('stroke_added', (stroke: StrokeData) => {
        this.strokeRenderer?.addStroke(stroke);
      }),
    );

    this.cleanupFns.push(
      globalEventBus.on('stroke_update', (stroke: StrokeData) => {
        this.strokeRenderer?.updateStroke(stroke);
      }),
    );

    this.cleanupFns.push(
      globalEventBus.on('stroke_erased', ({ strokeId }: { strokeId: string }) => {
        this.strokeRenderer?.removeStroke(strokeId);
      }),
    );

    this.cleanupFns.push(
      globalEventBus.on('clear_canvas', () => {
        this.clearEffect?.trigger();
        this.strokeRenderer?.clear();
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

  getClearEffect(): ClearEffect | null {
    return this.clearEffect;
  }

  render(now: number): void {
    if (!this.renderer || !this.scene || !this.camera) return;

    if (this.videoTexture && this.videoNeedsUpdate) {
      this.videoTexture.needsUpdate = true;
      this.videoNeedsUpdate = false;
    }
    this.strokeRenderer?.update(now);
    this.clearEffect?.update(now);

    this.renderer.render(this.scene, this.camera);
  }

  markVideoNeedsUpdate(): void {
    this.videoNeedsUpdate = true;
  }

  private handleResize(): void {
    if (!this.renderer || !this.camera) return;

    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;

    this.renderer.setSize(width, height, false);

    const aspect = width / height;
    const frustumSize = 1;
    this.camera.left = -frustumSize * aspect;
    this.camera.right = frustumSize * aspect;
    this.camera.top = frustumSize;
    this.camera.bottom = -frustumSize;
    this.camera.updateProjectionMatrix();

    if (this.videoBg) {
      this.videoBg.geometry.dispose();
      this.videoBg.geometry = new THREE.PlaneGeometry(aspect * 2, 2);
    }
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
    this.clearEffect?.destroy();

    if (this.videoTexture) {
      this.videoTexture.dispose();
      this.videoTexture = null;
    }
    if (this.videoBg) {
      this.scene?.remove(this.videoBg);
      this.videoBg.geometry?.dispose();
      (this.videoBg.material as THREE.Material)?.dispose();
      this.videoBg = null;
    }

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }

    this.scene = null;
    this.camera = null;
    this.initialized = false;
  }
}
