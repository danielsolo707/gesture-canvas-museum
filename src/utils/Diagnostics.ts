import { EngineStats } from '../core/types';
import { PERFORMANCE } from '../core/constants';

export interface DiagnosticsFrame {
  fps: number;
  inferenceMs: number;
  gestureMs: number;
  renderMs: number;
  totalMs: number;
  activeHands: number;
  strokeCount: number;
  motionSpeed: number;
  timestamp: number;
}

const MAX_FRAMES = 300;

export class Diagnostics {
  private frames: DiagnosticsFrame[] = [];
  private peakMemoryUsage = 0;
  private droppedFrames = 0;
  private lastFrameTime = 0;
  private warningCounts = new Map<string, number>();

  recordFrame(stats: EngineStats, now: number): void {
    const totalMs = stats.inferenceMs + stats.gestureMs + stats.drawMs + stats.renderMs;

    this.frames.push({
      fps: stats.fps,
      inferenceMs: stats.inferenceMs,
      gestureMs: stats.gestureMs,
      renderMs: stats.renderMs,
      totalMs,
      activeHands: stats.activeHands,
      strokeCount: stats.strokeCount,
      motionSpeed: stats.motionSpeed,
      timestamp: now,
    });

    if (this.frames.length > MAX_FRAMES) {
      this.frames.shift();
    }

    if (this.lastFrameTime > 0) {
      const delta = now - this.lastFrameTime;
      if (delta > 50) {
        this.droppedFrames++;
      }
    }
    this.lastFrameTime = now;

    if (totalMs > 100) {
      this.incrementWarning('high_latency');
    }
    if (stats.fps > 0 && stats.fps < PERFORMANCE.LOW_FPS_THRESHOLD) {
      this.incrementWarning('low_fps');
    }
  }

  recordMemory(bytes: number): void {
    if (bytes > this.peakMemoryUsage) {
      this.peakMemoryUsage = bytes;
    }
  }

  private incrementWarning(key: string): void {
    this.warningCounts.set(key, (this.warningCounts.get(key) ?? 0) + 1);
  }

  getAverageFps(): number {
    if (this.frames.length === 0) return 0;
    return this.frames.reduce((sum, f) => sum + f.fps, 0) / this.frames.length;
  }

  getAverageLatencyMs(): number {
    if (this.frames.length === 0) return 0;
    return this.frames.reduce((sum, f) => sum + f.totalMs, 0) / this.frames.length;
  }

  getDroppedFrames(): number { return this.droppedFrames; }
  getPeakMemory(): number { return this.peakMemoryUsage; }
  getTotalFrames(): number { return this.frames.length; }
  getWarningCounts(): Map<string, number> { return this.warningCounts; }
  getFrameHistory(): readonly DiagnosticsFrame[] { return this.frames; }

  getRecentFpsValues(count: number): number[] {
    const recent = this.frames.slice(-count);
    return recent.map(f => f.fps);
  }

  reset(): void {
    this.frames = [];
    this.droppedFrames = 0;
    this.peakMemoryUsage = 0;
    this.lastFrameTime = 0;
    this.warningCounts.clear();
  }
}
