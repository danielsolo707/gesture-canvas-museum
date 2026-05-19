import { CalibrationData, DEFAULT_CALIBRATION, HandSnapshot } from '../core/types';
import { CALIBRATION } from '../core/constants';
import { getLandmark } from '../utils/math';

export class ViewportCalibration {
  private data: CalibrationData;
  private bottomSamples: number[][] = [];
  private calibrationCount = 0;
  private calibrated = false;
  private autoCalibrating = false;

  constructor(initial?: Partial<CalibrationData>) {
    this.data = { ...DEFAULT_CALIBRATION, ...initial };
  }

  isCalibrated(): boolean {
    return this.calibrated;
  }

  getData(): CalibrationData {
    return { ...this.data };
  }

  sample(hands: HandSnapshot[]): void {
    if (this.calibrated) return;
    this.autoCalibrating = true;

    for (const hand of hands) {
      const wrist = getLandmark(hand.landmarks, 0);
      if (!wrist) continue;
      if (wrist[1] > 0.85) {
        this.bottomSamples.push([wrist[0], wrist[1]]);
      }
    }

    this.calibrationCount++;
    if (
      this.calibrationCount >= CALIBRATION.AUTO_CALIBRATION_FRAMES
      && this.bottomSamples.length >= CALIBRATION.BOTTOM_EDGE_SAMPLES
    ) {
      this.computeCalibration();
    }
  }

  private computeCalibration(): void {
    if (this.bottomSamples.length === 0) return;

    const avgY = this.bottomSamples.reduce((s, p) => s + p[1], 0)
      / this.bottomSamples.length;
    const offset = Math.max(0, avgY - 0.85);
    this.data.bottomEdgeOffset = offset;

    const leftSamples = this.bottomSamples.filter((p) => p[0] < 0.4);
    const rightSamples = this.bottomSamples.filter((p) => p[0] > 0.6);
    if (leftSamples.length > 2 && rightSamples.length > 2) {
      const leftAvgY = leftSamples.reduce((s, p) => s + p[1], 0) / leftSamples.length;
      const rightAvgY = rightSamples.reduce((s, p) => s + p[1], 0) / rightSamples.length;
      this.data.perspectiveSkewY = (rightAvgY - leftAvgY) * 0.5;
    }

    this.calibrated = true;
    this.autoCalibrating = false;
  }

  apply(rawX: number, rawY: number): { x: number; y: number } {
    if (!this.calibrated) return { x: rawX, y: rawY };

    let y = rawY - this.data.bottomEdgeOffset * 0.3;
    const skewFactor = (rawX - 0.5) * this.data.perspectiveSkewY;
    y += skewFactor;

    return {
      x: rawX + this.data.perspectiveSkewX * (rawY - 0.5),
      y: Math.max(0, Math.min(1, y)),
    };
  }

  getDebugOverlay(): { boundaryPoints: Array<{ x: number; y: number }> } | null {
    if (!this.calibrated) return null;
    return {
      boundaryPoints: [
        { x: 0, y: 1 - this.data.bottomEdgeOffset },
        { x: 1, y: 1 - this.data.bottomEdgeOffset - this.data.perspectiveSkewY },
      ],
    };
  }

  reset(): void {
    this.data = { ...DEFAULT_CALIBRATION };
    this.bottomSamples = [];
    this.calibrationCount = 0;
    this.calibrated = false;
    this.autoCalibrating = false;
  }
}
