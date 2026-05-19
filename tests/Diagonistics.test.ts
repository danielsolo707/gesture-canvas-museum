import { describe, it, expect } from 'vitest';
import { Diagnostics } from '../src/utils/Diagnostics';

describe('Diagnostics', () => {
  it('should record frames and compute average fps', () => {
    const diag = new Diagnostics();
    const stats = {
      fps: 60, inferenceMs: 10, gestureMs: 5, drawMs: 3, renderMs: 8,
      activeHands: 1, strokeCount: 5, mode: 'camera' as const,
      motionSpeed: 0.02, pipelineLatencyMs: 20,
      trackingStability: 0.9, intentConfidence: 0.7,
    };

    for (let i = 0; i < 10; i++) {
      diag.recordFrame(stats, i * 16);
    }

    expect(diag.getAverageFps()).toBeCloseTo(60, 0);
    expect(diag.getTotalFrames()).toBe(10);
  });

  it('should reset properly', () => {
    const diag = new Diagnostics();
    const stats = {
      fps: 30, inferenceMs: 10, gestureMs: 5, drawMs: 3, renderMs: 8,
      activeHands: 0, strokeCount: 0, mode: 'camera' as const,
      motionSpeed: 0, pipelineLatencyMs: 0,
      trackingStability: 1, intentConfidence: 0,
    };

    diag.recordFrame(stats, 0);
    diag.reset();
    expect(diag.getTotalFrames()).toBe(0);
    expect(diag.getAverageFps()).toBe(0);
  });
});
