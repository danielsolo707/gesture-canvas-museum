import { Handedness, CalibrationData } from '../core/types';
import { EventBus, globalEventBus } from '../core/EventBus';
import { CALIBRATION } from '../core/constants';
import { distance3D } from '../utils/math';

interface CalibrationSample {
  interLandmarkDists: number[];
  wristToTipSpan: number;
  palmWidth: number;
  timestamp: number;
}

export class CalibrationModule {
  private samples = new Map<Handedness, CalibrationSample[]>();
  private calibrations = new Map<Handedness, CalibrationData>();
  private settled = new Map<Handedness, number>();
  private active = new Map<Handedness, boolean>();
  private bus: EventBus;

  constructor(bus?: EventBus) {
    this.bus = bus ?? globalEventBus;
  }

  isCalibrated(hand: Handedness): boolean {
    return this.calibrations.has(hand);
  }

  getCalibration(hand: Handedness): CalibrationData | null {
    return this.calibrations.get(hand) ?? null;
  }

  recordFrame(
    hand: Handedness,
    landmarks: Float32Array,
    confidence: number,
    timestamp: number,
    isOpenPalm: boolean,
  ): void {
    if (confidence < CALIBRATION.MIN_CONFIDENCE || !isOpenPalm) {
      const settledCount = this.settled.get(hand) ?? 0;
      if (isOpenPalm) {
        this.settled.set(hand, settledCount + 1);
      }
      return;
    }

    const settledCount = this.settled.get(hand) ?? 0;
    if (settledCount < CALIBRATION.SETTLE_FRAMES) {
      this.settled.set(hand, settledCount + 1);
      if (!this.active.get(hand)) {
        this.active.set(hand, true);
        this.bus.emit('calibration_start', { hand });
      }
      return;
    }

    if (this.calibrations.has(hand)) return;

    const sample = this.computeSample(landmarks, timestamp);
    let arr = this.samples.get(hand);
    if (!arr) {
      arr = [];
      this.samples.set(hand, arr);
    }
    arr.push(sample);

    const elapsed = arr.length > 1 ? arr[arr.length - 1].timestamp - arr[0].timestamp : 0;
    if (arr.length >= CALIBRATION.MIN_SAMPLES || elapsed >= CALIBRATION.DURATION_MS) {
      this.finalize(hand);
    }
  }

  reset(hand?: Handedness): void {
    if (hand) {
      this.samples.delete(hand);
      this.calibrations.delete(hand);
      this.settled.delete(hand);
      this.active.delete(hand);
    } else {
      this.samples.clear();
      this.calibrations.clear();
      this.settled.clear();
      this.active.clear();
    }
  }

  recalibrate(hand?: Handedness): void {
    if (hand) {
      this.calibrations.delete(hand);
      this.samples.delete(hand);
      this.settled.delete(hand);
      this.active.set(hand, true);
      this.bus.emit('calibration_start', { hand });
    } else {
      this.reset();
    }
  }

  private computeSample(landmarks: Float32Array, timestamp: number): CalibrationSample {
    const pairs: [number, number][] = [
      [0, 5], [0, 9], [0, 13], [0, 17],
      [5, 9], [9, 13], [13, 17],
      [4, 8], [8, 12], [12, 16], [16, 20],
    ];
    const interLandmarkDists = pairs.map(([a, b]) => {
      const i = a * 3, j = b * 3;
      return distance3D(landmarks[i], landmarks[i + 1], landmarks[i + 2], landmarks[j], landmarks[j + 1], landmarks[j + 2]);
    });

    const wristIdx = 0, middleTipIdx = 12;
    const wi = wristIdx * 3, mi = middleTipIdx * 3;
    const wristToTipSpan = distance3D(landmarks[wi], landmarks[wi + 1], landmarks[wi + 2], landmarks[mi], landmarks[mi + 1], landmarks[mi + 2]);

    const idxMcp = 5 * 3, pinkyMcp = 17 * 3;
    const palmWidth = distance3D(landmarks[idxMcp], landmarks[idxMcp + 1], landmarks[idxMcp + 2], landmarks[pinkyMcp], landmarks[pinkyMcp + 1], landmarks[pinkyMcp + 2]);

    return { interLandmarkDists, wristToTipSpan, palmWidth, timestamp };
  }

  private finalize(hand: Handedness): void {
    const arr = this.samples.get(hand);
    if (!arr || arr.length === 0) return;

    const n = arr.length;
    const refSpan = 0.35;
    const refWidth = 0.20;

    let avgSpan = 0, avgWidth = 0;
    for (const s of arr) {
      avgSpan += s.wristToTipSpan;
      avgWidth += s.palmWidth;
    }
    avgSpan /= n;
    avgWidth /= n;

    const spanScale = avgSpan > 0 ? refSpan / avgSpan : 1;
    const widthScale = avgWidth > 0 ? refWidth / avgWidth : 1;
    const scaleFactor = (spanScale + widthScale) / 2;

    let avgDists = new Float32Array(arr[0].interLandmarkDists.length);
    for (const s of arr) {
      for (let i = 0; i < avgDists.length; i++) avgDists[i] += s.interLandmarkDists[i];
    }
    for (let i = 0; i < avgDists.length; i++) avgDists[i] /= n;

    const referenceDists = new Float32Array(avgDists.length);
    for (let i = 0; i < avgDists.length; i++) referenceDists[i] = avgDists[i] * scaleFactor;

    const data: CalibrationData = {
      scaleFactor,
      offsetVector: [scaleFactor, scaleFactor, scaleFactor],
      sampleCount: n,
      wristToTipSpan: avgSpan,
      palmWidth: avgWidth,
    };

    this.calibrations.set(hand, data);
    this.active.set(hand, false);
    this.bus.emit('calibration_done', { hand, data });
  }
}
