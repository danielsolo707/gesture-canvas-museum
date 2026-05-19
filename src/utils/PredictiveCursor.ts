export interface PredictiveCursorConfig {
  smoothingFactor: number;
  predictionHorizon: number;
  maxPredictionDistance: number;
  minSpeedForPrediction: number;
}

const DEFAULT_CONFIG: PredictiveCursorConfig = {
  smoothingFactor: 0.25,
  predictionHorizon: 0.02,
  maxPredictionDistance: 0.05,
  minSpeedForPrediction: 0.005,
};

interface MotionHistoryEntry {
  x: number;
  y: number;
  time: number;
}

const MAX_HISTORY = 8;

export class PredictiveCursor {
  private config: PredictiveCursorConfig;
  private history: MotionHistoryEntry[] = [];
  private smoothedX = 0;
  private smoothedY = 0;
  private velocityX = 0;
  private velocityY = 0;

  constructor(config?: Partial<PredictiveCursorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  update(rawX: number, rawY: number, now: number): { x: number; y: number; predictedX: number; predictedY: number } {
    const alpha = this.config.smoothingFactor;
    if (this.history.length === 0) {
      this.smoothedX = rawX;
      this.smoothedY = rawY;
    } else {
      this.smoothedX += alpha * (rawX - this.smoothedX);
      this.smoothedY += alpha * (rawY - this.smoothedY);
    }

    this.history.push({ x: rawX, y: rawY, time: now });
    if (this.history.length > MAX_HISTORY) {
      this.history.shift();
    }

    if (this.history.length >= 2) {
      const last = this.history[this.history.length - 1];
      const prev = this.history[this.history.length - 2];
      const dt = Math.max(last.time - prev.time, 0.001);
      const rawVx = (last.x - prev.x) / dt;
      const rawVy = (last.y - prev.y) / dt;
      const smoothAlpha = 0.4;
      this.velocityX += smoothAlpha * (rawVx - this.velocityX);
      this.velocityY += smoothAlpha * (rawVy - this.velocityY);
    }

    const speed = Math.sqrt(this.velocityX ** 2 + this.velocityY ** 2);

    let predX = this.smoothedX;
    let predY = this.smoothedY;

    if (speed > this.config.minSpeedForPrediction) {
      const t = Math.min(
        this.config.predictionHorizon,
        this.config.maxPredictionDistance / Math.max(speed, 0.001),
      );
      predX = this.smoothedX + this.velocityX * t;
      predY = this.smoothedY + this.velocityY * t;

      const dx = predX - rawX;
      const dy = predY - rawY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > this.config.maxPredictionDistance) {
        const scale = this.config.maxPredictionDistance / dist;
        predX = rawX + dx * scale;
        predY = rawY + dy * scale;
      }
    }

    return { x: this.smoothedX, y: this.smoothedY, predictedX: predX, predictedY: predY };
  }

  reset(): void {
    this.history = [];
    this.smoothedX = 0;
    this.smoothedY = 0;
    this.velocityX = 0;
    this.velocityY = 0;
  }
}
