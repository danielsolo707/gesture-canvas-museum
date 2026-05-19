import { describe, it, expect } from 'vitest';
import { HandIntegrityValidator } from '../src/tracking/HandIntegrityValidator';

function makeLandmarks(coords: [number, number, number][]): Float32Array {
  const arr = new Float32Array(63);
  for (let i = 0; i < 21; i++) {
    const c = coords[i] ?? [0.5, 0.5, 0];
    arr[i * 3] = c[0];
    arr[i * 3 + 1] = c[1];
    arr[i * 3 + 2] = c[2];
  }
  return arr;
}

function fullHand(): Float32Array {
  const coords: [number, number, number][] = [];
  for (let i = 0; i < 21; i++) {
    coords.push([0.3 + i * 0.02, 0.3 + (i % 5) * 0.04, 0]);
  }
  return makeLandmarks(coords);
}

describe('HandIntegrityValidator', () => {
  it('returns zero score for null landmarks', () => {
    const v = new HandIntegrityValidator();
    const r = v.validate(null);
    expect(r.score).toBe(0);
    expect(r.missingLandmarkCount).toBe(21);
    expect(r.wristVisible).toBe(false);
    expect(r.palmIntact).toBe(false);
  });

  it('returns zero score for empty landmarks', () => {
    const v = new HandIntegrityValidator();
    const r = v.validate(new Float32Array(0));
    expect(r.score).toBe(0);
    expect(r.missingLandmarkCount).toBe(21);
  });

  it('returns high score for complete hand in center', () => {
    const v = new HandIntegrityValidator();
    const r = v.validate(fullHand());
    expect(r.score).toBeGreaterThanOrEqual(0.8);
    expect(r.wristVisible).toBe(true);
    expect(r.palmIntact).toBe(true);
    expect(r.individualFingers.thumb).toBe(true);
    expect(r.individualFingers.index).toBe(true);
    expect(r.individualFingers.middle).toBe(true);
    expect(r.individualFingers.ring).toBe(true);
    expect(r.individualFingers.pinky).toBe(true);
    expect(r.requiredGroups.drawing).toBe(true);
    expect(r.requiredGroups.cursor).toBe(true);
    expect(r.requiredGroups.eraser).toBe(true);
    expect(r.missingLandmarkCount).toBe(0);
  });

  it('detects missing thumb as incomplete', () => {
    const coords: [number, number, number][] = [];
    for (let i = 0; i < 21; i++) {
      if (i === 4) {
        coords.push([0.0005, 0.0005, 0]);
      } else {
        coords.push([0.3 + i * 0.02, 0.3 + (i % 5) * 0.04, 0]);
      }
    }
    const r = new HandIntegrityValidator().validate(makeLandmarks(coords));
    expect(r.individualFingers.thumb).toBe(false);
    expect(r.requiredGroups.eraser).toBe(false);
    expect(r.score).toBeLessThan(0.9);
  });

  it('flags drawing group as usable when wrist+index+indexMcp present, but not cursor', () => {
    const coords: [number, number, number][] = Array.from({ length: 21 }, () => [0.0005, 0.0005, 0]);
    coords[0] = [0.5, 0.5, 0];
    coords[5] = [0.5, 0.4, 0];
    coords[6] = [0.52, 0.38, 0];
    coords[7] = [0.52, 0.34, 0];
    coords[8] = [0.54, 0.32, 0];
    const r = new HandIntegrityValidator().validate(makeLandmarks(coords));
    expect(r.wristVisible).toBe(true);
    expect(r.individualFingers.index).toBe(true);
    expect(r.requiredGroups.drawing).toBe(true);
    expect(r.requiredGroups.cursor).toBe(false);
    expect(r.requiredGroups.eraser).toBe(false);
  });

  it('detects landmarks at viewport edge', () => {
    const coords: [number, number, number][] = [];
    for (let i = 0; i < 21; i++) {
      coords.push([0.01, 0.5, 0]);
    }
    const r = new HandIntegrityValidator().validate(makeLandmarks(coords));
    expect(r.edgeFlags.leftEdge).toBe(true);
    expect(r.edgeFlags.anyEdge).toBe(true);
  });

  it('detects landmarks at top edge', () => {
    const coords: [number, number, number][] = [];
    for (let i = 0; i < 21; i++) {
      coords.push([0.5, 0.01, 0]);
    }
    const r = new HandIntegrityValidator().validate(makeLandmarks(coords));
    expect(r.edgeFlags.topEdge).toBe(true);
    expect(r.edgeFlags.anyEdge).toBe(true);
  });

  it('detects landmarks at bottom edge', () => {
    const coords: [number, number, number][] = [];
    for (let i = 0; i < 21; i++) {
      coords.push([0.5, 0.98, 0]);
    }
    const r = new HandIntegrityValidator().validate(makeLandmarks(coords));
    expect(r.edgeFlags.bottomEdge).toBe(true);
  });

  it('detects landmarks at right edge', () => {
    const coords: [number, number, number][] = [];
    for (let i = 0; i < 21; i++) {
      coords.push([0.98, 0.5, 0]);
    }
    const r = new HandIntegrityValidator().validate(makeLandmarks(coords));
    expect(r.edgeFlags.rightEdge).toBe(true);
  });
});
