import { describe, it, expect } from 'vitest';
import { SafeInteractionZoneMapper } from '../src/tracking/SafeInteractionZoneMapper';

describe('SafeInteractionZoneMapper', () => {
  it('passes through coordinates within safe zone unchanged', () => {
    const m = new SafeInteractionZoneMapper();
    const r = m.map(0.5, 0.5);
    expect(r.stabilizedX).toBeCloseTo(0.5);
    expect(r.stabilizedY).toBeCloseTo(0.5);
    expect(r.isInSafeZone).toBe(true);
    expect(r.dampingApplied).toBe(false);
  });

  it('compresses coordinates near the left edge toward origin', () => {
    const m = new SafeInteractionZoneMapper();
    const r = m.map(0.05, 0.5);
    expect(r.stabilizedX).toBeLessThanOrEqual(0.05);
    expect(r.dampingApplied).toBe(true);
    expect(r.isInSafeZone).toBe(false);
  });

  it('compresses coordinates near the right edge', () => {
    const m = new SafeInteractionZoneMapper();
    const r = m.map(0.95, 0.5);
    expect(r.stabilizedX).toBeLessThanOrEqual(0.95);
    expect(r.stabilizedX).toBeGreaterThanOrEqual(0.85);
    expect(r.dampingApplied).toBe(true);
  });

  it('compresses coordinates near the top edge toward origin', () => {
    const m = new SafeInteractionZoneMapper();
    const r = m.map(0.5, 0.05);
    expect(r.stabilizedY).toBeLessThanOrEqual(0.05);
    expect(r.dampingApplied).toBe(true);
  });

  it('provides extra compression near the bottom edge', () => {
    const m = new SafeInteractionZoneMapper();
    const r = m.map(0.5, 0.95);
    expect(r.stabilizedY).toBeLessThanOrEqual(0.95);
    expect(r.stabilizedY).toBeGreaterThanOrEqual(0.85);
    expect(r.dampingApplied).toBe(true);
  });

  it('clamps out-of-range coordinates to [0, 1]', () => {
    const m = new SafeInteractionZoneMapper();
    const r = m.map(-0.1, 1.2);
    expect(r.stabilizedX).toBe(0);
    expect(r.stabilizedY).toBe(1);
    expect(r.isInSafeZone).toBe(false);
  });

  it('returns raw values in result', () => {
    const m = new SafeInteractionZoneMapper();
    const r = m.map(0.05, 0.95);
    expect(r.rawX).toBe(0.05);
    expect(r.rawY).toBe(0.95);
  });

  it('handles custom safe zone boundaries', () => {
    const m = new SafeInteractionZoneMapper({
      innerXMin: 0,
      innerXMax: 1,
      innerYMin: 0,
      innerYMax: 1,
      compressionStrength: 0,
      bottomCompression: 0,
    });
    const r = m.map(0.1, 0.9);
    expect(r.stabilizedX).toBe(0.1);
    expect(r.stabilizedY).toBe(0.9);
    expect(r.isInSafeZone).toBe(true);
    expect(r.dampingApplied).toBe(false);
  });

  it('a point just inside safe zone is not damped', () => {
    const m = new SafeInteractionZoneMapper();
    const r = m.map(0.16, 0.5);
    expect(r.stabilizedX).toBeCloseTo(0.16);
    expect(r.dampingApplied).toBe(false);
  });

  it('maps a point exactly at 0 to 0', () => {
    const m = new SafeInteractionZoneMapper();
    const r = m.map(0, 0.5);
    expect(r.stabilizedX).toBe(0);
    expect(r.stabilizedY).toBeCloseTo(0.5);
  });

  it('maps a point exactly at 1 to 1', () => {
    const m = new SafeInteractionZoneMapper();
    const r = m.map(1, 0.5);
    expect(r.stabilizedX).toBe(1);
    expect(r.stabilizedY).toBeCloseTo(0.5);
  });
});
