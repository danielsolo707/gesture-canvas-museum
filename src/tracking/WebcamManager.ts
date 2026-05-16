import { WEBCAM } from '../core/constants';
import { WebcamConfig, WebcamState } from './types';
import { logger } from '../utils/logging';

export class WebcamManager {
  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private state: WebcamState = 'inactive';
  private config: WebcamConfig;
  private retryCount = 0;
  private maxRetries = 3;

  constructor(config?: Partial<WebcamConfig>) {
    this.config = {
      width: config?.width ?? WEBCAM.WIDTH,
      height: config?.height ?? WEBCAM.HEIGHT,
      fps: config?.fps ?? WEBCAM.FPS,
      facingMode: config?.facingMode ?? WEBCAM.FACING_MODE,
    };
  }

  getState(): WebcamState {
    return this.state;
  }

  getVideo(): HTMLVideoElement | null {
    return this.video;
  }

  async start(): Promise<void> {
    if (this.state === 'active') return;
    this.state = 'requesting';

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: this.config.width },
          height: { ideal: this.config.height },
          frameRate: { ideal: this.config.fps },
          facingMode: this.config.facingMode,
        },
        audio: false,
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);

      this.video = document.createElement('video');
      this.video.srcObject = this.stream;
      this.video.playsInline = true;
      this.video.muted = true;
      this.video.setAttribute('playsinline', '');

      await this.video.play();

      this.state = 'active';
      this.retryCount = 0;
      logger.info('Webcam started');
    } catch (err) {
      this.state = 'error';
      logger.error('Webcam start failed', err);
      throw err;
    }
  }

  stop(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    this.video = null;
    this.state = 'inactive';
  }

  async restart(): Promise<void> {
    this.stop();
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      const delay = Math.min(1000 * Math.pow(2, this.retryCount), 8000);
      logger.info(`Webcam restart attempt ${this.retryCount}/${this.maxRetries} in ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
      return this.start();
    }
    throw new Error('Webcam max retries exceeded');
  }

  isActive(): boolean {
    return this.state === 'active' && this.video !== null && !this.video.paused;
  }

  getActualResolution(): { width: number; height: number } | null {
    if (!this.video) return null;
    return {
      width: this.video.videoWidth,
      height: this.video.videoHeight,
    };
  }

  destroy(): void {
    this.stop();
  }
}
