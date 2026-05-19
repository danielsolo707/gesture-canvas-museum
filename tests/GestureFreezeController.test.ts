import { describe, it, expect, beforeEach } from 'vitest';
import { GestureFreezeController } from '../src/tracking/GestureFreezeController';
import type { IntegrityResult } from '../src/tracking/HandIntegrityValidator';
import type { EdgeProximity } from '../src/tracking/EdgeProximityDetector';

function fullIntegrity(score = 1): IntegrityResult {
  return {
    score,
    wristVisible: true,
    palmIntact: true,
    individualFingers: { thumb: true, index: true, middle: true, ring: true, pinky: true },
    requiredGroups: { drawing: true, cursor: true, eraser: true },
    edgeFlags: { anyEdge: false, leftEdge: false, rightEdge: false, topEdge: false, bottomEdge: false },
    missingLandmarkCount: 0,
  };
}

function lowIntegrity(score = 0.3): IntegrityResult {
  return {
    score,
    wristVisible: false,
    palmIntact: false,
    individualFingers: { thumb: false, index: true, middle: false, ring: false, pinky: false },
    requiredGroups: { drawing: false, cursor: false, eraser: false },
    edgeFlags: { anyEdge: false, leftEdge: false, rightEdge: false, topEdge: false, bottomEdge: false },
    missingLandmarkCount: 12,
  };
}

function edgeProx(overall = 0, dampingFactor = 1): EdgeProximity {
  return { left: 0, right: 0, top: 0, bottom: 0, overall, dampingFactor };
}

describe('GestureFreezeController', () => {
  let fc: GestureFreezeController;

  beforeEach(() => {
    fc = new GestureFreezeController();
  });

  it('starts unfrozen with idle gesture', () => {
    const s = fc.getState();
    expect(s.frozen).toBe(false);
    expect(s.lastStableGesture).toBe('idle');
  });

  it('does not freeze for idle gesture with low integrity', () => {
    const s = fc.update('idle', 0.9, lowIntegrity(), edgeProx(0), 0);
    expect(s.frozen).toBe(false);
  });

  it('freezes active gesture when integrity drops below threshold', () => {
    const s = fc.update('drawing', 0.8, lowIntegrity(), edgeProx(0), 100);
    expect(s.frozen).toBe(true);
    expect(s.lastStableGesture).toBe('drawing');
    expect(s.lastStableConfidence).toBe(0.8);
    expect(s.freezeReason).toBe('low_integrity');
    expect(s.freezeCount).toBe(1);
  });

  it('freezes active gesture when edge proximity is high', () => {
    const s = fc.update('cursor', 0.7, fullIntegrity(), edgeProx(0.8, 0.3), 100);
    expect(s.frozen).toBe(true);
    expect(s.freezeReason).toBe('edge_proximity');
    expect(s.lastStableGesture).toBe('cursor');
  });

  it('remains frozen on consecutive low integrity frames', () => {
    fc.update('drawing', 0.8, lowIntegrity(), edgeProx(0), 100);
    const s = fc.update('idle', 0, lowIntegrity(), edgeProx(0), 150);
    expect(s.frozen).toBe(true);
  });

  it('unfreezes after 3 consecutive high-integrity frames', () => {
    fc.update('drawing', 0.8, lowIntegrity(), edgeProx(0), 100);
    fc.update('idle', 0, lowIntegrity(), edgeProx(0), 150);

    const high = fullIntegrity(0.8);
    const lowEdge = edgeProx(0);
    fc.update('idle', 0, high, lowEdge, 200);
    fc.update('idle', 0, high, lowEdge, 250);
    const s = fc.update('drawing', 0.8, high, lowEdge, 300);
    expect(s.frozen).toBe(false);
    expect(s.unfreezeReason).toBe('tracking_recovered');
  });

  it('does not unfreeze immediately after just 1 good frame', () => {
    fc.update('drawing', 0.8, lowIntegrity(), edgeProx(0), 100);
    const s = fc.update('idle', 0, fullIntegrity(0.8), edgeProx(0), 200);
    expect(s.frozen).toBe(true);
  });

  it('force unfreeze works immediately', () => {
    fc.update('drawing', 0.8, lowIntegrity(), edgeProx(0), 100);
    fc.forceUnfreeze('test');
    expect(fc.isFrozen()).toBe(false);
    expect(fc.getState().unfreezeReason).toBe('test');
  });

  it('auto-unfreezes after max freeze duration', () => {
    fc.update('drawing', 0.8, lowIntegrity(), edgeProx(0), 0);
    const s = fc.update('idle', 0, lowIntegrity(), edgeProx(0), 500);
    expect(s.frozen).toBe(false);
    expect(s.unfreezeReason).toBe('max_duration');
  });

  it('getBlendFactor returns 0 when frozen', () => {
    fc.update('drawing', 0.8, lowIntegrity(), edgeProx(0), 100);
    expect(fc.getBlendFactor()).toBe(0);
  });

  it('getBlendFactor returns 1 when not frozen', () => {
    expect(fc.getBlendFactor()).toBe(1);
  });

  it('advanceUnfreezeBlend progresses blend after unfreeze', () => {
    fc.update('drawing', 0.8, lowIntegrity(), edgeProx(0), 100);
    const high = fullIntegrity(0.8);
    fc.update('idle', 0, high, edgeProx(0), 200);
    fc.update('idle', 0, high, edgeProx(0), 250);
    fc.update('idle', 0, high, edgeProx(0), 300);

    expect(fc.getBlendFactor()).toBeLessThan(1);
    fc.advanceUnfreezeBlend();
    expect(fc.getState().blendProgress).toBeGreaterThan(0);
    expect(fc.getBlendFactor()).toBeGreaterThan(0);
  });

  it('reset clears all state', () => {
    fc.update('drawing', 0.8, lowIntegrity(), edgeProx(0), 100);
    fc.reset();
    const s = fc.getState();
    expect(s.frozen).toBe(false);
    expect(s.lastStableGesture).toBe('idle');
    expect(s.freezeCount).toBe(0);
  });

  it('getLastStableGesture returns last frozen gesture', () => {
    fc.update('drawing', 0.8, lowIntegrity(), edgeProx(0), 100);
    expect(fc.getLastStableGesture()).toBe('drawing');
  });
});
