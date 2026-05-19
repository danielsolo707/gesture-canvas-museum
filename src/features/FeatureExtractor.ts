import { HandFeatures, FingerAngles, FingerOpenness, FEATURE_COUNT } from './types';
import { NormalizedHand } from '../tracking/LandmarkNormalizer';
import { getLandmark, distance3D, angleBetweenVectors, normalize, dot, vec3Sub, magnitude } from '../utils/math';
import { LANDMARK_INDICES as L } from '../core/types';

const FINGER_PAIRS: [number, number][] = [
  [L.THUMB_TIP, L.INDEX_TIP],
  [L.INDEX_TIP, L.MIDDLE_TIP],
  [L.MIDDLE_TIP, L.RING_TIP],
  [L.RING_TIP, L.PINKY_TIP],
  [L.THUMB_TIP, L.PINKY_TIP],
];

export class FeatureExtractor {
  private prevVelocity: [number, number, number] = [0, 0, 0];
  private prevFingertipPos: [number, number, number] = [0, 0, 0];
  private hasPrev = false;
  private lastValidOpenness: FingerOpenness | null = null;
  private lowIntegrityCount = 0;

  extract(normalized: NormalizedHand, timestamp: number): HandFeatures {
    const lm = normalized.landmarks;

    const fingerAngles = this.computeFingerAngles(lm);
    const fingerOpenness = this.computeFingerOpenness(lm);
    const interFingerDistances = this.computeInterFingerDistances(lm);

    const palmOrientation = this.computePalmOrientation(lm);

    const idxTip = getLandmark(lm, L.INDEX_TIP);
    let velocity: [number, number, number] = [0, 0, 0];
    let acceleration: [number, number, number] = [0, 0, 0];

    if (this.hasPrev) {
      const dt = Math.max(timestamp - normalized.timestamp + 0.001, 0.016);
      velocity = [
        (idxTip[0] - this.prevFingertipPos[0]) / dt,
        (idxTip[1] - this.prevFingertipPos[1]) / dt,
        (idxTip[2] - this.prevFingertipPos[2]) / dt,
      ];
      acceleration = [
        (velocity[0] - this.prevVelocity[0]) / dt,
        (velocity[1] - this.prevVelocity[1]) / dt,
        (velocity[2] - this.prevVelocity[2]) / dt,
      ];
    }

    this.prevVelocity = velocity;
    this.prevFingertipPos = [idxTip[0], idxTip[1], idxTip[2]];
    this.hasPrev = true;

    const speed = magnitude(velocity[0], velocity[1], velocity[2]);
    const motionDir = normalize(velocity[0], velocity[1], velocity[2]);

    return {
      fingerAngles,
      fingerOpenness,
      interFingerDistances,
      palmOrientation,
      fingertipVelocity: velocity,
      fingertipAcceleration: acceleration,
      motionDirection: motionDir,
      speed,
      handConfidence: normalized.confidence,
      handScale: normalized.scale,
    };
  }

  toFeatureArray(features: HandFeatures): Float32Array {
    const arr = new Float32Array(FEATURE_COUNT);
    const a = features.fingerAngles;
    const o = features.fingerOpenness;
    const d = features.interFingerDistances;
    const p = features.palmOrientation;
    const v = features.fingertipVelocity;
    const ac = features.fingertipAcceleration;

    arr[0] = a.thumb; arr[1] = a.index; arr[2] = a.middle; arr[3] = a.ring; arr[4] = a.pinky;
    arr[5] = o.thumb; arr[6] = o.index; arr[7] = o.middle; arr[8] = o.ring; arr[9] = o.pinky;
    arr[10] = d[0]; arr[11] = d[1]; arr[12] = d[2]; arr[13] = d[3]; arr[14] = d[4];
    arr[15] = p[0]; arr[16] = p[1]; arr[17] = p[2];
    arr[18] = v[0]; arr[19] = v[1]; arr[20] = v[2];
    arr[21] = ac[0]; arr[22] = ac[1]; arr[23] = ac[2];
    arr[24] = features.speed;
    arr[25] = Math.min(features.handScale, 3);
    return arr;
  }

  private computeFingerAngles(lm: Float32Array): FingerAngles {
    return {
      thumb: this.fingerBendAngle(lm, L.THUMB_CMC, L.THUMB_MCP, L.THUMB_IP, L.THUMB_TIP),
      index: this.fingerBendAngle(lm, L.INDEX_MCP, L.INDEX_PIP, L.INDEX_DIP, L.INDEX_TIP),
      middle: this.fingerBendAngle(lm, L.MIDDLE_MCP, L.MIDDLE_PIP, L.MIDDLE_DIP, L.MIDDLE_TIP),
      ring: this.fingerBendAngle(lm, L.RING_MCP, L.RING_PIP, L.RING_DIP, L.RING_TIP),
      pinky: this.fingerBendAngle(lm, L.PINKY_MCP, L.PINKY_PIP, L.PINKY_DIP, L.PINKY_TIP),
    };
  }

  private fingerBendAngle(
    lm: Float32Array,
    mcpIdx: number, pipIdx: number, dipIdx: number, tipIdx: number,
  ): number {
    const mcp = getLandmark(lm, mcpIdx);
    const pip = getLandmark(lm, pipIdx);
    const tip = getLandmark(lm, tipIdx);

    const v1 = vec3Sub(pip[0], pip[1], pip[2], mcp[0], mcp[1], mcp[2]);
    const v2 = vec3Sub(tip[0], tip[1], tip[2], mcp[0], mcp[1], mcp[2]);

    return angleBetweenVectors(v1[0], v1[1], v1[2], v2[0], v2[1], v2[2]);
  }

  private computeFingerOpenness(lm: Float32Array): FingerOpenness {
    const wrist = getLandmark(lm, L.WRIST);
    const midMcp = getLandmark(lm, L.MIDDLE_MCP);
    const handSize = distance3D(
      midMcp[0] - wrist[0], midMcp[1] - wrist[1], midMcp[2] - wrist[2],
      0, 0, 0,
    );
    if (handSize < 0.001) {
      this.lowIntegrityCount++;
      if (this.lastValidOpenness && this.lowIntegrityCount < 15) {
        return this.lastValidOpenness;
      }
      return { thumb: 0, index: 0, middle: 0, ring: 0, pinky: 0 };
    }
    this.lowIntegrityCount = 0;

    const fingerDefs: { key: keyof FingerOpenness; mcp: number; tip: number }[] = [
      { key: 'thumb',  mcp: L.THUMB_MCP,  tip: L.THUMB_TIP },
      { key: 'index',  mcp: L.INDEX_MCP,  tip: L.INDEX_TIP },
      { key: 'middle', mcp: L.MIDDLE_MCP, tip: L.MIDDLE_TIP },
      { key: 'ring',   mcp: L.RING_MCP,   tip: L.RING_TIP },
      { key: 'pinky',  mcp: L.PINKY_MCP,  tip: L.PINKY_TIP },
    ];

    const result: Partial<FingerOpenness> = {};
    for (const { key, mcp, tip } of fingerDefs) {
      const mcpLm = getLandmark(lm, mcp);
      const tipLm = getLandmark(lm, tip);
      const dist = distance3D(
        tipLm[0] - mcpLm[0], tipLm[1] - mcpLm[1], tipLm[2] - mcpLm[2],
        0, 0, 0,
      );
      const normalized = dist / handSize;
      result[key] = Math.max(0, Math.min(1, (normalized - 0.18) * 1.8));
    }

    const openness = result as FingerOpenness;
    this.lastValidOpenness = openness;
    return openness;
  }

  private computeInterFingerDistances(lm: Float32Array): [number, number, number, number, number] {
    return FINGER_PAIRS.map(([a, b]) => {
      const pa = getLandmark(lm, a);
      const pb = getLandmark(lm, b);
      return distance3D(pa[0], pa[1], pa[2], pb[0], pb[1], pb[2]);
    }) as [number, number, number, number, number];
  }

  private computePalmOrientation(lm: Float32Array): [number, number, number] {
    const wrist = getLandmark(lm, L.WRIST);
    const middleMcp = getLandmark(lm, L.MIDDLE_MCP);
    const indexMcp = getLandmark(lm, L.INDEX_MCP);
    const pinkyMcp = getLandmark(lm, L.PINKY_MCP);

    const palmCenter = [
      (indexMcp[0] + pinkyMcp[0]) / 2,
      (indexMcp[1] + pinkyMcp[1]) / 2,
      (indexMcp[2] + pinkyMcp[2]) / 2,
    ] as [number, number, number];

    const normal = normalize(
      (middleMcp[1] - wrist[1]) * (palmCenter[2] - wrist[2]) - (middleMcp[2] - wrist[2]) * (palmCenter[1] - wrist[1]),
      (middleMcp[2] - wrist[2]) * (palmCenter[0] - wrist[0]) - (middleMcp[0] - wrist[0]) * (palmCenter[2] - wrist[2]),
      (middleMcp[0] - wrist[0]) * (palmCenter[1] - wrist[1]) - (middleMcp[1] - wrist[1]) * (palmCenter[0] - wrist[0]),
    );

    return normal;
  }

  reset(): void {
    this.hasPrev = false;
    this.prevVelocity = [0, 0, 0];
    this.prevFingertipPos = [0, 0, 0];
    this.lastValidOpenness = null;
    this.lowIntegrityCount = 0;
  }
}
