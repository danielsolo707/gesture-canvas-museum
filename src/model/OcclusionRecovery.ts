import { NUM_LANDMARKS, LANDMARKS_FLOAT_SIZE, Handedness } from '../core/types';
import { EXTRAPOLATION } from '../core/constants';

interface PoseFrame {
  landmarks: Float32Array;
  timestamp: number;
  confidence: number;
  velocity: Float32Array;
}

export class OcclusionRecovery {
  private poseMemory = new Map<Handedness, PoseFrame[]>();
  private extrapolatedCache = new Map<Handedness, PoseFrame>();
  private readonly memorySize: number;
  private readonly maxExtrapolationMs: number;
  private readonly decayRate: number;
  private readonly velocityDamping: number;
  private readonly driftCap: number;

  constructor(
    memorySize = 10,
    maxExtrapolationMs = 400,
    decayRate = 0.15,
    velocityDamping = EXTRAPOLATION.VELOCITY_DAMPING,
    driftCap = EXTRAPOLATION.DRIFT_CAP,
  ) {
    this.memorySize = memorySize;
    this.maxExtrapolationMs = maxExtrapolationMs;
    this.decayRate = decayRate;
    this.velocityDamping = velocityDamping;
    this.driftCap = driftCap;
  }

  recordPose(hand: Handedness, landmarks: Float32Array, confidence: number, now: number): void {
    let memory = this.poseMemory.get(hand);
    if (!memory) {
      memory = [];
      this.poseMemory.set(hand, memory);
    }

    const velocity = this.computeVelocity(hand, landmarks, now);

    memory.push({
      landmarks: new Float32Array(landmarks),
      timestamp: now,
      confidence,
      velocity,
    });

    if (memory.length > this.memorySize) {
      memory.shift();
    }

    this.extrapolatedCache.delete(hand);
  }

  recover(hand: Handedness, rawLandmarks: Float32Array | null, rawConfidence: number, now: number): { landmarks: Float32Array; confidence: number; recovered: boolean } {
    const memory = this.poseMemory.get(hand);
    if (!memory || memory.length === 0) {
      if (rawLandmarks) {
        return { landmarks: rawLandmarks, confidence: rawConfidence, recovered: false };
      }
      return { landmarks: new Float32Array(LANDMARKS_FLOAT_SIZE), confidence: 0, recovered: false };
    }

    const lastStable = memory[memory.length - 1];

    if (rawLandmarks && rawConfidence >= 0.3) {
      return { landmarks: rawLandmarks, confidence: rawConfidence, recovered: false };
    }

    const elapsed = now - lastStable.timestamp;

    if (elapsed > this.maxExtrapolationMs) {
      if (rawLandmarks) {
        return { landmarks: rawLandmarks, confidence: Math.max(rawConfidence, 0.05), recovered: false };
      }
      return { landmarks: new Float32Array(LANDMARKS_FLOAT_SIZE), confidence: 0, recovered: false };
    }

    const extrapolated = this.extrapolatePose(hand, lastStable, elapsed, now);
    const decayedConfidence = Math.max(0, lastStable.confidence - (elapsed / 1000) * this.decayRate);

    this.extrapolatedCache.set(hand, extrapolated);

    return {
      landmarks: extrapolated.landmarks,
      confidence: Math.min(decayedConfidence, rawConfidence > 0 ? Math.max(rawConfidence, 0.1) : decayedConfidence),
      recovered: true,
    };
  }

  getLastStableLandmarks(hand: Handedness): Float32Array | null {
    const memory = this.poseMemory.get(hand);
    if (!memory || memory.length === 0) return null;
    return memory[memory.length - 1].landmarks;
  }

  getTrackingStability(hand: Handedness): number {
    const memory = this.poseMemory.get(hand);
    if (!memory || memory.length < 3) return 0;

    let totalMotion = 0;
    let count = 0;
    for (let i = 1; i < memory.length; i++) {
      const prev = memory[i - 1].landmarks;
      const curr = memory[i].landmarks;
      let motion = 0;
      for (let j = 0; j < LANDMARKS_FLOAT_SIZE; j += 3) {
        motion += Math.abs(curr[j] - prev[j]);
      }
      totalMotion += motion / (21 * 3);
      count++;
    }
    const avgMotion = totalMotion / count;
    return Math.max(0, Math.min(1, 1 - avgMotion * 0.5));
  }

  private computeVelocity(hand: Handedness, landmarks: Float32Array, now: number): Float32Array {
    const memory = this.poseMemory.get(hand);
    if (!memory || memory.length === 0) {
      return new Float32Array(LANDMARKS_FLOAT_SIZE);
    }

    const prev = memory[memory.length - 1];
    const dt = Math.max(now - prev.timestamp, 0.001);
    const vel = new Float32Array(LANDMARKS_FLOAT_SIZE);

    for (let i = 0; i < LANDMARKS_FLOAT_SIZE; i++) {
      vel[i] = (landmarks[i] - prev.landmarks[i]) / dt;
    }
    return vel;
  }

  blendWithRecovery(
    hand: Handedness,
    rawLandmarks: Float32Array,
    rawConfidence: number,
    now: number,
  ): Float32Array {
    const memory = this.poseMemory.get(hand);
    if (!memory || memory.length === 0 || rawConfidence >= 0.5) {
      return rawLandmarks;
    }

    const lastStable = memory[memory.length - 1];
    const elapsed = now - lastStable.timestamp;
    const blendAlpha = Math.min(1, elapsed / this.maxExtrapolationMs);

    const result = new Float32Array(LANDMARKS_FLOAT_SIZE);
    for (let i = 0; i < LANDMARKS_FLOAT_SIZE; i++) {
      result[i] = rawLandmarks[i] * blendAlpha + lastStable.landmarks[i] * (1 - blendAlpha);
    }

    return result;
  }

  private extrapolatePose(hand: Handedness, lastFrame: PoseFrame, elapsed: number, now: number): PoseFrame {
    const extrapolated = new Float32Array(LANDMARKS_FLOAT_SIZE);
    const t = Math.min(elapsed / 1000, 0.3);

    let velocity: Float32Array;
    if (lastFrame.velocity && lastFrame.velocity.length === LANDMARKS_FLOAT_SIZE) {
      velocity = lastFrame.velocity;
    } else {
      velocity = new Float32Array(LANDMARKS_FLOAT_SIZE);
    }

    const dampedVelocity = new Float32Array(LANDMARKS_FLOAT_SIZE);
    for (let i = 0; i < LANDMARKS_FLOAT_SIZE; i++) {
      dampedVelocity[i] = velocity[i] * this.velocityDamping;
    }

    for (let i = 0; i < LANDMARKS_FLOAT_SIZE; i++) {
      const displacement = dampedVelocity[i] * t;
      extrapolated[i] = lastFrame.landmarks[i] + Math.max(-this.driftCap, Math.min(this.driftCap, displacement));
    }

    return {
      landmarks: extrapolated,
      timestamp: now,
      confidence: lastFrame.confidence * 0.8,
      velocity: dampedVelocity,
    };
  }

  reset(hand?: Handedness): void {
    if (hand) {
      this.poseMemory.delete(hand);
      this.extrapolatedCache.delete(hand);
    } else {
      this.poseMemory.clear();
      this.extrapolatedCache.clear();
    }
  }

  destroy(): void {
    this.reset();
  }
}
