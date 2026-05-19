import { NUM_LANDMARKS, LANDMARKS_FLOAT_SIZE, Handedness, CalibrationData } from '../core/types';
import { getLandmark, distance3D, vec3Sub, normalize, dot } from '../utils/math';

export interface NormalizedHand {
  landmarks: Float32Array;
  handedness: Handedness;
  confidence: number;
  timestamp: number;
  wristPos: [number, number, number];
  scale: number;
  rotationMatrix: Float32Array;
}

export class LandmarkNormalizer {
  private readonly mirrored: boolean;
  private calibration: CalibrationData | null = null;

  constructor(mirrored = true) {
    this.mirrored = mirrored;
  }

  setCalibration(data: CalibrationData | null): void {
    this.calibration = data;
  }

  getCalibration(): CalibrationData | null {
    return this.calibration;
  }

  normalize(
    rawLandmarks: Float32Array,
    handedness: Handedness,
    confidence: number,
    timestamp: number,
  ): NormalizedHand {
    let landmarks = new Float32Array(rawLandmarks);

    if (this.mirrored) {
      landmarks = this.applyMirrorCorrection(landmarks, handedness);
    }

    if (this.calibration) {
      landmarks = this.applyCalibration(landmarks, this.calibration);
    }

    const wrist = getLandmark(landmarks, 0);
    const wristRel = this.makeWristRelative(landmarks, wrist);

    const scale = this.computeScale(wristRel);
    const scaled = this.applyScale(wristRel, scale);

    const rotationMatrix = this.computeRotationMatrix(scaled, handedness);
    const rotated = this.applyRotation(scaled, rotationMatrix);

    return {
      landmarks: rotated,
      handedness,
      confidence,
      timestamp,
      wristPos: wrist,
      scale,
      rotationMatrix,
    };
  }

  private applyCalibration(landmarks: Float32Array, cal: CalibrationData): Float32Array {
    const result = new Float32Array(landmarks.length);
    for (let i = 0; i < landmarks.length; i += 3) {
      result[i] = landmarks[i] * cal.offsetVector[0];
      result[i + 1] = landmarks[i + 1] * cal.offsetVector[1];
      result[i + 2] = landmarks[i + 2] * cal.offsetVector[2];
    }
    return result;
  }

  private applyMirrorCorrection(
    landmarks: Float32Array,
    handedness: Handedness,
  ): Float32Array {
    const result = new Float32Array(landmarks.length);
    for (let i = 0; i < landmarks.length; i += 3) {
      result[i] = 1 - landmarks[i];
      result[i + 1] = landmarks[i + 1];
      result[i + 2] = landmarks[i + 2];
    }
    return result;
  }

  private makeWristRelative(
    landmarks: Float32Array,
    wrist: [number, number, number],
  ): Float32Array {
    const result = new Float32Array(landmarks.length);
    for (let i = 0; i < landmarks.length; i += 3) {
      const dx = landmarks[i] - wrist[0];
      const dy = landmarks[i + 1] - wrist[1];
      const dz = landmarks[i + 2] - wrist[2];
      result[i] = dx;
      result[i + 1] = dy;
      result[i + 2] = dz;
    }
    return result;
  }

  private computeScale(wristRel: Float32Array): number {
    const middleMcp = getLandmark(wristRel, 9);
    const idxMcp = getLandmark(wristRel, 5);
    const pinkyMcp = getLandmark(wristRel, 17);
    const d1 = distance3D(middleMcp[0], middleMcp[1], middleMcp[2], 0, 0, 0);
    const d2 = distance3D(idxMcp[0], idxMcp[1], idxMcp[2], pinkyMcp[0], pinkyMcp[1], pinkyMcp[2]);
    const scale = Math.max(d1, d2 * 0.5, 0.001);
    return scale;
  }

  private applyScale(wristRel: Float32Array, scale: number): Float32Array {
    const inv = 1 / scale;
    const result = new Float32Array(wristRel.length);
    for (let i = 0; i < wristRel.length; i++) {
      result[i] = wristRel[i] * inv;
    }
    return result;
  }

  private computeRotationMatrix(
    landmarks: Float32Array,
    handedness: Handedness,
  ): Float32Array {
    const middleMcp = getLandmark(landmarks, 9);
    const indexMcp = getLandmark(landmarks, 5);

    const up = normalize(middleMcp[0], middleMcp[1], middleMcp[2]);

    const palmDir = normalize(indexMcp[0], indexMcp[1], indexMcp[2]);
    const right = normalize(
      palmDir[1] * up[2] - palmDir[2] * up[1],
      palmDir[2] * up[0] - palmDir[0] * up[2],
      palmDir[0] * up[1] - palmDir[1] * up[0],
    );

    const forward = normalize(
      up[1] * right[2] - up[2] * right[1],
      up[2] * right[0] - up[0] * right[2],
      up[0] * right[1] - up[1] * right[0],
    );

    const mat = new Float32Array(9);
    mat[0] = right[0]; mat[1] = right[1]; mat[2] = right[2];
    mat[3] = up[0]; mat[4] = up[1]; mat[5] = up[2];
    mat[6] = forward[0]; mat[7] = forward[1]; mat[8] = forward[2];
    return mat;
  }

  private applyRotation(landmarks: Float32Array, rotMatrix: Float32Array): Float32Array {
    const result = new Float32Array(landmarks.length);
    for (let i = 0; i < landmarks.length; i += 3) {
      const x = landmarks[i];
      const y = landmarks[i + 1];
      const z = landmarks[i + 2];
      result[i] = rotMatrix[0] * x + rotMatrix[1] * y + rotMatrix[2] * z;
      result[i + 1] = rotMatrix[3] * x + rotMatrix[4] * y + rotMatrix[5] * z;
      result[i + 2] = rotMatrix[6] * x + rotMatrix[7] * y + rotMatrix[8] * z;
    }
    return result;
  }

  getNormalizedLandmark(landmarks: Float32Array, index: number): [number, number, number] {
    return getLandmark(landmarks, index);
  }
}
