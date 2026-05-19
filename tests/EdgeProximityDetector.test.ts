import { describe, it, expect } from 'vitest';
import { EdgeProximityDetector } from '../src/tracking/EdgeProximityDetector';

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

describe('EdgeProximityDetector', () => {
  it('returns damping factor 1 for null landmarks', () => {
    const d = new EdgeProximityDetector();
    const r = d.compute(null);
    expect(r.dampingFactor).toBe(1);
    expect(r.overall).toBe(0);
  });

  it('returns damping factor 1 for empty landmarks', () => {
    const d = new EdgeProximityDetector();
    const r = d.compute(new Float32Array(0));
    expect(r.dampingFactor).toBe(1);
  });

  it('returns damping factor 1 for hand in center', () => {
    const coords: [number, number, number][] = Array.from({ length: 21 }, () => [0.5, 0.5, 0]);
    const r = new EdgeProximityDetector().compute(makeLandmarks(coords));
    expect(r.overall).toBe(0);
    expect(r.dampingFactor).toBe(1);
  });

  it('reduces damping when hand is at left edge', () => {
    const coords: [number, number, number][] = [];
    for (let i = 0; i < 21; i++) {
      coords.push([0.02, 0.5, 0]);
    }
    const r = new EdgeProximityDetector().compute(makeLandmarks(coords));
    expect(r.left).toBeGreaterThan(0);
    expect(r.overall).toBeGreaterThan(0);
    expect(r.dampingFactor).toBeLessThan(1);
  });

  it('returns minimal damping at extreme left edge', () => {
    const coords: [number, number, number][] = [];
    for (let i = 0; i < 21; i++) {
      coords.push([0.001, 0.5, 0]);
    }
    const r = new EdgeProximityDetector().compute(makeLandmarks(coords));
    expect(r.dampingFactor).toBeCloseTo(0.2, 1);
  });

  it('reduces damping when hand is at right edge', () => {
    const coords: [number, number, number][] = [];
    for (let i = 0; i < 21; i++) {
      coords.push([0.98, 0.5, 0]);
    }
    const r = new EdgeProximityDetector().compute(makeLandmarks(coords));
    expect(r.right).toBeGreaterThan(0);
    expect(r.overall).toBeGreaterThan(0);
    expect(r.dampingFactor).toBeLessThan(1);
  });

  it('reduces damping when hand is at top edge', () => {
    const coords: [number, number, number][] = [];
    for (let i = 0; i < 21; i++) {
      coords.push([0.5, 0.02, 0]);
    }
    const r = new EdgeProximityDetector().compute(makeLandmarks(coords));
    expect(r.top).toBeGreaterThan(0);
    expect(r.overall).toBeGreaterThan(0);
    expect(r.dampingFactor).toBeLessThan(1);
  });

  it('reduces damping when hand is at bottom edge', () => {
    const coords: [number, number, number][] = [];
    for (let i = 0; i < 21; i++) {
      coords.push([0.5, 0.98, 0]);
    }
    const r = new EdgeProximityDetector().compute(makeLandmarks(coords));
    expect(r.bottom).toBeGreaterThan(0);
    expect(r.overall).toBeGreaterThan(0);
    expect(r.dampingFactor).toBeLessThan(1);
  });

  it('returns damping factor 1 when too few valid landmarks', () => {
    const coords: [number, number, number][] = [];
    for (let i = 0; i < 21; i++) {
      coords.push(i < 2 ? [0.02, 0.5, 0] : [0, 0, 0]);
    }
    const r = new EdgeProximityDetector().compute(makeLandmarks(coords));
    expect(r.dampingFactor).toBe(1);
  });

  it('getNearestEdge returns correct edge', () => {
    const d = new EdgeProximityDetector();
    const prox = { left: 0.8, right: 0, top: 0, bottom: 0, overall: 0.8, dampingFactor: 0.3 };
    expect(d.getNearestEdge(prox)).toBe('left');
  });

  it('getNearestEdge returns none when all below threshold', () => {
    const d = new EdgeProximityDetector();
    const prox = { left: 0.05, right: 0.03, top: 0.02, bottom: 0.04, overall: 0.05, dampingFactor: 1 };
    expect(d.getNearestEdge(prox)).toBe('none');
  });
});
