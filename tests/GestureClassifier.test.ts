import { describe, it, expect, beforeEach } from 'vitest';
import { GestureClassifier } from '../src/model/GestureClassifier';
import type { HandFeatures } from '../src/features/types';
import type { HandIntegrity } from '../src/core/types';
import type { EdgeProximityInfo } from '../src/core/types';
import type { GestureFreezeState } from '../src/core/types';

function makeFeatures(index: number, thumb: number, middle: number, ring: number, pinky: number): HandFeatures {
  return {
    fingerAngles: { thumb, index, middle, ring, pinky },
    fingerOpenness: { thumb, index, middle, ring, pinky },
    interFingerDistances: [0.1, 0.1, 0.1, 0.1, 0.1],
    palmOrientation: [0, 0, 1],
    fingertipVelocity: [0, 0, 0],
    fingertipAcceleration: [0, 0, 0],
    motionDirection: [0, 0, 0],
    speed: 0,
    handConfidence: 1,
    handScale: 1,
  };
}

const fullIntegrity: HandIntegrity = {
  score: 1,
  wristVisible: true,
  palmIntact: true,
  individualFingers: { thumb: true, index: true, middle: true, ring: true, pinky: true },
  requiredGroups: { drawing: true, cursor: true, eraser: true },
  edgeFlags: { anyEdge: false, leftEdge: false, rightEdge: false, topEdge: false, bottomEdge: false },
  missingLandmarkCount: 0,
};

const noEdge: EdgeProximityInfo = {
  left: 0, right: 0, top: 0, bottom: 0,
  overall: 0, dampingFactor: 1,
  nearestEdge: 'none' as const,
};

const noFreeze: GestureFreezeState = {
  frozen: false, lastStableGesture: 'idle', lastStableConfidence: 0,
  freezeStartTime: 0, freezeDurationMs: 0, freezeCount: 0,
  blendProgress: 1, unfreezeReason: '', freezeReason: '',
};

describe('GestureClassifier.edgeAwareHeuristicDetect', () => {
  let classifier: GestureClassifier;

  beforeEach(() => {
    classifier = new GestureClassifier();
    classifier.initialize();
  });

  it('returns drawing when index is dominant and others are curled', () => {
    const features = makeFeatures(0.5, 0.1, 0.1, 0.1, 0.1);
    const result = classifier.edgeAwareHeuristicDetect(features, 0, fullIntegrity, noEdge, noFreeze);
    expect(result).toBe('drawing');
  });

  it('returns cursor when index and middle are extended', () => {
    const features = makeFeatures(0.45, 0.1, 0.45, 0.1, 0.1);
    const result = classifier.edgeAwareHeuristicDetect(features, 0, fullIntegrity, noEdge, noFreeze);
    expect(result).toBe('cursor');
  });

  it('returns eraser when all fingers are open', () => {
    const features = makeFeatures(0.5, 0.5, 0.5, 0.5, 0.5);
    const result = classifier.edgeAwareHeuristicDetect(features, 0, fullIntegrity, noEdge, noFreeze);
    expect(result).toBe('eraser');
  });

  it('returns null when integrity score is below 0.4', () => {
    const lowIntegrity: HandIntegrity = { ...fullIntegrity, score: 0.3 };
    const features = makeFeatures(0.5, 0.1, 0.1, 0.1, 0.1);
    const result = classifier.edgeAwareHeuristicDetect(features, 0, lowIntegrity, noEdge, noFreeze);
    expect(result).toBeNull();
  });

  it('returns null when frozen', () => {
    const frozen: GestureFreezeState = { ...noFreeze, frozen: true, lastStableGesture: 'drawing' };
    const features = makeFeatures(0.5, 0.1, 0.1, 0.1, 0.1);
    const result = classifier.edgeAwareHeuristicDetect(features, 0, fullIntegrity, noEdge, frozen);
    expect(result).toBeNull();
  });

  it('returns null when all fingers curled', () => {
    const features = makeFeatures(0.05, 0.05, 0.05, 0.05, 0.05);
    const result = classifier.edgeAwareHeuristicDetect(features, 0, fullIntegrity, noEdge, noFreeze);
    expect(result).toBeNull();
  });

  it('edge damping raises thresholds: drawing not detected at borderline openness with low damping', () => {
    const edgeDamped: EdgeProximityInfo = { ...noEdge, dampingFactor: 0.2, overall: 0.8, nearestEdge: 'left' };
    const features = makeFeatures(0.4, 0.15, 0.15, 0.15, 0.15);
    const noDamping: EdgeProximityInfo = { ...noEdge, dampingFactor: 1, overall: 0 };
    const resultWithDamping = classifier.edgeAwareHeuristicDetect(features, 0, fullIntegrity, edgeDamped, noFreeze);
    const resultWithoutDamping = classifier.edgeAwareHeuristicDetect(features, 0, fullIntegrity, noDamping, noFreeze);
    expect(resultWithDamping).toBeNull();
    expect(resultWithoutDamping).toBe('drawing');
  });

  it('cursor not detected when index and middle are not dominant enough', () => {
    const features = makeFeatures(0.05, 0.1, 0.05, 0.5, 0.5);
    const result = classifier.edgeAwareHeuristicDetect(features, 0, fullIntegrity, noEdge, noFreeze);
    expect(result).toBeNull();
  });

  it('drawing is detected even without integrity object (null check)', () => {
    const features = makeFeatures(0.5, 0.1, 0.1, 0.1, 0.1);
    const result = classifier.edgeAwareHeuristicDetect(features, 0, null, noEdge, noFreeze);
    expect(result).toBe('drawing');
  });

  it('cursor is detected even without integrity object', () => {
    const features = makeFeatures(0.45, 0.1, 0.45, 0.1, 0.1);
    const result = classifier.edgeAwareHeuristicDetect(features, 0, null, noEdge, noFreeze);
    expect(result).toBe('cursor');
  });

  it('eraser is detected even without integrity object', () => {
    const features = makeFeatures(0.5, 0.5, 0.5, 0.5, 0.5);
    const result = classifier.edgeAwareHeuristicDetect(features, 0, null, noEdge, noFreeze);
    expect(result).toBe('eraser');
  });

  it('drawing blocked when required group is false', () => {
    const noDrawingIntegrity: HandIntegrity = {
      ...fullIntegrity,
      requiredGroups: { drawing: false, cursor: true, eraser: true },
    };
    const features = makeFeatures(0.5, 0.1, 0.1, 0.1, 0.1);
    const result = classifier.edgeAwareHeuristicDetect(features, 0, noDrawingIntegrity, noEdge, noFreeze);
    expect(result).toBeNull();
  });

  it('cursor blocked when required group is false', () => {
    const noCursorIntegrity: HandIntegrity = {
      ...fullIntegrity,
      requiredGroups: { drawing: true, cursor: false, eraser: true },
    };
    const features = makeFeatures(0.45, 0.1, 0.45, 0.1, 0.1);
    const result = classifier.edgeAwareHeuristicDetect(features, 0, noCursorIntegrity, noEdge, noFreeze);
    expect(result).toBeNull();
  });

  it('eraser blocked when required group is false', () => {
    const noEraserIntegrity: HandIntegrity = {
      ...fullIntegrity,
      requiredGroups: { drawing: true, cursor: true, eraser: false },
    };
    const features = makeFeatures(0.5, 0.5, 0.5, 0.5, 0.5);
    const result = classifier.edgeAwareHeuristicDetect(features, 0, noEraserIntegrity, noEdge, noFreeze);
    expect(result).toBeNull();
  });
});
