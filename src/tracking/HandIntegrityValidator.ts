import { LANDMARK_INDICES as L, NUM_LANDMARKS } from '../core/types';
import { INTEGRITY } from '../core/constants';
import { getLandmark } from '../utils/math';

export interface IntegrityResult {
  score: number;
  wristVisible: boolean;
  palmIntact: boolean;
  individualFingers: { thumb: boolean; index: boolean; middle: boolean; ring: boolean; pinky: boolean };
  requiredGroups: { drawing: boolean; cursor: boolean; eraser: boolean };
  edgeFlags: { anyEdge: boolean; leftEdge: boolean; rightEdge: boolean; topEdge: boolean; bottomEdge: boolean };
  missingLandmarkCount: number;
}

export class HandIntegrityValidator {
  private readonly landmarkThreshold: number;
  private readonly edgeMargin: number;

  constructor(landmarkThreshold = INTEGRITY.STALE_LANDMARK_VALUE, edgeMargin = 0.03) {
    this.landmarkThreshold = landmarkThreshold;
    this.edgeMargin = edgeMargin;
  }

  validate(landmarks: Float32Array | null): IntegrityResult {
    if (!landmarks || landmarks.length < NUM_LANDMARKS * 3) {
      return this.zeroResult();
    }

    const missing: number[] = [];
    const atEdge: { leftEdge: boolean; rightEdge: boolean; topEdge: boolean; bottomEdge: boolean } = {
      leftEdge: false, rightEdge: false, topEdge: false, bottomEdge: false,
    };

    for (let i = 0; i < NUM_LANDMARKS; i++) {
      const lm = getLandmark(landmarks, i);
      if (!lm) { missing.push(i); continue; }
      const [x, y, _z] = lm;
      const isMissing = Math.abs(x) < this.landmarkThreshold
        && Math.abs(y) < this.landmarkThreshold;
      if (isMissing) { missing.push(i); continue; }
      if (x < this.edgeMargin) atEdge.leftEdge = true;
      if (x > 1 - this.edgeMargin) atEdge.rightEdge = true;
      if (y < this.edgeMargin) atEdge.topEdge = true;
      if (y > 1 - this.edgeMargin) atEdge.bottomEdge = true;
    }

    const wristVis = !missing.includes(L.WRIST);
    const palm = {
      thumbMcp: !missing.includes(L.THUMB_MCP),
      indexMcp: !missing.includes(L.INDEX_MCP),
      middleMcp: !missing.includes(L.MIDDLE_MCP),
      ringMcp: !missing.includes(L.RING_MCP),
      pinkyMcp: !missing.includes(L.PINKY_MCP),
    };
    const palmIntact = palm.thumbMcp && palm.indexMcp && palm.middleMcp && palm.ringMcp && palm.pinkyMcp;

    const finger = {
      thumb: !missing.includes(L.THUMB_TIP) && !missing.includes(L.THUMB_MCP) && !missing.includes(L.THUMB_IP),
      index: !missing.includes(L.INDEX_TIP) && !missing.includes(L.INDEX_MCP) && !missing.includes(L.INDEX_PIP),
      middle: !missing.includes(L.MIDDLE_TIP) && !missing.includes(L.MIDDLE_MCP) && !missing.includes(L.MIDDLE_PIP),
      ring: !missing.includes(L.RING_TIP) && !missing.includes(L.RING_MCP) && !missing.includes(L.RING_PIP),
      pinky: !missing.includes(L.PINKY_TIP) && !missing.includes(L.PINKY_MCP) && !missing.includes(L.PINKY_PIP),
    };

    const requiredGroups = {
      drawing: wristVis && finger.index && palm.indexMcp,
      cursor: wristVis && finger.index && finger.middle && palm.indexMcp && palm.middleMcp,
      eraser: wristVis && finger.thumb && finger.index && finger.middle && finger.ring && finger.pinky && palmIntact,
    };

    const maxGroups = 6;
    let groupScore = 0;
    if (wristVis) groupScore++;
    if (palmIntact) groupScore++;
    if (finger.thumb) groupScore++;
    if (finger.index) groupScore++;
    if (finger.middle) groupScore++;
    if (finger.ring) groupScore++;
    if (finger.pinky) groupScore++;

    const fingerCount = [finger.thumb, finger.index, finger.middle, finger.ring, finger.pinky].filter(Boolean).length;
    const missingPenalty = missing.length / NUM_LANDMARKS;
    const score = Math.max(0, Math.min(1,
      ((groupScore / 7) * 0.7 + (fingerCount / 5) * 0.3) * (1 - missingPenalty * 0.3)
    ));

    return {
      score,
      wristVisible: wristVis,
      palmIntact,
      individualFingers: finger,
      requiredGroups,
      edgeFlags: { ...atEdge, anyEdge: atEdge.leftEdge || atEdge.rightEdge || atEdge.topEdge || atEdge.bottomEdge },
      missingLandmarkCount: missing.length,
    };
  }

  getGestureSpecificScore(gesture: 'drawing' | 'cursor' | 'eraser', integrity: IntegrityResult): number {
    const group = integrity.requiredGroups[gesture];
    if (!group) return 0;

    let base = integrity.score;

    switch (gesture) {
      case 'drawing':
        base = (integrity.wristVisible ? 0.4 : 0)
          + (integrity.individualFingers.index ? 0.4 : 0)
          + (integrity.palmIntact ? 0.2 : 0);
        break;
      case 'cursor':
        base = (integrity.wristVisible ? 0.3 : 0)
          + (integrity.individualFingers.index ? 0.25 : 0)
          + (integrity.individualFingers.middle ? 0.25 : 0)
          + (integrity.palmIntact ? 0.2 : 0);
        break;
      case 'eraser':
        base = (integrity.wristVisible ? 0.1 : 0)
          + (integrity.individualFingers.thumb ? 0.18 : 0)
          + (integrity.individualFingers.index ? 0.18 : 0)
          + (integrity.individualFingers.middle ? 0.18 : 0)
          + (integrity.individualFingers.ring ? 0.18 : 0)
          + (integrity.individualFingers.pinky ? 0.18 : 0);
        break;
    }

    return Math.max(0, Math.min(1, base));
  }

  completenessByRegion(landmarks: Float32Array): {
    topHalf: number; bottomHalf: number; leftHalf: number; rightHalf: number;
  } {
    let topCount = 0, bottomCount = 0, leftCount = 0, rightCount = 0;
    let topValid = 0, bottomValid = 0, leftValid = 0, rightValid = 0;

    for (let i = 0; i < NUM_LANDMARKS; i++) {
      const lm = getLandmark(landmarks, i);
      if (!lm) continue;
      const [x, y] = lm;
      const valid = !(Math.abs(x) < this.landmarkThreshold && Math.abs(y) < this.landmarkThreshold);
      if (y < 0.5) { topCount++; if (valid) topValid++; }
      else { bottomCount++; if (valid) bottomValid++; }
      if (x < 0.5) { leftCount++; if (valid) leftValid++; }
      else { rightCount++; if (valid) rightValid++; }
    }

    return {
      topHalf: topCount > 0 ? topValid / topCount : 0,
      bottomHalf: bottomCount > 0 ? bottomValid / bottomCount : 0,
      leftHalf: leftCount > 0 ? leftValid / leftCount : 0,
      rightHalf: rightCount > 0 ? rightValid / rightCount : 0,
    };
  }

  private zeroResult(): IntegrityResult {
    return {
      score: 0,
      wristVisible: false,
      palmIntact: false,
      individualFingers: { thumb: false, index: false, middle: false, ring: false, pinky: false },
      requiredGroups: { drawing: false, cursor: false, eraser: false },
      edgeFlags: { anyEdge: false, leftEdge: false, rightEdge: false, topEdge: false, bottomEdge: false },
      missingLandmarkCount: NUM_LANDMARKS,
    };
  }
}
