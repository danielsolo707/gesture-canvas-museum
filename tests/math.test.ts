import { describe, it, expect } from 'vitest';
import { lerp, clamp, distance2D, distance3D, magnitude, normalize, dot } from '../src/utils/math';

describe('math utils', () => {
  it('lerp', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
  });

  it('clamp', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('distance2D', () => {
    expect(distance2D(0, 0, 3, 4)).toBe(5);
    expect(distance2D(0, 0, 0, 0)).toBe(0);
  });

  it('distance3D', () => {
    expect(distance3D(0, 0, 0, 1, 0, 0)).toBe(1);
    expect(distance3D(0, 0, 0, 1, 1, 1)).toBeCloseTo(Math.sqrt(3));
  });

  it('magnitude', () => {
    expect(magnitude(3, 4, 0)).toBe(5);
    expect(magnitude(0, 0, 0)).toBe(0);
  });

  it('normalize', () => {
    const [x, y, z] = normalize(3, 4, 0);
    expect(x).toBeCloseTo(0.6);
    expect(y).toBeCloseTo(0.8);
    expect(z).toBe(0);
  });

  it('dot', () => {
    expect(dot(1, 0, 0, 0, 1, 0)).toBe(0);
    expect(dot(1, 0, 0, 1, 0, 0)).toBe(1);
  });
});
