import { describe, it, expect } from 'vitest';
import { PredictiveCursor } from '../src/utils/PredictiveCursor';

describe('PredictiveCursor', () => {
  it('should smooth cursor position', () => {
    const pc = new PredictiveCursor({ smoothingFactor: 0.5 });
    const r1 = pc.update(0.5, 0.5, 0);
    expect(r1.x).toBe(0.5);
    expect(r1.y).toBe(0.5);

    const r2 = pc.update(0.6, 0.6, 16);
    expect(r2.x).toBeGreaterThan(0.5);
    expect(r2.x).toBeLessThan(0.6);
  });

  it('should reset state', () => {
    const pc = new PredictiveCursor();
    pc.update(0.5, 0.5, 0);
    pc.update(0.6, 0.5, 16);
    pc.reset();
    const r = pc.update(0.5, 0.5, 32);
    expect(r.x).toBe(0.5);
  });

  it('should provide prediction with motion', () => {
    const pc = new PredictiveCursor({ predictionHorizon: 0.05, smoothingFactor: 0.5 });
    pc.update(0, 0, 0);
    pc.update(0.1, 0, 16);
    pc.update(0.2, 0, 32);

    const r = pc.update(0.35, 0, 48);
    expect(r.predictedX).toBeGreaterThan(r.x);
  });
});
